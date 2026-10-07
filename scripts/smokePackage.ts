/**
 * Package Smoke Test (npm run smoke:package)
 * Verifies that the offline release package works completely standalone without dev tooling or source files.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import { spawn, execSync } from 'child_process';
import { verifyPackageArchive } from './verifyPackage.js';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHttp(url: string, headers: Record<string, string> = {}): Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode || 0, body: data, headers: res.headers }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });
}

async function runSmokeTest(): Promise<void> {
  console.log('======================================================================');
  console.log('🧪 بدء اختبار الجاهزية الميدانية الشامل للحزمة (Package Smoke Test)');
  console.log('======================================================================');

  const rootDir = process.cwd();

  // 1. Build offline package
  console.log('1️⃣  جاري بناء حزمة التثبيت دون اتصال...');
  execSync('npm run package:offline', { stdio: 'inherit', cwd: rootDir });

  // 2. Find release archive
  const releaseDir = path.join(rootDir, 'release');
  const archives = fs.readdirSync(releaseDir).filter((f) => f.endsWith('.tar.gz') || f.endsWith('.zip'));
  if (archives.length === 0) {
    throw new Error('لم يتم العثور على أي ملف أرشيف في دليل release/');
  }
  const archivePath = path.join(releaseDir, archives[0]);
  console.log(`2️⃣  تم العثور على الأرشيف: ${archivePath}`);

  // 3. Verify archive cryptographic manifest & security rules
  console.log('3️⃣  جاري التحقق الرقمي والتشفيري من الأرشيف...');
  await verifyPackageArchive(archivePath);

  // 4. Extract package into sandbox
  const smokeSandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke-pkg-'));
  let serverProcess: ReturnType<typeof spawn> | undefined;

  try {
    console.log(`4️⃣  جاري فك ضغط الحزمة في بيئة معزولة: ${smokeSandbox}`);
    if (archivePath.endsWith('.zip')) {
      execSync(`powershell -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${smokeSandbox}' -Force"`, { stdio: 'pipe' });
    } else {
      execSync(`tar -xzf "${archivePath}" -C "${smokeSandbox}"`, { stdio: 'pipe' });
    }

    // 5. Verify NO dev tooling in node_modules
    console.log('5️⃣  التحقق الصارم من خلو الحزمة من أدوات التطوير (No Dev Tooling in Production)...');
    const binDir = path.join(smokeSandbox, 'node_modules', '.bin');
    if (fs.existsSync(binDir)) {
      const bins = fs.readdirSync(binDir);
      const prohibited = ['tsx', 'vite', 'esbuild', 'tsc', 'typescript', 'vitest', 'supertest'];
      for (const b of bins) {
        if (prohibited.includes(b)) {
          throw new Error(`Security Failure: Found prohibited dev tool ${b} in extracted production package node_modules/.bin`);
        }
      }
      console.log(`   ✅ تم التحقق من .bin: لا توجد أدوات تطوير (${bins.join(', ') || 'فارغ'})`);
    }

    // Verify NO typescript source files
    function assertNoTs(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== 'node_modules') {
          assertNoTs(full);
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          throw new Error(`Security Failure: Found TypeScript source file in production package: ${full}`);
        }
      }
    }
    assertNoTs(smokeSandbox);
    console.log('   ✅ تم التحقق: لا توجد أي ملفات شفرة مصدرية غير مترجمة (.ts / .tsx).');

    // 6. Start production server inside extracted package
    const testPort = 3389 + Math.floor(Math.random() * 500);
    const testDataDir = path.join(smokeSandbox, 'data');
    const testBackupDir = path.join(smokeSandbox, 'var', 'backups');
    fs.mkdirSync(testDataDir, { recursive: true });
    fs.mkdirSync(testBackupDir, { recursive: true });

    const env = {
      ...process.env,
      PORT: String(testPort),
      APP_PORT: String(testPort),
      NODE_ENV: 'production',
      DATA_DIR: testDataDir,
      BACKUP_DIR: testBackupDir,
      COOKIE_SECURE: 'false'
    };

    console.log(`6️⃣  جاري تشغيل خادم الإنتاج المعزول: node dist-server/server.js (المنفذ: ${testPort})...`);
    serverProcess = spawn('node', ['dist-server/server.js'], {
      cwd: smokeSandbox,
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let serverOutput = '';
    serverProcess.stdout?.on('data', (d) => (serverOutput += d.toString()));
    serverProcess.stderr?.on('data', (d) => (serverOutput += d.toString()));
    // Wait for server to become healthy
    let isHealthy = false;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        const res = await fetchHttp(`http://127.0.0.1:${testPort}/api/health`);
        if (res.status === 200) {
          isHealthy = true;
          break;
        }
      } catch {}
    }

    if (!isHealthy) {
      console.error('Server output:\n', serverOutput);
      throw new Error(`خادم الإنتاج لم يستجب على http://127.0.0.1:${testPort}/api/health`);
    }
    console.log('   ✅ خادم الإنتاج يعمل بنجاح (HTTP 200 on /api/health).');

    // 7. Verify frontend SPA delivery
    const rootRes = await fetchHttp(`http://127.0.0.1:${testPort}/`);
    if (rootRes.status !== 200 || !rootRes.body.includes('id="root"')) {
      throw new Error('فشل تقديم الصفحة الرئيسية dist/index.html من خادم الإنتاج');
    }
    console.log('   ✅ تم التحقق من تقديم واجهة المستخدم React SPA بنجاح (HTTP 200).');

    // Create a record in database to verify write capability
    const dbPath = path.join(testDataDir, 'app.db');
    if (fs.existsSync(dbPath)) {
      const Database = (await import('better-sqlite3')).default;
      const db = new Database(dbPath);
      const testId = `smoke-${Date.now()}`;
      db.prepare("INSERT INTO contacts (id, name, entity, position, phone, email, category, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
        testId,
        'قيد اختبار الجاهزية الميدانية',
        'الهيئة القومية للبريد',
        'مسؤول النظم',
        '01000000000',
        'sysadmin@post.eg',
        'official',
        new Date().toISOString()
      );
      const row = db.prepare("SELECT * FROM contacts WHERE id = ?").get(testId) as any;
      if (!row || row.name !== 'قيد اختبار الجاهزية الميدانية') {
        throw new Error('فشل إنشاء والتحقق من القيد الجديد في قاعدة البيانات');
      }
      db.close();
      console.log('   ✅ تم إنشاء والتحقق من إضافة قيد جديد في قاعدة البيانات.');
    }

    // 8. Test backup tool execution from inside the extracted package
    const testPassphrase = 'SmokeTestStrongPassphrase1234!';
    console.log('7️⃣  اختبار أداة النسخ الاحتياطي المشفر من داخل الحزمة (node dist-server/backup.js)...');
    execSync('node dist-server/backup.js', {
      cwd: smokeSandbox,
      env: { ...env, BACKUP_PASSPHRASE: testPassphrase },
      stdio: 'inherit'
    });

    const backupFiles = fs.readdirSync(testBackupDir).filter((f) => f.startsWith('backup-') && f.endsWith('.enc'));
    if (backupFiles.length === 0) {
      throw new Error('لم يتم العثور على ملف النسخة الاحتياطية المشفرة المنشأة!');
    }
    const createdBackupFile = path.join(testBackupDir, backupFiles[0]);
    console.log(`   ✅ تم إنشاء النسخة الاحتياطية بنجاح: ${createdBackupFile}`);

    // 9. Test backup:verify command
    console.log('8️⃣  اختبار التحقق من النسخة الاحتياطية (node dist-server/backup.js --verify)...');
    execSync(`node dist-server/backup.js --verify "${createdBackupFile}"`, {
      cwd: smokeSandbox,
      env: { ...env, BACKUP_PASSPHRASE: testPassphrase },
      stdio: 'inherit'
    });
    console.log('   ✅ تم التحقق التشفيري والهيكلي من ملف النسخة الاحتياطية بنجاح.');

    // 10. Test backup:restore-test command
    console.log('9️⃣  اختبار الاسترجاع التجريبي المعزول (node dist-server/backup.js --restore-test)...');
    execSync(`node dist-server/backup.js --restore-test "${createdBackupFile}"`, {
      cwd: smokeSandbox,
      env: { ...env, BACKUP_PASSPHRASE: testPassphrase },
      stdio: 'inherit'
    });
    console.log('   ✅ نجح اختبار الاسترجاع التجريبي في البيئة المعزولة.');

    // 11. Test BACKUP_PASSPHRASE_FILE support with 0600 file
    console.log('🔟 اختبار تمرير كلمة المرور عبر ملف آمن (BACKUP_PASSPHRASE_FILE 0600)...');
    const secretFile = path.join(smokeSandbox, '.backup_secret');
    fs.writeFileSync(secretFile, testPassphrase + '\n', { mode: 0o600 });
    execSync('node dist-server/backup.js', {
      cwd: smokeSandbox,
      env: { ...env, BACKUP_PASSPHRASE: undefined, BACKUP_PASSPHRASE_FILE: secretFile },
      stdio: 'inherit'
    });
    console.log('   ✅ تم إنشاء نسخة احتياطية بنجاح باستخدام BACKUP_PASSPHRASE_FILE.');

    console.log('======================================================================');
    console.log('🎉 نجح اختبار الجاهزية الميدانية الشامل للحزمة (Smoke Test Passed 100%)');
    console.log('======================================================================');
  } finally {
    // Stop server
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      await sleep(500);
      try { serverProcess.kill('SIGKILL'); } catch {}
    }

    if (fs.existsSync(smokeSandbox)) {
      try {
        fs.rmSync(smokeSandbox, { recursive: true, force: true });
      } catch {}
    }
  }
}

runSmokeTest().catch((err) => {
  console.error('❌ فشل اختبار الجاهزية الميدانية للحزمة:', err);
  process.exit(1);
});
