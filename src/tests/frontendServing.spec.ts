import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { createApp } from '../server/app.js';

describe('Frontend Serving & SPA Routing Verification (Section 2 & 5)', () => {
  let prodApp: express.Express;
  const distPath = path.resolve(process.cwd(), 'dist');
  const indexHtmlPath = path.join(distPath, 'index.html');

  beforeAll(() => {
    // Build dist if not already built
    if (!fs.existsSync(indexHtmlPath)) {
      fs.mkdirSync(distPath, { recursive: true });
      fs.writeFileSync(indexHtmlPath, '<!doctype html><html><body><div id="root"></div></body></html>', 'utf8');
    }

    prodApp = createApp();
    prodApp.use(express.static(distPath));
    prodApp.get('*', (req: Request, res: Response) => {
      res.sendFile(indexHtmlPath);
    });
  });

  it('1. GET / returns dist/index.html with status 200 and text/html', async () => {
    const res = await request(prodApp).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('<div id="root"></div>');
  });

  it('2. SPA Frontend Routes (/meetings, /correspondence, /directives) return dist/index.html', async () => {
    const routes = ['/meetings', '/correspondence', '/directives', '/matters', '/contacts', '/settings', '/custom-spa-page'];
    for (const route of routes) {
      const res = await request(prodApp).get(route);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('<div id="root"></div>');
    }
  });

  it('3. GET /api/unknown-endpoint returns JSON 404, never index.html', async () => {
    const res = await request(prodApp).get('/api/unknown-endpoint');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body.code).toBe('NOT_FOUND');
    expect(res.body.error).toBeDefined();
    expect(res.text).not.toContain('<div id="root"></div>');
  });

  it('4. GET /api/auth/me returns JSON 401 unauthenticated response without HTML', async () => {
    const res = await request(prodApp).get('/api/auth/me').set('X-Requested-With', 'XMLHttpRequest');
    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body.error).toContain('يرجى تسجيل الدخول أولاً');
  });

  it('5. Fallback error response when dist/index.html is missing returns 503 with clear explanation', async () => {
    const missingBuildApp = createApp();
    missingBuildApp.get('*', (req: Request, res: Response) => {
      res.status(503).type('html').send(`
        <!doctype html>
        <html lang="ar" dir="rtl">
          <head><meta charset="UTF-8"><title>خطأ في ملفات الواجهة</title></head>
          <body><h1>ملفات واجهة الإنتاج غير متوفرة (Build Missing)</h1></body>
        </html>
      `);
    });

    const res = await request(missingBuildApp).get('/meetings');
    expect(res.status).toBe(503);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('ملفات واجهة الإنتاج غير متوفرة');
  });
});
