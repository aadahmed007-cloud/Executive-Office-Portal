import { Request, Response, NextFunction } from 'express';
import { UserContext } from '../../data/contracts/index.js';
import { RoleType, User } from '../../domain/types/index.js';
import { SessionService, SESSION_COOKIE_NAME } from '../services/session.service.js';
import { can, PermissionAction, PermissionResource } from '../security/permissions.js';

// Extend Express Request interface to carry session user and context
declare global {
  namespace Express {
    interface Request {
      user?: User;
      userContext?: UserContext;
      rawSessionToken?: string;
    }
  }
}

/**
 * Server-side Session Authentication Middleware.
 * Reads HttpOnly cookie, verifies token hash against database, loads fresh user record.
 * Strips and ignores any client-supplied spoofing headers.
 */
export function sessionAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const cookies = req.cookies || {};
  const rawToken = cookies[SESSION_COOKIE_NAME];

  if (rawToken) {
    const meta = {
      ipAddress: req.ip || req.socket.remoteAddress || '127.0.0.1',
      userAgent: req.headers['user-agent']
    };

    const validation = SessionService.validateSession(rawToken, meta);
    if (validation.isValid && validation.user) {
      req.user = validation.user;
      req.userContext = {
        userId: validation.user.id,
        role: validation.user.role,
        can_view_confidential: Boolean(validation.user.can_view_confidential)
      };
      req.rawSessionToken = rawToken;
    }
  }

  next();
}

/**
 * CSRF Protection Middleware for state-changing HTTP requests (POST, PUT, PATCH, DELETE).
 * Enforces custom client header requirement and same-origin Origin/Referer check.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // 1. Require custom header sent by client wrapper
  const customHeader = req.headers['x-requested-with'] || req.headers['x-executive-client'];
  if (!customHeader) {
    res.status(403).json({
      error: 'طلب غير مصرح به: ترويسة مكافحة التزوير مفقودة (CSRF Protection: Missing Custom Header)'
    });
    return;
  }

  // 2. Same-Origin verification if Origin or Referer is supplied
  const forwardedHost = req.headers['x-forwarded-host'] as string | undefined;
  const directHost = req.headers.host;
  const origin = req.headers.origin;
  const referer = req.headers.referer;

  // Build list of valid hosts
  const validHosts = new Set<string>();
  if (directHost) validHosts.add(directHost);
  if (forwardedHost) {
    forwardedHost.split(',').forEach((h) => validHosts.add(h.trim()));
  }

  // Add optional ALLOWED_ORIGINS (e.g. from env)
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS || '';
  if (allowedOriginsEnv) {
    allowedOriginsEnv.split(',').forEach((o) => {
      try {
        const u = new URL(o.trim());
        validHosts.add(u.host);
      } catch {
        validHosts.add(o.trim());
      }
    });
  }

  if (origin) {
    try {
      const originHost = new URL(origin).host;
      if (!validHosts.has(originHost)) {
        res.status(403).json({
          error: 'طلب مرفوض: عدم تطابق مصدر الطلب'
        });
        return;
      }
    } catch {
      res.status(403).json({ error: 'طلب مرفوض: صيغة مصدر الطلب غير صالحة' });
      return;
    }
  } else if (referer) {
    try {
      const refererHost = new URL(referer).host;
      if (!validHosts.has(refererHost)) {
        res.status(403).json({
          error: 'طلب مرفوض: عدم تطابق مرجع الطلب'
        });
        return;
      }
    } catch {
      res.status(403).json({ error: 'طلب مرفوض: صيغة مرجع الطلب غير صالحة' });
      return;
    }
  }

  next();
}

/**
 * Middleware requiring an active, authenticated server session.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !req.userContext) {
    res.status(401).json({
      error: 'يرجى تسجيل الدخول أولاً للوصول إلى هذا المورد'
    });
    return;
  }
  next();
}

/**
 * Middleware to enforce forced password change before allowing any other operation.
 */
export function mustChangePasswordGuard(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.must_change_password) {
    const allowedPaths = [
      '/api/auth/change-password',
      '/api/auth/me',
      '/api/auth/logout',
      '/api/health'
    ];

    if (!allowedPaths.includes(req.path)) {
      res.status(403).json({
        error: 'يجب تغيير كلمة المرور الأولية قبل متابعة استخدام النظام',
        code: 'MUST_CHANGE_PASSWORD'
      });
      return;
    }
  }
  next();
}

/**
 * Middleware requiring specific user roles.
 */
export function requireRole(allowedRoles: RoleType[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.user?.role;
    if (!role || !allowedRoles.includes(role)) {
      res.status(403).json({
        error: 'غير مصرح لرتبتك الوظيفية بتنفيذ هذا الإجراء',
        code: 'FORBIDDEN'
      });
      return;
    }
    next();
  };
}

/**
 * Middleware requiring specific RBAC permissions.
 */
export function rbacGuard(resource: PermissionResource, action: PermissionAction) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.userContext) {
      res.status(401).json({
        error: 'يرجى تسجيل الدخول أولاً للوصول إلى هذا المورد',
        code: 'UNAUTHORIZED'
      });
      return;
    }
    if (!can(req.userContext, action, resource)) {
      let errorMsg = 'غير مصرح بتنفيذ هذا الإجراء لعدم كفاية الصلاحيات';
      if (action === 'approve') {
        errorMsg = 'تأشيرة الاعتماد الرئاسية مقصورة حصرياً على السيد رئيس مجلس الإدارة';
      }
      res.status(403).json({
        error: errorMsg,
        code: 'FORBIDDEN'
      });
      return;
    }
    next();
  };
}
