import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { SessionService } from '../server/services/session.service.js';
import express, { Response } from 'express';

describe('Security Headers Verification (src/tests/securityHeaders.spec.ts)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.PREVIEW_MODE;
    delete process.env.FRAME_ANCESTORS;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // 1) Default (production-like) mode sets frame-ancestors to 'none' and X-Frame-Options to 'DENY'
  it("1) Default (production-like) mode sets frame-ancestors to 'none' and X-Frame-Options to 'DENY'", async () => {
    // Simulate default environment without preview flag
    delete process.env.PREVIEW_MODE;
    process.env.NODE_ENV = 'development';

    const app = createApp();
    const res = await request(app).get('/api/users');

    // Verify Content-Security-Policy frame-ancestors is 'none'
    const csp = res.headers['content-security-policy'] || '';
    expect(csp).toContain("frame-ancestors 'none'");

    // Verify X-Frame-Options is DENY
    expect(res.headers['x-frame-options']).toBe('DENY');

    // Verify Cross-Origin-Resource-Policy is same-origin
    expect(res.headers['cross-origin-resource-policy']).toBe('same-origin');

    // Verify session cookies default to SameSite=Strict
    const dummyApp = express();
    dummyApp.get('/set-cookie', (_req, rRes: Response) => {
      SessionService.setCookie(rRes, 'dummy-token');
      rRes.send('ok');
    });
    const cookieRes = await request(dummyApp).get('/set-cookie');
    const setCookie = cookieRes.headers['set-cookie']?.[0] || '';
    expect(setCookie).toContain('SameSite=Strict');
    expect(setCookie).toContain('HttpOnly');
  });

  // 2) When PREVIEW_MODE=true and FRAME_ANCESTORS is set, the headers respect the allowlist and never permit '*'
  it("2) When PREVIEW_MODE=true and FRAME_ANCESTORS is set, the headers respect the allowlist and never permit '*'", async () => {
    process.env.PREVIEW_MODE = 'true';
    process.env.NODE_ENV = 'development';
    process.env.FRAME_ANCESTORS = "'self' https://aistudio.google.com * https://custom-preview.domain.internal";

    const app = createApp();
    const res = await request(app).get('/api/users');

    const csp = res.headers['content-security-policy'] || '';
    const frameAncestorsMatch = csp.match(/frame-ancestors\s+([^;]+)/);
    expect(frameAncestorsMatch).not.toBeNull();

    const directives = frameAncestorsMatch![1].split(/\s+/);

    // Verify allowable origins from FRAME_ANCESTORS are present
    expect(directives).toContain("'self'");
    expect(directives).toContain('https://aistudio.google.com');
    expect(directives).toContain('https://custom-preview.domain.internal');

    // Crucial check: '*' must NEVER be permitted
    expect(directives).not.toContain('*');
    expect(csp).not.toContain("frame-ancestors *");

    // X-Frame-Options must NOT be sent in preview mode so iframe embedding succeeds
    expect(res.headers['x-frame-options']).toBeUndefined();

    // Cross-Origin-Resource-Policy must be set to cross-origin in preview mode
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');

    // Cookies in preview mode must be SameSite=None; Secure; HttpOnly
    const dummyApp = express();
    dummyApp.get('/set-cookie', (_req, rRes: Response) => {
      SessionService.setCookie(rRes, 'dummy-preview-token');
      rRes.send('ok');
    });
    const cookieRes = await request(dummyApp).get('/set-cookie');
    const setCookie = cookieRes.headers['set-cookie']?.[0] || '';
    expect(setCookie).toContain('SameSite=None');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('HttpOnly');
  });

  // 3) Verify that in production mode, PREVIEW_MODE flags are ignored
  it("3) Verify that in production mode, PREVIEW_MODE flags are ignored", async () => {
    process.env.NODE_ENV = 'production';
    process.env.PREVIEW_MODE = 'true';
    process.env.FRAME_ANCESTORS = 'https://aistudio.google.com';

    const app = createApp();
    const res = await request(app).get('/api/users');

    // In production mode, frame-ancestors must strictly remain 'none' regardless of flags
    const csp = res.headers['content-security-policy'] || '';
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain('aistudio.google.com');

    // X-Frame-Options must remain DENY
    expect(res.headers['x-frame-options']).toBe('DENY');

    // Cross-Origin-Resource-Policy must remain same-origin
    expect(res.headers['cross-origin-resource-policy']).toBe('same-origin');

    // Production cookies must remain SameSite=Strict
    const dummyApp = express();
    dummyApp.get('/set-cookie', (_req, rRes: Response) => {
      SessionService.setCookie(rRes, 'dummy-prod-token');
      rRes.send('ok');
    });
    const cookieRes = await request(dummyApp).get('/set-cookie');
    const setCookie = cookieRes.headers['set-cookie']?.[0] || '';
    expect(setCookie).toContain('SameSite=Strict');
    expect(setCookie).not.toContain('SameSite=None');
  });
});
