import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { SecurityAuthorizationError } from '../../data/contracts/index.js';

/**
 * Centralized Error Handler Middleware.
 * Never leaks stack traces, database schema details, or raw SQL queries to the client.
 */
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log error internally on server console for sysadmin diagnostics
  console.error(`[Server Error] ${req.method} ${req.path}:`, err);

  if (err instanceof SecurityAuthorizationError) {
    res.status(403).json({
      error: err.message || 'غير مصرح بتنفيذ هذا الإجراء'
    });
    return;
  }

  if (err instanceof ZodError || err.name === 'ZodError') {
    res.status(400).json({
      error: 'بيانات الطلب غير صالحة أو تحتوي على حقول غير مصرح بها',
      code: 'VALIDATION_ERROR',
      details: err.issues || err.errors
    });
    return;
  }

  const statusCode = err.statusCode || err.status || 500;

  // Protect internal details: do not leak SQL or stack messages on internal 500 errors
  let safeMessage = err.message || 'حدث خطأ غير متوقع أثناء معالجة الطلب';
  if (statusCode === 500 || safeMessage.toLowerCase().includes('sql') || safeMessage.includes('sqlite')) {
    safeMessage = 'حدث خطأ داخلي في الخادم. يرجى مراجعة مسؤول النظام';
  }

  res.status(statusCode).json({
    error: safeMessage,
    code: err.code || (statusCode === 409 ? 'CONFLICT' : statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR')
  });
}

