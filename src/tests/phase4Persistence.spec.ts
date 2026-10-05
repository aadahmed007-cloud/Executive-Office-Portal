import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';
import { SqliteEngine } from '../data/database/sqliteEngine.js';
import { verifyAuditLogIntegrity } from '../domain/security/cryptoUtils.js';

describe('Phase 4: Real Persistence & Transactional Integrity', () => {
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exec-portal-persist-'));
    dbPath = path.join(tempDir, 'app.db');
    process.env.DATA_DIR = tempDir;
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('1. First start initializes DB with users and schema_version; simulated restart preserves existing users and passwords without regenerating', async () => {
    const engine1 = new SqliteEngine();
    await engine1.init();

    // Check schema_version
    const versionRows = engine1.query<{ version: number }>('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1');
    expect(versionRows.length).toBeGreaterThan(0);
    expect(versionRows[0].version).toBeGreaterThanOrEqual(1);

    // Read initial users
    const usersFirst = engine1.query<any>('SELECT id, username, password_hash FROM users ORDER BY username ASC');
    expect(usersFirst.length).toBeGreaterThan(0);

    // Insert a custom user and custom item
    engine1.run(
      'INSERT INTO contacts (id, name, entity, position, phone, email, category, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['con-test-p4', 'المستشار القانوني', 'الهيئة', 'مستشار', '01000000000', 'advisor@postal.test', 'official', 'ملاحظة', new Date().toISOString()]
    );

    // Close first engine
    engine1.close();

    // Verify DB file exists on disk
    expect(fs.existsSync(dbPath)).toBe(true);

    // 2. Restart with second engine pointing to same DATA_DIR
    const engine2 = new SqliteEngine();
    await engine2.init();

    // Verify custom data survived
    const contactRows = engine2.query<any>('SELECT * FROM contacts WHERE id = ?', ['con-test-p4']);
    expect(contactRows.length).toBe(1);
    expect(contactRows[0].name).toBe('المستشار القانوني');

    // Verify users and password hashes were NOT regenerated or altered
    const usersSecond = engine2.query<any>('SELECT id, username, password_hash FROM users ORDER BY username ASC');
    expect(usersSecond.length).toBe(usersFirst.length);
    for (let i = 0; i < usersFirst.length; i++) {
      expect(usersSecond[i].username).toBe(usersFirst[i].username);
      expect(usersSecond[i].password_hash).toBe(usersFirst[i].password_hash);
    }

    engine2.close();
  });

  it('2. Atomic Transaction: state changes and audit logs commit together or rollback completely on error', async () => {
    const engine = new SqliteEngine();
    await engine.init();

    const initialCorrCount = engine.query<{ c: number }>('SELECT count(*) as c FROM correspondence')[0].c;
    const initialAuditCount = engine.query<{ c: number }>('SELECT count(*) as c FROM audit_log')[0].c;

    // Simulate an atomic operation where business data insert succeeds but audit entry fails
    expect(() => {
      engine.transaction(() => {
        // Business change
        engine.run(
          'INSERT INTO correspondence (id, serial_number, type, date, source_or_dest_entity, subject, priority, confidentiality, summary, status, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          ['corr-atomic-fail', 'SERIAL-ATOMIC-01', 'incoming', '2026-10-01', 'جهة', 'موضوع', 'normal', 'normal', 'ملخص', 'registered', new Date().toISOString(), new Date().toISOString(), 'مستخدم']
        );

        // Force an error during audit step (e.g. invalid foreign key or forced exception)
        throw new Error('FORCED_AUDIT_FAILURE_SIMULATION');
      });
    }).toThrow('FORCED_AUDIT_FAILURE_SIMULATION');

    // Assert that correspondence was ROLLED BACK and not committed
    const finalCorrCount = engine.query<{ c: number }>('SELECT count(*) as c FROM correspondence')[0].c;
    const finalAuditCount = engine.query<{ c: number }>('SELECT count(*) as c FROM audit_log')[0].c;

    expect(finalCorrCount).toBe(initialCorrCount);
    expect(finalAuditCount).toBe(initialAuditCount);

    const checkItem = engine.query<any>('SELECT * FROM correspondence WHERE id = ?', ['corr-atomic-fail']);
    expect(checkItem.length).toBe(0);

    engine.close();
  });

  it('3. Online Backup creates consistent backup file that passes audit-chain verification', async () => {
    const engine = new SqliteEngine();
    await engine.init();

    const backupFile = path.join(tempDir, 'backup-test.db');
    await engine.backup(backupFile);

    expect(fs.existsSync(backupFile)).toBe(true);

    // Open backup database directly and verify integrity
    const backupDb = new Database(backupFile);
    const auditRows = backupDb.prepare('SELECT * FROM audit_log ORDER BY seq ASC').all() as any[];
    const checkpointRow = backupDb.prepare('SELECT audit_last_seq, audit_head_hash, audit_count FROM settings LIMIT 1').get() as any;

    const checkpoint = checkpointRow ? {
      last_seq: checkpointRow.audit_last_seq,
      head_hash: checkpointRow.audit_head_hash,
      count: checkpointRow.audit_count
    } : null;

    const result = await verifyAuditLogIntegrity(auditRows, checkpoint);
    expect(result.isValid).toBe(true);
    expect(result.totalEntries).toBe(auditRows.length);

    backupDb.close();
    engine.close();
  });
});
