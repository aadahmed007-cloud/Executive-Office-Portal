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
import {
  sign2FaToken,
  verify2FaToken,
  checkTotpLockout,
  recordTotpFailure,
  recordTotpSuccess,
  generateTotpSecret,
  encryptTotpSecret,
  decryptTotpSecret,
  generateRecoveryCodes,
  verifyAndConsumeRecoveryCode,
  generateOtpAuthUri,
  generateQrCodeSvg,
  verifyTotpCode
} from '../services/totp.service.js';

const loginSchema = z.object({
  username: z.string().min(1, 'اسم المستخدم مطلوب'),
  password: z.string().min(1, 'كلمة المرور مطلوبة')
}).strict();

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(1).optional(),
  current_password: z.string().min(1).optional(),
  new_password: z.string().min(1).optional()
}).strict();

const reauthSchema = z.object({
  password: z.string().min(1, 'كلمة المرور مطلوبة')
}).strict();

const verifyTotpSchema = z.object({
  totp_token: z.string().min(1, 'رمز الجلسة المؤقت مطلوب'),
  code: z.string().optional(),
  recovery_code: z.string().optional()
}).strict();

const setup2FaSchema = z.object({
  totp_token: z.string().optional()
}).strict();

const confirm2FaSchema = z.object({
  totp_token: z.string().optional(),
  code: z.string().min(1, 'رمز المصادقة مطلوب')
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

      // Check if user account is disabled
      if (Boolean(userRecord.is_disabled)) {
        dummyPasswordHash(password);
        AuthSecurityService.recordFailure(username);
        await auditRepo.log({
          user_id: userRecord.id,
          user_name: userRecord.name,
          user_role: userRecord.role,
          action_type: 'AUTH',
          entity_type: 'LOGIN_FAILURE',
          entity_id: userRecord.id,
          before_value: null,
          after_value: `محاولة تسجيل دخول لحساب معطل للمستخدم (${username})`,
          ip_address: clientIp
        }, { userId: userRecord.id, role: userRecord.role, can_view_confidential: Boolean(userRecord.can_view_confidential) });

        res.status(403).json({ error: 'تم تعطيل هذا الحساب. يرجى مراجعة مسؤول النظم' });
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

      // 5. Check 2FA requirements:
      // Case A: User has 2FA enabled
      if (Boolean(userRecord.totp_enabled)) {
        const lockout = checkTotpLockout(userRecord);
        if (lockout.isLocked) {
          res.status(429).json({
            error: `تم قفل المصادقة الثنائية مؤقتاً لتكرار المحاولات الخاطئة. يرجى الانتظار حتى: ${lockout.lockedUntil}`,
            code: 'TOTP_LOCKED'
          });
          return;
        }

        const totpToken = sign2FaToken(userRecord.id, 'login');
        res.json({
          require_totp: true,
          totp_token: totpToken,
          user_id: userRecord.id
        });
        return;
      }

      // Case B: Policy REQUIRE_2FA=true enforces enrollment for CHAIRMAN and ADMIN
      const isTargetRole = userRecord.role === 'CHAIRMAN' || userRecord.role === 'ADMIN';
      if (process.env.REQUIRE_2FA === 'true' && isTargetRole && !userRecord.totp_enabled) {
        const totpToken = sign2FaToken(userRecord.id, 'enrollment');
        res.json({
          require_totp_enrollment: true,
          totp_token: totpToken,
          user_id: userRecord.id
        });
        return;
      }

      // 6. Create server session & rotate cookie (No 2FA needed or enabled)
      const rawToken = SessionService.createSession(userRecord.id, {
        ipAddress: clientIp,
        userAgent: req.headers['user-agent']
      });
      SessionService.setCookie(res, rawToken);

      // 7. Log successful authentication
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

      const { password_hash, password_salt, totp_secret_enc, recovery_codes, ...safeUser } = userRecord;
      res.json({
        user: {
          ...safeUser,
          can_view_confidential: Boolean(safeUser.can_view_confidential),
          must_change_password: Boolean(safeUser.must_change_password),
          totp_enabled: Boolean(safeUser.totp_enabled)
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
      const strengthCheck = AuthSecurityService.validatePasswordStrength(effectiveNewPassword, req.user.username, effectiveCurrentPassword);
      if (!strengthCheck.isValid) {
        res.status(400).json({ error: strengthCheck.error, reason: strengthCheck.reason, code: 'VALIDATION_ERROR' });
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

  /**
   * POST /api/auth/verify-totp
   */
  static async verifyTotp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parseResult = verifyTotpSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ error: parseResult.error.issues?.[0]?.message || 'بيانات غير صالحة' });
        return;
      }

      const { totp_token, code, recovery_code } = parseResult.data;
      if (!code && !recovery_code) {
        res.status(400).json({ error: 'يرجى إدخال رمز المصادقة الثنائية (TOTP) أو رمز الاسترداد' });
        return;
      }

      const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

      // 1. Verify pre-auth token
      const tokenPayload = verify2FaToken(totp_token);
      if (!tokenPayload) {
        res.status(401).json({ error: 'جلسة التحقق المؤقتة منتهية الصلاحية أو غير صالحة. يرجى تسجيل الدخول مجدداً.' });
        return;
      }

      const rows = sqliteEngine.query<any>(
        'SELECT * FROM users WHERE id = ? LIMIT 1',
        [tokenPayload.userId]
      );
      const user = rows[0];
      if (!user || Boolean(user.is_disabled)) {
        res.status(401).json({ error: 'المستخدم غير متاح أو تم تعطيل حسابه' });
        return;
      }

      if (!user.totp_enabled) {
        res.status(400).json({ error: 'المصادقة الثنائية غير مفعلة لهذا الحساب' });
        return;
      }

      // 2. Check Lockout
      const lockout = checkTotpLockout(user);
      if (lockout.isLocked) {
        res.status(429).json({
          error: `تم قفل المصادقة الثنائية مؤقتاً لتكرار المحاولات الخاطئة. يرجى الانتظار حتى: ${lockout.lockedUntil}`,
          code: 'TOTP_LOCKED'
        });
        return;
      }

      // 3. Handle Recovery Code
      if (recovery_code) {
        const recoveryResult = verifyAndConsumeRecoveryCode(recovery_code, user.recovery_codes);
        if (!recoveryResult.isValid) {
          const failStatus = recordTotpFailure(user.id);
          await auditRepo.log({
            user_id: user.id,
            user_name: user.name,
            user_role: user.role,
            action_type: 'AUTH',
            entity_type: 'LOGIN_FAILURE',
            entity_id: user.id,
            before_value: null,
            after_value: `محاولة تسجيل دخول فاشلة برمز استرداد غير صالح للمستخدم (${user.username})`,
            ip_address: clientIp
          }, { userId: user.id, role: user.role, can_view_confidential: Boolean(user.can_view_confidential) });

          if (failStatus.isLocked) {
            res.status(429).json({
              error: `تم قفل المصادقة الثنائية مؤقتاً لتكرار المحاولات الخاطئة. يرجى الانتظار حتى: ${failStatus.lockedUntil}`,
              code: 'TOTP_LOCKED'
            });
            return;
          }
          res.status(401).json({ error: 'رمز الاسترداد غير صحيح أو تم استخدامه مسبقاً' });
          return;
        }

        // Recovery code valid! Update remaining recovery codes & reset failures
        sqliteEngine.run(
          'UPDATE users SET recovery_codes = ?, totp_failed_attempts = 0, totp_locked_until = NULL WHERE id = ?',
          [recoveryResult.remainingHashedCodesJson!, user.id]
        );

        // Create session
        const rawToken = SessionService.createSession(user.id, {
          ipAddress: clientIp,
          userAgent: req.headers['user-agent']
        });
        SessionService.setCookie(res, rawToken);

        await auditRepo.log({
          user_id: user.id,
          user_name: user.name,
          user_role: user.role,
          action_type: 'AUTH',
          entity_type: 'SESSION',
          entity_id: user.id,
          before_value: null,
          after_value: `تسجيل دخول ناجح باستخدام رمز استرداد لمرة واحدة للمستخدم (${user.name} - ${user.role})`,
          ip_address: clientIp
        }, { userId: user.id, role: user.role, can_view_confidential: Boolean(user.can_view_confidential) });

        const { password_hash, password_salt, totp_secret_enc, recovery_codes: _, ...safeUser } = user;
        res.json({
          user: {
            ...safeUser,
            can_view_confidential: Boolean(safeUser.can_view_confidential),
            must_change_password: Boolean(safeUser.must_change_password),
            totp_enabled: true
          }
        });
        return;
      }

      // 4. Handle Standard TOTP Code
      if (!user.totp_secret_enc) {
        res.status(500).json({ error: 'بيانات المصادقة الثنائية غير متوفرة' });
        return;
      }

      const secret = decryptTotpSecret(user.totp_secret_enc);
      const verifyResult = verifyTotpCode(secret, code!, Math.floor(Date.now() / 1000), {
        window: 1,
        lastStep: user.totp_last_step ?? -1
      });

      if (verifyResult.reason === 'REUSED_CODE') {
        recordTotpFailure(user.id);
        res.status(400).json({
          error: 'تم استخدام رمز المصادقة هذا مسبقاً في هذه النافذة الزمنية، يرجى الانتظار لتوليد رمز جديد',
          code: 'TOTP_CODE_REUSED'
        });
        return;
      }

      if (!verifyResult.isValid) {
        const failStatus = recordTotpFailure(user.id);

        await auditRepo.log({
          user_id: user.id,
          user_name: user.name,
          user_role: user.role,
          action_type: 'AUTH',
          entity_type: 'LOGIN_FAILURE',
          entity_id: user.id,
          before_value: null,
          after_value: `محاولة مصادقة ثنائية فاشلة للمستخدم (${user.username}) - رمز غير مطابق`,
          ip_address: clientIp
        }, { userId: user.id, role: user.role, can_view_confidential: Boolean(user.can_view_confidential) });

        if (failStatus.isLocked) {
          res.status(429).json({
            error: `تم قفل المصادقة الثنائية مؤقتاً لتكرار المحاولات الخاطئة. يرجى الانتظار حتى: ${failStatus.lockedUntil}`,
            code: 'TOTP_LOCKED'
          });
          return;
        }

        res.status(401).json({ error: 'رمز المصادقة الثنائية غير صحيح' });
        return;
      }

      // Valid TOTP code! Update lastStep and reset failures in DB
      recordTotpSuccess(user.id);
      sqliteEngine.run(
        'UPDATE users SET totp_last_step = ? WHERE id = ?',
        [verifyResult.matchedStep, user.id]
      );

      // Create session & rotate cookie
      const rawToken = SessionService.createSession(user.id, {
        ipAddress: clientIp,
        userAgent: req.headers['user-agent']
      });
      SessionService.setCookie(res, rawToken);

      await auditRepo.log({
        user_id: user.id,
        user_name: user.name,
        user_role: user.role,
        action_type: 'AUTH',
        entity_type: 'SESSION',
        entity_id: user.id,
        before_value: null,
        after_value: `تسجيل دخول ناجح مع إتمام المصادقة الثنائية (2FA) للمستخدم (${user.name} - ${user.role})`,
        ip_address: clientIp
      }, { userId: user.id, role: user.role, can_view_confidential: Boolean(user.can_view_confidential) });

      const { password_hash, password_salt, totp_secret_enc, recovery_codes: _, ...safeUser } = user;
      res.json({
        user: {
          ...safeUser,
          can_view_confidential: Boolean(safeUser.can_view_confidential),
          must_change_password: Boolean(safeUser.must_change_password),
          totp_enabled: true
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/2fa/setup
   * Generate per-user secret, otpauth URI, QR code SVG, and 10 recovery codes.
   */
  static async setup2Fa(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parseResult = setup2FaSchema.safeParse(req.body);
      let userId = req.user?.id;

      if (!userId && parseResult.success && parseResult.data.totp_token) {
        const tokenPayload = verify2FaToken(parseResult.data.totp_token);
        if (tokenPayload) {
          userId = tokenPayload.userId;
        }
      }

      if (!userId) {
        res.status(401).json({ error: 'يرجى تسجيل الدخول أو تقديم رمز جلسة صالح للبدء بإعداد المصادقة الثنائية' });
        return;
      }

      const rows = sqliteEngine.query<any>('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
      const user = rows[0];
      if (!user || Boolean(user.is_disabled)) {
        res.status(401).json({ error: 'المستخدم غير متاح' });
        return;
      }

      const secret = generateTotpSecret(20);
      const secretEnc = encryptTotpSecret(secret);
      const { plaintextCodes, hashedCodes } = generateRecoveryCodes(10);
      const otpauthUri = generateOtpAuthUri(user.username, secret);
      const qrCodeSvg = await generateQrCodeSvg(otpauthUri);

      // Store pending secret and recovery codes (totp_enabled remains 0 until confirmed)
      sqliteEngine.run(
        'UPDATE users SET totp_secret_enc = ?, recovery_codes = ? WHERE id = ?',
        [secretEnc, JSON.stringify(hashedCodes), user.id]
      );

      res.json({
        otpauthUri,
        manualEntrySecret: secret,
        qrCodeSvg,
        recoveryCodes: plaintextCodes
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/2fa/confirm
   * Confirms enrollment with a valid TOTP code.
   */
  static async confirm2Fa(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parseResult = confirm2FaSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ error: parseResult.error.issues?.[0]?.message || 'بيانات غير صالحة' });
        return;
      }

      const { totp_token, code } = parseResult.data;
      let userId = req.user?.id;
      let isPreAuth = false;

      if (!userId && totp_token) {
        const tokenPayload = verify2FaToken(totp_token);
        if (tokenPayload) {
          userId = tokenPayload.userId;
          isPreAuth = true;
        }
      }

      if (!userId) {
        res.status(401).json({ error: 'يرجى تسجيل الدخول لتأكيد تفعيل المصادقة الثنائية' });
        return;
      }

      const rows = sqliteEngine.query<any>('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
      const user = rows[0];
      if (!user || Boolean(user.is_disabled)) {
        res.status(401).json({ error: 'المستخدم غير متاح' });
        return;
      }

      if (!user.totp_secret_enc) {
        res.status(400).json({ error: 'يرجى بدء إعداد المصادقة الثنائية أولاً عبر /setup' });
        return;
      }

      const secret = decryptTotpSecret(user.totp_secret_enc);
      const verifyResult = verifyTotpCode(secret, code, Math.floor(Date.now() / 1000), { window: 1 });

      if (!verifyResult.isValid) {
        res.status(400).json({ error: 'رمز التحقق غير صحيح، يرجى التأكد من الوقت والمحاولة مجدداً' });
        return;
      }

      const nowIso = new Date().toISOString();
      const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

      sqliteEngine.transaction(() => {
        sqliteEngine.run(
          `UPDATE users SET
             totp_enabled = 1,
             totp_enrolled_at = ?,
             totp_last_step = ?,
             totp_failed_attempts = 0,
             totp_locked_until = NULL
           WHERE id = ?`,
          [nowIso, verifyResult.matchedStep, user.id]
        );
      });

      await auditRepo.log({
        user_id: user.id,
        user_name: user.name,
        user_role: user.role,
        action_type: 'UPDATE',
        entity_type: 'USER_2FA_ENROLLED',
        entity_id: user.id,
        before_value: null,
        after_value: `تم تفعيل المصادقة الثنائية (2FA) بنجاح للمستخدم (${user.username})`,
        ip_address: clientIp
      }, { userId: user.id, role: user.role, can_view_confidential: Boolean(user.can_view_confidential) });

      // If pre-auth flow (user enrolled before full login), establish session now!
      if (isPreAuth) {
        const rawToken = SessionService.createSession(user.id, {
          ipAddress: clientIp,
          userAgent: req.headers['user-agent']
        });
        SessionService.setCookie(res, rawToken);
      }

      res.json({
        success: true,
        message: 'تم تفعيل المصادقة الثنائية بنجاح على حسابك'
      });
    } catch (err) {
      next(err);
    }
  }
}
