import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Environment Variables & Docs Contract Validation', () => {
  const rootDir = process.cwd();

  it('1. ensures package.json dependencies contain NO dev tooling or client packages', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    const prodDeps = Object.keys(pkg.dependencies || {});

    const prohibitedInProd = [
      'vite',
      '@vitejs/plugin-react',
      '@tailwindcss/vite',
      'tsx',
      'esbuild',
      'typescript',
      'vitest',
      'supertest',
      'react',
      'react-dom',
      'lucide-react',
      'motion',
      'tailwindcss',
      'autoprefixer'
    ];

    for (const pkgName of prohibitedInProd) {
      expect(prodDeps).not.toContain(pkgName);
    }
  });

  it('2. ensures EVERY process.env variable read in src/ and scripts/ is listed in .env.example', () => {
    const envExamplePath = path.join(rootDir, '.env.example');
    expect(fs.existsSync(envExamplePath)).toBe(true);

    const envExampleContent = fs.readFileSync(envExamplePath, 'utf8');

    // Collect all process.env.<VAR> matches from src/ and scripts/
    const foundEnvVars = new Set<string>();

    function scan(dir: string) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scan(full);
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
          const content = fs.readFileSync(full, 'utf8');
          const matches = content.matchAll(/process\.env\.([A-Z0-9_]+)/g);
          for (const m of matches) {
            const varName = m[1];
            // Ignore internal vitest/test/build flags or comment placeholders
            if (!['VITEST', 'DISABLE_HMR', 'APP_PORT', 'XYZ', 'VAR'].includes(varName)) {
              foundEnvVars.add(varName);
            }
          }
        }
      }
    }

    scan(path.join(rootDir, 'src'));
    scan(path.join(rootDir, 'scripts'));

    const unlistedVars: string[] = [];
    for (const envVar of foundEnvVars) {
      if (!envExampleContent.includes(envVar)) {
        unlistedVars.push(envVar);
      }
    }

    expect(unlistedVars, `The following process.env variables were found in code but missing from .env.example: ${unlistedVars.join(', ')}`).toEqual([]);
  });

  it('3. ensures documentation shell commands refer to existing scripts or compiled entrypoints', () => {
    const docFiles = [
      path.join(rootDir, 'docs', 'OFFLINE_INSTALL_AR.md'),
      path.join(rootDir, 'PRODUCTION_DEPLOYMENT.md'),
      path.join(rootDir, 'README.md')
    ];

    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    const npmScripts = Object.keys(pkg.scripts || {});

    for (const docFile of docFiles) {
      if (!fs.existsSync(docFile)) continue;
      const content = fs.readFileSync(docFile, 'utf8');

      // Check npm run <script>
      const npmMatches = content.matchAll(/npm\s+(?:run\s+)?([a-z0-9:-]+)/gi);
      for (const m of npmMatches) {
        const scriptName = m[1].toLowerCase();
        if (['install', 'ci', 'test', 'start'].includes(scriptName)) continue;
        // Verify script is defined in package.json
        expect(npmScripts, `Documentation in ${path.basename(docFile)} references non-existent npm script "${scriptName}"`).toContain(scriptName);
      }

      // Check node <file>
      const nodeMatches = content.matchAll(/node\s+([a-zA-Z0-9_/\\.-]+\.(?:js|ts))/gi);
      for (const m of nodeMatches) {
        let rawFilePath = m[1].replace(/\\/g, '/');
        // Strip production deployment path prefixes like /opt/executive-portal/ or C:/ExecutivePortal/
        const normalized = rawFilePath
          .replace(/^\/opt\/executive-portal\//, '')
          .replace(/^C:\/ExecutivePortal\//i, '')
          .replace(/^D:\/ExecutivePortal\//i, '');

        const possiblePaths = [
          path.join(rootDir, normalized),
          path.join(rootDir, normalized.replace(/^dist-server\//, 'scripts/').replace(/\.js$/, '.ts'))
        ];
        const exists = possiblePaths.some((p) => fs.existsSync(p));
        expect(exists, `Documentation in ${path.basename(docFile)} references non-existent node file "${rawFilePath}" (normalized: "${normalized}")`).toBe(true);
      }
    }
  });

});
