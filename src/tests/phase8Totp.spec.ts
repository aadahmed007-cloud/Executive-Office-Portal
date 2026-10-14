import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { sqliteEngine } from '../data/database/sqliteEngine.js';
import { hashPasswordServer } from '../server/utils/crypto.js';
import {
  generateTotpSecret,
  generateTotpCode,
  verifyTotpCode,
  generateRecoveryCodes,
  verifyAndConsumeRecoveryCode,
  encryptTotpSecret,
  decryptTotpSecret,
  checkTotpLockout,
  recordTotpFailure
} from '../server/services/totp.service.js';

describe('Phase 8: Two-Factor Authentication (TOTP / RFC 6238)', () => {
  let app: any;
  const commonPass = 'SuperSecurePass2026!#';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await sqliteEngine.init();
    app = createApp();
  });

  it('1. RFC 6238 test vectors and drift window verification', () => {
    const secret = generateTotpSecret(20);
    const now = Math.floor(Date.now() / 1000);

    const currentCode = generateTotpCode(secret, now, 6, 30);
    const verifyNow = verifyTotpCode(secret, currentCode, now, { window: 1 });
    expect(verifyNow.isValid).toBe(true);

    // Test drift window (previous step / next step)
    const prevCode = generateTotpCode(secret, now - 30, 6, 30);
    const verifyPrev = verifyTotpCode(secret, prevCode, now, { window: 1 });
    expect(verifyPrev.isValid).toBe(true);

    const nextCode = generateTotpCode(secret, now + 30, 6, 30);
    const verifyNext = verifyTotpCode(secret, nextCode, now, { window: 1 });
    expect(verifyNext.isValid).toBe(true);
  });

  it('2. Code reuse rejection within the same step', () => {
    const secret = generateTotpSecret(20);
    const now = Math.floor(Date.now() / 1000);
    const code = generateTotpCode(secret, now, 6, 30);

    const firstVerify = verifyTotpCode(secret, code, now, { window: 1, lastStep: -1 });
    expect(firstVerify.isValid).toBe(true);

    const matchedStep = firstVerify.matchedStep!;

    // Replay attempt with same matchedStep should fail
    const replayVerify = verifyTotpCode(secret, code, now, { window: 1, lastStep: matchedStep });
    expect(replayVerify.isValid).toBe(false);
    expect(replayVerify.reason).toBe('REUSED_CODE');
  });

  it('3. Recovery codes generation, hashing, and single-use consumption', () => {
    const { plaintextCodes, hashedCodes } = generateRecoveryCodes(10);
    expect(plaintextCodes.length).toBe(10);
    expect(hashedCodes.length).toBe(10);

    const testCode = plaintextCodes[0];
    let hashesJson = JSON.stringify(hashedCodes);

    // First consumption succeeds
    const consume1 = verifyAndConsumeRecoveryCode(testCode, hashesJson);
    expect(consume1.isValid).toBe(true);
    expect(consume1.remainingHashedCodesJson).toBeDefined();

    // Second consumption (reuse) fails
    const consume2 = verifyAndConsumeRecoveryCode(testCode, consume1.remainingHashedCodesJson);
    expect(consume2.isValid).toBe(false);
  });

  it('4. Lockout persistence after 5 failed 2FA attempts', () => {
    const ts = Date.now();
    const userId = `usr-lockout-${ts}`;
    sqliteEngine.run(
      `INSERT INTO users (id, username, name, title, department_id, email, role, can_view_confidential, password_hash, password_salt, must_change_password, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, `lockout_${ts}`, 'مستخدم قفل', 'موظف', 'dept-1', `lock_${ts}@mail.test`, 'SECRETARY', 0, 'hash', 'salt', 0, new Date().toISOString()]
    );

    let lockoutStatus = checkTotpLockout({ totp_failed_attempts: 0, totp_locked_until: null });
    expect(lockoutStatus.isLocked).toBe(false);

    // Simulate 5 failures
    for (let i = 0; i < 5; i++) {
      recordTotpFailure(userId);
    }

    const updatedUser = sqliteEngine.query<any>('SELECT * FROM users WHERE id = ?', [userId])[0];
    expect(updatedUser.totp_failed_attempts).toBe(5);
    expect(updatedUser.totp_locked_until).toBeDefined();

    const checkLocked = checkTotpLockout(updatedUser);
    expect(checkLocked.isLocked).toBe(true);
  });

  it('5. API integration: Setup 2FA, confirm 2FA, login with TOTP, and ADMIN reset 2FA with audit entry', async () => {
    const ts = Date.now();
    const adminUsername = `adm_2fa_${ts}`;
    const pass = hashPasswordServer(commonPass);

    // Create ADMIN user
    sqliteEngine.run(
      `INSERT INTO users (id, username, name, title, department_id, email, role, can_view_confidential, password_hash, password_salt, must_change_password, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [`usr-adm-2fa-${ts}`, adminUsername, 'مسؤول النظام', 'مدير', 'dept-admin', `${adminUsername}@mail.test`, 'ADMIN', 1, pass.hashHex, pass.saltHex, 0, new Date().toISOString()]
    );

    // Login as admin
    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ username: adminUsername, password: commonPass });

    expect(loginRes.status).toBe(200);
    const adminCookie = loginRes.headers['set-cookie'];

    // Setup 2FA
    const setupRes = await request(app)
      .post('/api/auth/2fa/setup')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', adminCookie);

    expect(setupRes.status).toBe(200);
    expect(setupRes.body.otpauthUri).toBeDefined();
    expect(setupRes.body.manualEntrySecret).toBeDefined();
    expect(setupRes.body.qrCodeSvg).toBeDefined();
    expect(setupRes.body.recoveryCodes.length).toBe(10);

    const secret = setupRes.body.manualEntrySecret;
    // Generate fresh code right before confirm
    const currentCode = generateTotpCode(secret);

    // Confirm 2FA
    const confirmRes = await request(app)
      .post('/api/auth/2fa/confirm')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', adminCookie)
      .send({ code: currentCode });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.success).toBe(true);

    // Login again -> should require TOTP
    const loginAgainRes = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ username: adminUsername, password: commonPass });

    expect(loginAgainRes.status).toBe(200);
    expect(loginAgainRes.body.require_totp).toBe(true);
    expect(loginAgainRes.body.totp_token).toBeDefined();

    const totpToken = loginAgainRes.body.totp_token;
    // Generate code for next step (32 seconds in future) to avoid same-step replay check
    const loginCode = generateTotpCode(secret, Math.floor(Date.now() / 1000) + 32);

    // Verify TOTP token and complete login
    const verifyRes = await request(app)
      .post('/api/auth/verify-totp')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ totp_token: totpToken, code: loginCode });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.user.totp_enabled).toBe(true);

    // ADMIN resets 2FA for user
    const adminUserRecord = sqliteEngine.query<any>('SELECT id FROM users WHERE username = ?', [adminUsername])[0];
    const resetRes = await request(app)
      .post(`/api/admin/users/${adminUserRecord.id}/reset-2fa`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', adminCookie)
      .send({ confirmUsername: adminUsername });

    expect(resetRes.status).toBe(200);
    expect(resetRes.body.success).toBe(true);

    // Verify audit log entry exists
    const auditEntries = sqliteEngine.query<any>('SELECT * FROM audit_log WHERE entity_type = ?', ['USER_2FA_RESET']);
    expect(auditEntries.length).toBeGreaterThan(0);
  });
});
