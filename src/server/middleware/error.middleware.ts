import { Request, Response, NextFunction } from 'express';
import { SecurityAuthorizationError } from '../../data/contracts/index.js';

/**
 * Central Error Handler Middleware
 */
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error(`[Server Error] ${req.method} ${req.path}:`, err);

  if (err instanceof SecurityAuthorizationError) {
    res.status(403).json({
      error: err.message || 'غير مصرح بتنفيذ هذا الإجراء (Access Denied: Security Policy)'
    });
    return;
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'حدث خطأ داخلي في الخادم (Internal Server Error)';

  res.status(statusCode).json({
    error: message,
    code: err.code || 'INTERNAL_ERROR',
    timestamp: new Date().toISOString()
  });
}
