import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User, RoleType } from '../../domain/types';
import { INITIAL_USERS } from '../../data/database/seedData';
import { auditRepo, userRepo } from '../../data/sqlite/repositories';
import { verifyPassword, hashPassword } from '../../domain/security/cryptoUtils';

interface AuthContextType {
  currentUser: User;
  isAuthenticated: boolean;
  isLocked: boolean;
  inactivitySecondsRemaining: number;
  sessionTimeoutMinutes: number;
  throttleSecondsRemaining: number;
  mustChangePasswordPrompt: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string; mustChange?: boolean }>;
  logout: () => Promise<void>;
  unlockSession: (password: string) => Promise<{ success: boolean; error?: string }>;
  lockSession: () => void;
  changePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  dismissPasswordChangePrompt: () => void;
  setSessionTimeoutMinutes: (minutes: number) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const DEFAULT_TIMEOUT_MINS = 15;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Start with Secretary as authenticated user in prototype
  const [currentUser, setCurrentUser] = useState<User>(() => ({
    ...INITIAL_USERS[1],
    can_view_confidential: Boolean(INITIAL_USERS[1].can_view_confidential),
    role: INITIAL_USERS[1].role as RoleType,
    must_change_password: Boolean(INITIAL_USERS[1].must_change_password)
  }));

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutesState] = useState<number>(DEFAULT_TIMEOUT_MINS);
  const [inactivitySecondsRemaining, setInactivitySecondsRemaining] = useState<number>(DEFAULT_TIMEOUT_MINS * 60);

  // Throttling state
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [throttleSecondsRemaining, setThrottleSecondsRemaining] = useState<number>(0);

  // Forced password change simulation
  const [mustChangePasswordPrompt, setMustChangePasswordPrompt] = useState<boolean>(false);

  const lastActivityRef = useRef<number>(Date.now());

  // Throttling countdown timer
  useEffect(() => {
    if (throttleSecondsRemaining <= 0) return;
    const timer = setInterval(() => {
      setThrottleSecondsRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [throttleSecondsRemaining]);

  // Inactivity tracking
  const resetInactivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setInactivitySecondsRemaining(sessionTimeoutMinutes * 60);
  }, [sessionTimeoutMinutes]);

  useEffect(() => {
    const handleUserActivity = () => {
      if (!isLocked && isAuthenticated) {
        lastActivityRef.current = Date.now();
      }
    };

    window.addEventListener('mousemove', handleUserActivity, { passive: true });
    window.addEventListener('keydown', handleUserActivity, { passive: true });
    window.addEventListener('click', handleUserActivity, { passive: true });

    const interval = setInterval(() => {
      if (isLocked || !isAuthenticated) return;
      const elapsedSeconds = Math.floor((Date.now() - lastActivityRef.current) / 1000);
      const remaining = Math.max(0, sessionTimeoutMinutes * 60 - elapsedSeconds);
      setInactivitySecondsRemaining(remaining);

      if (remaining <= 0) {
        setIsLocked(true);
        auditRepo.log({
          user_id: currentUser.id,
          user_name: currentUser.name,
          user_role: currentUser.role,
          action_type: 'AUTH',
          entity_type: 'SESSION',
          entity_id: currentUser.id,
          before_value: 'جلسة نشطة',
          after_value: 'قفل تلقائي بسبب عدم النشاط (Inactivity Auto-Lock)',
          ip_address: '<LAN_CLIENT_IP>'
        }).catch(() => {});
      }
    }, 1000);

    return () => {
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      clearInterval(interval);
    };
  }, [isLocked, isAuthenticated, sessionTimeoutMinutes, currentUser]);

  /**
   * Per-user login with PBKDF2 hash verification and progressive throttling
   */
  const login = async (
    username: string,
    password: string
  ): Promise<{ success: boolean; error?: string; mustChange?: boolean }> => {
    if (throttleSecondsRemaining > 0) {
      return {
        success: false,
        error: `تم كبح محاولات تسجيل الدخول مؤقتاً لحماية الحساب. يرجى الانتظار ${throttleSecondsRemaining} ثانية.`
      };
    }

    try {
      const userRecord = await userRepo.getByUsername(username);

      if (!userRecord) {
        const nextAttempts = failedAttempts + 1;
        setFailedAttempts(nextAttempts);
        const delay = Math.min(30, Math.pow(2, nextAttempts));
        setThrottleSecondsRemaining(delay);

        await auditRepo.log({
          user_id: 'anonymous',
          user_name: username,
          user_role: 'ADMIN',
          action_type: 'AUTH',
          entity_type: 'LOGIN_FAILURE',
          entity_id: 'unknown_account',
          before_value: null,
          after_value: `محاولة تسجيل دخول فاشلة للمستخدم (${username}) - حساب غير موجود`,
          ip_address: '<LAN_CLIENT_IP>'
        });

        return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
      }

      // Verify PBKDF2 Hash
      const isValid = await verifyPassword(
        password,
        userRecord.password_hash,
        userRecord.password_salt
      );

      if (!isValid) {
        const nextAttempts = failedAttempts + 1;
        setFailedAttempts(nextAttempts);
        const delay = Math.min(30, Math.pow(2, nextAttempts));
        setThrottleSecondsRemaining(delay);

        await auditRepo.log({
          user_id: userRecord.id,
          user_name: userRecord.name,
          user_role: userRecord.role,
          action_type: 'AUTH',
          entity_type: 'LOGIN_FAILURE',
          entity_id: userRecord.id,
          before_value: null,
          after_value: `محاولة تسجيل دخول فاشلة للمستخدم (${username}) - كلمة مرور غير صحيحة`,
          ip_address: '<LAN_CLIENT_IP>'
        });

        return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
      }

      // Login Success - Role comes strictly from the DB record!
      setFailedAttempts(0);
      setThrottleSecondsRemaining(0);
      setCurrentUser({
        id: userRecord.id,
        username: userRecord.username,
        name: userRecord.name,
        title: userRecord.title,
        department_id: userRecord.department_id,
        email: userRecord.email,
        role: userRecord.role,
        can_view_confidential: Boolean(userRecord.can_view_confidential),
        must_change_password: Boolean(userRecord.must_change_password),
        avatar: userRecord.avatar,
        created_at: userRecord.created_at
      });

      setIsAuthenticated(true);
      setIsLocked(false);
      resetInactivity();

      const mustChange = Boolean(userRecord.must_change_password);
      if (mustChange) {
        setMustChangePasswordPrompt(true);
      }

      await auditRepo.log({
        user_id: userRecord.id,
        user_name: userRecord.name,
        user_role: userRecord.role,
        action_type: 'AUTH',
        entity_type: 'LOGIN_SUCCESS',
        entity_id: userRecord.id,
        before_value: null,
        after_value: `تسجيل دخول ناجح للمستخدم (${userRecord.username}) - الدور المحدد آلياً: ${userRecord.role}`,
        ip_address: '<LAN_CLIENT_IP>'
      });

      return { success: true, mustChange };
    } catch (err: any) {
      console.error('Login error:', err);
      return { success: false, error: 'حدث خطأ في معالجة طلب تسجيل الدخول' };
    }
  };

  /**
   * Logout
   */
  const logout = async () => {
    await auditRepo.log({
      user_id: currentUser.id,
      user_name: currentUser.name,
      user_role: currentUser.role,
      action_type: 'AUTH',
      entity_type: 'LOGOUT',
      entity_id: currentUser.id,
      before_value: `المستخدم: ${currentUser.username}`,
      after_value: 'تسجيل خروج رسمي وإنهاء الجلسة',
      ip_address: '<LAN_CLIENT_IP>'
    }).catch(() => {});

    setIsAuthenticated(false);
    setIsLocked(false);
  };

  /**
   * Unlock session with password
   */
  const unlockSession = async (password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const userRecord = await userRepo.getByUsername(currentUser.username);
      if (!userRecord) return { success: false, error: 'تعذر التحقق من الحساب' };

      const isValid = await verifyPassword(
        password,
        userRecord.password_hash,
        userRecord.password_salt
      );

      if (!isValid) {
        return { success: false, error: 'كلمة المرور غير صحيحة' };
      }

      setIsLocked(false);
      resetInactivity();

      await auditRepo.log({
        user_id: currentUser.id,
        user_name: currentUser.name,
        user_role: currentUser.role,
        action_type: 'AUTH',
        entity_type: 'SESSION_UNLOCK',
        entity_id: currentUser.id,
        before_value: 'شاشة مقفلة',
        after_value: 'تم فك قفل الشاشة بنجاح بكلمة المرور',
        ip_address: '<LAN_CLIENT_IP>'
      });

      return { success: true };
    } catch (err) {
      return { success: false, error: 'حدث خطأ أثناء فك القفل' };
    }
  };

  const lockSession = () => {
    setIsLocked(true);
  };

  /**
   * Forced/Voluntary password change
   */
  const changePassword = async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
    if (newPassword.length < 8) {
      return { success: false, error: 'يجب أن لا تقل كلمة المرور عن 8 أحرف وأرقام' };
    }

    try {
      const { hashHex, saltHex } = await hashPassword(newPassword);
      await userRepo.updatePassword(currentUser.id, hashHex, saltHex);

      setCurrentUser((prev) => ({
        ...prev,
        must_change_password: false
      }));
      setMustChangePasswordPrompt(false);

      await auditRepo.log({
        user_id: currentUser.id,
        user_name: currentUser.name,
        user_role: currentUser.role,
        action_type: 'AUTH',
        entity_type: 'PASSWORD_CHANGE',
        entity_id: currentUser.id,
        before_value: 'كلمة مرور سابقة',
        after_value: 'تم تغيير كلمة المرور وتحديث التشفير PBKDF2 بنجاح',
        ip_address: '<LAN_CLIENT_IP>'
      });

      return { success: true };
    } catch (err) {
      return { success: false, error: 'تعذر تغيير كلمة المرور' };
    }
  };

  const dismissPasswordChangePrompt = () => {
    setMustChangePasswordPrompt(false);
  };

  const setSessionTimeoutMinutes = (mins: number) => {
    setSessionTimeoutMinutesState(mins);
    setInactivitySecondsRemaining(mins * 60);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        isLocked,
        inactivitySecondsRemaining,
        sessionTimeoutMinutes,
        throttleSecondsRemaining,
        mustChangePasswordPrompt,
        login,
        logout,
        unlockSession,
        lockSession,
        changePassword,
        dismissPasswordChangePrompt,
        setSessionTimeoutMinutes
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
