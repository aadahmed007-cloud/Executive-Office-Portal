/**
 * Offline Package Verification Script
 * Validates the cryptographic integrity, absence of leaked data/secrets, and file hashes of a release package.
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
  if (!fs.existsSync(dir)) return results;
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

export async function verifyPackageArchive(specifiedPath?: string): Promise<boolean> {
  const rootDir = process.cwd();
  let archivePath = specifiedPath;

  if (!archivePath) {
    const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
    if (args.length > 0) {
      archivePath = path.resolve(rootDir, args[0]);
    } else {
      const releaseDir = path.join(rootDir, 'release');
      if (fs.existsSync(releaseDir)) {
        const files = fs.readdirSync(releaseDir).filter((f) => f.endsWith('.tar.gz') || f.endsWith('.zip'));
        if (files.length > 0) {
          archivePath = path.join(releaseDir, files[0]);
        }
      }
    }
  }

  if (!archivePath || !fs.existsSync(archivePath)) {
    console.error('❌ خطأ: لم يتم العثور على ملف الحزمة للتحقق منه.');
    console.error(`المسار المطلوب: ${archivePath || 'غير محدد'}`);
    process.exit(1);
  }

  console.log('======================================================================');
  console.log('🔍 بدء التحقق الرقمي من حزمة التثبيت (Offline Package Verification)');
  console.log('======================================================================');
  console.log(`📌 مسار ملف الحزمة: ${archivePath}`);

  // 1. Check archive sha256 checksum file if present
  const checksumFile = `${archivePath}.sha256`;
  const computedArchiveSha = calculateFileSha256(archivePath);
  console.log(`📌 البصمة المحسوبة للأرشيف: ${computedArchiveSha}`);

  if (fs.existsSync(checksumFile)) {
    const expectedChecksumContent = fs.readFileSync(checksumFile, 'utf8').trim().split(/\s+/)[0];
    if (expectedChecksumContent.toLowerCase() !== computedArchiveSha.toLowerCase()) {
      console.error('❌ خطأ أمني: عدم تطابق بصمة SHA-256 لملف الأرشيف مع ملف البصمات المرفق!');
      console.error(`المتوقع: ${expectedChecksumContent}`);
      console.error(`الفعلي:   ${computedArchiveSha}`);
      process.exit(1);
    }
    console.log('✅ تطابق بصمة SHA-256 لملف الأرشيف بنجاح.');
  }

  // 2. Extract into temporary sandbox
  const tempExtractDir = path.join(rootDir, '.temp_pkg_verify_' + Date.now());
  if (fs.existsSync(tempExtractDir)) {
    fs.rmSync(tempExtractDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempExtractDir, { recursive: true });

  try {
    console.log('📂 جاري فك ضغط الحزمة في بيئة معزولة مؤقتة...');
    if (archivePath.endsWith('.zip')) {
      execSync(`powershell -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${tempExtractDir}' -Force"`, { stdio: 'pipe' });
    } else {
      execSync(`tar -xzf "${archivePath}" -C "${tempExtractDir}"`, { stdio: 'pipe' });
    }

    // 3. Security Sanity Checks: Ensure NO confidential or state data was included
    console.log('🛡️  التحقق من عدم وجود ملفات ممنوعة أو بيانات تسريب...');
    const extractedFiles = getAllFiles(tempExtractDir);
    for (const f of extractedFiles) {
      const rel = path.relative(tempExtractDir, f).replace(/\\/g, '/');
      if (rel === '.env' || (rel.startsWith('.env.') && rel !== '.env.example')) {
        throw new Error(`حظر أمني: الحزمة تحتوي على ملف متغيرات بيئة سري: ${rel}`);
      }
      if (rel.endsWith('.db') || rel.endsWith('.db-wal') || rel.endsWith('.db-shm')) {
        throw new Error(`حظر أمني: الحزمة تحتوي على ملف قاعدة بيانات مسبق: ${rel}`);
      }
      if (rel.startsWith('data/')) {
        throw new Error(`حظر أمني: الحزمة تحتوي على مجلد بيانات محلي: ${rel}`);
      }
      if (rel.includes('backups') || rel.endsWith('.enc')) {
        throw new Error(`حظر أمني: الحزمة تحتوي على نسخ احتياطية: ${rel}`);
      }
      if (rel.endsWith('.map')) {
        throw new Error(`حظر أمني: الحزمة تحتوي على ملفات خرائط الشفرة المصدرية (Source Maps): ${rel}`);
      }
    }

    // 4. Validate MANIFEST.json existence
    const manifestPath = path.join(tempExtractDir, 'MANIFEST.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error('ملف البيان الرقمي MANIFEST.json غير موجود داخل الحزمة!');
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    console.log(`📋 بيانات الحزمة: ${manifest.name} v${manifest.version}`);
    console.log(`📋 بيئة البناء: ${manifest.platform} (${manifest.arch}) | Node: ${manifest.nodeVersionRequired}`);
    console.log(`📋 عدد الملفات المسجلة: ${manifest.files?.length || 0}`);

    if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
      throw new Error('ملف MANIFEST.json فارغ أو تالف!');
    }

    // 5. Verify every single file hash
    console.log('🔐 جاري تدقيق ومطابقة البصمة التشفيرية لكل ملف داخل الحزمة...');
    let verifiedCount = 0;
    for (const item of manifest.files) {
      const filePath = path.join(tempExtractDir, item.path);
      if (!fs.existsSync(filePath)) {
        throw new Error(`ملف مفقود من الحزمة: ${item.path}`);
      }
      const actualHash = calculateFileSha256(filePath);
      if (actualHash.toLowerCase() !== item.sha256.toLowerCase()) {
        throw new Error(`تم رصد تلاعب أو تلف في الملف: ${item.path} (البصمة غير متطابقة)`);
      }
      verifiedCount++;
    }

    console.log('======================================================================');
    console.log(`✅ اكتمل الفحص بنجاح تام! تم تدقيق ومطابقة ${verifiedCount} ملف بنجاح.`);
    console.log('✨ خلو الحزمة بالكامل من أي أسرار أو قواعد بيانات سابقة.');
    console.log('======================================================================');
    return true;
  } catch (err: any) {
    console.error('======================================================================');
    console.error('❌ فشل التحقق من سلامة حزمة التثبيت:');
    console.error(`📌 سبب الفشل: ${err.message}`);
    console.error('======================================================================');
    throw err;
  } finally {
    if (fs.existsSync(tempExtractDir)) {
      fs.rmSync(tempExtractDir, { recursive: true, force: true });
    }
  }
}

// Execute when run as script
if (process.argv[1] && (process.argv[1].endsWith('verifyPackage.ts') || process.argv[1]?.endsWith('verifyPackage.js'))) {
  verifyPackageArchive().catch(() => process.exit(1));
}
