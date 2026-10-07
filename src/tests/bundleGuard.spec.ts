import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

describe('Phase 2.5 F3: Architecture & Bundle Guard Test', () => {
  it('(a) client files must not import server-only, sqlite or node-only modules', () => {
    const checkedDirs = ['src/features', 'src/ui', 'src/data/api'];
    const checkedFiles = ['src/App.tsx', 'src/main.tsx'];

    const forbiddenResolvedPatterns = [
      'src/server',
      'src/data/sqlite',
      'src/data/database'
    ];

    const forbiddenPackages = [
      'better-sqlite3',
      'express',
      'fs',
      'crypto'
    ];

    function resolveImport(specifier: string, fileDir: string): string {
      // Handle alias like "@/src/..." -> "src/..." or "@/..." -> "src/..."
      if (specifier.startsWith('@/')) {
        const afterAlias = specifier.substring(2);
        if (afterAlias.startsWith('src/')) {
          return afterAlias;
        }
        return 'src/' + afterAlias;
      }

      // Handle relative imports
      if (specifier.startsWith('.')) {
        const absolutePath = path.resolve(fileDir, specifier);
        const relativeToRoot = path.relative(path.resolve('.'), absolutePath);
        return relativeToRoot.replace(/\\/g, '/'); // normalize slashes
      }

      return specifier;
    }

    function scanFile(filePath: string) {
      const content = fs.readFileSync(filePath, 'utf8');
      const fileDir = path.dirname(filePath);

      // Regex to match:
      // 1. static imports: import ... from 'specifier'
      // 2. side-effect imports: import 'specifier'
      // 3. dynamic imports: import('specifier')
      // 4. require: require('specifier')
      const importRegexes = [
        /import\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g,
        /import\s*['"]([^'"]+)['"]/g,
        /import\(['"]([^'"]+)['"]\)/g,
        /require\(['"]([^'"]+)['"]\)/g
      ];

      for (const regex of importRegexes) {
        let match;
        // Reset lastIndex for safety with global flag
        regex.lastIndex = 0;
        while ((match = regex.exec(content)) !== null) {
          const specifier = match[1];
          
          // Verify against forbidden packages
          if (forbiddenPackages.includes(specifier) || specifier.startsWith('node:')) {
            expect.fail(`File ${filePath} imports forbidden package/module: "${specifier}"`);
          }

          // Resolve relative or aliased path
          const resolved = resolveImport(specifier, fileDir);

          // Check if resolved path contains any forbidden server patterns
          for (const pattern of forbiddenResolvedPatterns) {
            if (resolved.startsWith(pattern) || resolved.includes('/' + pattern)) {
              expect.fail(`File ${filePath} contains forbidden client-side import "${specifier}" (resolves to "${resolved}") which targets "${pattern}"`);
            }
          }
        }
      }
    }

    function scanDir(dir: string) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          scanFile(fullPath);
        }
      }
    }

    for (const d of checkedDirs) {
      scanDir(d);
    }
    for (const f of checkedFiles) {
      if (fs.existsSync(f)) {
        scanFile(f);
      }
    }
    expect(true).toBe(true);
  });

  it('(b) & (c) build to temp outDir must succeed and contain no SQL DDL, wasm or password hashes', () => {
    const tempOutDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vite-bundle-guard-'));

    try {
      // Run build without swallowing errors
      execSync(`npx vite build --outDir "${tempOutDir}"`, { stdio: 'pipe' });

      if (!fs.existsSync(tempOutDir)) {
        expect.fail('Vite build did not generate any output directory.');
      }

      function scanBuildDir(dir: string) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            scanBuildDir(fullPath);
          } else if (entry.isFile()) {
            // Fail on any .wasm file
            if (entry.name.endsWith('.wasm')) {
              expect.fail(`Found forbidden .wasm file in build output: ${entry.name}`);
            }

            const content = fs.readFileSync(fullPath, 'utf8');

            // Fail on strings: "CREATE TABLE", "password_hash", "PBKDF2", "sql-wasm"
            const forbiddenStrings = ['CREATE TABLE', 'password_hash', 'PBKDF2', 'sql-wasm'];
            for (const str of forbiddenStrings) {
              if (content.includes(str)) {
                expect.fail(`Built file ${entry.name} contains forbidden string "${str}"`);
              }
            }
          }
        }
      }

      scanBuildDir(tempOutDir);
      expect(true).toBe(true);
    } finally {
      // Cleanup temp directory in finally block
      if (fs.existsSync(tempOutDir)) {
        try {
          fs.rmSync(tempOutDir, { recursive: true, force: true });
        } catch {}
      }
    }
  });
});
