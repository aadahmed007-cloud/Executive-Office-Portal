import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const staticTargets = ['dist', 'dist-server', 'release', '.test_offline_sandbox'];

for (const target of staticTargets) {
  const targetPath = path.join(rootDir, target);
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
}

// Clean any pattern-matching temp/sandbox directories in the project root
try {
  const entries = fs.readdirSync(rootDir);
  for (const entry of entries) {
    if (
      entry.startsWith('.test_smoke_pkg') ||
      entry.startsWith('.test_pkg_') ||
      entry.startsWith('.temp_pkg_') ||
      entry.startsWith('.temp_') ||
      entry.startsWith('.test_')
    ) {
      const fullPath = path.join(rootDir, entry);
      fs.rmSync(fullPath, { recursive: true, force: true });
    }
  }
} catch {
  // Ignore error if readdir fails
}

console.log('Clean complete.');
