import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import { spawn, execSync } from 'child_process';
import Database from 'better-sqlite3';
import { SqliteEngine } from '../data/database/sqliteEngine.js';
import { verifyPasswordServer } from '../server/utils/crypto.js';

describe('Phase 3: Regression Guard Tests', () => {
  const rootDir = process.cwd();

  // P3-1: Fresh database init creates exactly 3 users
  describe('P3-1: Fresh database initialization guards', () => {
    it('creates exactly 3 users (chairman, secretary, admin) with non-empty credentials, must_change_password=1 and rejects known passwords', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p3_test_db_'));
      const dbPath = path.join(tempDir, 'app.db');

      try {
        const engine = new SqliteEngine();
        await engine.init(dbPath);

        const users = engine.query<any>('SELECT username, password_hash, password_salt, must_change_password FROM users ORDER BY username ASC');
        engine.close();

        // Exactly 3 users
        expect(users).toHaveLength(3);
        const usernames = users.map((u: any) => u.username).sort();
        expect(usernames).toEqual(['admin', 'chairman', 'secretary']);

        const forbiddenPasswords = [
          'InitPass@2026',
          '1234',
          'admin123',
          'Pass#Secr2026',
          'admin1234567'
        ];

        for (const u of users) {
          expect(u.username).toBeTruthy();
          expect(typeof u.password_hash).toBe('string');
          expect(u.password_hash.length).toBeGreaterThan(0);
          expect(typeof u.password_salt).toBe('string');
          expect(u.password_salt.length).toBeGreaterThan(0);
          expect(u.must_change_password).toBe(1);

          // None of the forbidden passwords or the username itself must work
          const testList = [...forbiddenPasswords, u.username];
          for (const candidate of testList) {
            const matches = verifyPasswordServer(candidate, u.password_hash, u.password_salt);
            expect(matches, `Forbidden password matched for user ${u.username}`).toBe(false);
          }
        }
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  // P3-2: The client never starts authenticated
  describe('P3-2: Client unauthenticated start guard', () => {
    it('fails if AuthContext.tsx defaults isAuthenticated or currentUser to truthy values or imports INITIAL_USERS', () => {
      const authContextPath = path.join(rootDir, 'src', 'features', 'auth', 'AuthContext.tsx');
      expect(fs.existsSync(authContextPath)).toBe(true);

      const content = fs.readFileSync(authContextPath, 'utf8');

      // Fail if INITIAL_USERS is imported
      expect(content).not.toMatch(/INITIAL_USERS/);

      // Check default isAuthenticated state hook
      // e.g. useState<boolean>(false) -> must be false
      const authStateMatch = content.match(/useState(?:<boolean>)?\s*\(\s*(true|false|[a-zA-Z0-9_]+)\s*\)/g);
      expect(authStateMatch).toBeTruthy();

      // Specifically check isAuthenticated hook
      const isAuthHookMatch = content.match(/\[\s*isAuthenticated\s*,\s*setIsAuthenticated\s*\]\s*=\s*useState(?:<boolean>)?\s*\(\s*([^)]+)\s*\)/);
      expect(isAuthHookMatch).toBeTruthy();
      const isAuthDefault = isAuthHookMatch![1].trim();
      expect(isAuthDefault).toBe('false');

      // Specifically check currentUser hook: must default to GUEST_USER or null, never a real user
      const currentUserHookMatch = content.match(/\[\s*currentUser\s*,\s*setCurrentUser\s*\]\s*=\s*useState(?:<User[^>]*>)?\s*\(\s*([^)]+)\s*\)/);
      expect(currentUserHookMatch).toBeTruthy();
      const currentUserDefault = currentUserHookMatch![1].trim();
      expect(['GUEST_USER', 'null', 'undefined']).toContain(currentUserDefault);

      // GUEST_USER must be unauthenticated
      if (currentUserDefault === 'GUEST_USER') {
        const guestMatch = content.match(/GUEST_USER\s*:\s*User\s*=\s*\{([\s\S]*?)\};/);
        expect(guestMatch).toBeTruthy();
        expect(guestMatch![1]).toContain("'unauthenticated'");
      }
    });
  });

  // P3-3: No console.assert, no pinCode, no switch-role, no hardcoded demo password in src
  describe('P3-3: Prohibited keywords and insecure constructs guard', () => {
    it('verifies src contains no console.assert, no pinCode, no switch-role, and no demo passwords', () => {
      const srcDir = path.join(rootDir, 'src');

      const prohibitedLiterals = [
        'console.assert',
        'pinCode',
        'switch-role',
        'InitPass@2026',
        'Pass#Secr2026'
      ];

      const foundViolations: { file: string; match: string }[] = [];

      function scan(dir: string) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            scan(full);
          } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js'))) {
            // Exclude test files themselves from scanning forbidden literal strings
            if (entry.name.includes('.spec.') || entry.name.includes('.test.')) {
              continue;
            }
            const content = fs.readFileSync(full, 'utf8');
            for (const literal of prohibitedLiterals) {
              if (content.includes(literal)) {
                foundViolations.push({ file: path.relative(rootDir, full), match: literal });
              }
            }
          }
        }
      }

      scan(srcDir);
      expect(foundViolations).toEqual([]);
    });
  });

  // P3-4: Production start with ONLY DATA_DIR and PORT set succeeds and /api/health returns {"status":"ok"}
  describe('P3-4: Production start minimal env guard', () => {
    it('starts production server with only DATA_DIR and PORT set and verifies /api/health returns {"status":"ok"}', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p3_prod_srv_'));
      const testPort = 48291;

      // Ensure dist-server/server.js exists (built server)
      const serverScript = path.join(rootDir, 'dist-server', 'server.js');
      if (!fs.existsSync(serverScript)) {
        execSync('npm run build:server', { cwd: rootDir, stdio: 'ignore' });
      }
      expect(fs.existsSync(serverScript), 'dist-server/server.js must be built').toBe(true);

      let serverProc: any = null;

      try {
        // Spawn with an isolated clean environment containing only minimal system vars + DATA_DIR + PORT
        const env: NodeJS.ProcessEnv = {
          PATH: process.env.PATH,
          SYSTEMROOT: process.env.SYSTEMROOT,
          HOME: process.env.HOME,
          DATA_DIR: tempDir,
          PORT: String(testPort)
          // Explicitly unset all secrets, JWT_SECRET, BACKUP_PASSPHRASE, etc.
        };

        serverProc = spawn('node', [serverScript], {
          cwd: rootDir,
          env,
          stdio: ['ignore', 'pipe', 'pipe']
        });

        // Wait for server to become responsive on /api/health
        const maxWaitMs = 8000;
        const startTime = Date.now();
        let isHealthy = false;
        let responseBody = '';

        while (Date.now() - startTime < maxWaitMs) {
          try {
            const res = await new Promise<{ statusCode: number; data: string }>((resolve, reject) => {
              const req = http.get(`http://127.0.0.1:${testPort}/api/health`, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => resolve({ statusCode: res.statusCode || 0, data }));
              });
              req.on('error', reject);
              req.setTimeout(500);
            });

            if (res.statusCode === 200) {
              isHealthy = true;
              responseBody = res.data;
              break;
            }
          } catch {
            await new Promise((r) => setTimeout(r, 200));
          }
        }

        expect(isHealthy, 'Server did not respond with 200 OK on /api/health within timeout').toBe(true);
        const parsed = JSON.parse(responseBody);
        expect(parsed).toEqual({ status: 'ok' });
      } finally {
        if (serverProc) {
          serverProc.kill('SIGTERM');
        }
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  // P3-5: Docs-claims lint
  describe('P3-5: Documentation claims lint guard', () => {
    it('verifies markdown documentation contains no exaggerated or forbidden claims', () => {
      const docCandidates = [
        'README.md',
        'SECURITY.md',
        'ARCHITECTURE.md',
        'PRODUCTION_HANDOFF.md',
        'PRODUCTION_DEPLOYMENT.md'
      ];

      const docsDir = path.join(rootDir, 'docs');
      const docFiles: string[] = [];

      for (const f of docCandidates) {
        const full = path.join(rootDir, f);
        if (fs.existsSync(full)) docFiles.push(full);
      }

      if (fs.existsSync(docsDir)) {
        for (const file of fs.readdirSync(docsDir)) {
          // Check docs/*.md but exclude ENGINEERING_RULES.md itself (which lists the forbidden words as rules)
          if (file.endsWith('.md') && file !== 'ENGINEERING_RULES.md') {
            docFiles.push(path.join(docsDir, file));
          }
        }
      }

      const forbiddenWordRegexes = [
        { name: 'سيادي', re: /سيادي/u },
        { name: 'sovereign', re: /\bsovereign\b/i },
        { name: '100%', re: /\b100%/i },
        { name: 'zero-trust', re: /\bzero-trust\b/i },
        { name: 'production-ready', re: /\bproduction-ready\b/i },
        { name: 'جاهز للإنتاج', re: /جاهز للإنتاج/u },
        { name: 'Production Release', re: /\bProduction Release\b/i },
        { name: 'اعتماد الوثيقة', re: /اعتماد الوثيقة/u }
      ];

      const violations: { file: string; line: number; rule: string; content: string }[] = [];

      for (const file of docFiles) {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');

        lines.forEach((line, idx) => {
          const lineNum = idx + 1;

          // Air-Gapped check: FAIL except a sentence that explicitly says the system is NOT air-gapped by itself
          if (/air-gapped/i.test(line)) {
            const isExplicitNegation = /(not|لا|ليس|بدون).*(air-gapped|معزول)/i.test(line);
            if (!isExplicitNegation) {
              violations.push({ file: path.relative(rootDir, file), line: lineNum, rule: 'Air-Gapped claim', content: line });
            }
          }

          // Immutable check: FAIL if audit log is described as immutable
          if (/\bimmutable\b/i.test(line) || /غير قابل للتعديل/.test(line)) {
            violations.push({ file: path.relative(rootDir, file), line: lineNum, rule: 'Immutable claim', content: line });
          }

          // Forbidden buzzwords
          for (const item of forbiddenWordRegexes) {
            if (item.re.test(line)) {
              violations.push({ file: path.relative(rootDir, file), line: lineNum, rule: item.name, content: line });
            }
          }
        });

        // Approval/signature table containing person names check
        // Matches table headers or rows having signature/approval along with person name column
        const tableMatches = content.match(/\|[^\n]*(?:توقيع|موافقة|اعتماد)[^\n]*\|[\s\S]*?\|[^\n]*(?:المهندس|الأستاذ|دكتور|السيد)[^\n]*\|/gi);
        if (tableMatches) {
          violations.push({ file: path.relative(rootDir, file), line: 0, rule: 'Approval table with names', content: tableMatches[0] });
        }
      }

      expect(violations).toEqual([]);
    });
  });

  // P3-6: Destructive-command lint
  describe('P3-6: Destructive-command lint guard', () => {
    it('fails if docs/OFFLINE_INSTALL_AR.md contains || true or 2>/dev/null on a move or delete command', () => {
      const docPath = path.join(rootDir, 'docs', 'OFFLINE_INSTALL_AR.md');
      expect(fs.existsSync(docPath)).toBe(true);

      const content = fs.readFileSync(docPath, 'utf8');
      const lines = content.split('\n');

      const violations: { line: number; command: string }[] = [];

      lines.forEach((line, idx) => {
        const isMoveOrDelete = /\b(mv|rm|Move-Item|Remove-Item)\b/i.test(line);
        const hasSilencer = /\|\|\s*true/i.test(line) || /2>\s*\/dev\/null/i.test(line);

        if (isMoveOrDelete && hasSilencer) {
          violations.push({ line: idx + 1, command: line });
        }
      });

      expect(violations).toEqual([]);
    });
  });

  // P3-7: Script lint
  describe('P3-7: Package scripts cross-platform lint guard', () => {
    it('fails if any package.json script contains rm -rf, NODE_ENV=, cp, mv or other POSIX-only syntax', () => {
      const pkgPath = path.join(rootDir, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const scripts = pkg.scripts || {};

      const forbiddenSyntax = [
        { name: 'rm -rf', re: /rm\s+-rf/ },
        { name: 'inline NODE_ENV=', re: /\bNODE_ENV=/ },
        { name: 'posix cp', re: /\bcp\s+/ },
        { name: 'posix mv', re: /\bmv\s+/ }
      ];

      const violations: { script: string; pattern: string; command: string }[] = [];

      for (const [name, cmd] of Object.entries(scripts)) {
        for (const item of forbiddenSyntax) {
          if (item.re.test(cmd as string)) {
            violations.push({ script: name, pattern: item.name, command: cmd as string });
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });

  // P3-8: Metadata & Gemini & Single Audit Insert Guards
  describe('Metadata, Gemini references, and single audit insert guards', () => {
    it('fails if metadata.json exists', () => {
      const metaPath = path.join(rootDir, 'metadata.json');
      expect(fs.existsSync(metaPath)).toBe(false);
    });

    it('fails if any file in workspace references GEMINI', () => {
      function scanDir(dir: string) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'dist-server' || entry.name === 'regressionGuards.spec.ts') continue;
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            scanDir(full);
          } else if (entry.isFile()) {
            const content = fs.readFileSync(full, 'utf8');
            if (/GEMINI/i.test(content)) {
              throw new Error(`Found GEMINI reference in file: ${full}`);
            }
          }
        }
      }
      scanDir(rootDir);
    });

    it('asserts that only one INSERT INTO audit_log exists in src (excluding tests)', () => {
      function getSrcFiles(dir: string): string[] {
        let results: string[] = [];
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            results = results.concat(getSrcFiles(full));
          } else if (entry.isFile() && !full.includes('.spec.')) {
            results.push(full);
          }
        }
        return results;
      }

      const srcFiles = getSrcFiles(path.join(rootDir, 'src'));
      let auditInsertCount = 0;
      for (const file of srcFiles) {
        const content = fs.readFileSync(file, 'utf8');
        const matches = content.match(/INSERT\s+INTO\s+audit_log/gi);
        if (matches) {
          auditInsertCount += matches.length;
        }
      }
      expect(auditInsertCount).toBe(1);
    });
  });
});

