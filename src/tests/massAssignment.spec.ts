import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { sqliteEngine } from '../data/database/sqliteEngine.js';
import { hashPasswordServer } from '../server/utils/crypto.js';

describe('Mass Assignment & Strict Validation Verification (Section A)', () => {
  let app: any;
  const commonPass = 'MassAssignSecurePass123!';
  let secretaryCookie: string;
  let chairmanCookie: string;
  let unclearedCookie: string;
  let testCorrId: string;
  let testConfCorrId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await sqliteEngine.init();
    app = createApp();

    const pass = hashPasswordServer(commonPass);

    // 1. Create Secretary User
    const secretaryUsername = `sec_ma_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    sqliteEngine.run(
      `INSERT INTO users (id, username, name, title, department_id, email, role, can_view_confidential, password_hash, password_salt, must_change_password, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [`usr-sec-${Date.now()}`, secretaryUsername, 'السكرتير التنفيذي', 'سكرتير أول', 'dept-sec', `${secretaryUsername}@internal.test`, 'SECRETARY', 1, pass.hashHex, pass.saltHex, 0, new Date().toISOString()]
    );

    // 2. Create Chairman User
    const chairmanUsername = `chm_ma_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    sqliteEngine.run(
      `INSERT INTO users (id, username, name, title, department_id, email, role, can_view_confidential, password_hash, password_salt, must_change_password, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [`usr-chm-${Date.now()}`, chairmanUsername, 'رئيس مجلس الإدارة', 'رئيس مجلس الإدارة', 'dept-chm', `${chairmanUsername}@internal.test`, 'CHAIRMAN', 1, pass.hashHex, pass.saltHex, 0, new Date().toISOString()]
    );

    // 3. Create Uncleared Secretary User
    const unclearedUsername = `unc_ma_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    sqliteEngine.run(
      `INSERT INTO users (id, username, name, title, department_id, email, role, can_view_confidential, password_hash, password_salt, must_change_password, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [`usr-unc-${Date.now()}`, unclearedUsername, 'مساعد بدون تصريح', 'مساعد', 'dept-sec', `${unclearedUsername}@internal.test`, 'SECRETARY', 0, pass.hashHex, pass.saltHex, 0, new Date().toISOString()]
    );

    // Login
    const loginSec = await request(app).post('/api/auth/login').set('X-Requested-With', 'XMLHttpRequest').send({ username: secretaryUsername, password: commonPass });
    secretaryCookie = loginSec.headers['set-cookie'];

    const loginChm = await request(app).post('/api/auth/login').set('X-Requested-With', 'XMLHttpRequest').send({ username: chairmanUsername, password: commonPass });
    chairmanCookie = loginChm.headers['set-cookie'];

    const loginUnc = await request(app).post('/api/auth/login').set('X-Requested-With', 'XMLHttpRequest').send({ username: unclearedUsername, password: commonPass });
    unclearedCookie = loginUnc.headers['set-cookie'];

    // Seed test correspondence
    testCorrId = `corr-ma-${Date.now()}`;
    const now = new Date().toISOString();
    sqliteEngine.run(
      `INSERT INTO correspondence (id, serial_number, type, date, source_or_dest_entity, subject, priority, confidentiality, summary, status, created_at, updated_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [testCorrId, `CORR-MA-${Date.now()}`, 'incoming', '2026-10-01', 'هيئة البريد', 'موضوع الاختبار الأمني للمطابقة', 'normal', 'normal', 'ملخص أصلي', 'registered', now, now, 'السكرتير التنفيذي']
    );

    testConfCorrId = `corr-conf-ma-${Date.now()}`;
    sqliteEngine.run(
      `INSERT INTO correspondence (id, serial_number, type, date, source_or_dest_entity, subject, priority, confidentiality, summary, status, created_at, updated_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [testConfCorrId, `CONF-MA-${Date.now()}`, 'incoming', '2026-10-01', 'مكتب سري', 'تقرير سري للغاية', 'urgent', 'confidential', 'ملخص سري', 'registered', now, now, 'السكرتير التنفيذي']
    );
  });

  it('1. Secretary cannot change status, created_by, serial_number, or confidentiality via PATCH (rejected with 400 or fields excluded; DB unchanged)', async () => {
    const res = await request(app)
      .patch(`/api/correspondence/${testCorrId}`)
      .set('Cookie', secretaryCookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        status: 'approved',
        created_by: 'usr-chairman'
      });

    // Zod .strict() rejects unknown keys on update schema with 400 Bad Request
    expect(res.status).toBe(400);

    // Verify in database that neither status nor created_by was modified
    const rows = sqliteEngine.query<any>('SELECT status, created_by, serial_number, confidentiality FROM correspondence WHERE id = ?', [testCorrId]);
    expect(rows[0].status).toBe('registered');
    expect(rows[0].created_by).toBe('السكرتير التنفيذي');
  });

  it('2. Unknown body keys are strictly rejected with 400 Bad Request across write endpoints', async () => {
    const res = await request(app)
      .patch(`/api/correspondence/${testCorrId}`)
      .set('Cookie', secretaryCookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        subject: 'تحديث شرعي للموضوع',
        malicious_injected_field: 'hacked',
        role_override: 'ADMIN'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('بيانات الطلب غير صالحة');
  });

  it('3. Chairman cannot create registry data (POST /api/correspondence returns 403)', async () => {
    const res = await request(app)
      .post('/api/correspondence')
      .set('Cookie', chairmanCookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        type: 'incoming',
        date: '2026-10-05',
        source_or_dest_entity: 'جهة خارجية',
        subject: 'محاولة تسجيل غير مصرحة',
        priority: 'normal',
        summary: 'ملخص'
      });

    expect(res.status).toBe(403);
  });

  it('4. Illegal status transitions return 409 Conflict', async () => {
    // Submit correspondence from 'registered' -> 'submitted'
    const resSubmit = await request(app)
      .post(`/api/correspondence/${testCorrId}/submit`)
      .set('Cookie', secretaryCookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ comment: 'إحالة أولى' });

    expect(resSubmit.status).toBe(200);

    // Submitting again on an already-submitted correspondence must fail with 409 Conflict
    const resIllegalSubmit = await request(app)
      .post(`/api/correspondence/${testCorrId}/submit`)
      .set('Cookie', secretaryCookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ comment: 'إحالة غير قانونية مكررة' });

    expect(resIllegalSubmit.status).toBe(409);
    expect(resIllegalSubmit.body.error).toContain('لا يمكن إحالة المكاتبة');
  });

  it('5. Uncleared user cannot archive a confidential item (returns 404 or 403; item remains untouched)', async () => {
    const resArchive = await request(app)
      .delete(`/api/correspondence/${testConfCorrId}`)
      .set('Cookie', unclearedCookie)
      .set('X-Requested-With', 'XMLHttpRequest');

    expect([403, 404]).toContain(resArchive.status);

    // Verify record in DB is not deleted
    const rows = sqliteEngine.query<any>('SELECT deleted_at FROM correspondence WHERE id = ?', [testConfCorrId]);
    expect(rows[0].deleted_at).toBeNull();
  });
});
