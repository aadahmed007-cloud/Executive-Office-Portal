import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Phase 5.5 Guard: Required Source & Contract Files Check', () => {
  const root = process.cwd();

  const requiredStaticFiles = [
    'src/data/contracts/index.ts',
    'src/data/api/apiHelper.ts',
    'src/data/api/apiRepositories.ts',
    'src/server/start.ts',
    'src/server/validation/schemas.ts',
    'scripts/backup.ts',
    'vitest.config.ts'
  ];

  const requiredDirectoriesWithFiles = [
    { dir: 'src/data/database', minFiles: 2 },
    { dir: 'src/data/sqlite', minFiles: 1 }
  ];

  it('verifies that all critical contract, repository, server and backup files exist', () => {
    for (const relPath of requiredStaticFiles) {
      const fullPath = path.join(root, relPath);
      const exists = fs.existsSync(fullPath);
      expect(exists, `Required file is missing from codebase: ${relPath}`).toBe(true);
    }
  });

  it('verifies that database and sqlite repository directories contain required source files', () => {
    for (const req of requiredDirectoriesWithFiles) {
      const fullDir = path.join(root, req.dir);
      expect(fs.existsSync(fullDir), `Directory is missing: ${req.dir}`).toBe(true);
      const files = fs.readdirSync(fullDir).filter(f => f.endsWith('.ts') || f.endsWith('.js'));
      expect(files.length, `Directory ${req.dir} must contain at least ${req.minFiles} files`).toBeGreaterThanOrEqual(req.minFiles);
    }
  });
});
