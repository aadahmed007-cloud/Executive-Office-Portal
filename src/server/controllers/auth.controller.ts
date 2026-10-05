import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { sqliteEngine } from '../../data/database/sqliteEngine.js';
import { userRepo, auditRepo } from '../repositories/index.js';
import { SessionService } from '../services/session.service.js';
import { AuthSecurityService } from '../services/authSecurity.service.js';
import {
  verifyPasswordServer,
  hashPasswordServer,
  dummyPasswordHash
} from '../utils/crypto.js';

const loginSchema = z.object({
  username: z.string().min(1, 'اسم المستخدم مطلوب'),
  password: z.string().min(1, 'كلمة المرور مطلوبة')
}).strict();

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(8).optional(),
  current_password: z.string().min(1).optional(),
  new_password: z.string().min(8).optional()
}).strict();

const reauthSchema = z.object({
  password: z.string().min(1, 'كلمة المرور مطلوبة')
}).strict();

export class AuthController {
  /**
   * POST /api/auth/login
   */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parseResult = loginSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ error: parseResult.error.issues?.[0]?.message || 'بيانات غير صالحة' });
        return;
      }

      const { username, password } = parseResult.data;
      const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

      // 1. Check Brute-Force Lockout
      const securityStatus = AuthSecurityService.checkLockout(username);
      if (securityStatus.isLocked) {
        res.status(429).json({
          error: `تم إغلاق الحساب مؤقتاً بسبب تكرار المحاولات الخاطئة. يرجى الانتظار حتى: ${securityStatus.lockedUntil}`,
          code: 'ACCOUNT_LOCKED'
        });
        return;
      }

      // 2. Fetch User Record
      const userRecord = await userRepo.getByUsername(username);

      if (!userRecord) {
        // Equalize execution timing against enumeration attacks
        dummyPasswordHash(password);
        AuthSecurityService.recordFailure(username);

        await auditRepo.log({
          user_id: 'anonymous',
          user_name: username,
          user_role: 'ADMIN',
          action_type: 'AUTH',
          entity_type: 'LOGIN_FAILURE',
          entity_id: 'unknown_user',
          before_value: null,
          after_value: `محاولة تسجيل دخول فاشلة للمستخدم (${username}) - حساب غير مسجل`,
          ip_address: clientIp
        }, { userId: 'anonymous', role: 'ADMIN', can_view_confidential: false });

        res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
        return;
      }

      // 3. Constant-time password verification on server
      const isValid = verifyPasswordServer(
        password,
        userRecord.password_hash,
        userRecord.password_salt
      );

      if (!isValid) {
        const failureStatus = AuthSecurityService.recordFailure(username);

        await auditRepo.log({
          user_id: userRecord.id,
          user_name: userRecord.name,
          user_role: userRecord.role,
          action_type: 'AUTH',
          entity_type: 'LOGIN_FAILURE',
          entity_id: userRecord.id,
          before_value: null,
          after_value: `محاولة تسجيل دخول فاشلة للمستخدم (${username}) - كلمة مرور خاطئة (محاولة رقم ${failureStatus.failedAttempts})`,
          ip_address: clientIp
        }, { userId: userRecord.id, role: userRecord.role, can_view_confidential: Boolean(userRecord.can_view_confidential) });

        res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
        return;
      }

      // 4. Reset brute force attempts on success
      AuthSecurityService.recordSuccess(username);

      // 5. Create server session & rotate cookie
      const rawToken = SessionService.createSession(userRecord.id, {
        ipAddress: clientIp,
        userAgent: req.headers['user-agent']
      });
      SessionService.setCookie(res, rawToken);

      // 6. Log successful authentication
      await auditRepo.log({
        user_id: userRecord.id,
        user_name: userRecord.name,
        user_role: userRecord.role,
        action_type: 'AUTH',
        entity_type: 'SESSION',
        entity_id: userRecord.id,
        before_value: null,
        after_value: `تسجيل دخول ناجح للمستخدم (${userRecord.name} - ${userRecord.role}) وإنشاء جلسة عمل مؤمنة`,
        ip_address: clientIp
      }, { userId: userRecord.id, role: userRecord.role, can_view_confidential: Boolean(userRecord.can_view_confidential) });

      const { password_hash, password_salt, ...safeUser } = userRecord;
      res.json({
        user: {
          ...safeUser,
          can_view_confidential: Boolean(safeUser.can_view_confidential),
          must_change_password: Boolean(safeUser.must_change_password)
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/auth/me
   */
  static async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'جلسة العمل غير متوفرة أو منتهية' });
        return;
      }
      res.json({ user: req.user });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/logout
   */
  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.rawSessionToken) {
        SessionService.destroySession(req.rawSessionToken);
      }
      SessionService.clearCookie(res);

      if (req.user) {
        await auditRepo.log({
          user_id: req.user.id,
          user_name: req.user.name,
          user_role: req.user.role,
          action_type: 'AUTH',
          entity_type: 'SESSION',
          entity_id: req.user.id,
          before_value: 'جلسة نشطة',
          after_value: `تسجيل خروج آمن وإبطال جلسة العمل للمستخدم (${req.user.name})`,
          ip_address: req.ip || '127.0.0.1'
        }, req.userContext || { userId: req.user.id, role: req.user.role, can_view_confidential: Boolean(req.user.can_view_confidential) });
      }

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/change-password
   */
  static async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'غير مصرح' });
        return;
      }

      const parseResult = changePasswordSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ error: parseResult.error.issues?.[0]?.message || 'بيانات غير صالحة' });
        return;
      }

      const { current_password, currentPassword, new_password, newPassword } = parseResult.data as any;
      const effectiveCurrentPassword = current_password || currentPassword;
      const effectiveNewPassword = new_password || newPassword;

      if (!effectiveCurrentPassword || !effectiveNewPassword) {
        res.status(400).json({ error: 'كلمة المرور الحالية والجديدة مطلوبة' });
        return;
      }

      // Load full user with hash
      const userWithHash = await userRepo.getByUsername(req.user.username);
      if (!userWithHash) {
        res.status(404).json({ error: 'المستخدم غير موجود' });
        return;
      }

      // Verify current password
      const isCurrentValid = verifyPasswordServer(
        effectiveCurrentPassword,
        userWithHash.password_hash,
        userWithHash.password_salt
      );

      if (!isCurrentValid) {
        res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });
        return;
      }

      // Enforce strength policy
      const strengthCheck = AuthSecurityService.validatePasswordStrength(effectiveNewPassword, req.user.username);
      if (!strengthCheck.isValid) {
        res.status(400).json({ error: strengthCheck.error });
        return;
      }

      // Compute new hash with fresh random salt
      const newCredentials = hashPasswordServer(effectiveNewPassword);

      // Update in DB
      sqliteEngine.run(
        'UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 0 WHERE id = ?',
        [newCredentials.hashHex, newCredentials.saltHex, req.user.id]
      );

      // Invalidate all existing sessions
      SessionService.destroyAllUserSessions(req.user.id);

      // Issue new session and set cookie
      const rawToken = SessionService.createSession(req.user.id, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      SessionService.setCookie(res, rawToken);

      await auditRepo.log({
        user_id: req.user.id,
        user_name: req.user.name,
        user_role: req.user.role,
        action_type: 'UPDATE',
        entity_type: 'USER_PASSWORD',
        entity_id: req.user.id,
        before_value: 'كلمة مرور سابقة',
        after_value: `تحديث كلمة المرور وإلغاء الجلسات السابقة بنجاح للمستخدم (${req.user.name})`,
        ip_address: req.ip || '127.0.0.1'
      }, req.userContext || { userId: req.user.id, role: req.user.role, can_view_confidential: Boolean(req.user.can_view_confidential) });

      const updatedUser = {
        ...req.user,
        must_change_password: false
      };

      res.json({ success: true, user: updatedUser });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/reauth
   */
  static async reauth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'غير مصرح' });
        return;
      }

      const parseResult = reauthSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ error: parseResult.error.issues?.[0]?.message || 'كلمة المرور مطلوبة' });
        return;
      }

      const { password } = parseResult.data;
      const userWithHash = await userRepo.getByUsername(req.user.username);
      if (!userWithHash) {
        res.status(404).json({ error: 'المستخدم غير موجود' });
        return;
      }

      const isValid = verifyPasswordServer(
        password,
        userWithHash.password_hash,
        userWithHash.password_salt
      );

      if (!isValid) {
        res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
        return;
      }

      // Update session activity in DB
      if (req.rawSessionToken) {
        SessionService.validateSession(req.rawSessionToken);
      }

      await auditRepo.log({
        user_id: req.user.id,
        user_name: req.user.name,
        user_role: req.user.role,
        action_type: 'AUTH',
        entity_type: 'LOCK_SCREEN_UNLOCK',
        entity_id: req.user.id,
        before_value: 'شاشة مقفلة',
        after_value: `إلغاء قفل الشاشة بنجاح للمستخدم (${req.user.name})`,
        ip_address: req.ip || '127.0.0.1'
      }, req.userContext || { userId: req.user.id, role: req.user.role, can_view_confidential: Boolean(req.user.can_view_confidential) });

      res.json({ success: true, user: req.user });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/users
   */
  static async getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const list = await userRepo.getAll(req.userContext!);
      // If caller is not ADMIN, only return public picker details
      const isFullAdmin = req.user?.role === 'ADMIN';

      const sanitized = list.map((u: any) => {
        if (isFullAdmin) {
          return {
            id: u.id,
            username: u.username,
            name: u.name,
            title: u.title,
            department_id: u.department_id,
            email: u.email,
            role: u.role,
            can_view_confidential: Boolean(u.can_view_confidential),
            must_change_password: Boolean(u.must_change_password),
            avatar: u.avatar,
            created_at: u.created_at
          };
        }
        return {
          id: u.id,
          name: u.name,
          title: u.title,
          role: u.role
        };
      });

      res.json(sanitized);
    } catch (err) {
      next(err);
    }
  }
}
