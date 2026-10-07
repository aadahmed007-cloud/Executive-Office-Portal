import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Request, Response } from 'express';
import { createApp } from './app.js';
import { sqliteEngine, formatStartupBanner } from '../data/database/sqliteEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';
// In AI Studio and Docker container environment, Nginx listens on 8080 and proxies to port 3000
const PORT = parseInt(process.env.APP_PORT || (process.env.PORT === '8080' ? '3000' : process.env.PORT || '3000'), 10);

export async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    process.env.PREVIEW_MODE = process.env.PREVIEW_MODE || 'true';
  }

  // 1. Initialize local SQLite engine & seed default users
  await sqliteEngine.init();
  const engineInfo = sqliteEngine.getEngineInfo();


  console.log('\n' + formatStartupBanner(engineInfo) + '\n');

  // 2. Create Express application with hardened security and /api routes
  const app = createApp();

  if (!isProduction) {
    // Development mode: Mount Vite dev server in middleware mode
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
    console.log('⚡ Vite Dev Middlewares mounted on Express.');
  } else {
    // Production mode: Serve built static assets from dist with strict verification and fallback error response
    const distPath = path.resolve(process.cwd(), 'dist');
    const indexHtmlPath = path.join(distPath, 'index.html');

    if (fs.existsSync(indexHtmlPath)) {
      app.use((await import('express')).default.static(distPath));
      app.get('*', (req: Request, res: Response) => {
        if (fs.existsSync(indexHtmlPath)) {
          res.sendFile(indexHtmlPath);
        } else {
          res.status(503).type('html').send(`
            <!doctype html>
            <html lang="ar" dir="rtl">
              <head><meta charset="UTF-8"><title>خطأ في ملفات الواجهة</title></head>
              <body style="font-family:sans-serif;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
                <div style="background:#1e293b;padding:30px;border-radius:16px;max-width:500px;text-align:center;border:1px solid #dc2626;">
                  <h1 style="color:#ef4444;font-size:20px;margin-bottom:12px;">ملفات واجهة الإنتاج غير متوفرة (Build Missing)</h1>
                  <p style="color:#cbd5e1;font-size:14px;line-height:1.6;">تعذر العثور على ملف <code>dist/index.html</code>. يرجى تنفيذ أمر البناء <code>npm run build</code> أولاً.</p>
                </div>
              </body>
            </html>
          `);
        }
      });
      console.log(`📦 Production static assets mounted from ${distPath}`);
    } else {
      console.error('\n======================================================');
      console.error('❌ FATAL: Production frontend build not found.');
      console.error('💡 Run "npm run build" before starting the production server.');
      console.error(`📌 Expected file: ${indexHtmlPath}`);
      console.error('======================================================\n');

      // Mount fallback error response for all non-API routes
      app.get('*', (req: Request, res: Response) => {
        res.status(503).type('html').send(`
          <!doctype html>
          <html lang="ar" dir="rtl">
            <head><meta charset="UTF-8"><title>خطأ في ملفات الواجهة</title></head>
            <body style="font-family:sans-serif;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
              <div style="background:#1e293b;padding:30px;border-radius:16px;max-width:500px;text-align:center;border:1px solid #dc2626;">
                <h1 style="color:#ef4444;font-size:20px;margin-bottom:12px;">ملفات واجهة الإنتاج غير متوفرة (Build Missing)</h1>
                <p style="color:#cbd5e1;font-size:14px;line-height:1.6;">تعذر العثور على ملف <code>dist/index.html</code>. يرجى تنفيذ أمر البناء <code>npm run build</code> أولاً قبل تشغيل خادم الإنتاج.</p>
              </div>
            </body>
          </html>
        `);
      });
    }
  }

  // 3. Listen on configured PORT (default 3000)
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Executive Office Portal Server Running on Port ${PORT}`);
    console.log(`🌐 URL: http://0.0.0.0:${PORT}`);
    console.log(`💾 Storage: ${engineInfo.isMemory ? 'SQLite In-Memory Mode (:memory:)' : `SQLite File-Backed Mode (${engineInfo.journalMode})`}`);
    console.log(`📁 Database: ${engineInfo.absolutePath}`);
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
