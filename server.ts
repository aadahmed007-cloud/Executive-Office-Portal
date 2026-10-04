import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Request, Response } from 'express';
import { createApp } from './src/server/app.js';
import { sqliteEngine } from './src/data/database/sqliteEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  // Initialize local SQLite engine
  await sqliteEngine.init();
  console.log('🏛️ Executive Office Portal: SQLite In-Memory Database Initialized.');

  // Create modular Express application
  const app = createApp();

  if (!isProduction) {
    // Development mode: Dynamically mount Vite middlewares
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
    console.log('⚡ Vite Dev Middlewares mounted on Express.');
  } else {
    // Production mode: Serve built static assets
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use((await import('express')).default.static(distPath));
      app.get('*', (req: Request, res: Response) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
      console.log(`📦 Production static assets mounted from ${distPath}`);
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Executive Office Portal Server Running on Port ${PORT}`);
    console.log(`🌐 URL: http://0.0.0.0:${PORT}`);
    console.log(`🔒 Security: Air-Gapped Sovereign Local Operation`);
    console.log(`📁 Structure: Modular MVC Architecture (/src/server)`);
    console.log(`======================================================\n`);
  });
}

startServer().catch((err) => {
  console.error('Fatal Server Initialization Error:', err);
  process.exit(1);
});
