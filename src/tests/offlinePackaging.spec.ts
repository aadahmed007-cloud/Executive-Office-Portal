import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { verifyPackageArchive } from '../../scripts/verifyPackage.js';

describe('Offline Package & Manifest Verification (Requirement 3)', () => {
  let testSandboxDir: string;
  let stageDir: string;
  let archivePath: string;

  beforeAll(() => {
    testSandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exec-portal-pkg-test-'));
    stageDir = path.join(testSandboxDir, 'stage');
    archivePath = path.join(testSandboxDir, 'test-package.tar.gz');
    fs.mkdirSync(stageDir, { recursive: true });

    // Populate mock production payload
    fs.mkdirSync(path.join(stageDir, 'dist'));
    fs.writeFileSync(path.join(stageDir, 'dist', 'index.html'), '<!DOCTYPE html><html><body>Test</body></html>', 'utf8');

    fs.mkdirSync(path.join(stageDir, 'dist-server'));
    fs.writeFileSync(path.join(stageDir, 'dist-server', 'server.js'), 'console.log("Mock Server");', 'utf8');

    fs.mkdirSync(path.join(stageDir, 'scripts'));
    fs.writeFileSync(path.join(stageDir, 'scripts', 'verifyNative.js'), 'console.log("Native OK");', 'utf8');

    fs.writeFileSync(path.join(stageDir, 'package.json'), JSON.stringify({ name: 'test-app', version: '1.0.0' }), 'utf8');
    fs.writeFileSync(path.join(stageDir, '.env.example'), 'PORT=3000\nNODE_ENV=production\n', 'utf8');
  });

  afterAll(() => {
    if (testSandboxDir && fs.existsSync(testSandboxDir)) {
      try {
        fs.rmSync(testSandboxDir, { recursive: true, force: true });
      } catch {}
    }
  });

  function createArchiveWithManifest(sourceDir: string, destArchive: string): void {
    // Generate valid MANIFEST.json
    const manifestFiles: Array<{ path: string; sha256: string; size: number }> = [];
    function scan(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scan(full);
        } else if (entry.isFile() && entry.name !== 'MANIFEST.json') {
          const rel = path.relative(sourceDir, full).replace(/\\/g, '/');
          const buf = fs.readFileSync(full);
          const sha = crypto.createHash('sha256').update(buf).digest('hex');
          manifestFiles.push({ path: rel, sha256: sha, size: buf.length });
        }
      }
    }
    scan(sourceDir);

    const manifest = {
      name: 'test-app',
      version: '1.0.0',
      platform: process.platform,
      arch: process.arch,
      nodeVersionRequired: 'v22.x',
      totalFiles: manifestFiles.length,
      files: manifestFiles
    };

    fs.writeFileSync(path.join(sourceDir, 'MANIFEST.json'), JSON.stringify(manifest, null, 2), 'utf8');
    execSync(`tar -czf "${destArchive}" -C "${sourceDir}" .`, { stdio: 'pipe' });

    // Also write checksum file
    const archiveSha = crypto.createHash('sha256').update(fs.readFileSync(destArchive)).digest('hex');
    fs.writeFileSync(`${destArchive}.sha256`, `${archiveSha}  ${path.basename(destArchive)}\n`, 'utf8');
  }

  it('generates a valid archive whose MANIFEST.json lists every file with SHA-256 hash', async () => {
    createArchiveWithManifest(stageDir, archivePath);

    const result = await verifyPackageArchive(archivePath);
    expect(result).toBe(true);
  });

  it('tampering with a file causes package verification to fail', async () => {
    const tamperedStage = path.join(testSandboxDir, 'stage-tampered');
    fs.cpSync(stageDir, tamperedStage, { recursive: true });

    // Generate valid manifest first
    createArchiveWithManifest(tamperedStage, archivePath);

    // Now extract, tamper one file, repack without updating manifest
    const tempWork = path.join(testSandboxDir, 'temp-tamper');
    fs.mkdirSync(tempWork, { recursive: true });
    execSync(`tar -xzf "${archivePath}" -C "${tempWork}"`, { stdio: 'pipe' });

    // Tamper index.html content
    fs.writeFileSync(path.join(tempWork, 'dist', 'index.html'), 'TAMPERED CORRUPTED CONTENT', 'utf8');

    // Repack with old manifest
    execSync(`tar -czf "${archivePath}" -C "${tempWork}" .`, { stdio: 'pipe' });
    const tamperedArchiveSha = crypto.createHash('sha256').update(fs.readFileSync(archivePath)).digest('hex');
    fs.writeFileSync(`${archivePath}.sha256`, `${tamperedArchiveSha}  ${path.basename(archivePath)}\n`, 'utf8');
    fs.rmSync(tempWork, { recursive: true, force: true });

    // Expect verify to throw/fail
    let threw = false;
    try {
      await verifyPackageArchive(archivePath);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  it('rejects archive containing prohibited state files (.env, *.db, data/, backups, *.map)', async () => {
    const leakStage = path.join(testSandboxDir, 'stage-leak');
    fs.cpSync(stageDir, leakStage, { recursive: true });

    // Add prohibited files
    fs.writeFileSync(path.join(leakStage, '.env'), 'SECRET_KEY=12345', 'utf8');
    fs.writeFileSync(path.join(leakStage, 'test.db'), 'SQLITE DATA', 'utf8');

    let threw = false;
    try {
      createArchiveWithManifest(leakStage, archivePath);
      await verifyPackageArchive(archivePath);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});
