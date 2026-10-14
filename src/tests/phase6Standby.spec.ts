import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import { createEncryptedBackup, resolvePassphrase } from '../../scripts/backup.js';
import { checkStandbyFreshness } from '../../scripts/standbyCheck.js';
import { sqliteEngine } from '../data/database/sqliteEngine.js';

describe('Phase 6: Warm Standby Availability & Freshness Verification', () => {
  const tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p6-standby-test-'));
  const testPassphrase = 'Phase6StandbyTestPassphrase2026!';
  let validBackupPath: string;
  let validBackupDir: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await sqliteEngine.init();

    validBackupDir = path.join(tempBaseDir, 'valid-backups');
    fs.mkdirSync(validBackupDir, { recursive: true });

    // Create a real encrypted backup
    const backupRes = await createEncryptedBackup({
      backupDir: validBackupDir,
      passphrase: testPassphrase
    });
    validBackupPath = backupRes.backupFilePath;
    expect(fs.existsSync(validBackupPath)).toBe(true);
  });

  afterAll(() => {
    try {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    } catch {}
  });

  it('1. Fresh backup passes verification and freshness check', async () => {
    const result = await checkStandbyFreshness({
      backupDir: validBackupDir,
      maxAgeMinutes: 90,
      passphrase: testPassphrase,
      quiet: true
    });

    expect(result.success).toBe(true);
    expect(result.newestBackup).toBe(path.basename(validBackupPath));
    expect(result.ageMinutes).toBeLessThan(5);
    expect(result.rowCounts).toBeDefined();
    expect(result.rowCounts!['users']).toBeGreaterThan(0);
    expect(result.rowCounts!['audit_log']).toBeGreaterThanOrEqual(0);
    expect(result.rowCounts!['settings']).toBeGreaterThan(0);
  });

  it('2. Old backup (age > STANDBY_MAX_AGE_MINUTES) fails with clear status', async () => {
    const oldDir = path.join(tempBaseDir, 'old-backups');
    fs.mkdirSync(oldDir, { recursive: true });
    const oldBackupFile = path.join(oldDir, 'backup-20260101120000.db.enc');
    fs.copyFileSync(validBackupPath, oldBackupFile);

    // Set mtime to 120 minutes ago
    const twoHoursAgo = new Date(Date.now() - 120 * 60 * 1000);
    fs.utimesSync(oldBackupFile, twoHoursAgo, twoHoursAgo);

    const result = await checkStandbyFreshness({
      backupDir: oldDir,
      maxAgeMinutes: 90,
      passphrase: testPassphrase,
      quiet: true
    });

    expect(result.success).toBe(false);
    expect(result.ageMinutes).toBeGreaterThanOrEqual(119);
    expect(result.reason).toContain('قديمة جداً');
  });

  it('3. Corrupt backup file fails integrity verification', async () => {
    const corruptDir = path.join(tempBaseDir, 'corrupt-backups');
    fs.mkdirSync(corruptDir, { recursive: true });
    const corruptFile = path.join(corruptDir, 'backup-20261013220000.db.enc');
    fs.writeFileSync(corruptFile, Buffer.from('NOT_A_VALID_AES_GCM_BACKUP_CORRUPT_BYTES'));

    const result = await checkStandbyFreshness({
      backupDir: corruptDir,
      maxAgeMinutes: 90,
      passphrase: testPassphrase,
      quiet: true
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('4. Tampered ciphertext backup fails authentication and GCM verification', async () => {
    const tamperedDir = path.join(tempBaseDir, 'tampered-backups');
    fs.mkdirSync(tamperedDir, { recursive: true });
    const tamperedFile = path.join(tamperedDir, 'backup-20261013230000.db.enc');

    const originalBuf = fs.readFileSync(validBackupPath);
    const tamperedBuf = Buffer.from(originalBuf);
    // Flip bytes in the ciphertext region (past header, salt, iv, auth_tag = 16+32+12+16 = 76)
    if (tamperedBuf.length > 100) {
      tamperedBuf[95] = tamperedBuf[95] ^ 0xff;
      tamperedBuf[96] = tamperedBuf[96] ^ 0xaa;
    }
    fs.writeFileSync(tamperedFile, tamperedBuf);

    const result = await checkStandbyFreshness({
      backupDir: tamperedDir,
      maxAgeMinutes: 90,
      passphrase: testPassphrase,
      quiet: true
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('5. Wrong passphrase fails decryption', async () => {
    const result = await checkStandbyFreshness({
      backupDir: validBackupDir,
      maxAgeMinutes: 90,
      passphrase: 'WrongSecretPassword123!',
      quiet: true
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('6. Empty backup directory (no backup) fails', async () => {
    const emptyDir = path.join(tempBaseDir, 'empty-backups');
    fs.mkdirSync(emptyDir, { recursive: true });

    const result = await checkStandbyFreshness({
      backupDir: emptyDir,
      maxAgeMinutes: 90,
      passphrase: testPassphrase,
      quiet: true
    });

    expect(result.success).toBe(false);
    expect(result.reason).toContain('لا توجد أي نسخ احتياطية');
  });

  it('7. CLI execution (node dist-server/standbyCheck.js) exits 0 on fresh backup and 1 on old backup', () => {
    const cliScript = path.join(process.cwd(), 'dist-server', 'standbyCheck.js');
    if (!fs.existsSync(cliScript)) {
      // Build first if needed
      spawnSync('npm', ['run', 'build:server'], { stdio: 'ignore' });
    }

    // Success run
    const successRun = spawnSync('node', [cliScript], {
      env: {
        ...process.env,
        BACKUP_DIR: validBackupDir,
        BACKUP_PASSPHRASE: testPassphrase,
        STANDBY_MAX_AGE_MINUTES: '90'
      },
      encoding: 'utf8'
    });
    expect(successRun.status).toBe(0);
    expect(successRun.stdout).toContain('نجاح فحص الجاهزية الاحتياطية');

    // Failure run on empty dir
    const emptyDir = path.join(tempBaseDir, 'empty-cli');
    fs.mkdirSync(emptyDir, { recursive: true });
    const failRun = spawnSync('node', [cliScript], {
      env: {
        ...process.env,
        BACKUP_DIR: emptyDir,
        BACKUP_PASSPHRASE: testPassphrase,
        STANDBY_MAX_AGE_MINUTES: '90'
      },
      encoding: 'utf8'
    });
    expect(failRun.status).toBe(1);
    expect(failRun.stderr).toContain('فشل فحص الجاهزية الاحتياطية');
  });
});
