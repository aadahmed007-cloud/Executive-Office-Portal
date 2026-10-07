import crypto from 'crypto';
import { Response } from 'express';
import { sqliteEngine } from '../../data/database/sqliteEngine.js';
import { User } from '../../domain/types/index.js';

export interface DbSession {
  id: string; // SHA-256 hash of token
  user_id: string;
  created_at: string;
  last_active_at: string;
  expires_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

export const SESSION_COOKIE_NAME = 'chairmans_session';

export class SessionService {
  /**
   * Hashes a raw session token using SHA-256 for secure DB storage.
   */
  public static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Creates a new session in the database and returns the raw token to send to the client.
   */
  public static createSession(
    userId: string,
    meta: { ipAddress?: string; userAgent?: string } = {}
  ): string {
    const rawToken = crypto.randomBytes(32).toString('hex'); // 256-bit random token
    const tokenHash = this.hashToken(rawToken);

    // Read timeout configurations (default 30 min idle or env override, 12 hours absolute)
    const settingsRows = sqliteEngine.query<{ session_timeout_minutes: number }>(
      'SELECT session_timeout_minutes FROM settings LIMIT 1'
    );
    const envIdle = process.env.SESSION_IDLE_MINUTES ? parseInt(process.env.SESSION_IDLE_MINUTES, 10) : undefined;
    const idleMinutes = envIdle || settingsRows[0]?.session_timeout_minutes || 30;
    const absoluteHours = parseInt(process.env.SESSION_ABSOLUTE_HOURS || '12', 10);


    const now = new Date();
    const expiresAt = new Date(now.getTime() + absoluteHours * 60 * 60 * 1000);

    sqliteEngine.run(
      `INSERT INTO sessions (id, user_id, created_at, last_active_at, expires_at, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        tokenHash,
        userId,
        now.toISOString(),
        now.toISOString(),
        expiresAt.toISOString(),
        meta.ipAddress || null,
        meta.userAgent || null
      ]
    );

    return rawToken;
  }

  /**
   * Validates a session token from request cookie against the database.
   * Checks both absolute expiration and idle expiration.
   */
  public static validateSession(
    rawToken: string,
    meta: { ipAddress?: string; userAgent?: string } = {}
  ): { isValid: boolean; user?: User; tokenHash?: string } {
    if (!rawToken || typeof rawToken !== 'string') {
      return { isValid: false };
    }

    const tokenHash = this.hashToken(rawToken);
    const sessionRows = sqliteEngine.query<DbSession>(
      'SELECT * FROM sessions WHERE id = ? LIMIT 1',
      [tokenHash]
    );

    const session = sessionRows[0];
    if (!session) {
      return { isValid: false };
    }

    const now = new Date();
    const expiresAt = new Date(session.expires_at);

    // Check absolute expiration
    if (now > expiresAt) {
      this.destroySession(rawToken);
      return { isValid: false };
    }

    // Check idle timeout
    const settingsRows = sqliteEngine.query<{ session_timeout_minutes: number }>(
      'SELECT session_timeout_minutes FROM settings LIMIT 1'
    );
    const envIdle = process.env.SESSION_IDLE_MINUTES ? parseInt(process.env.SESSION_IDLE_MINUTES, 10) : undefined;
    const idleMinutes = envIdle || settingsRows[0]?.session_timeout_minutes || 30;
    const lastActive = new Date(session.last_active_at);

    const idleExpiry = new Date(lastActive.getTime() + idleMinutes * 60 * 1000);

    if (now > idleExpiry) {
      this.destroySession(rawToken);
      return { isValid: false };
    }

    // Load fresh user from database to ensure up-to-date roles and permissions
    const userRows = sqliteEngine.query<any>(
      `SELECT id, username, name, title, department_id, email, role, can_view_confidential, must_change_password, avatar, created_at
       FROM users WHERE id = ? LIMIT 1`,
      [session.user_id]
    );

    const dbUser = userRows[0];
    if (!dbUser) {
      this.destroySession(rawToken);
      return { isValid: false };
    }

    // Update last_active_at timestamp
    sqliteEngine.run(
      'UPDATE sessions SET last_active_at = ? WHERE id = ?',
      [now.toISOString(), tokenHash]
    );

    const user: User = {
      id: dbUser.id,
      username: dbUser.username,
      name: dbUser.name,
      title: dbUser.title,
      department_id: dbUser.department_id,
      email: dbUser.email,
      role: dbUser.role,
      can_view_confidential: Boolean(dbUser.can_view_confidential),
      must_change_password: Boolean(dbUser.must_change_password),
      avatar: dbUser.avatar,
      created_at: dbUser.created_at
    };

    return { isValid: true, user, tokenHash };
  }

  /**
   * Destroys a single session.
   */
  public static destroySession(rawToken: string): void {
    if (!rawToken) return;
    const tokenHash = this.hashToken(rawToken);
    sqliteEngine.run('DELETE FROM sessions WHERE id = ?', [tokenHash]);
  }

  /**
   * Destroys all sessions for a specific user (e.g. after password change).
   */
  public static destroyAllUserSessions(userId: string): void {
    sqliteEngine.run('DELETE FROM sessions WHERE user_id = ?', [userId]);
  }

  /**
   * Attaches the session cookie to the HTTP response.
   * In Production: SameSite=Strict, Secure (unless COOKIE_SECURE=false for LAN).
   * In Preview Mode (PREVIEW_MODE=true): SameSite=None, Secure=true for AI Studio iframe embedding.
   */
  public static setCookie(res: Response, rawToken: string): void {
    const isProduction = process.env.NODE_ENV === 'production';
    const isPreview = !isProduction && process.env.PREVIEW_MODE === 'true';
    const isSecure = isPreview || process.env.COOKIE_SECURE !== 'false';
    const sameSiteMode: 'strict' | 'none' = isPreview ? 'none' : 'strict';
    const absoluteHours = parseInt(process.env.SESSION_ABSOLUTE_HOURS || '12', 10);

    res.cookie(SESSION_COOKIE_NAME, rawToken, {
      httpOnly: true,
      sameSite: sameSiteMode,
      secure: isSecure,
      path: '/',
      maxAge: absoluteHours * 60 * 60 * 1000
    });
  }

  /**
   * Clears the session cookie from the client.
   */
  public static clearCookie(res: Response): void {
    const isProduction = process.env.NODE_ENV === 'production';
    const isPreview = !isProduction && process.env.PREVIEW_MODE === 'true';
    const isSecure = isPreview || process.env.COOKIE_SECURE !== 'false';
    const sameSiteMode: 'strict' | 'none' = isPreview ? 'none' : 'strict';

    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      sameSite: sameSiteMode,
      secure: isSecure,
      path: '/'
    });
  }
}
