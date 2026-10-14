import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { sqliteEngine } from '../../data/database/sqliteEngine.js';
import { userRepo, auditRepo } from '../repositories/index.js';
import { SessionService } from '../services/session.service.js';
import {
  generateRandomPassword,
  hashPasswordServer
} from '../utils/crypto.js';

// Username: 3-32 chars, lowercase letters, digits, dot, underscore, hyphen
const usernameRegex = /^[a-z0-9._-]{3,32}$/;

const createUserSchema = z.object({
  username: z.string()
    .min(3, 'اسم المستخدم يجب ألا يقل عن 3 أحرف')
    .max(32, 'اسم المستخدم يجب ألا يتجاوز 32 حرفاً')
    .regex(usernameRegex, 'اسم المستخدم يجب أن يحتوي فقط على أحرف صغيرة بالإنجليزية، وأرقام، ونقطة، وشرطة، وشرطة سفلية'),
  name: z.string().min(2, 'الاسم الكامل مطلوب'),
  title: z.string().min(2, 'المسمى الوظيفي مطلوب'),
  email: z.string().email('صيغة البريد الإلكتروني غير صحيحة'),
  role: z.enum(['CHAIRMAN', 'SECRETARY', 'ADMIN'], {
    message: 'الدور الوظيفي يجب أن يكون أحد الأدوار المعتمدة: CHAIRMAN أو SECRETARY أو ADMIN'
  }),
  department_id: z.string().optional().default('dept-exec'),
  can_view_confidential: z.boolean().optional().default(false),
  avatar: z.string().optional()
}).strict();

const updateUserSchema = z.object({
  name: z.string().min(2, 'الاسم الكامل مطلوب').optional(),
  title: z.string().min(2, 'المسمى الوظيفي مطلوب').optional(),
  email: z.string().email('صيغة البريد الإلكتروني غير صحيحة').optional(),
  role: z.enum(['CHAIRMAN', 'SECRETARY', 'ADMIN'], {
    message: 'الدور الوظيفي يجب أن يكون أحد الأدوار المعتمدة: CHAIRMAN أو SECRETARY أو ADMIN'
  }).optional(),
  can_view_confidential: z.boolean().optional(),
  confirmation_phrase: z.string().optional()
}).strict();

export class AdminUsersController {
  /**
   * GET /api/admin/users
   * Full record without hashes or salts.
   */
  static async listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rows = sqliteEngine.query<any>(
        `SELECT u.id, u.username, u.name, u.title, u.department_id, u.email, u.role,
                u.can_view_confidential, u.must_change_password, u.is_disabled, u.totp_enabled, u.totp_enrolled_at, u.avatar, u.created_at,
                (SELECT MAX(s.last_active_at) FROM sessions s WHERE s.user_id = u.id) as last_active_at,
                (SELECT ls.last_success_at FROM login_security ls WHERE LOWER(ls.username) = LOWER(u.username)) as last_login_at
         FROM users u
         ORDER BY u.name ASC`
      );

      const users = rows.map((u) => ({
        id: u.id,
        username: u.username,
        name: u.name,
        title: u.title,
        department_id: u.department_id,
        email: u.email,
        role: u.role,
        can_view_confidential: Boolean(u.can_view_confidential),
        must_change_password: Boolean(u.must_change_password),
        is_disabled: Boolean(u.is_disabled),
        totp_enabled: Boolean(u.totp_enabled),
        totp_enrolled_at: u.totp_enrolled_at || null,
        avatar: u.avatar || null,
        created_at: u.created_at,
        last_login_at: u.last_login_at || u.last_active_at || null
      }));

