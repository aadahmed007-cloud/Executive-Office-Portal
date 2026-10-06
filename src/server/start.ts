import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Request, Response } from 'express';
import { createApp } from './app.js';
import { sqliteEngine } from '../data/database/sqliteEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';
// In AI Studio and Docker container environment, Nginx listens on 8080 and proxies to port 3000
const PORT = parseInt(process.env.APP_PORT || (process.env.PORT === '8080' ? '3000' : process.env.PORT || '3000'), 10);

export async function startServer() {
  // Validate or automatically initialize cryptographic secrets
  const isProd = process.env.NODE_ENV === 'production';
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'REPLACE_WITH_STRONG_RANDOM_64_CHAR_SECRET') {
    if (isProd) {
      console.error('❌ FATAL: Critical environment variable SESSION_SECRET is missing or has placeholder value.');
      process.exit(1);
    } else {
      process.env.SESSION_SECRET = (await import('crypto')).randomBytes(32).toString('hex');
      console.log('ℹ️  Development/Preview mode: auto-generated volatile SESSION_SECRET.');
    }
  }

  if (!process.env.BACKUP_PASSPHRASE || process.env.BACKUP_PASSPHRASE === 'REPLACE_WITH_STRONG_OFFLINE_PASSPHRASE') {
    if (isProd) {
      console.error('❌ FATAL: Critical environment variable BACKUP_PASSPHRASE is missing or has placeholder value.');
      process.exit(1);
    } else {
      process.env.BACKUP_PASSPHRASE = (await import('crypto')).randomBytes(24).toString('hex');
      console.log('ℹ️  Development/Preview mode: auto-generated volatile BACKUP_PASSPHRASE.');
    }
  }

  console.log('\n======================================================================');
  console.log('🏛️  EGYPT NATIONAL POST - CHAIRMAN OFFICE EXECUTIVE PORTAL');
  console.log('⚠️  NOTICE: Database is running in SQLite In-Memory mode.');
  console.log('🔑  Initial random credentials are generated on every cold start.');
  console.log('🔒  Keep this console private. Never write credentials to files or git.');
  console.log('======================================================================\n');

  // 1. Initialize local SQLite engine & seed default users
  await sqliteEngine.init();

  // 2. Create Express application with hardened security and /api routes
  const app = createApp();

  if (!isProduction) {
    // Development mode: Mount Vite dev server in middleware mode
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
    console.log('⚡ Vite Dev Middlewares mounted on Express.');
  } else {
    // Production mode: Serve built static assets from dist
    const distPath = path.resolve(__dirname, '../../dist');
    if (fs.existsSync(distPath)) {
      app.use((await import('express')).default.static(distPath));
      app.get('*', (req: Request, res: Response) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
      console.log(`📦 Production static assets mounted from ${distPath}`);
    }
  }

  // 3. Listen on configured PORT (default 3000)
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Executive Office Portal Server Running on Port ${PORT}`);
    console.log(`🌐 URL: http://0.0.0.0:${PORT}`);
    console.log(`💾 Storage: SQLite In-Memory Mode`);
    console.log(`📁 API Routes: Mounted at /api/* (JSON 404 for unknown endpoints)`);
    console.log(`======================================================\n`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ FATAL: Port ${PORT} is already in use by another process.`);
      console.error(`💡 Please terminate any existing process on port ${PORT} or configure PORT env variable.\n`);
    } else {
      console.error('❌ Server startup error:', err);
    }
    process.exit(1);
  });

  // 4. Handle SIGTERM and SIGINT signals for clean graceful shutdowns
  let isShuttingDown = false;
  const handleShutdown = (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n🛑 Received ${signal}. Gracefully shutting down Executive Office Portal server...`);

    server.close((err) => {
      if (err) {
        console.error('❌ Error during server shutdown:', err);
        process.exit(1);
      }
      console.log('✅ Server HTTP listener closed cleanly. Exiting.');
      process.exit(0);
    });

    // Force shutdown after timeout if pending connections hang
    setTimeout(() => {
      console.error('⚠️ Forcing shutdown after timeout.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));

  return { app, server };
}

// Auto-start if executed directly as entrypoint
startServer().catch((err) => {
  console.error('Fatal Server Initialization Error:', err);
  process.exit(1);
});
