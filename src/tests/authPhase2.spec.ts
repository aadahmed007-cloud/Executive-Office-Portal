import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { sqliteEngine } from '../data/database/sqliteEngine.js';
import { hashPasswordServer } from '../server/utils/crypto.js';
import { SESSION_COOKIE_NAME } from '../server/services/session.service.js';

describe('Phase 2: Server-Side Authentication & Session Security', () => {
  let app: any;
  const testPassword = 'TestPassword123!';
  const testUsername = `test_user_p2_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  let testUserId = 'usr-test-p2';

  beforeAll(async () => {
    await sqliteEngine.init();
    app = createApp();

    // Insert a known test user for deterministic test cases
    const credentials = hashPasswordServer(testPassword);
    testUserId = `usr-test-${Date.now()}`;
    sqliteEngine.run(
      `INSERT INTO users (id, username, name, title, department_id, email, role, can_view_confidential, password_hash, password_salt, must_change_password, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        testUserId,
        testUsername,
        'مستخدم اختبار الخادم',
        'مختبر نظم',
        'dept-tech',
        `${testUsername}@postal.internal`,
        'SECRETARY',
        1,
        credentials.hashHex,
        credentials.saltHex,
        0,
        new Date().toISOString()
      ]
    );
  });

  it('rejects state-changing requests without custom CSRF header', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: testUsername, password: testPassword });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('CSRF');
  });

  it('authenticates valid credentials, sets HttpOnly cookie, and returns safe user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ username: testUsername, password: testPassword });

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.username).toBe(testUsername);
    expect(res.body.user.password_hash).toBeUndefined();
    expect(res.body.user.password_salt).toBeUndefined();

    // Check Set-Cookie header
    const rawCookies = res.headers['set-cookie'];
    expect(rawCookies).toBeDefined();
    const cookieList: string[] = Array.isArray(rawCookies) ? rawCookies : [rawCookies as string];
    const sessionCookie = cookieList.find((c: string) => c.includes(SESSION_COOKIE_NAME));
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toContain('HttpOnly');
    expect(sessionCookie).toContain('SameSite=Strict');
  });

  it('returns identical generic 401 error for unknown user and wrong password', async () => {
    // 1. Unknown user
    const resUnknown = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ username: 'non_existent_account_999', password: 'WrongPassword123!' });

    // 2. Wrong password for existing user
    const resWrongPass = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ username: testUsername, password: 'IncorrectPassword999!' });

    expect(resUnknown.status).toBe(401);
    expect(resWrongPass.status).toBe(401);
    expect(resUnknown.body.error).toBe(resWrongPass.body.error);
  });

  it('rejects unauthorized access to protected routes without session cookie', async () => {
    const res = await request(app).get('/api/meetings');
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('يرجى تسجيل الدخول أولاً للوصول إلى هذا المورد');
  });

  it('completely ignores forged client headers (X-User-Role / X-Can-View-Confidential)', async () => {
    const res = await request(app)
      .get('/api/meetings')
      .set('X-User-Id', 'usr-chairman')
      .set('X-User-Role', 'CHAIRMAN')
      .set('X-Can-View-Confidential', 'true');

    expect(res.status).toBe(401);
  });

  it('loads current user via GET /api/auth/me with active session', async () => {
    // Login to get session cookie
    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ username: testUsername, password: testPassword });

    const cookie = loginRes.headers['set-cookie'];

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.username).toBe(testUsername);
  });

  it('enforces must_change_password restriction on operational routes', async () => {
    // Create user with must_change_password = 1
    const forcedUser = `forced_change_user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const forcedPass = 'ForcedInitialPass123!';
    const creds = hashPasswordServer(forcedPass);

    sqliteEngine.run(
      `INSERT INTO users (id, username, name, title, department_id, email, role, can_view_confidential, password_hash, password_salt, must_change_password, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `usr-forced-${Date.now()}`,
        forcedUser,
        'مستخدم إلزامي التغيير',
        'مساعد إداري',
        'dept-exec',
        `${forcedUser}@postal.internal`,
        'SECRETARY',
        1,
        creds.hashHex,
        creds.saltHex,
        1, // must_change_password = 1
        new Date().toISOString()
      ]
    );

    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ username: forcedUser, password: forcedPass });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.must_change_password).toBe(true);

    const cookie = loginRes.headers['set-cookie'];

    // Operational route should be blocked with 403 code MUST_CHANGE_PASSWORD
    const meetingRes = await request(app)
      .get('/api/meetings')
      .set('Cookie', cookie);

    expect(meetingRes.status).toBe(403);
    expect(meetingRes.body.code).toBe('MUST_CHANGE_PASSWORD');

    // But GET /api/auth/me is allowed
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie);
    expect(meRes.status).toBe(200);
  });

  it('destroys session on logout and clears cookie', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ username: testUsername, password: testPassword });

    const cookie = loginRes.headers['set-cookie'];

    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', cookie);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);

    // Subsequent call with old cookie must fail with 401
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie);

    expect(meRes.status).toBe(401);
  });

  it('returns JSON 404 for unknown /api/* endpoints (never HTML)', async () => {
    // Authenticate first
    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ username: testUsername, password: testPassword });

    const cookie = loginRes.headers['set-cookie'];

    const res = await request(app)
      .get('/api/non-existent-endpoint-xyz')
      .set('Cookie', cookie);

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('rejects state-changing requests with mismatched Origin header', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Origin', 'https://malicious-site.attacker.com')
      .send({ username: testUsername, password: testPassword });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('طلب مرفوض: عدم تطابق مصدر الطلب');
  });
});
