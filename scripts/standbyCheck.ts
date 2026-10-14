/**
 * Warm Standby Backup Freshness & Verification Utility (npm run standby:check)
 * 
 * Verifies that the newest encrypted backup in BACKUP_DIR is recent (age <= STANDBY_MAX_AGE_MINUTES)
 * and passes complete cryptographic and structural verification:
 * - Decryption (AES-256-GCM authentication)
 * - PRAGMA integrity_check
 * - PRAGMA foreign_key_check
 * - Cryptographic audit log hash chain & checkpoint validation
 * - Table row count verification
 */
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { verifyBackupFile, resolvePassphrase } from './backup.js';

export interface StandbyCheckOptions {
  backupDir?: string;
  maxAgeMinutes?: number;
  passphrase?: string;
  quiet?: boolean;
}

export interface StandbyCheckResult {
  success: boolean;
  newestBackup?: string;
  ageMinutes?: number;
  reason?: string;
  rowCounts?: Record<string, number>;
}

export async function checkStandbyFreshness(options?: StandbyCheckOptions): Promise<StandbyCheckResult> {
  const backupDir = options?.backupDir || process.env.BACKUP_DIR || path.join(process.cwd(), 'var', 'backups');
  const maxAgeMinutes = options?.maxAgeMinutes !== undefined
    ? options.maxAgeMinutes
    : parseInt(process.env.STANDBY_MAX_AGE_MINUTES || '90', 10);
  const passphrase = options?.passphrase !== undefined ? options.passphrase : resolvePassphrase();
  const quiet = Boolean(options?.quiet);

  if (!fs.existsSync(backupDir)) {
    const reason = `دليل النسخ الاحتياطية غير موجود: ${backupDir}`;
    if (!quiet) console.error(`❌ فشل فحص الجاهزية الاحتياطية (Warm Standby): ${reason}`);
    return { success: false, reason };
  }

  const files = fs
    .readdirSync(backupDir)
    .filter((f) => (f.endsWith('.db.enc') || f.endsWith('.db')) && f.startsWith('backup-'));

  if (files.length === 0) {
    const reason = `لا توجد أي نسخ احتياطية في الدليل المحدد: ${backupDir}`;
    if (!quiet) console.error(`❌ فشل فحص الجاهزية الاحتياطية (Warm Standby): ${reason}`);
    return { success: false, reason };
  }

  // Find newest backup file by modification time
  let newestFile = files[0];
  let newestMtime = 0;
  for (const f of files) {
    const full = path.join(backupDir, f);
    try {
      const stat = fs.statSync(full);
      if (stat.mtimeMs > newestMtime) {
        newestMtime = stat.mtimeMs;
        newestFile = f;
      }
    } catch {}
  }

  const newestPath = path.join(backupDir, newestFile);
  const now = Date.now();
  const ageMs = now - newestMtime;
  const ageMinutes = Math.max(0, ageMs / (1000 * 60));

  // Check age threshold
  if (ageMinutes > maxAgeMinutes) {
    const reason = `أحدث نسخة احتياطية قديمة جداً (${newestFile}، عمرها ${Math.round(ageMinutes)} دقيقة، والحد الأقصى المسموح ${maxAgeMinutes} دقيقة)`;
    if (!quiet) console.error(`❌ فشل فحص الجاهزية الاحتياطية (Warm Standby): ${reason}`);
    return { success: false, newestBackup: newestFile, ageMinutes, reason };
  }

  // Run full verification (decrypt, PRAGMA checks, audit chain, table counts)
  try {
    const verifyResult = await verifyBackupFile(newestPath, passphrase);
    if (!verifyResult.isValid) {
      const reason = `النسخة الاحتياطية تالفة أو غير صالحة (${newestFile}): ${verifyResult.reason}`;
      if (!quiet) console.error(`❌ فشل فحص الجاهزية الاحتياطية (Warm Standby): ${reason}`);
      return { success: false, newestBackup: newestFile, ageMinutes, reason, rowCounts: verifyResult.rowCounts };
    }

    // Verify critical tables are present
    const expectedTables = ['users', 'correspondence', 'directives', 'meetings', 'audit_log', 'settings'];
    for (const t of expectedTables) {
      if (verifyResult.rowCounts[t] === undefined) {
        const reason = `النسخة تفتقر إلى الجدول الأساسي: ${t}`;
        if (!quiet) console.error(`❌ فشل فحص الجاهزية الاحتياطية (Warm Standby): ${reason}`);
        return { success: false, newestBackup: newestFile, ageMinutes, reason, rowCounts: verifyResult.rowCounts };
      }
    }

    if (!quiet) {
      console.log(
        `✅ نجاح فحص الجاهزية الاحتياطية (Warm Standby): أحدث نسخة احتياطية سليمة ومحدثة (${newestFile}، عمرها ${Math.round(ageMinutes)} دقيقة، تم التحقق من سلامة البيانات وسلسلة التدقيق).`
      );
    }

    return {
      success: true,
      newestBackup: newestFile,
      ageMinutes,
      rowCounts: verifyResult.rowCounts
    };
  } catch (err: any) {
    const reason = `خطأ أثناء التحقق من سلامة النسخة الاحتياطية (${newestFile}): ${err.message}`;
    if (!quiet) console.error(`❌ فشل فحص الجاهزية الاحتياطية (Warm Standby): ${reason}`);
    return { success: false, newestBackup: newestFile, ageMinutes, reason };
  }
}

// CLI entry point
const isDirectCli = process.argv[1] && (
  process.argv[1].endsWith('standbyCheck.ts') ||
  process.argv[1].endsWith('standbyCheck.js')
);

if (isDirectCli) {
  checkStandbyFreshness()
    .then((result) => {
      if (!result.success) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ خطأ غير متوقع أثناء فحص الجاهزية الاحتياطية:', err.message);
      process.exit(1);
    });
}
