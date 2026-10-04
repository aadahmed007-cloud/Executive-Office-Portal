import { Request, Response, NextFunction } from 'express';
import { UserContext } from '../../data/contracts/index.js';
import { RoleType } from '../../domain/types/index.js';

// Extend Express Request interface to carry userContext
declare global {
  namespace Express {
    interface Request {
      userContext?: UserContext;
    }
  }
}

/**
 * Middleware to extract and validate userContext from incoming request headers
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const userId = req.headers['x-user-id'] as string | undefined;
  const role = req.headers['x-user-role'] as RoleType | undefined;
  const canViewConfidential = req.headers['x-can-view-confidential'] === 'true';

  req.userContext = {
    userId,
    role,
    can_view_confidential: canViewConfidential
  };

  next();
}

/**
 * Middleware to require authenticated user context
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.userContext?.userId && !req.userContext?.role) {
    res.status(401).json({
      error: 'يرجى تسجيل الدخول أولاً للوصول إلى هذا المورد (Authentication Required)'
    });
    return;
  }
  next();
}

/**
 * Middleware to require specific roles
 */
export function requireRole(allowedRoles: RoleType[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.userContext?.role;
    if (!role || !allowedRoles.includes(role)) {
      res.status(403).json({
        error: 'غير مصرح لرتبتك الوظيفية بتنفيذ هذا الإجراء (Access Denied: Insufficient Role)'
      });
      return;
    }
    next();
  };
}
