/**
 * Offline Package Builder for Executive Office Portal
 * Produces an air-gapped production package with prebuilt native binaries, compiled server, and cryptographic MANIFEST.json.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

function calculateFileSha256(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function getAllFiles(dir: string, baseDir: string = dir): string[] {
  let results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

function copyDirRecursive(src: string, dest: string, filter?: (relPath: string) => boolean): void {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (filter && !filter(entry.name)) continue;

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath, filter);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function buildOfflinePackage(): Promise<void> {
  console.log('======================================================================');
  console.log('📦 بدء بناء حزمة التثبيت دون اتصال (Offline Package Builder)');
  console.log('======================================================================');

  const rootDir = process.cwd();
  const pkgJsonPath = path.join(rootDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

  const platform = process.platform;
  const arch = process.arch;
  const nodeMajor = process.versions.node.split('.')[0];
  const version = pkg.version || '1.0.0';
  const isWindows = platform === 'win32';
  const ext = isWindows ? 'zip' : 'tar.gz';

  const archiveName = `executive-office-portal-${version}-${platform}-${arch}-node${nodeMajor}.${ext}`;
  const releaseDir = path.join(rootDir, 'release');
  const stageDir = path.join(releaseDir, '.stage');
  const archivePath = path.join(releaseDir, archiveName);
  const checksumPath = path.join(releaseDir, `${archiveName}.sha256`);

  console.log(`📌 اسم الحزمة المستهدفة: ${archiveName}`);
  console.log(`📌 نظام التشغيل: ${platform} | المعمارية: ${arch} | إصدار Node.js: v${process.versions.node}`);

  // 1. Build frontend and compiled server
  console.log('🔨 جاري تجميع الواجهة الأمامية وخادم الإنتاج (Building dist & dist-server)...');
  execSync('npm run build', { stdio: 'inherit', cwd: rootDir });

  // 2. Prepare staging directory
  if (fs.existsSync(stageDir)) {
    fs.rmSync(stageDir, { recursive: true, force: true });
  }
  fs.mkdirSync(stageDir, { recursive: true });

  // 3. Copy application components to staging
  console.log('📂 جاري نسخ ملفات التطبيق المصرح بها إلى دليل التجهيز...');

  // Copy dist (skip sourcemaps)
  copyDirRecursive(path.join(rootDir, 'dist'), path.join(stageDir, 'dist'), (name) => !name.endsWith('.map'));

  // Copy dist-server (skip sourcemaps)
  copyDirRecursive(path.join(rootDir, 'dist-server'), path.join(stageDir, 'dist-server'), (name) => !name.endsWith('.map'));

  // Copy docs
  if (fs.existsSync(path.join(rootDir, 'docs'))) {
    copyDirRecursive(path.join(rootDir, 'docs'), path.join(stageDir, 'docs'));
  }

  // Copy package configurations
  fs.copyFileSync(path.join(rootDir, 'package.json'), path.join(stageDir, 'package.json'));
  fs.copyFileSync(path.join(rootDir, 'package-lock.json'), path.join(stageDir, 'package-lock.json'));
  fs.copyFileSync(path.join(rootDir, '.npmrc'), path.join(stageDir, '.npmrc'));
  if (fs.existsSync(path.join(rootDir, '.env.example'))) {
    fs.copyFileSync(path.join(rootDir, '.env.example'), path.join(stageDir, '.env.example'));
  }
  if (fs.existsSync(path.join(rootDir, 'PRODUCTION_DEPLOYMENT.md'))) {
    fs.copyFileSync(path.join(rootDir, 'PRODUCTION_DEPLOYMENT.md'), path.join(stageDir, 'PRODUCTION_DEPLOYMENT.md'));
  }
  if (fs.existsSync(path.join(rootDir, 'README.md'))) {
    fs.copyFileSync(path.join(rootDir, 'README.md'), path.join(stageDir, 'README.md'));
  }

  // 4. Install production dependencies with --omit=dev --ignore-scripts in stage directory
  console.log('📥 جاري تثبيت حزم الإنتاج الصافية (npm ci --omit=dev --ignore-scripts)...');
  execSync('npm ci --omit=dev --ignore-scripts', { stdio: 'inherit', cwd: stageDir });

  // Clean out any leftover .map files anywhere in stageDir
  for (const f of getAllFiles(stageDir)) {
    if (f.endsWith('.map')) {
      try { fs.unlinkSync(f); } catch {}
    }
  }

  // 5. Security audit & exclusion verification
  console.log('🔒 فحص خلو الحزمة من أي ملفات حساسة أو بيانات تشغيل أو أدوات تطوير...');
  const allStaged = getAllFiles(stageDir);
  for (const f of allStaged) {
    const rel = path.relative(stageDir, f);
    if (!rel.startsWith('node_modules/') && !rel.startsWith('node_modules\\') && (rel.endsWith('.ts') || rel.endsWith('.tsx'))) {
      throw new Error(`Security Violation: Found TypeScript source file in production package: ${rel}`);
    }

    if (rel === '.env' || (rel.startsWith('.env.') && rel !== '.env.example')) {
      throw new Error(`Security Violation: Found prohibited environment file: ${rel}`);
    }
    if (rel.endsWith('.db') || rel.endsWith('.db-wal') || rel.endsWith('.db-shm')) {
      throw new Error(`Security Violation: Found prohibited database file: ${rel}`);
    }
    if (rel.startsWith('data/') || rel.startsWith('data\\')) {
      throw new Error(`Security Violation: Found prohibited data directory: ${rel}`);
    }
    if (rel.includes('backups') || rel.endsWith('.enc')) {
      throw new Error(`Security Violation: Found prohibited backup file: ${rel}`);
    }
    if (rel.endsWith('.map')) {
      throw new Error(`Security Violation: Found source map file: ${rel}`);
    }
  }

  // Check node_modules/.bin for dev tools
  const binDir = path.join(stageDir, 'node_modules', '.bin');
  if (fs.existsSync(binDir)) {
    const binFiles = fs.readdirSync(binDir);
    const prohibitedBins = ['tsx', 'vite', 'esbuild', 'tsc', 'typescript', 'vitest', 'supertest'];
    for (const b of binFiles) {
      if (prohibitedBins.includes(b)) {
        throw new Error(`Security Violation: Dev tool binary found in production node_modules/.bin: ${b}`);
      }
    }
  }


  // 6. Generate MANIFEST.json with SHA-256 for every file
  console.log('📝 إنشاء سجل المطابقة والنزاهة الرقمية MANIFEST.json...');
  let gitCommit = 'unknown';
  try {
    gitCommit = execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {}

  const manifestFiles: Array<{ path: string; sha256: string; size: number }> = [];
  for (const f of allStaged) {
    const rel = path.relative(stageDir, f).replace(/\\/g, '/');
    const sha256 = calculateFileSha256(f);
    const size = fs.statSync(f).size;
    manifestFiles.push({ path: rel, sha256, size });
  }

  // Sort files for deterministic manifest
  manifestFiles.sort((a, b) => a.path.localeCompare(b.path));

  const manifest = {
    name: pkg.name,
    version,
    platform,
    arch,
    nodeMajor,
    nodeVersionRequired: `v${nodeMajor}.x`,
    builtAt: new Date().toISOString(),
    gitCommit,
    totalFiles: manifestFiles.length,
    files: manifestFiles
  };

  fs.writeFileSync(path.join(stageDir, 'MANIFEST.json'), JSON.stringify(manifest, null, 2), 'utf8');

  // 7. Compress into archive
  console.log(`🗜️  جاري ضغط الحزمة إلى ${archivePath}...`);
  if (!fs.existsSync(releaseDir)) {
    fs.mkdirSync(releaseDir, { recursive: true });
  }
  if (fs.existsSync(archivePath)) {
    fs.unlinkSync(archivePath);
  }

  if (isWindows) {
    execSync(`powershell -Command "Compress-Archive -Path '${stageDir}\\*' -DestinationPath '${archivePath}' -Force"`, { stdio: 'inherit' });
  } else {
    execSync(`tar -czf "${archivePath}" -C "${stageDir}" .`, { stdio: 'inherit' });
  }

  // 8. Generate external checksum file
  const archiveSha256 = calculateFileSha256(archivePath);
  fs.writeFileSync(checksumPath, `${archiveSha256}  ${archiveName}\n`, 'utf8');

  // 9. Clean up staging directory
  fs.rmSync(stageDir, { recursive: true, force: true });

  const archiveSizeMb = (fs.statSync(archivePath).size / (1024 * 1024)).toFixed(2);
  console.log('======================================================================');
  console.log('✅ تم إنشاء حزمة التثبيت دون اتصال بنجاح تام!');
  console.log(`📦 المسار: ${archivePath} (${archiveSizeMb} MB)`);
  console.log(`🔑 البصمة الرقمية (SHA-256): ${archiveSha256}`);
  console.log(`📄 ملف التحقق: ${checksumPath}`);
  console.log(`📊 إجمالي الملفات المفحوصة: ${manifestFiles.length} ملف`);
  console.log('⚠️  تنبيه: يجب تشغيل هذه الحزمة على جهاز مكتب بنفس المعمارية ونظام التشغيل وإصدار Node الرئيسي.');
  console.log('======================================================================');
}

buildOfflinePackage().catch((err) => {
  console.error('❌ خطأ أثناء بناء الحزمة:', err);
  process.exit(1);
});
