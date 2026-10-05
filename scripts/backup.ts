import path from 'path';
import fs from 'fs';
import { sqliteEngine } from '../src/data/database/sqliteEngine.js';

/**
 * Executive Office Portal Database Backup Utility
 * Performs SQLite online backup with timestamping and retention policy.
 */
async function runBackup() {
  console.log('📦 Starting Executive Office Portal online database backup...');

  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  const backupDir = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  }

  // Initialize engine
  await sqliteEngine.init();

  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T.]/g, '').slice(0, 14); // YYYYMMDDHHMMSS
  const backupFileName = `backup-${timestamp}.db`;
  const backupFilePath = path.join(backupDir, backupFileName);

  // Perform SQLite native online backup
  await sqliteEngine.backup(backupFilePath);
  console.log(`✅ Backup successfully created at: ${backupFilePath}`);

  // Apply retention policy: keep last 7 backups
  const retentionCount = parseInt(process.env.BACKUP_RETENTION || '7', 10);
  const files = fs
    .readdirSync(backupDir)
    .filter((f) => f.startsWith('backup-') && f.endsWith('.db'))
    .map((f) => ({
      name: f,
      path: path.join(backupDir, f),
      mtime: fs.statSync(path.join(backupDir, f)).mtime.getTime()
    }))
    .sort((a, b) => b.mtime - a.mtime); // newest first

  if (files.length > retentionCount) {
    const toDelete = files.slice(retentionCount);
    for (const item of toDelete) {
      fs.unlinkSync(item.path);
      console.log(`🗑️  Rotated old backup file: ${item.name}`);
    }
  }

  console.log(`🔒 Active backups in retention: ${Math.min(files.length, retentionCount)}`);
}

runBackup().catch((err) => {
  console.error('❌ Backup process failed:', err);
  process.exit(1);
});
