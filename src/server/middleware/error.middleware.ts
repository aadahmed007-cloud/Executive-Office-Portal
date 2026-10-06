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

  // SQLite Constraint Error Mapping (never leak 500 or SQL details)
  const errCode = String(err.code || '');
  const errMsg = String(err.message || '');
  const isSqliteConstraint = errCode.startsWith('SQLITE_CONSTRAINT') || errMsg.toLowerCase().includes('constraint failed');

  if (isSqliteConstraint) {
    if (
      errCode === 'SQLITE_CONSTRAINT_NOTNULL' ||
      errMsg.includes('NOT NULL constraint failed') ||
      errCode === 'SQLITE_CONSTRAINT_CHECK' ||
      errMsg.includes('CHECK constraint failed')
    ) {
      res.status(400).json({
        error: 'خطأ في التحقق من صحة البيانات: بعض الحقول الإلزامية مفقودة أو غير صالحة',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    if (
      errCode === 'SQLITE_CONSTRAINT_UNIQUE' ||
      errCode === 'SQLITE_CONSTRAINT_PRIMARYKEY' ||
      errMsg.includes('UNIQUE constraint failed') ||
      errMsg.includes('PRIMARY KEY constraint failed')
    ) {
      res.status(409).json({
        error: 'تعارض في البيانات: السجل أو المعرف المدخل موجود مسبقاً في النظام',
        code: 'CONFLICT'
      });
      return;
    }

    if (
      errCode === 'SQLITE_CONSTRAINT_FOREIGNKEY' ||
      errMsg.includes('FOREIGN KEY constraint failed')
    ) {
      res.status(409).json({
        error: 'تعارض في العلاقات: السجل المرتبط غير موجود أو لا يمكن الربط به',
        code: 'CONFLICT'
      });
      return;
    }

    res.status(400).json({
      error: 'خطأ في قيود التحقق من البيانات',
      code: 'VALIDATION_ERROR'
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

