import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createApp } from '../server/app.js';
import { SqliteEngine } from '../data/database/sqliteEngine.js';
import { hashPasswordServer } from '../server/utils/crypto.js';

describe('Phase 4: User Management (Admin Only) API and Safeguards', () => {
  let app: any;
  let testEngine: SqliteEngine;
  let tempDir: string;
  let dbPath: string;

  const testPass = 'AdminPhase4Pass@2026';
  let adminCookie: string;
  let secretaryCookie: string;
  let chairmanCookie: string;

  let adminUserId: string;
  let secretaryUserId: string;
  let chairmanUserId: string;
  let adminUsername: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p4_test_db_'));
    dbPath = path.join(tempDir, 'p4_test.db');

    testEngine = new SqliteEngine();
    await testEngine.init(dbPath);

    const { sqliteEngine } = await import('../data/database/sqliteEngine.js');
    await sqliteEngine.init(dbPath);

    app = createApp();

    const pass = hashPasswordServer(testPass);

    // Disable seed admin so our test admin is the primary test admin
    sqliteEngine.run("UPDATE users SET is_disabled = 1 WHERE role = 'ADMIN'");

    // 1. Create ADMIN user
    adminUserId = `usr-adm-${Date.now()}`;
    adminUsername = `admin_${Date.now()}`;
    sqliteEngine.run(
      `INSERT INTO users (id, username, name, title, department_id, email, role, can_view_confidential, password_hash, password_salt, must_change_password, is_disabled, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [adminUserId, adminUsername, 'مسؤول النظام الرئيسي', 'مدير تكنولوجيا المعلومات', 'dept-it', `${adminUsername}@postal.internal`, 'ADMIN', 1, pass.hashHex, pass.saltHex, 0, 0, new Date().toISOString()]
    );

    // 2. Create SECRETARY user
    secretaryUserId = `usr-sec-${Date.now()}`;
    const secUsername = `sec_${Date.now()}`;
    sqliteEngine.run(
      `INSERT INTO users (id, username, name, title, department_id, email, role, can_view_confidential, password_hash, password_salt, must_change_password, is_disabled, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [secretaryUserId, secUsername, 'السكرتير التنفيذي', 'سكرتير أول', 'dept-exec', `${secUsername}@postal.internal`, 'SECRETARY', 1, pass.hashHex, pass.saltHex, 0, 0, new Date().toISOString()]
    );

    // 3. Create CHAIRMAN user
    chairmanUserId = `usr-chm-${Date.now()}`;
    const chmUsername = `chm_${Date.now()}`;
    sqliteEngine.run(
      `INSERT INTO users (id, username, name, title, department_id, email, role, can_view_confidential, password_hash, password_salt, must_change_password, is_disabled, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [chairmanUserId, chmUsername, 'رئيس مجلس الإدارة', 'رئيس المجلس', 'dept-exec', `${chmUsername}@postal.internal`, 'CHAIRMAN', 1, pass.hashHex, pass.saltHex, 0, 0, new Date().toISOString()]
    );

    // Login each to acquire session cookies
    const admLogin = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ username: adminUsername, password: testPass });
    expect(admLogin.status).toBe(200);
    adminCookie = admLogin.headers['set-cookie'];

    const secLogin = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ username: secUsername, password: testPass });
    expect(secLogin.status).toBe(200);
    secretaryCookie = secLogin.headers['set-cookie'];

    const chmLogin = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ username: chmUsername, password: testPass });
    expect(chmLogin.status).toBe(200);
    chairmanCookie = chmLogin.headers['set-cookie'];
  });

  afterAll(() => {
    try {
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  // P4-6: Role Matrix & Authentication tests
  describe('P4-6 Role Matrix on New Admin Routes', () => {
    it('rejects anonymous access (401) on /api/admin/users', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('X-Requested-With', 'XMLHttpRequest');
      expect(res.status).toBe(401);
    });

    it('rejects SECRETARY (403) and CHAIRMAN (403) on /api/admin/users', async () => {
      const secRes = await request(app)
        .get('/api/admin/users')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', secretaryCookie);
      expect(secRes.status).toBe(403);

      const chmRes = await request(app)
        .get('/api/admin/users')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', chairmanCookie);
      expect(chmRes.status).toBe(403);
    });

    it('allows ADMIN (200) on /api/admin/users and does not return password_hash or password_salt', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', adminCookie);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(3);

      for (const u of res.body) {
        expect(u).not.toHaveProperty('password_hash');
        expect(u).not.toHaveProperty('password_salt');
        expect(u).toHaveProperty('id');
        expect(u).toHaveProperty('username');
        expect(u).toHaveProperty('name');
        expect(u).toHaveProperty('role');
      }
    });

    it('verifies GET /api/users still returns full records for ADMIN and picker fields for others', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', secretaryCookie);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      for (const u of res.body) {
        const keys = Object.keys(u).sort();
        expect(keys).toEqual(['id', 'name', 'role', 'title']);
      }
    });

    it('ensures ADMIN still gets 403 on business data routes (correspondence, meetings, directives, matters, contacts)', async () => {
      const corr = await request(app)
        .get('/api/correspondence')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', adminCookie);
      expect(corr.status).toBe(403);

      const mtg = await request(app)
        .get('/api/meetings')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', adminCookie);
      expect(mtg.status).toBe(403);

      const dir = await request(app)
        .get('/api/directives')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', adminCookie);
      expect(dir.status).toBe(403);

      const mat = await request(app)
        .get('/api/matters')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', adminCookie);
      expect(mat.status).toBe(403);

      const cnt = await request(app)
        .get('/api/contacts')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', adminCookie);
      expect(cnt.status).toBe(403);
    });
  });

  // P4-1 & P4-2: User Creation, Random Password, Audit and Secrets
  describe('P4-1 & P4-2 User Creation & Secret Isolation', () => {
    let createdUserId: string;
    let createdUsername: string;
    let oneTimePassword: string;

    it('creates a new user, returns one-time temporary password, sets must_change_password=1', async () => {
      createdUsername = `testuser_${Date.now()}`;
      const payload = {
        username: createdUsername,
        name: 'مستخدم تجريبي جديد',
        title: 'باحث شؤون مكتب أول',
        email: `${createdUsername}@postal.internal`,
        role: 'SECRETARY',
        can_view_confidential: false
      };

      const res = await request(app)
        .post('/api/admin/users')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', adminCookie)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.username).toBe(createdUsername);
      expect(res.body.user.must_change_password).toBe(true);
      expect(res.body.temporary_password).toBeDefined();
      expect(typeof res.body.temporary_password).toBe('string');
      expect(res.body.temporary_password.length).toBeGreaterThanOrEqual(16);

      createdUserId = res.body.user.id;
      oneTimePassword = res.body.temporary_password;

      expect(res.body.user).not.toHaveProperty('password_hash');
      expect(res.body.user).not.toHaveProperty('password_salt');
    });

    it('verifies the temporary password is NOT present anywhere in audit_log rows', async () => {
      const { sqliteEngine } = await import('../data/database/sqliteEngine.js');
      const auditRows = sqliteEngine.query<any>(
        'SELECT before_value, after_value FROM audit_log WHERE entity_id = ?',
        [createdUserId]
      );
      expect(auditRows.length).toBeGreaterThan(0);

      for (const row of auditRows) {
        const fullText = `${row.before_value || ''} ${row.after_value || ''}`;
        expect(fullText).not.toContain(oneTimePassword);
        expect(fullText).not.toContain('password_hash');
        expect(fullText).not.toContain('password_salt');
      }
    });

    it('rejects mass-assignment attributes (e.g. password_hash, id) with 400', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', adminCookie)
        .send({
          username: `mass_assign_${Date.now()}`,
          name: 'تسلل بيانات',
          title: 'اختبار',
          email: 'mass@postal.internal',
          role: 'SECRETARY',
          password_hash: 'injected_hash',
          id: 'custom-id'
        });

      expect(res.status).toBe(400);
    });

    it('rejects duplicate username with 409 and an Arabic error message', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', adminCookie)
        .send({
          username: createdUsername,
          name: 'تكرار اسم الدخول',
          title: 'سكرتير',
          email: 'another_unique@postal.internal',
          role: 'SECRETARY'
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('اسم المستخدم مسجل مسبقاً');
    });

    it('rejects invalid username formats (regex guard: 3-32 chars, lowercase, dot, dash, underscore)', async () => {
      const badUsernames = ['ab', 'USER_UPPERCASE', 'user with space', 'user@at', 'u'.repeat(33)];

      for (const bad of badUsernames) {
        const res = await request(app)
          .post('/api/admin/users')
          .set('X-Requested-With', 'XMLHttpRequest')
          .set('Cookie', adminCookie)
          .send({
            username: bad,
            name: 'اسم تجريبي',
            title: 'وظيفة',
            email: `bad_${Math.random()}@postal.internal`,
            role: 'SECRETARY'
          });
        expect(res.status).toBe(400);
      }
    });
  });

  // P4-3 Safeguards: Last Admin, Self-Disable, Confirmation Phrase
  describe('P4-3 Safeguards and Session Invalidation', () => {
    let dummyAdminId: string;
    let dummyAdminUsername: string;

    it('blocks self-disable for current administrator with 400', async () => {
      const res = await request(app)
        .post(`/api/admin/users/${adminUserId}/disable`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('لا يمكن للمسؤول تعطيل حسابه الشخصي');
    });

    it('creates a second admin to test last-admin protection', async () => {
      dummyAdminUsername = `second_adm_${Date.now()}`;
      const res = await request(app)
        .post('/api/admin/users')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', adminCookie)
        .send({
          username: dummyAdminUsername,
          name: 'مسؤول نظم ثانٍ',
          title: 'مهندس شبكات',
          email: `${dummyAdminUsername}@postal.internal`,
          role: 'ADMIN'
        });

      expect(res.status).toBe(201);
      dummyAdminId = res.body.user.id;
    });

    it('disables the second admin successfully', async () => {
      const res = await request(app)
        .post(`/api/admin/users/${dummyAdminId}/disable`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('blocks demoting the last active admin when attempting role change without another active admin', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${adminUserId}`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', adminCookie)
        .send({
          role: 'SECRETARY',
          confirmation_phrase: 'تأكيد التعديل الأمني'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('لا يمكن خفض رتبة آخر مسؤول نظام نشط');
    });

    it('requires typed confirmation phrase for role change or can_view_confidential clearance change', async () => {
      // Re-enable dummy admin
      await request(app)
        .post(`/api/admin/users/${dummyAdminId}/enable`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', adminCookie);

      // Re-login admin to ensure fresh session
      const admLogin = await request(app)
        .post('/api/auth/login')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ username: adminUsername, password: testPass });
      const freshAdminCookie = admLogin.headers['set-cookie'];

      // Attempt role change without confirmation phrase
      const resNoPhrase = await request(app)
        .patch(`/api/admin/users/${dummyAdminId}`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', freshAdminCookie)
        .send({
          role: 'SECRETARY'
        });
      expect(resNoPhrase.status).toBe(400);
      expect(resNoPhrase.body.error).toContain('تأكيد التعديل الأمني');

      // Attempt with correct phrase
      const resWithPhrase = await request(app)
        .patch(`/api/admin/users/${dummyAdminId}`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', freshAdminCookie)
        .send({
          role: 'SECRETARY',
          confirmation_phrase: 'تأكيد التعديل الأمني'
        });
      expect(resWithPhrase.status).toBe(200);
      expect(resWithPhrase.body.user.role).toBe('SECRETARY');
    });

    it('invalidates active sessions when password is reset or user is disabled', async () => {
      const { sqliteEngine } = await import('../data/database/sqliteEngine.js');
      const pass = hashPasswordServer('DummyPass123!');
      sqliteEngine.run(
        'UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 0, is_disabled = 0 WHERE id = ?',
        [pass.hashHex, pass.saltHex, dummyAdminId]
      );

      const loginRes = await request(app)
        .post('/api/auth/login')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ username: dummyAdminUsername, password: 'DummyPass123!' });
      expect(loginRes.status).toBe(200);
      const userCookie = loginRes.headers['set-cookie'];

      const meResBefore = await request(app)
        .get('/api/auth/me')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', userCookie);
      expect(meResBefore.status).toBe(200);

      const admLogin = await request(app)
        .post('/api/auth/login')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ username: adminUsername, password: testPass });
      const freshAdminCookie = admLogin.headers['set-cookie'];

      const resetRes = await request(app)
        .post(`/api/admin/users/${dummyAdminId}/reset-password`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', freshAdminCookie);
      expect(resetRes.status).toBe(200);
      expect(resetRes.body.temporary_password).toBeDefined();

      const meResAfter = await request(app)
        .get('/api/auth/me')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', userCookie);
      expect(meResAfter.status).toBe(401);
    });
  });
});
