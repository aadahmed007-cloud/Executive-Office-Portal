import express, { Express, Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { sessionAuthMiddleware } from './middleware/auth.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import { apiRouter } from './routes/api.router.js';

/**
 * Express Application Factory with Hardened Security Controls.
 */
export function createApp(): Express {
  const app = express();

  const isProduction = process.env.NODE_ENV === 'production';
  // PREVIEW_MODE is ONLY active when explicitly set to 'true' AND NOT in production
  const isPreview = !isProduction && process.env.PREVIEW_MODE === 'true';

  if (process.env.COOKIE_SECURE === 'false') {
    console.warn('⚠️  [SECURITY WARNING] COOKIE_SECURE is set to false. Cookies are not encrypted over plain HTTP.');
  }

  if (process.env.PREVIEW_MODE === 'true') {
    if (isProduction) {
      console.warn('ℹ️  [SECURITY NOTICE] PREVIEW_MODE is set, but running in PRODUCTION mode. Preview mode is ignored; full strict security controls enforced.');
    } else {
      console.warn('\n**********************************************************************');
      console.warn('⚠️  PREVIEW MODE: NOT FOR PRODUCTION');
      console.warn('   Relaxed frame-ancestors allowlist and SameSite=None session cookies active.');
      console.warn('**********************************************************************\n');
    }
  }

  // Parse allowed frame ancestors: space-separated allowlist, default 'self' https://aistudio.google.com
  // Strictly filter out '*' - never allow '*'
  const rawAncestors = process.env.FRAME_ANCESTORS || "'self' https://aistudio.google.com";
  const parsedAncestors = rawAncestors
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== '*');
  const allowedAncestors = parsedAncestors.length > 0 ? parsedAncestors : ["'self'", 'https://aistudio.google.com'];

  // 1. Trust Proxy Configuration: defaults to false (disabled); enabled strictly via TRUST_PROXY env
  app.set('trust proxy', process.env.TRUST_PROXY ? (process.env.TRUST_PROXY === 'true' ? true : parseInt(process.env.TRUST_PROXY, 10)) : false);

  // 2. Custom HSTS Middleware: Send Strict-Transport-Security ONLY on HTTPS (req.secure) without includeSubDomains
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.secure) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    }
    next();
  });

  // 3. Security Headers via Helmet
  app.use(
    helmet({
      hsts: false, // Handled conditionally above for req.secure
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: isProduction
            ? ["'self'", "'wasm-unsafe-eval'"]
            : ["'self'", "'unsafe-inline'", "'unsafe-eval'", "'wasm-unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: isProduction
            ? ["'self'"]
            : ["'self'", 'ws:', 'wss:'],
          frameAncestors: isPreview ? allowedAncestors : ["'none'"],
          upgradeInsecureRequests: null
        }
      },
      xContentTypeOptions: true,
      referrerPolicy: { policy: 'no-referrer' },
      frameguard: isPreview ? false : { action: 'deny' },
      crossOriginResourcePolicy: { policy: isPreview ? 'cross-origin' : 'same-origin' },
      crossOriginOpenerPolicy: isPreview ? false : { policy: 'same-origin' }
    })
  );

  // 4. Cookie & Body Parsing
  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 5. Server-side Session Authentication Middleware
  app.use(sessionAuthMiddleware);

  // 6. Mount API Routes
  app.use('/api', apiRouter);

  // 7. Explicit 404 handler for unknown /api/* endpoints (Ensures JSON 404, never index.html)
  app.all('/api/*', (req: Request, res: Response) => {
    res.status(404).json({
      error: 'المسار البرمجي المطلوب غير موجود',
      code: 'NOT_FOUND',
      path: req.path
    });
  });

  // 8. Centralized Error Handler
  app.use(errorHandler);

  return app;
}
