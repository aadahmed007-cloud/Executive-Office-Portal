import express, { Express } from 'express';
import { authMiddleware } from './middleware/auth.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import { apiRouter } from './routes/api.router.js';

/**
 * Express Application Factory.
 * Prepares and mounts all security middleware, API routers, and global error handlers.
 */
export function createApp(): Express {
  const app = express();

  // Basic Body Parsing
  app.use(express.json());

  // Global Context & Security Middleware
  app.use(authMiddleware);

  // Mount API Router
  app.use('/api', apiRouter);

  // Central Error Handler
  app.use(errorHandler);

  return app;
}
