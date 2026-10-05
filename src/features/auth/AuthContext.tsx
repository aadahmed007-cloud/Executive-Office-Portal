import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User, RoleType } from '../../domain/types/index.js';
import { parseApiResponse } from '../../data/api/apiHelper.js';

export const GUEST_USER: User = {
  id: 'guest',
  username: 'unauthenticated',
  name: 'مستخدم غير مسجل',
  title: 'غير مصرح',
  department_id: '',
  email: '',
  role: 'SECRETARY',
  can_view_confidential: false,
  must_change_password: false,
  created_at: ''
};

interface AuthContextType {
  currentUser: User;
  isAuthenticated: boolean;
  isLocked: boolean;
  inactivitySecondsRemaining: number;
  sessionTimeoutMinutes: number;
  throttleSecondsRemaining: number;
  mustChangePasswordPrompt: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string; technicalDetails?: string; mustChange?: boolean }>;
  logout: () => Promise<void>;
  unlockSession: (password: string) => Promise<{ success: boolean; error?: string; technicalDetails?: string }>;
  lockSession: () => void;
  changePassword: (newPassword: string, currentPassword?: string) => Promise<{ success: boolean; error?: string; technicalDetails?: string }>;
  dismissPasswordChangePrompt: () => void;
  setSessionTimeoutMinutes: (minutes: number) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const DEFAULT_TIMEOUT_MINS = 15;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User>(GUEST_USER);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutesState] = useState<number>(DEFAULT_TIMEOUT_MINS);
  const [inactivitySecondsRemaining, setInactivitySecondsRemaining] = useState<number>(DEFAULT_TIMEOUT_MINS * 60);

  const [throttleSecondsRemaining, setThrottleSecondsRemaining] = useState<number>(0);
  const [mustChangePasswordPrompt, setMustChangePasswordPrompt] = useState<boolean>(false);

  const lastActivityRef = useRef<number>(Date.now());

  // Check active session on initial load
  useEffect(() => {
    async function checkCurrentSession() {
      try {
        const res = await fetch('/api/auth/me', {
          credentials: 'same-origin',
          headers: {
            'X-Requested-With': 'XMLHttpRequest'
          }
        });
        const parsed = await parseApiResponse<{ user: User }>(res);
        if (parsed.ok && parsed.data?.user) {
          setCurrentUser(parsed.data.user);
          setIsAuthenticated(true);
          if (parsed.data.user.must_change_password) {
            setMustChangePasswordPrompt(true);
          }
        }
      } catch {
        // No active server session
      }
    }
    checkCurrentSession();
  }, []);

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
      }
    }, 1000);

    return () => {
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      clearInterval(interval);
    };
  }, [isLocked, isAuthenticated, sessionTimeoutMinutes]);

  /**
   * Server-side login with safe response parsing & detailed error status
   */
  const login = async (
    username: string,
    password: string
  ): Promise<{ success: boolean; error?: string; technicalDetails?: string; mustChange?: boolean }> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin',
        body: JSON.stringify({ username, password })
      });

      const parsed = await parseApiResponse<{ user: User }>(response);

      if (!parsed.ok || !parsed.data) {
        return {
          success: false,
          error: parsed.error || 'اسم المستخدم أو كلمة المرور غير صحيحة',
          technicalDetails: parsed.technicalDetails
        };
      }

      const user: User = parsed.data.user;
      setCurrentUser(user);
      setIsAuthenticated(true);
      setIsLocked(false);
      resetInactivity();

      const mustChange = Boolean(user.must_change_password);
      if (mustChange) {
        setMustChangePasswordPrompt(true);
      }

      return { success: true, mustChange };
    } catch {
      return {
        success: false,
        error: 'فشل الاتصال بالخادم: تعذر الوصول إلى الشبكة أو انقطع الاتصال',
        technicalDetails: 'Network Failure (Fetch Error)'
      };
    }
  };

  /**
   * Server-side logout
   */
  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin'
      });
    } catch {}

    setCurrentUser(GUEST_USER);
    setIsAuthenticated(false);
    setIsLocked(false);
    setMustChangePasswordPrompt(false);
  };

  /**
   * Server-side session unlock (re-authentication)
   */
  const unlockSession = async (password: string): Promise<{ success: boolean; error?: string; technicalDetails?: string }> => {
    try {
      const response = await fetch('/api/auth/reauth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin',
        body: JSON.stringify({ password })
      });

      const parsed = await parseApiResponse<{ user: User }>(response);

      if (!parsed.ok) {
        return {
          success: false,
          error: parsed.error || 'كلمة المرور غير صحيحة',
          technicalDetails: parsed.technicalDetails
        };
      }

      setIsLocked(false);
      resetInactivity();
      return { success: true };
    } catch {
      return {
        success: false,
        error: 'حدث خطأ أثناء فك القفل: انقطع الاتصال بالخادم',
        technicalDetails: 'Network Error'
      };
    }
  };

  const lockSession = () => {
    setIsLocked(true);
  };

  /**
   * Server-side password change
   */
  const changePassword = async (
    newPassword: string,
    currentPassword?: string
  ): Promise<{ success: boolean; error?: string; technicalDetails?: string }> => {
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          currentPassword: currentPassword || '',
          newPassword
        })
      });

      const parsed = await parseApiResponse<{ user: User }>(response);

      if (!parsed.ok) {
        return {
          success: false,
          error: parsed.error || 'تعذر تغيير كلمة المرور',
          technicalDetails: parsed.technicalDetails
        };
      }

      if (parsed.data?.user) {
        setCurrentUser(parsed.data.user);
      }
      setMustChangePasswordPrompt(false);

      return { success: true };
    } catch {
      return {
        success: false,
        error: 'تعذر الاتصال بالخادم لتحديث كلمة المرور',
        technicalDetails: 'Network Error'
      };
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
