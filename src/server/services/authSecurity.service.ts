import { sqliteEngine } from '../../data/database/sqliteEngine.js';

export interface SecurityStatus {
  isLocked: boolean;
  lockedUntil?: string | null;
  failedAttempts: number;
}

const COMMON_PASSWORDS = new Set([
  '123456789012',
  'password1234',
  'admin1234567',
  'secret123456',
  'egyptpost123',
  'egyptpost2026',
  'welcome12345'
]);

export class AuthSecurityService {
  /**
   * Checks if an account is currently locked due to repeated failed login attempts.
   */
  public static checkLockout(username: string): SecurityStatus {
    const rows = sqliteEngine.query<{
      failed_attempts: number;
      locked_until: string | null;
    }>('SELECT failed_attempts, locked_until FROM login_security WHERE username = ? LIMIT 1', [username]);

    if (!rows || rows.length === 0) {
      return { isLocked: false, failedAttempts: 0 };
    }

    const rec = rows[0];
    if (rec.locked_until) {
      const lockExpiry = new Date(rec.locked_until);
      if (new Date() < lockExpiry) {
        return {
          isLocked: true,
          lockedUntil: rec.locked_until,
          failedAttempts: rec.failed_attempts
        };
      }
    }

    return { isLocked: false, failedAttempts: rec.failed_attempts || 0 };
  }

  /**
   * Records a failed login attempt in the database with progressive exponential delay.
   */
  public static recordFailure(username: string): SecurityStatus {
    const now = new Date();
    const rows = sqliteEngine.query<{ failed_attempts: number }>(
      'SELECT failed_attempts FROM login_security WHERE username = ? LIMIT 1',
      [username]
    );

    const currentAttempts = (rows[0]?.failed_attempts || 0) + 1;
    let lockedUntil: string | null = null;

    // Progressive lockout starting at 5 failed attempts
    if (currentAttempts >= 5) {
      const lockSeconds = Math.min(1800, Math.pow(2, currentAttempts - 4) * 30); // 30s, 60s, 120s, up to 30 min
      const lockDate = new Date(now.getTime() + lockSeconds * 1000);
      lockedUntil = lockDate.toISOString();
    }

    sqliteEngine.run(
      `INSERT INTO login_security (username, failed_attempts, locked_until, last_failed_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(username) DO UPDATE SET
         failed_attempts = ?,
         locked_until = ?,
         last_failed_at = ?`,
      [
        username,
        currentAttempts,
        lockedUntil,
        now.toISOString(),
        currentAttempts,
        lockedUntil,
        now.toISOString()
      ]
    );

    return {
      isLocked: Boolean(lockedUntil),
      lockedUntil,
      failedAttempts: currentAttempts
    };
  }

  /**
   * Resets failed login attempts upon successful authentication.
   */
  public static recordSuccess(username: string): void {
    const now = new Date().toISOString();
    sqliteEngine.run(
      `INSERT INTO login_security (username, failed_attempts, locked_until, last_success_at)
       VALUES (?, 0, NULL, ?)
       ON CONFLICT(username) DO UPDATE SET
         failed_attempts = 0,
         locked_until = NULL,
         last_success_at = ?`,
      [username, now, now]
    );
  }

  /**
   * Validates password strength policy:
   * - Minimum 12 characters
   * - Cannot match username
   * - Cannot be in common weak password list
   */
  public static validatePasswordStrength(password: string, username: string): { isValid: boolean; error?: string } {
    if (!password || typeof password !== 'string') {
      return { isValid: false, error: 'كلمة المرور مطلوبة' };
    }

    if (password.length < 12) {
      return { isValid: false, error: 'يجب ألا تقل كلمة المرور عن 12 حرفاً ورمزاً (Security Requirement: Min 12 chars)' };
    }

    if (password.toLowerCase().includes(username.toLowerCase())) {
      return { isValid: false, error: 'لا يمكن أن تحتوي كلمة المرور على اسم المستخدم' };
    }

    if (COMMON_PASSWORDS.has(password.toLowerCase())) {
      return { isValid: false, error: 'كلمة المرور المدخلة شائعة وسهلة التخمين. يرجى اختيار كلمة مرور قوية' };
    }

    return { isValid: true };
  }
}
