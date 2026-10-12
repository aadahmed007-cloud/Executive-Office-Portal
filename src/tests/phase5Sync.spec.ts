import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { sqliteEngine } from '../data/database/sqliteEngine.js';
import { hashPasswordServer } from '../server/utils/crypto.js';

describe('Phase 5: Multi-Device Freshness & Change Version Sync', () => {
  let app: any;
  const commonPass = 'SyncPhase5SecurePass123!';
  let adminCookie: string;
  let secretaryCookie: string;
  let normalUserCookie: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await sqliteEngine.init();
    app = createApp();
    const pass = hashPasswordServer(commonPass);

    const adminUsername = `adm_sync_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    sqliteEngine.run(
      `INSERT INTO users (id, username, name, title, department_id, email, role, can_view_confidential, password_hash, password_salt, must_change_password, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [`usr-adm-${Date.now()}`, adminUsername, 'مدير النظام', 'مسؤول أمني', 'dept-it', `${adminUsername}@sync.test`, 'ADMIN', 1, pass.hashHex, pass.saltHex, 0, new Date().toISOString()]
    );

    const secretaryUsername = `sec_sync_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    sqliteEngine.run(
      `INSERT INTO users (id, username, name, title, department_id, email, role, can_view_confidential, password_hash, password_salt, must_change_password, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [`usr-sec-${Date.now()}`, secretaryUsername, 'السكرتير الأول', 'أمين السر', 'dept-sec', `${secretaryUsername}@sync.test`, 'SECRETARY', 1, pass.hashHex, pass.saltHex, 0, new Date().toISOString()]
    );

    const normalUsername = `usr_sync_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    sqliteEngine.run(
      `INSERT INTO users (id, username, name, title, department_id, email, role, can_view_confidential, password_hash, password_salt, must_change_password, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [`usr-norm-${Date.now()}`, normalUsername, 'موظف عادي', 'كاتب', 'dept-ops', `${normalUsername}@sync.test`, 'SECRETARY', 0, pass.hashHex, pass.saltHex, 0, new Date().toISOString()]
    );

    const loginAdm = await request(app).post('/api/auth/login').set('X-Requested-With', 'XMLHttpRequest').send({ username: adminUsername, password: commonPass });
    adminCookie = loginAdm.headers['set-cookie'];

    const loginSec = await request(app).post('/api/auth/login').set('X-Requested-With', 'XMLHttpRequest').send({ username: secretaryUsername, password: commonPass });
    secretaryCookie = loginSec.headers['set-cookie'];

    const loginNorm = await request(app).post('/api/auth/login').set('X-Requested-With', 'XMLHttpRequest').send({ username: normalUsername, password: commonPass });
    normalUserCookie = loginNorm.headers['set-cookie'];
  });

  it('1. GET /api/sync/version requires authentication (401 if unauthenticated)', async () => {
    const res = await request(app).get('/api/sync/version');
    expect(res.status).toBe(401);
  });

  it('2. Users with can_view_confidential receive non_confidential_version and confidential_version', async () => {
    const res = await request(app).get('/api/sync/version').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('non_confidential_version');
    expect(res.body).toHaveProperty('confidential_version');
    expect(typeof res.body.non_confidential_version).toBe('number');
    expect(typeof res.body.confidential_version).toBe('number');
  });

  it('3. Uncleared users (can_view_confidential = 0) receive ONLY non_confidential_version with no confidential_version hint', async () => {
    const res = await request(app).get('/api/sync/version').set('Cookie', normalUserCookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('non_confidential_version');
    expect(res.body).not.toHaveProperty('confidential_version');
  });

  it('4. Counter increments inside transaction; rolled-back transaction leaves counters unchanged', async () => {
    const beforeRows = sqliteEngine.query<{ non_confidential_version: number }>('SELECT non_confidential_version FROM change_versions WHERE id = 1');
    const vBefore = beforeRows[0].non_confidential_version;

    // Test rollback leaves counter unchanged
    try {
      sqliteEngine.transaction(() => {
        sqliteEngine.run('UPDATE change_versions SET non_confidential_version = non_confidential_version + 1 WHERE id = 1', []);
        throw new Error('Force rollback');
      });
    } catch {}

    const afterRollbackRows = sqliteEngine.query<{ non_confidential_version: number }>('SELECT non_confidential_version FROM change_versions WHERE id = 1');
    expect(afterRollbackRows[0].non_confidential_version).toBe(vBefore);
  });
});
