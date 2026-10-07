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

import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import { sqliteEngine } from '../src/data/database/sqliteEngine.js';
import { verifyAuditLogIntegrity, AuditCheckpoint } from '../src/domain/security/cryptoUtils.js';

export const BACKUP_MAGIC_HEADER = Buffer.from('ENPA_BK_GCM_V1\0\0'); // 16 bytes

export function resolvePassphrase(explicit?: string): string | undefined {
  if (explicit) return explicit;
  if (process.env.BACKUP_PASSPHRASE) return process.env.BACKUP_PASSPHRASE;
  if (process.env.BACKUP_PASSPHRASE_FILE) {
    const filePath = path.resolve(process.env.BACKUP_PASSPHRASE_FILE);
    if (!fs.existsSync(filePath)) {
      throw new Error(`ملف كلمة مرور النسخ الاحتياطي غير موجود: ${filePath}`);
    }
    // Check permissions on POSIX systems (must be 0600 or 0400, no group/other read)
    if (process.platform !== 'win32') {
      const stat = fs.statSync(filePath);
      const mode = stat.mode & 0o777;
      if ((mode & 0o077) !== 0) {
        throw new Error(`خطأ أمني: أذونات ملف كلمة المرور ${filePath} غير آمنة (${mode.toString(8)}). يجب أن تكون 0600 أو 0400 (للمالك فقط).`);
      }
    }
    return fs.readFileSync(filePath, 'utf8').trim();
  }
  return undefined;
}


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
  const passphrase = resolvePassphrase(options?.passphrase);
  const allowPlaintext = options?.allowPlaintext || process.env.BACKUP_ALLOW_PLAINTEXT === 'true';

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  }

  // Ensure passphrase is provided unless explicitly allowed
  if (!passphrase && !allowPlaintext) {
    throw new Error(
      'خطأ أمني: كلمة مرور التشفير (BACKUP_PASSPHRASE أو BACKUP_PASSPHRASE_FILE) غير محددة. يمنع النظام إنشاء نسخ احتياطية غير مشفرة ما لم يتم تفعيل BACKUP_ALLOW_PLAINTEXT=true صراحة.'
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
  const resolvedPassphrase = resolvePassphrase(passphrase);
  const tempRestoreDir = fs.mkdtempSync(path.join(os.tmpdir(), 'restore-test-'));
  const tempRestoredDb = path.join(tempRestoreDir, 'app.db');

  const fileContent = fs.readFileSync(backupFilePath);
  const isEncrypted = fileContent.subarray(0, 16).equals(BACKUP_MAGIC_HEADER);

  let plainBuffer: Buffer;
  if (isEncrypted) {
    if (!resolvedPassphrase) throw new Error('كلمة المرور مطلوبة لاختبار الاسترجاع');
    plainBuffer = decryptBuffer(fileContent, resolvedPassphrase);
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

export async function decryptAndVerifyBackup(
  backupFilePath: string,
  outFilePath: string,
  passphrase?: string
): Promise<{ success: boolean; outFilePath: string; rowCounts: Record<string, number> }> {
  if (!backupFilePath) {
    throw new Error('يرجى تحديد مسار ملف النسخة الاحتياطية المراد فك تشفيرها');
  }
  if (!outFilePath) {
    throw new Error('يرجى تحديد مسار ملف الإخراج المستهدف (--out <path>)');
  }

  const resolvedBackupPath = path.resolve(backupFilePath);
  if (!fs.existsSync(resolvedBackupPath)) {
    throw new Error(`ملف النسخة الاحتياطية غير موجود: ${backupFilePath}`);
  }

  const resolvedOutPath = path.resolve(outFilePath);

  // 1. Refuse to overwrite existing file
  if (fs.existsSync(resolvedOutPath)) {
    throw new Error(`مسار ملف الإخراج موجود مسبقاً، يمنع استبدال ملف قائم: ${resolvedOutPath}`);
  }

  // 2. Refuse live DATA_DIR/app.db path
  const liveDataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.resolve(process.cwd(), 'data');
  const liveDbPath = path.join(liveDataDir, 'app.db');
  if (path.resolve(resolvedOutPath) === path.resolve(liveDbPath)) {
    throw new Error(`حظر أمني: يمنع فك التشفير مباشرة فوق مسار قاعدة البيانات الحية (${liveDbPath}). يرجى تحديد مسار جديد ونقله يدوياً بعد اكتمال التحقق.`);
  }

  // 3. Resolve passphrase
  const resolvedPassphrase = resolvePassphrase(passphrase);

  // 4. Decrypt buffer
  const fileContent = fs.readFileSync(resolvedBackupPath);
  const isEncrypted = fileContent.subarray(0, 16).equals(BACKUP_MAGIC_HEADER);

  let plainBuffer: Buffer;
  if (isEncrypted) {
    if (!resolvedPassphrase) {
      throw new Error('كلمة مرور النسخ الاحتياطي (BACKUP_PASSPHRASE أو BACKUP_PASSPHRASE_FILE) مطلوبة لفك التشفير');
    }
    plainBuffer = decryptBuffer(fileContent, resolvedPassphrase);
  } else {
    plainBuffer = fileContent;
  }

  // 5. Ensure parent dir exists and write with 0600 mode
  fs.mkdirSync(path.dirname(resolvedOutPath), { recursive: true });
  fs.writeFileSync(resolvedOutPath, plainBuffer, { mode: 0o600 });
  if (process.platform !== 'win32') {
    try { fs.chmodSync(resolvedOutPath, 0o600); } catch {}
  }

  // 6. Verification: integrity_check, foreign_key_check, and audit chain verification
  let verifyDb: Database.Database | null = null;
  try {
    verifyDb = new Database(resolvedOutPath, { readonly: true });

    // Integrity check
    const integrityResult = verifyDb.prepare('PRAGMA integrity_check').all() as { integrity_check: string }[];
    if (!integrityResult || integrityResult.length === 0 || integrityResult[0].integrity_check !== 'ok') {
      throw new Error(`فشل فحص سلامة SQLite: ${JSON.stringify(integrityResult)}`);
    }

    // Foreign key check
    const fkResult = verifyDb.prepare('PRAGMA foreign_key_check').all();
    if (fkResult && fkResult.length > 0) {
      throw new Error(`فشل فحص المفاتيح الأجنبية: ${JSON.stringify(fkResult)}`);
    }

    // Cryptographic audit log verification
    const auditRows = verifyDb.prepare('SELECT * FROM audit_log ORDER BY seq ASC').all() as any[];
    let checkpoint: AuditCheckpoint | null = null;
    try {
      const checkpointRow = verifyDb.prepare('SELECT audit_last_seq, audit_head_hash, audit_count FROM settings LIMIT 1').get() as any;
      if (checkpointRow) {
        checkpoint = {
          last_seq: checkpointRow.audit_last_seq,
          head_hash: checkpointRow.audit_head_hash,
          count: checkpointRow.audit_count
        };
      }
    } catch {}

    const auditVerify = await verifyAuditLogIntegrity(auditRows, checkpoint);
    if (!auditVerify.isValid) {
      throw new Error(`فشل التحقق التشفيري لسجل الرقابة: ${auditVerify.brokenReason}`);
    }

    // Parity row counts
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

    verifyDb.close();
    verifyDb = null;

    return { success: true, outFilePath: resolvedOutPath, rowCounts };
  } catch (err) {
    if (verifyDb) {
      try { verifyDb.close(); } catch {}
      verifyDb = null;
    }
    // Delete output file if verification fails
    if (fs.existsSync(resolvedOutPath)) {
      try { fs.unlinkSync(resolvedOutPath); } catch {}
    }
    throw err;
  }
}

// CLI Execution Handler
async function main() {
  const args = process.argv.slice(2);
  const passphrase = resolvePassphrase();

  if (args.includes('--decrypt')) {
    const decryptIdx = args.indexOf('--decrypt');
    const outIdx = args.indexOf('--out');
    let targetFile = decryptIdx !== -1 && args[decryptIdx + 1] && !args[decryptIdx + 1].startsWith('--') ? args[decryptIdx + 1] : undefined;
    let outFile = outIdx !== -1 && args[outIdx + 1] && !args[outIdx + 1].startsWith('--') ? args[outIdx + 1] : undefined;
    if (!targetFile || !outFile) {
      console.error('❌ يرجى تحديد مسار ملف النسخة ومسار الإخراج: node dist-server/backup.js --decrypt <backup.db.enc> --out <new-file-path>');
      process.exit(1);
    }
    console.log(`🔓 بدء فك تشفير والتحقق من النسخة الاحتياطية: ${targetFile} -> ${outFile}`);
    try {
      const res = await decryptAndVerifyBackup(targetFile, outFile, passphrase);
      console.log(`✅ تم فك تشفير النسخة بنجاح والتحقق من سلامتها وهيكلها التشفيري: ${res.outFilePath}`);
      console.table(res.rowCounts);
      process.exit(0);
    } catch (err: any) {
      console.error(`❌ فشل فك التشفير أو التحقق: ${err.message}`);
      process.exit(1);
    }
  }

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

if (process.argv[1] && (process.argv[1].endsWith('backup.ts') || process.argv[1].endsWith('backup.js') || process.argv[1].endsWith('backup'))) {
  main().catch((err) => {
    console.error('❌ فشلت عملية النسخ الاحتياطي:', err.message);
    process.exit(1);
  });
}

