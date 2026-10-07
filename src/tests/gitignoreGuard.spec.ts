import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import ignore from 'ignore';

describe('.gitignore Source Code Safety Guard (Item A.3)', () => {
  const root = process.cwd();

  function getAllFiles(dir: string, baseDir: string = ''): string[] {
    const fullDir = path.join(root, dir);
    if (!fs.existsSync(fullDir)) return [];
    const entries = fs.readdirSync(fullDir, { withFileTypes: true });
    let results: string[] = [];
    for (const entry of entries) {
      const relPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(relPath);
        results = results.concat(getAllFiles(relPath, baseDir));
      } else {
        results.push(relPath);
      }
    }
    return results;
  }

  it('ensures .gitignore does NOT swallow or ignore any source files under src/, scripts/, or public/', () => {
    const gitignorePath = path.join(root, '.gitignore');
    expect(fs.existsSync(gitignorePath)).toBe(true);

    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
    const ig = ignore().add(gitignoreContent);

    // Collect all source files and directories that must never be ignored by Git
    const sourceDirectories = ['src', 'scripts', 'public'];
    const sourceFiles: string[] = [];

    for (const d of sourceDirectories) {
      sourceFiles.push(d);
      sourceFiles.push(...getAllFiles(d));
    }

    // Add root source/config files
    const rootSourceFiles = [
      'package.json',
      'tsconfig.json',
      'vite.config.ts',
      'vitest.config.ts',
      'index.html',
      'ARCHITECTURE.md',
      'README.md',
      'SECURITY.md'
    ];

    for (const f of rootSourceFiles) {
      if (fs.existsSync(path.join(root, f))) {
        sourceFiles.push(f);
      }
    }

    const ignoredSourceFiles: string[] = [];

    for (const file of sourceFiles) {
      // ignore package accepts paths relative to root with forward slashes
      const normalizedPath = file.replace(/\\/g, '/');
      if (ig.ignores(normalizedPath)) {
        ignoredSourceFiles.push(normalizedPath);
      }
    }

    expect(
      ignoredSourceFiles,
      `FATAL: .gitignore is swallowing the following source files or directories: ${ignoredSourceFiles.join(', ')}`
    ).toEqual([]);
  });

  it('ensures .gitignore ignores build output and test sandbox directories (/dist-server/, /release/, /.test_*/, /.temp_pkg_verify_*/, /.stage/)', () => {
    const gitignorePath = path.join(root, '.gitignore');
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
    const ig = ignore().add(gitignoreContent);

    const artifactPaths = [
      'dist/index.html',
      'dist-server/server.js',
      'release/package.tar.gz',
      '.test_smoke_pkg_12345/temp.txt',
      '.temp_pkg_verify_12345/manifest.json',
      '.stage/package.json'
    ];

    for (const p of artifactPaths) {
      expect(ig.ignores(p), `Expected .gitignore to ignore artifact path "${p}"`).toBe(true);
    }
  });
});