      res.json(users);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/admin/users
   * Create new user with random one-time password returned ONCE in the response.
   */
  static async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parseResult = createUserSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: parseResult.error.issues?.[0]?.message || 'بيانات غير صالحة',
          details: parseResult.error.issues
        });
        return;
      }

      const data = parseResult.data;
      const normalizedUsername = data.username.trim().toLowerCase();
      const normalizedEmail = data.email.trim().toLowerCase();

      // Check unique username
      const existingUser = sqliteEngine.query<any>(
        'SELECT id FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1',
        [normalizedUsername]
      );
      if (existingUser.length > 0) {
        res.status(409).json({ error: 'اسم المستخدم مسجل مسبقاً، يرجى اختيار اسم مستخدم آخر' });
        return;
      }

      // Check unique email
      const existingEmail = sqliteEngine.query<any>(
        'SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
        [normalizedEmail]
      );
      if (existingEmail.length > 0) {
        res.status(409).json({ error: 'البريد الإلكتروني مسجل مسبقاً لمستخدم آخر' });
        return;
      }

      const tempPassword = generateRandomPassword(16);
      const { hashHex, saltHex } = hashPasswordServer(tempPassword);

      const userId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const now = new Date().toISOString();
      const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

      sqliteEngine.transaction(() => {
        sqliteEngine.run(
          `INSERT INTO users (id, username, name, title, department_id, email, role, can_view_confidential, password_hash, password_salt, must_change_password, is_disabled, avatar, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            normalizedUsername,
            data.name.trim(),
            data.title.trim(),
            data.department_id,
            normalizedEmail,
            data.role,
            data.can_view_confidential ? 1 : 0,
            hashHex,
            saltHex,
            1,
            0,
            data.avatar || null,
            now
          ]
        );
      });

      const afterSafe = JSON.stringify({
        id: userId,
        username: normalizedUsername,
        name: data.name,
        title: data.title,
        email: normalizedEmail,
        role: data.role,
        can_view_confidential: Boolean(data.can_view_confidential),
        is_disabled: false,
        must_change_password: true
      });

      await auditRepo.log({
        user_id: req.user!.id,
        user_name: req.user!.name,
        user_role: req.user!.role,
        action_type: 'CREATE',
        entity_type: 'USER',
        entity_id: userId,
        before_value: null,
        after_value: afterSafe,
        ip_address: clientIp
      }, req.userContext || { userId: req.user!.id, role: req.user!.role, can_view_confidential: Boolean(req.user!.can_view_confidential) });

      res.status(201).json({
        user: {
          id: userId,
          username: normalizedUsername,
          name: data.name.trim(),
          title: data.title.trim(),
          department_id: data.department_id,
          email: normalizedEmail,
          role: data.role,
          can_view_confidential: Boolean(data.can_view_confidential),
          must_change_password: true,
          is_disabled: false,
          created_at: now
        },
        temporary_password: tempPassword,
        warning: 'احفظ كلمة المرور المؤقتة الآن؛ لن يتم عرضها مرة أخرى إطلاقاً وسيُطلب من المستخدم تغييرها عند أول تسجيل دخول.'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/admin/users/:id
   */
  static async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.params.id;
      const parseResult = updateUserSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: parseResult.error.issues?.[0]?.message || 'بيانات غير صالحة',
          details: parseResult.error.issues
        });
        return;
      }

      const data = parseResult.data;
      const targetUser = await userRepo.getById(userId, req.userContext!);
      if (!targetUser) {
        res.status(404).json({ error: 'المستخدم غير موجود' });
        return;
      }

      const isChangingRole = data.role !== undefined && data.role !== targetUser.role;
      const isChangingClearance = data.can_view_confidential !== undefined && data.can_view_confidential !== targetUser.can_view_confidential;

      if (isChangingRole || isChangingClearance) {
        const expectedPhrase = 'تأكيد التعديل الأمني';
        if (data.confirmation_phrase !== expectedPhrase) {
          res.status(400).json({
            error: `تعديل الصلاحيات أو الرتبة يتطلب كتابة عبارة التأكيد بدقة: "${expectedPhrase}"`,
            code: 'CONFIRMATION_REQUIRED'
          });
          return;
        }
      }

      if (isChangingRole && targetUser.role === 'ADMIN' && data.role !== 'ADMIN') {
        const adminRows = sqliteEngine.query<{ count: number }>(
          "SELECT COUNT(*) as count FROM users WHERE role = 'ADMIN' AND is_disabled = 0"
        );
        const activeAdminCount = adminRows[0]?.count || 0;
        if (activeAdminCount <= 1) {
          res.status(400).json({
            error: 'لا يمكن خفض رتبة آخر مسؤول نظام نشط، يجب تعيين مسؤول نظام آخر أولاً'
          });
          return;
        }
      }

      if (data.email && data.email.toLowerCase() !== targetUser.email.toLowerCase()) {
        const existingEmail = sqliteEngine.query<any>(
          'SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ? LIMIT 1',
          [data.email.trim().toLowerCase(), userId]
        );
        if (existingEmail.length > 0) {
          res.status(409).json({ error: 'البريد الإلكتروني مسجل مسبقاً لمستخدم آخر' });
          return;
        }
      }

      const beforeSafe = JSON.stringify({
        id: targetUser.id,
        username: targetUser.username,
        name: targetUser.name,
        title: targetUser.title,
        email: targetUser.email,
        role: targetUser.role,
        can_view_confidential: targetUser.can_view_confidential,
        is_disabled: targetUser.is_disabled
      });

      const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

      sqliteEngine.transaction(() => {
        const updates: string[] = [];
        const params: any[] = [];

        if (data.name !== undefined) {
          updates.push('name = ?');
          params.push(data.name.trim());
        }
        if (data.title !== undefined) {
          updates.push('title = ?');
          params.push(data.title.trim());
        }
        if (data.email !== undefined) {
          updates.push('email = ?');
          params.push(data.email.trim().toLowerCase());
        }
        if (data.role !== undefined) {
          updates.push('role = ?');
          params.push(data.role);
        }
        if (data.can_view_confidential !== undefined) {
          updates.push('can_view_confidential = ?');
          params.push(data.can_view_confidential ? 1 : 0);
        }

        if (updates.length > 0) {
          params.push(userId);
          sqliteEngine.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
        }
      });

      const freshRows = sqliteEngine.query<any>(
        `SELECT id, username, name, title, department_id, email, role, can_view_confidential, must_change_password, is_disabled, avatar, created_at
         FROM users WHERE id = ? LIMIT 1`,
        [userId]
      );
      const updatedRecord = freshRows[0];

      const afterSafe = JSON.stringify({
        id: updatedRecord.id,
        username: updatedRecord.username,
        name: updatedRecord.name,
        title: updatedRecord.title,
        email: updatedRecord.email,
        role: updatedRecord.role,
        can_view_confidential: Boolean(updatedRecord.can_view_confidential),
        is_disabled: Boolean(updatedRecord.is_disabled)
      });

      await auditRepo.log({
        user_id: req.user!.id,
        user_name: req.user!.name,
        user_role: req.user!.role,
        action_type: 'UPDATE',
        entity_type: 'USER',
        entity_id: userId,
        before_value: beforeSafe,
        after_value: afterSafe,
        ip_address: clientIp
      }, req.userContext || { userId: req.user!.id, role: req.user!.role, can_view_confidential: Boolean(req.user!.can_view_confidential) });

      if (isChangingRole || isChangingClearance) {
        SessionService.destroyAllUserSessions(userId);
      }

      res.json({
        user: {
          id: updatedRecord.id,
          username: updatedRecord.username,
          name: updatedRecord.name,
          title: updatedRecord.title,
          department_id: updatedRecord.department_id,
          email: updatedRecord.email,
          role: updatedRecord.role,
          can_view_confidential: Boolean(updatedRecord.can_view_confidential),
          must_change_password: Boolean(updatedRecord.must_change_password),
          is_disabled: Boolean(updatedRecord.is_disabled),
          created_at: updatedRecord.created_at
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/admin/users/:id/disable
   */
  static async disableUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.params.id;
      const callerId = req.user!.id;

      if (userId === callerId) {
        res.status(400).json({ error: 'لا يمكن للمسؤول تعطيل حسابه الشخصي' });
        return;
      }

      const targetUser = await userRepo.getById(userId, req.userContext!);
      if (!targetUser) {
        res.status(404).json({ error: 'المستخدم غير موجود' });
        return;
      }

      if (targetUser.role === 'ADMIN') {
        const adminRows = sqliteEngine.query<{ count: number }>(
          "SELECT COUNT(*) as count FROM users WHERE role = 'ADMIN' AND is_disabled = 0"
        );
        const activeAdminCount = adminRows[0]?.count || 0;
        if (activeAdminCount <= 1) {
          res.status(400).json({ error: 'لا يمكن تعطيل آخر مسؤول نظام نشط' });
          return;
        }
      }

      const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

      sqliteEngine.transaction(() => {
        sqliteEngine.run('UPDATE users SET is_disabled = 1 WHERE id = ?', [userId]);
      });

      await auditRepo.log({
        user_id: req.user!.id,
        user_name: req.user!.name,
        user_role: req.user!.role,
        action_type: 'UPDATE',
        entity_type: 'USER',
        entity_id: userId,
        before_value: JSON.stringify({ is_disabled: false }),
        after_value: JSON.stringify({ is_disabled: true }),
        ip_address: clientIp
      }, req.userContext || { userId: req.user!.id, role: req.user!.role, can_view_confidential: Boolean(req.user!.can_view_confidential) });

      SessionService.destroyAllUserSessions(userId);

      res.json({ success: true, message: 'تم تعطيل الحساب بنجاح وإلغاء جميع جلساته النشطة' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/admin/users/:id/enable
   */
  static async enableUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.params.id;
      const targetUser = await userRepo.getById(userId, req.userContext!);
      if (!targetUser) {
        res.status(404).json({ error: 'المستخدم غير موجود' });
        return;
      }

      const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

      sqliteEngine.transaction(() => {
        sqliteEngine.run('UPDATE users SET is_disabled = 0 WHERE id = ?', [userId]);
      });

      await auditRepo.log({
        user_id: req.user!.id,
        user_name: req.user!.name,
        user_role: req.user!.role,
        action_type: 'UPDATE',
        entity_type: 'USER',
        entity_id: userId,
        before_value: JSON.stringify({ is_disabled: true }),
        after_value: JSON.stringify({ is_disabled: false }),
        ip_address: clientIp
      }, req.userContext || { userId: req.user!.id, role: req.user!.role, can_view_confidential: Boolean(req.user!.can_view_confidential) });

      res.json({ success: true, message: 'تم تفعيل الحساب بنجاح' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/admin/users/:id/reset-password
   */
  static async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.params.id;
      const targetUser = await userRepo.getById(userId, req.userContext!);
      if (!targetUser) {
        res.status(404).json({ error: 'المستخدم غير موجود' });
        return;
      }

      const newTempPassword = generateRandomPassword(16);
      const { hashHex, saltHex } = hashPasswordServer(newTempPassword);
      const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

      sqliteEngine.transaction(() => {
        sqliteEngine.run(
          'UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 1 WHERE id = ?',
          [hashHex, saltHex, userId]
        );
      });

      await auditRepo.log({
        user_id: req.user!.id,
        user_name: req.user!.name,
        user_role: req.user!.role,
        action_type: 'UPDATE',
        entity_type: 'USER',
        entity_id: userId,
        before_value: JSON.stringify({ must_change_password: targetUser.must_change_password }),
        after_value: JSON.stringify({ must_change_password: true, status: 'password_reset_by_admin' }),
        ip_address: clientIp
      }, req.userContext || { userId: req.user!.id, role: req.user!.role, can_view_confidential: Boolean(req.user!.can_view_confidential) });

      SessionService.destroyAllUserSessions(userId);

      res.json({
        success: true,
        temporary_password: newTempPassword,
        warning: 'احفظ كلمة المرور الجديدة الآن؛ لن يتم عرضها مرة أخرى إطلاقاً وسيطلب من المستخدم تغييرها عند تسجيل الدخول.'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/admin/users/:id/reset-2fa
   * ADMIN can reset a user's 2FA with a typed confirmation and an audit entry (P8-3).
   */
  static async reset2Fa(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const resetSchema = z.object({
        confirmUsername: z.string().min(1, 'يرجى كتابة اسم المستخدم للتأكيد')
      }).strict();

      const parseResult = resetSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ error: parseResult.error.issues?.[0]?.message || 'بيانات غير صالحة' });
        return;
      }

      const userId = req.params.id;
      const targetUser = await userRepo.getById(userId, req.userContext!);
      if (!targetUser) {
        res.status(404).json({ error: 'المستخدم غير موجود' });
        return;
      }

      const { confirmUsername } = parseResult.data;
      if (confirmUsername.trim().toLowerCase() !== targetUser.username.trim().toLowerCase()) {
        res.status(400).json({ error: 'اسم المستخدم للتأكيد غير مطابق؛ يرجى كتابة اسم المستخدم بدقة لتأكيد إعادة التعيين' });
        return;
      }

      const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

      sqliteEngine.transaction(() => {
        sqliteEngine.run(
          `UPDATE users SET
             totp_enabled = 0,
             totp_secret_enc = NULL,
             totp_enrolled_at = NULL,
             totp_last_step = 0,
             recovery_codes = NULL,
             totp_failed_attempts = 0,
             totp_locked_until = NULL
           WHERE id = ?`,
          [userId]
        );
      });

      await auditRepo.log({
        user_id: req.user!.id,
        user_name: req.user!.name,
        user_role: req.user!.role,
        action_type: 'UPDATE',
        entity_type: 'USER_2FA_RESET',
        entity_id: userId,
        before_value: null,
        after_value: `تم إلغاء وإعادة تعيين المصادقة الثنائية (2FA) للمستخدم (${targetUser.username}) بواسطة مسؤول النظام`,
        ip_address: clientIp
      }, req.userContext || { userId: req.user!.id, role: req.user!.role, can_view_confidential: Boolean(req.user!.can_view_confidential) });

      res.json({
        success: true,
        message: `تم إلغاء وإعادة تعيين المصادقة الثنائية (2FA) للمستخدم (${targetUser.username}) بنجاح.`
      });
    } catch (err) {
      next(err);
    }
  }
}
