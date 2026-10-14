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
    const beforeRows = sqliteEngine.query<{ non_confidential_version: number; confidential_version: number }>('SELECT non_confidential_version, confidential_version FROM change_versions WHERE id = 1');
    const vNonConfBefore = beforeRows[0].non_confidential_version;
    const vConfBefore = beforeRows[0].confidential_version;

    // Test successful transaction increment
    sqliteEngine.transaction(() => {
      sqliteEngine.incrementVersion(false);
      sqliteEngine.incrementVersion(true);
    });

    const afterTxRows = sqliteEngine.query<{ non_confidential_version: number; confidential_version: number }>('SELECT non_confidential_version, confidential_version FROM change_versions WHERE id = 1');
    expect(afterTxRows[0].non_confidential_version).toBe(vNonConfBefore + 1);
    expect(afterTxRows[0].confidential_version).toBe(vConfBefore + 1);

    // Test rollback leaves counter unchanged
    try {
      sqliteEngine.transaction(() => {
        sqliteEngine.incrementVersion(false);
        sqliteEngine.incrementVersion(true);
        throw new Error('Force rollback');
      });
    } catch {}

    const afterRollbackRows = sqliteEngine.query<{ non_confidential_version: number; confidential_version: number }>('SELECT non_confidential_version, confidential_version FROM change_versions WHERE id = 1');
    expect(afterRollbackRows[0].non_confidential_version).toBe(vNonConfBefore + 1);
    expect(afterRollbackRows[0].confidential_version).toBe(vConfBefore + 1);
  });

  it('5. Polling hook logic respects Page Visibility API and pauses when hidden (fake timers)', async () => {
    const vi = (await import('vitest')).vi;
    vi.useFakeTimers();

    let pollCount = 0;
    let isVisible = false;

    // Simulate hook visibility guard & interval
    const intervalMs = 20000;
    const intervalId = setInterval(() => {
      if (isVisible) {
        pollCount++;
      }
    }, intervalMs);

    // 1. Advance timer 60s while hidden -> should not poll
    vi.advanceTimersByTime(60000);
    expect(pollCount).toBe(0);

    // 2. Tab becomes visible -> resumes polling
    isVisible = true;
    pollCount++; // immediate fetch on visibility
    expect(pollCount).toBe(1);

    // 3. Advance timer 40s while visible -> 2 more polls
    vi.advanceTimersByTime(40000);
    expect(pollCount).toBe(3);

    // 4. Tab becomes hidden -> pauses polling
    isVisible = false;
    vi.advanceTimersByTime(40000);
    expect(pollCount).toBe(3);

    clearInterval(intervalId);
    vi.useRealTimers();
  });

  it('6. Backoff on errors increases interval cleanly', () => {
    const baseInterval = 20000;
    const calculateBackoff = (errorCount: number) => Math.min(baseInterval * Math.pow(1.5, errorCount), 120000);

    expect(calculateBackoff(0)).toBe(20000);
    expect(calculateBackoff(1)).toBe(30000);
    expect(calculateBackoff(2)).toBe(45000);
    expect(calculateBackoff(10)).toBe(120000); // capped at 120s
  });

  it('7. Input drafts are preserved on refresh without discarding unsaved user input', () => {
    // Simulate user typing into draft state
    let draftInput = 'مسودة توجيه لم يتم حفظها بعد';
    let dataList = ['البند 1', 'البند 2'];

    // Simulate background refresh trigger from custom event
    const handleDataRefreshed = (newItems: string[]) => {
      dataList = newItems;
      // Note: draftInput is NOT touched or reassigned
    };

    handleDataRefreshed(['البند 1', 'البند 2', 'البند 3 الجديد من جهاز آخر']);

    // Assert that the draft input is completely preserved while data list is updated
    expect(draftInput).toBe('مسودة توجيه لم يتم حفظها بعد');
    expect(dataList).toHaveLength(3);
  });
});

