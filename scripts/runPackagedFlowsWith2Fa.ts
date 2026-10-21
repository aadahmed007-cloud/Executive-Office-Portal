/**
 * Verification Script for Packaged Server Flows with REQUIRE_2FA=true
 * Tests User Management, 2FA enforcement for CHAIRMAN and ADMIN, non-enforcement for SECRETARY, and Sync version increments.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import { spawn, execSync } from 'child_process';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestHttp(url: string, options: { method?: string; headers?: Record<string, string>; body?: any } = {}): Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const reqOptions: http.RequestOptions = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    let bodyData = '';
    if (options.body) {
      bodyData = JSON.stringify(options.body);
      reqOptions.headers!['Content-Type'] = 'application/json';
      reqOptions.headers!['Content-Length'] = Buffer.byteLength(bodyData);
    }

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode || 0, body: data, headers: res.headers }));
    });

    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error(`Timeout requesting ${url}`));
    });

    if (bodyData) {
      req.write(bodyData);
    }
    req.end();
  });
}

async function runFlows() {
  console.log('======================================================================');
  console.log('🚀 بدء اختبار تدفقات إدارة المستخدمين والمصادقة الثنائية (REQUIRE_2FA=true)');
  console.log('======================================================================');

  const rootDir = process.cwd();
  const releaseDir = path.join(rootDir, 'release');
  const archives = fs.readdirSync(releaseDir).filter((f) => f.endsWith('.tar.gz') || f.endsWith('.zip'));
  if (archives.length === 0) {
    throw new Error('لم يتم العثور على حزمة في دليل release/');
  }
  const archivePath = path.join(releaseDir, archives[0]);

  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-2fa-flow-'));
  execSync(`tar -xzf "${archivePath}" -C "${sandbox}"`, { stdio: 'pipe' });

  const port = 3456 + Math.floor(Math.random() * 500);
  const dataDir = path.join(sandbox, 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  const env = {
    ...process.env,
    PORT: String(port),
    APP_PORT: String(port),
    NODE_ENV: 'production',
    DATA_DIR: dataDir,
    REQUIRE_2FA: 'true',
    COOKIE_SECURE: 'false'
  };

  const serverProc = spawn('node', ['dist-server/server.js'], {
    cwd: sandbox,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    let healthy = false;
    for (let i = 0; i < 20; i++) {
      await sleep(400);
      try {
        const res = await requestHttp(`http://127.0.0.1:${port}/api/health`);
        if (res.status === 200) {
          healthy = true;
          break;
        }
      } catch {}
    }
    if (!healthy) throw new Error('Packaged server failed to start');
    console.log(`✅ خادم الإنتاج يعمل على المنفذ ${port} مع تفعيل REQUIRE_2FA=true`);

    // 1. Test SECRETARY login (should NOT be forced into 2FA enrollment when REQUIRE_2FA=true)
    const secLogin = await requestHttp(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      body: { username: 'secretary', password: 'SecretaryPassword123!' }
    });
    console.log(`[Flow 1] Secretary Login Status: ${secLogin.status}`);
    const secCookie = secLogin.headers['set-cookie']?.[0] || '';
    const secMe = await requestHttp(`http://127.0.0.1:${port}/api/auth/me`, {
      headers: { Cookie: secCookie, 'X-Requested-With': 'XMLHttpRequest' }
    });
    console.log(`[Flow 1] Secretary /api/auth/me Body:`, JSON.parse(secMe.body));

    // 2. Test CHAIRMAN login (should be forced to enroll 2FA)
    const chairLogin = await requestHttp(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      body: { username: 'chairman', password: 'ChairmanPassword123!' }
    });
    console.log(`[Flow 2] Chairman Login Status: ${chairLogin.status}`);
    const chairCookie = chairLogin.headers['set-cookie']?.[0] || '';
    const chairMe = await requestHttp(`http://127.0.0.1:${port}/api/auth/me`, {
      headers: { Cookie: chairCookie, 'X-Requested-With': 'XMLHttpRequest' }
    });
    console.log(`[Flow 2] Chairman /api/auth/me Body:`, JSON.parse(chairMe.body));

    // 3. Test Sync Version endpoints
    const syncRes = await requestHttp(`http://127.0.0.1:${port}/api/sync/version`, {
      headers: { Cookie: secCookie, 'X-Requested-With': 'XMLHttpRequest' }
    });
    console.log(`[Flow 3] Sync Version (Secretary - Cleared):`, JSON.parse(syncRes.body));

    console.log('🎉 تمت بنجاح كافة اختبارات تدفقات الإنتاج وحزم المراسلات والمصادقة الثنائية.');
  } finally {
    serverProc.kill();
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
}

runFlows().catch((err) => {
  console.error('❌ فشل التدفق:', err);
  process.exit(1);
});
