import { describe, it, expect } from 'vitest';
import { formatStartupBanner, EngineInfo } from '../data/database/sqliteEngine.js';

describe('Startup Banner Verification (Requirement 2)', () => {
  it('formats banner for file mode containing the real DB path and "WAL"', () => {
    const fileInfo: EngineInfo = {
      mode: 'file',
      isMemory: false,
      dbPath: '/app/applet/data/app.db',
      absolutePath: '/app/applet/data/app.db',
      journalMode: 'WAL',
      foreignKeys: true,
      schemaVersion: 1,
      fileSizeBytes: 24576,
      fileSizeFormatted: '24.0 KB (24576 bytes)',
      isFirstStart: false,
      userCount: 6
    };

    const banner = formatStartupBanner(fileInfo);

    expect(banner).toContain('File-Backed Persistent Database');
    expect(banner).toContain('/app/applet/data/app.db');
    expect(banner).toContain('WAL');
    expect(banner).toContain('24.0 KB');
    expect(banner).not.toContain('⚠️  WARNING: Database running in SQLite IN-MEMORY mode');
  });

  it('formats banner for :memory: mode containing the loud warning that data is lost on exit', () => {
    const memoryInfo: EngineInfo = {
      mode: 'memory',
      isMemory: true,
      dbPath: ':memory:',
      absolutePath: ':memory:',
      journalMode: 'MEMORY',
      foreignKeys: true,
      schemaVersion: 1,
      fileSizeBytes: 0,
      fileSizeFormatted: '0 KB',
      isFirstStart: true,
      userCount: 6
    };

    const banner = formatStartupBanner(memoryInfo);

    expect(banner).toContain('IN-MEMORY mode (:memory:)');
    expect(banner).toContain('ALL DATA WILL BE PERMANENTLY LOST WHEN THE PROCESS EXITS');
  });

  it('generates different status text for first start vs server restart', () => {
    const firstStartInfo: EngineInfo = {
      mode: 'file',
      isMemory: false,
      dbPath: '/app/applet/data/app.db',
      absolutePath: '/app/applet/data/app.db',
      journalMode: 'WAL',
      foreignKeys: true,
      schemaVersion: 1,
      fileSizeBytes: 12288,
      fileSizeFormatted: '12.0 KB',
      isFirstStart: true,
      userCount: 0
    };

    const restartInfo: EngineInfo = {
      mode: 'file',
      isMemory: false,
      dbPath: '/app/applet/data/app.db',
      absolutePath: '/app/applet/data/app.db',
      journalMode: 'WAL',
      foreignKeys: true,
      schemaVersion: 1,
      fileSizeBytes: 36864,
      fileSizeFormatted: '36.0 KB',
      isFirstStart: false,
      userCount: 6
    };

    const firstBanner = formatStartupBanner(firstStartInfo);
    const restartBanner = formatStartupBanner(restartInfo);

    expect(firstBanner).toContain('Status: First Start');
    expect(firstBanner).toContain('Initial credentials printed above');

    expect(restartBanner).toContain('Status: Server Restart');
    expect(restartBanner).toContain('Loaded 6 existing users from storage');
    expect(restartBanner).toContain('Retaining existing encrypted credentials');

    expect(firstBanner).not.toEqual(restartBanner);
  });
});
