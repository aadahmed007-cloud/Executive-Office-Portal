import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { sqliteEngine } from '../data/database/sqliteEngine.js';
import { hashPasswordServer } from '../server/utils/crypto.js';
import {
  computeAuditEntryHash,
  verifyAuditLogIntegrity,
  GENESIS_BLOCK_HASH
} from '../domain/security/cryptoUtils.js';

describe('Phase 5: Cryptographic Audit Log Chaining & Verification', () => {
  let app: any;
  const commonPass = 'AuditPhase5SecurePass123!';
  let adminCookie: string;
  let secretaryCookie: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await sqliteEngine.init();
    app = createApp();

    const pass = hashPasswordServer(commonPass);

    const adminUsername = `adm_aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    sqliteEngine.run(
      `INSERT INTO users (id, username, name, title, department_id, email, role, can_view_confidential, password_hash, password_salt, must_change_password, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [`usr-adm-${Date.now()}`, adminUsername, 'مدير النظام', 'مسؤول أمني', 'dept-it', `${adminUsername}@audit.test`, 'ADMIN', 1, pass.hashHex, pass.saltHex, 0, new Date().toISOString()]
    );

    const secretaryUsername = `sec_aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    sqliteEngine.run(
      `INSERT INTO users (id, username, name, title, department_id, email, role, can_view_confidential, password_hash, password_salt, must_change_password, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [`usr-sec-${Date.now()}`, secretaryUsername, 'السكرتير الأول', 'أمين السر', 'dept-sec', `${secretaryUsername}@audit.test`, 'SECRETARY', 1, pass.hashHex, pass.saltHex, 0, new Date().toISOString()]
    );

    const loginAdm = await request(app).post('/api/auth/login').set('X-Requested-With', 'XMLHttpRequest').send({ username: adminUsername, password: commonPass });
    adminCookie = loginAdm.headers['set-cookie'];

    const loginSec = await request(app).post('/api/auth/login').set('X-Requested-With', 'XMLHttpRequest').send({ username: secretaryUsername, password: commonPass });
    secretaryCookie = loginSec.headers['set-cookie'];
  });

  it('1. GET /api/audit/verify endpoint returns valid verification result for ADMIN and SECRETARY', async () => {
    const resAdm = await request(app).get('/api/audit/verify').set('Cookie', adminCookie);
    expect(resAdm.status).toBe(200);
    expect(resAdm.body.isValid).toBe(true);
    expect(resAdm.body.totalEntries).toBeGreaterThan(0);

    const resSec = await request(app).get('/api/audit/verify').set('Cookie', secretaryCookie);
    expect(resSec.status).toBe(200);
    expect(resSec.body.isValid).toBe(true);
  });

  it('2. Tamper Detection: Modified row payload is immediately detected as invalid', async () => {
    // Build a valid 3-entry synthetic chain
    const entry1: any = {
      seq: 1,
      id: 'aud-01',
      timestamp: '2026-10-01T10:00:00Z',
      user_id: 'usr-1',
      user_role: 'SECRETARY',
      action_type: 'CREATE',
      entity_type: 'CORRESPONDENCE',
      entity_id: 'corr-1',
      before_value: null,
      after_value: 'Initial Subject',
      ip_address: null,
      prev_hash: GENESIS_BLOCK_HASH,
      is_confidential: 0
    };
    entry1.entry_hash = await computeAuditEntryHash(entry1);

    const entry2: any = {
      seq: 2,
      id: 'aud-02',
      timestamp: '2026-10-01T10:05:00Z',
      user_id: 'usr-1',
      user_role: 'SECRETARY',
      action_type: 'UPDATE',
      entity_type: 'CORRESPONDENCE',
      entity_id: 'corr-1',
      before_value: 'Initial Subject',
      after_value: 'Updated Subject',
      ip_address: null,
      prev_hash: entry1.entry_hash,
      is_confidential: 0
    };
    entry2.entry_hash = await computeAuditEntryHash(entry2);

    const checkpoint = {
      last_seq: 2,
      head_hash: entry2.entry_hash,
      count: 2
    };

    // Verify pristine chain
    const pristineRes = await verifyAuditLogIntegrity([entry1, entry2], checkpoint);
    expect(pristineRes.isValid).toBe(true);

    // Tamper with entry2's content without re-signing
    const tamperedEntry2 = { ...entry2, after_value: 'MALICIOUS_TAMPERED_SUBJECT' };
    const tamperedRes = await verifyAuditLogIntegrity([entry1, tamperedEntry2], checkpoint);
    expect(tamperedRes.isValid).toBe(false);
    expect(tamperedRes.brokenEntryId).toBe('aud-02');
  });

  it('3. Tamper Detection: Deleting the oldest row is detected via checkpoint and sequence validation', async () => {
    const entry1: any = {
      seq: 1,
      id: 'aud-11',
      timestamp: '2026-10-01T10:00:00Z',
      user_id: 'usr-1',
      user_role: 'SECRETARY',
      action_type: 'CREATE',
      entity_type: 'CORRESPONDENCE',
      entity_id: 'corr-1',
      prev_hash: GENESIS_BLOCK_HASH,
      is_confidential: 0
    };
    entry1.entry_hash = await computeAuditEntryHash(entry1);

    const entry2: any = {
      seq: 2,
      id: 'aud-12',
      timestamp: '2026-10-01T10:05:00Z',
      user_id: 'usr-1',
      user_role: 'SECRETARY',
      action_type: 'UPDATE',
      entity_type: 'CORRESPONDENCE',
      entity_id: 'corr-1',
      prev_hash: entry1.entry_hash,
      is_confidential: 0
    };
    entry2.entry_hash = await computeAuditEntryHash(entry2);

    const checkpoint = {
      last_seq: 2,
      head_hash: entry2.entry_hash,
      count: 2
    };

    // Attacker deletes row 1 (leaving only row 2)
    const result = await verifyAuditLogIntegrity([entry2], checkpoint);
    expect(result.isValid).toBe(false);
    expect(result.brokenReason).toContain('حذف');
  });

  it('4. Tamper Detection: Deleting the newest row is detected via checkpoint mismatch', async () => {
    const entry1: any = {
      seq: 1,
      id: 'aud-21',
      timestamp: '2026-10-01T10:00:00Z',
      user_id: 'usr-1',
      user_role: 'SECRETARY',
      action_type: 'CREATE',
      entity_type: 'CORRESPONDENCE',
      entity_id: 'corr-1',
      prev_hash: GENESIS_BLOCK_HASH,
      is_confidential: 0
    };
    entry1.entry_hash = await computeAuditEntryHash(entry1);

    const entry2: any = {
      seq: 2,
      id: 'aud-22',
      timestamp: '2026-10-01T10:05:00Z',
      user_id: 'usr-1',
      user_role: 'SECRETARY',
      action_type: 'UPDATE',
      entity_type: 'CORRESPONDENCE',
      entity_id: 'corr-1',
      prev_hash: entry1.entry_hash,
      is_confidential: 0
    };
    entry2.entry_hash = await computeAuditEntryHash(entry2);

    const checkpoint = {
      last_seq: 2,
      head_hash: entry2.entry_hash,
      count: 2
    };

    // Attacker deletes row 2 (leaving only row 1)
    const result = await verifyAuditLogIntegrity([entry1], checkpoint);
    expect(result.isValid).toBe(false);
    expect(result.brokenReason).toContain('حذف');
  });

  it('5. Tamper Detection: Null or empty entry_hash is detected as broken', async () => {
    const brokenEntry: any = {
      seq: 1,
      id: 'aud-null-hash',
      timestamp: '2026-10-01T10:00:00Z',
      user_id: 'usr-1',
      user_role: 'SECRETARY',
      action_type: 'CREATE',
      entity_type: 'CORRESPONDENCE',
      entity_id: 'corr-1',
      prev_hash: GENESIS_BLOCK_HASH,
      entry_hash: '',
      is_confidential: 0
    };

    const result = await verifyAuditLogIntegrity([brokenEntry], null);
    expect(result.isValid).toBe(false);
    expect(result.brokenEntryId).toBe('aud-null-hash');
  });

  it('6. Concurrent writes with mutex serialize properly and maintain valid hash chain', async () => {
    const operations = Array.from({ length: 8 }, (_, i) => ({
      entity_type: 'CORRESPONDENCE',
      entity_id: `corr-concurrent-${i}`,
      action_type: 'CREATE',
      user_id: 'usr-concurrent',
      user_name: 'مستخدم متزامن',
      user_role: 'SECRETARY',
      before_value: null,
      after_value: `Content ${i}`,
      ip_address: null
    }));

    // Execute concurrently
    await Promise.all(
      operations.map((op) =>
        sqliteEngine.runWithMutex(async () => {
          const latest = sqliteEngine.query<{ seq: number; entry_hash: string }>('SELECT seq, entry_hash FROM audit_log ORDER BY seq DESC LIMIT 1');
          const prevHash = latest[0]?.entry_hash || GENESIS_BLOCK_HASH;
          const nextSeq = (latest[0]?.seq || 0) + 1;
          const id = `audit-conc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          const timestamp = new Date().toISOString();

          const entryToHash = {
            seq: nextSeq,
            id,
            timestamp,
            user_id: op.user_id,
            user_role: op.user_role,
            action_type: op.action_type,
            entity_type: op.entity_type,
            entity_id: op.entity_id,
            before_value: op.before_value,
            after_value: op.after_value,
            ip_address: op.ip_address,
            prev_hash: prevHash,
            is_confidential: 0
          };
          const entryHash = await computeAuditEntryHash(entryToHash);

          sqliteEngine.run(
            `INSERT INTO audit_log (id, user_id, user_name, user_role, action_type, entity_type, entity_id, before_value, after_value, timestamp, ip_address, prev_hash, entry_hash, is_confidential)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, op.user_id, op.user_name, op.user_role, op.action_type, op.entity_type, op.entity_id, op.before_value, op.after_value, timestamp, op.ip_address, prevHash, entryHash, 0]
          );

          sqliteEngine.run(
            'UPDATE settings SET audit_last_seq = ?, audit_head_hash = ?, audit_count = audit_count + 1 WHERE id = ?',
            [nextSeq, entryHash, 'settings-global']
          );
        })
      )
    );

    // Verify entire audit log in DB
    const allRows = sqliteEngine.query<any>('SELECT * FROM audit_log ORDER BY seq ASC');
    const checkpointRow = sqliteEngine.query<any>('SELECT audit_last_seq, audit_head_hash, audit_count FROM settings LIMIT 1')[0];

    const checkpoint = checkpointRow ? {
      last_seq: checkpointRow.audit_last_seq,
      head_hash: checkpointRow.audit_head_hash,
      count: checkpointRow.audit_count
    } : null;

    const result = await verifyAuditLogIntegrity(allRows, checkpoint);
    expect(result.isValid).toBe(true);
    expect(result.totalEntries).toBe(allRows.length);
  });
});
