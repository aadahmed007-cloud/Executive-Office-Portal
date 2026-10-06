import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';
import { SqliteEngine } from '../data/database/sqliteEngine.js';
import {
  createEncryptedBackup,
  verifyBackupFile,
  restoreTest,
  encryptBuffer,
  decryptBuffer,
  BACKUP_MAGIC_HEADER
} from '../../scripts/backup.js';

describe('Phase 4.5: Military-Grade Encrypted Backup & Auto-Verification (Section C)', () => {
  let tempDir: string;
  let dataDir: string;
  let backupDir: string;
  const testPassphrase = 'VaultSecureBackupPassphrase2026!#$';

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exec-portal-bk-test-'));
    dataDir = path.join(tempDir, 'var', 'data');
    backupDir = path.join(tempDir, 'var', 'backups');
    process.env.DATA_DIR = dataDir;
    process.env.BACKUP_DIR = backupDir;
    delete process.env.BACKUP_PASSPHRASE;
    delete process.env.BACKUP_ALLOW_PLAINTEXT;

    // Seed database in test data dir
    const engine = new SqliteEngine();
    await engine.init();
    engine.close();
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('1. Backup refuses to write plaintext backup without passphrase unless explicitly permitted', async () => {
    await expect(
      createEncryptedBackup({ dataDir, backupDir })
    ).rejects.toThrow('BACKUP_PASSPHRASE');
  });

  it('2. Backup succeeds with passphrase, produces file with magic header that is NOT readable as SQLite database', async () => {
    const result = await createEncryptedBackup({
      dataDir,
      backupDir,
      passphrase: testPassphrase
    });

    expect(result.success).toBe(true);
    expect(result.isEncrypted).toBe(true);
    expect(fs.existsSync(result.backupFilePath)).toBe(true);

    const fileContent = fs.readFileSync(result.backupFilePath);
    expect(fileContent.subarray(0, 16).equals(BACKUP_MAGIC_HEADER)).toBe(true);

    // Attempting to open encrypted backup directly as SQLite DB must throw
    expect(() => {
      const db = new Database(result.backupFilePath);
      db.prepare('SELECT count(*) FROM users').get();
      db.close();
    }).toThrow();
  });

  it('3. Decryption fails with invalid passphrase', async () => {
    const result = await createEncryptedBackup({
      dataDir,
      backupDir,
      passphrase: testPassphrase
    });

    await expect(
      verifyBackupFile(result.backupFilePath, 'WrongPassphrase123!')
    ).rejects.toThrow();
  });

  it('4. Tampered ciphertext is detected and fails AES-256-GCM authentication tag verification', async () => {
    const result = await createEncryptedBackup({
      dataDir,
      backupDir,
      passphrase: testPassphrase
    });

    const fileBuffer = fs.readFileSync(result.backupFilePath);
    // Tamper with the last byte of ciphertext
    fileBuffer[fileBuffer.length - 1] ^= 0xff;
    const tamperedPath = path.join(backupDir, 'tampered-backup.db.enc');
    fs.writeFileSync(tamperedPath, fileBuffer);

    await expect(
      verifyBackupFile(tamperedPath, testPassphrase)
    ).rejects.toThrow();
  });

  it('5. Valid backup passes all integrity checks and restores perfectly to a temp directory with identical row counts', async () => {
    const result = await createEncryptedBackup({
      dataDir,
      backupDir,
      passphrase: testPassphrase
    });

    const verify = await verifyBackupFile(result.backupFilePath, testPassphrase);
    expect(verify.isValid).toBe(true);
    expect(verify.rowCounts.users).toBeGreaterThan(0);
    expect(verify.rowCounts.correspondence).toBeGreaterThan(0);
    expect(verify.rowCounts.audit_log).toBeGreaterThan(0);

    const restore = await restoreTest(result.backupFilePath, testPassphrase);
    expect(restore.success).toBe(true);
    expect(restore.rowCounts.users).toBe(verify.rowCounts.users);
    expect(restore.rowCounts.correspondence).toBe(verify.rowCounts.correspondence);
  });
});
