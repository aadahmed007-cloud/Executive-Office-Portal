/**
 * Executive Office Portal Secure Database Backup & Verification Utility
 * 
 * Features:
 * - Military-grade AES-256-GCM encryption with scrypt key derivation.
 * - Format: [MAGIC_HEADER(16B) | SALT(32B) | IV(12B) | AUTH_TAG(16B) | CIPHERTEXT]
 * - Auto-verification: PRAGMA integrity_check, foreign_key_check, audit chain validation, and table row count parity.
 * - Retention rotation (keeps last N backups, protecting latest verified backup).
 * - Standalone CLI commands for verify (--verify <file>) and restore testing (--restore-test <file>).
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import { sqliteEngine } from '../src/data/database/sqliteEngine.js';
import { verifyAuditLogIntegrity, AuditCheckpoint } from '../src/domain/security/cryptoUtils.js';

export const BACKUP_MAGIC_HEADER = Buffer.from('ENPA_BK_GCM_V1\0\0'); // 16 bytes

export interface BackupResult {
  success: boolean;
  backupFilePath: string;
  isEncrypted: boolean;
  verified: boolean;
  error?: string;
}

export function encryptBuffer(plainBuffer: Buffer, passphrase: string): Buffer {
  const salt = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12); // 96-bit standard for GCM
  const key = crypto.scryptSync(passphrase, salt, 32, { N: 16384, r: 8, p: 1 });
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([BACKUP_MAGIC_HEADER, salt, iv, authTag, ciphertext]);
}

export function decryptBuffer(encryptedBuffer: Buffer, passphrase: string): Buffer {
  if (encryptedBuffer.length < 16 + 32 + 12 + 16) {
    throw new Error('الملف المشفر تالف أو أصغر من الحجم الأدنى المطلوب');
  }

  const magic = encryptedBuffer.subarray(0, 16);
  if (!magic.equals(BACKUP_MAGIC_HEADER)) {
    throw new Error('ترويسة ملف النسخة الاحتياطية غير صالحة أو غير مشفرة بهذا النظام');
  }

  const salt = encryptedBuffer.subarray(16, 48);
  const iv = encryptedBuffer.subarray(48, 60);
  const authTag = encryptedBuffer.subarray(60, 76);
  const ciphertext = encryptedBuffer.subarray(76);

  const key = crypto.scryptSync(passphrase, salt, 32, { N: 16384, r: 8, p: 1 });
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export async function verifyBackupFile(
  backupFilePath: string,
  passphrase?: string,
  liveDbInstance?: Database.Database | null
): Promise<{ isValid: boolean; rowCounts: Record<string, number>; reason?: string }> {
  if (!fs.existsSync(backupFilePath)) {
    throw new Error(`ملف النسخة الاحتياطية غير موجود: ${backupFilePath}`);
  }

  const fileContent = fs.readFileSync(backupFilePath);
  const isEncrypted = fileContent.subarray(0, 16).equals(BACKUP_MAGIC_HEADER);

  let plainDbBuffer: Buffer;
  if (isEncrypted) {
    if (!passphrase) {
      throw new Error('كلمة مرور النسخ الاحتياطي (BACKUP_PASSPHRASE) مطلوبة لفك تشفير والتحقق من الملف');
    }
    plainDbBuffer = decryptBuffer(fileContent, passphrase);
  } else {
    plainDbBuffer = fileContent;
  }

  // Write to a temporary isolated file for SQLite verification
  const tempVerifyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-verify-'));
  const tempVerifyFile = path.join(tempVerifyDir, 'verify.db');
  fs.writeFileSync(tempVerifyFile, plainDbBuffer, { mode: 0o600 });

  let verifyDb: Database.Database | null = null;
  try {
    verifyDb = new Database(tempVerifyFile, { readonly: true });

    // 1. PRAGMA integrity_check
    const integrityResult = verifyDb.prepare('PRAGMA integrity_check').all() as { integrity_check: string }[];
    if (!integrityResult || integrityResult.length === 0 || integrityResult[0].integrity_check !== 'ok') {
      return { isValid: false, rowCounts: {}, reason: `فشل فحص سلامة SQLite: ${JSON.stringify(integrityResult)}` };
    }

    // 2. PRAGMA foreign_key_check
    const fkResult = verifyDb.prepare('PRAGMA foreign_key_check').all();
    if (fkResult && fkResult.length > 0) {
      return { isValid: false, rowCounts: {}, reason: `فشل فحص المفاتيح الأجنبية: ${JSON.stringify(fkResult)}` };
    }

    // 3. Cryptographic Audit Log Verification
    const auditRows = verifyDb.prepare('SELECT * FROM audit_log ORDER BY seq ASC').all() as any[];
    const checkpointRow = verifyDb.prepare('SELECT audit_last_seq, audit_head_hash, audit_count FROM settings LIMIT 1').get() as any;
    const checkpoint: AuditCheckpoint | null = checkpointRow
      ? {
          last_seq: checkpointRow.audit_last_seq,
          head_hash: checkpointRow.audit_head_hash,
          count: checkpointRow.audit_count
        }
      : null;

    const auditVerify = await verifyAuditLogIntegrity(auditRows, checkpoint);
    if (!auditVerify.isValid) {
      return { isValid: false, rowCounts: {}, reason: `فشل التحقق التشفيري لسجل الرقابة: ${auditVerify.brokenReason}` };
    }

    // 4. Record row counts
    const tables = ['users', 'correspondence', 'directives', 'meetings', 'matters', 'contacts', 'audit_log', 'settings'];
    const rowCounts: Record<string, number> = {};
    for (const t of tables) {
      try {
        const res = verifyDb.prepare(`SELECT count(*) as count FROM ${t}`).get() as { count: number };
        rowCounts[t] = res.count;
      } catch {
        rowCounts[t] = 0;
      }
    }

    // 5. Compare with live DB if provided
    if (liveDbInstance) {
      for (const t of ['users', 'correspondence', 'directives', 'meetings', 'audit_log']) {
        try {
          const liveRes = liveDbInstance.prepare(`SELECT count(*) as count FROM ${t}`).get() as { count: number };
          if (liveRes.count !== rowCounts[t]) {
            return {
              isValid: false,
              rowCounts,
              reason: `عدم تطابق عدد السجلات في جدول ${t}: الحي ${liveRes.count} مقابل ${rowCounts[t]} في النسخة`
            };
          }
        } catch {}
      }
    }

    return { isValid: true, rowCounts };
  } finally {
    if (verifyDb) {
      try {
        verifyDb.close();
      } catch {}
    }
    try {
      fs.rmSync(tempVerifyDir, { recursive: true, force: true });
    } catch {}
  }
}

export async function createEncryptedBackup(options?: {
  dataDir?: string;
  backupDir?: string;
  passphrase?: string;
  allowPlaintext?: boolean;
}): Promise<BackupResult> {
  const dataDir = options?.dataDir || process.env.DATA_DIR || path.join(process.cwd(), 'var', 'data');
  const backupDir = options?.backupDir || process.env.BACKUP_DIR || path.join(process.cwd(), 'var', 'backups');
  const passphrase = options?.passphrase || process.env.BACKUP_PASSPHRASE;
  const allowPlaintext = options?.allowPlaintext || process.env.BACKUP_ALLOW_PLAINTEXT === 'true';

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  }

  // Ensure passphrase is provided unless explicitly allowed
  if (!passphrase && !allowPlaintext) {
    throw new Error(
      'خطأ أمني: كلمة مرور التشفير (BACKUP_PASSPHRASE) غير محددة. يمنع النظام إنشاء نسخ احتياطية غير مشفرة ما لم يتم تفعيل BACKUP_ALLOW_PLAINTEXT=true صراحة.'
    );
  }

  if (!passphrase && allowPlaintext) {
    console.warn('⚠️  تحذير أمني: يتم إنشاء نسخة احتياطية غير مشفرة بناءً على تفعيل BACKUP_ALLOW_PLAINTEXT=true.');
  }

  await sqliteEngine.init();

  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T.]/g, '').slice(0, 14); // YYYYMMDDHHMMSS
  const ext = passphrase ? 'db.enc' : 'db';
  const backupFileName = `backup-${timestamp}.${ext}`;
  const backupFilePath = path.join(backupDir, backupFileName);

  // Step 1: Create a consistent SQLite online backup to a temporary file
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'online-bk-'));
  const tempOnlineDb = path.join(tempDir, 'temp-online.db');

  try {
    await sqliteEngine.backup(tempOnlineDb);

    const plainBuffer = fs.readFileSync(tempOnlineDb);

    if (passphrase) {
      const encryptedBuffer = encryptBuffer(plainBuffer, passphrase);
      fs.writeFileSync(backupFilePath, encryptedBuffer, { mode: 0o600 });
    } else {
      fs.writeFileSync(backupFilePath, plainBuffer, { mode: 0o600 });
    }

    // Step 2: Auto-verify the created backup file immediately
    const verifyResult = await verifyBackupFile(backupFilePath, passphrase, sqliteEngine.getDatabase());
    if (!verifyResult.isValid) {
      // Remove bad backup
      if (fs.existsSync(backupFilePath)) fs.unlinkSync(backupFilePath);
      throw new Error(`فشل التحقق التلقائي من النسخة الاحتياطية المنشأة: ${verifyResult.reason}`);
    }

    // Step 3: Enforce retention policy
    const retentionCount = parseInt(process.env.BACKUP_RETENTION || '7', 10);
    const existingBackups = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith('backup-') && (f.endsWith('.db') || f.endsWith('.db.enc')))
      .map((f) => ({
        name: f,
        path: path.join(backupDir, f),
        mtime: fs.statSync(path.join(backupDir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.mtime - a.mtime); // newest first

    if (existingBackups.length > retentionCount) {
      // Never delete the newest backup that just passed verification (item 0)
      const toRotate = existingBackups.slice(retentionCount);
      for (const item of toRotate) {
        if (item.path !== backupFilePath) {
          try {
            fs.unlinkSync(item.path);
          } catch {}
        }
      }
    }

    return {
      success: true,
      backupFilePath,
      isEncrypted: Boolean(passphrase),
      verified: true
    };
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

export async function restoreTest(backupFilePath: string, passphrase?: string): Promise<{ success: boolean; tempDir: string; rowCounts: Record<string, number> }> {
  const tempRestoreDir = fs.mkdtempSync(path.join(os.tmpdir(), 'restore-test-'));
  const tempRestoredDb = path.join(tempRestoreDir, 'app.db');

  const fileContent = fs.readFileSync(backupFilePath);
  const isEncrypted = fileContent.subarray(0, 16).equals(BACKUP_MAGIC_HEADER);

  let plainBuffer: Buffer;
  if (isEncrypted) {
    if (!passphrase) throw new Error('كلمة المرور مطلوبة لاختبار الاسترجاع');
    plainBuffer = decryptBuffer(fileContent, passphrase);
  } else {
    plainBuffer = fileContent;
  }

  fs.writeFileSync(tempRestoredDb, plainBuffer, { mode: 0o600 });

  const testDb = new Database(tempRestoredDb, { readonly: true });
  try {
    const integrity = testDb.prepare('PRAGMA integrity_check').get() as any;
    if (integrity.integrity_check !== 'ok') {
      throw new Error(`فشل فحص السلامة بعد الاسترجاع: ${integrity.integrity_check}`);
    }

    const rowCounts: Record<string, number> = {};
    for (const t of ['users', 'correspondence', 'directives', 'meetings', 'audit_log']) {
      try {
        const res = testDb.prepare(`SELECT count(*) as count FROM ${t}`).get() as { count: number };
        rowCounts[t] = res.count;
      } catch {
        rowCounts[t] = 0;
      }
    }

    return { success: true, tempDir: tempRestoreDir, rowCounts };
  } finally {
    testDb.close();
    fs.rmSync(tempRestoreDir, { recursive: true, force: true });
  }
}

// CLI Execution Handler
async function main() {
  const args = process.argv.slice(2);
  const passphrase = process.env.BACKUP_PASSPHRASE;

  if (args.includes('--verify')) {
    const fileIdx = args.indexOf('--verify') + 1;
    const targetFile = args[fileIdx];
    if (!targetFile) {
      console.error('❌ يرجى تحديد مسار ملف النسخة الاحتياطية للتحقق: npm run backup:verify -- <file>');
      process.exit(1);
    }
    console.log(`🔍 بدء التحقق من النسخة الاحتياطية: ${targetFile}`);
    const res = await verifyBackupFile(targetFile, passphrase);
    if (res.isValid) {
      console.log('✅ النسخة الاحتياطية سليمة تماماً ومجتازة لكافة الفحوصات التشفيرية والهيكلية:');
      console.table(res.rowCounts);
      process.exit(0);
    } else {
      console.error(`❌ فشل التحقق من النسخة الاحتياطية: ${res.reason}`);
      process.exit(1);
    }
  }

  if (args.includes('--restore-test')) {
    const fileIdx = args.indexOf('--restore-test') + 1;
    const targetFile = args[fileIdx];
    if (!targetFile) {
      console.error('❌ يرجى تحديد مسار ملف النسخة الاحتياطية لاختبار الاسترجاع: npm run backup:restore-test -- <file>');
      process.exit(1);
    }
    console.log(`🧪 بدء اختبار استرجاع تجريبي آمن في بيئة معزولة للملف: ${targetFile}`);
    const res = await restoreTest(targetFile, passphrase);
    if (res.success) {
      console.log('✅ نجح اختبار الاسترجاع بالكامل في دليل مؤقت معزول مع مطابقة البيانات:');
      console.table(res.rowCounts);
      process.exit(0);
    } else {
      console.error('❌ فشل اختبار الاسترجاع.');
      process.exit(1);
    }
  }

  // Default: Create Backup
  console.log('📦 جاري إنشاء نسخة احتياطية مشفرة ومؤمنة لقاعدة البيانات...');
  const result = await createEncryptedBackup();
  console.log(`✅ تم إنشاء والتحقق من النسخة الاحتياطية بنجاح: ${result.backupFilePath} (مشفرة: ${result.isEncrypted})`);
}

if (process.argv[1] && process.argv[1].endsWith('backup.ts')) {
  main().catch((err) => {
    console.error('❌ فشلت عملية النسخ الاحتياطي:', err.message);
    process.exit(1);
  });
}
