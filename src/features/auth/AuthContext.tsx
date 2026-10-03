import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User, RoleType } from '../../domain/types';
import { INITIAL_USERS } from '../../data/database/seedData';
import { auditRepo, userRepo } from '../../data/sqlite/repositories';

interface AuthContextType {
  currentUser: User;
  usersList: User[];
  isLocked: boolean;
  inactivitySecondsRemaining: number;
  sessionTimeoutMinutes: number;
  switchUser: (userId: string) => Promise<void>;
  unlockSession: () => void;
  lockSession: () => void;
  setSessionTimeoutMinutes: (minutes: number) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const DEFAULT_TIMEOUT_MINS = 15;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Default to Secretary for daily productivity or Chairman
  const [currentUser, setCurrentUser] = useState<User>(() => ({
    ...INITIAL_USERS[1],
    can_view_confidential: Boolean(INITIAL_USERS[1].can_view_confidential),
    role: INITIAL_USERS[1].role as RoleType
  }));

  const [usersList, setUsersList] = useState<User[]>(() =>
    INITIAL_USERS.map((u) => ({
      ...u,
      can_view_confidential: Boolean(u.can_view_confidential),
      role: u.role as RoleType
    }))
  );

  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutesState] = useState<number>(DEFAULT_TIMEOUT_MINS);
  const [inactivitySecondsRemaining, setInactivitySecondsRemaining] = useState<number>(DEFAULT_TIMEOUT_MINS * 60);

  const lastActivityRef = useRef<number>(Date.now());

  // Load users from DB when DB initializes
  useEffect(() => {
    userRepo.getAll().then((users) => {
      if (users && users.length > 0) {
        setUsersList(users);
      }
    }).catch(() => {});
  }, []);

  // Inactivity tracking
  const resetInactivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setInactivitySecondsRemaining(sessionTimeoutMinutes * 60);
  }, [sessionTimeoutMinutes]);

  useEffect(() => {
    const handleUserActivity = () => {
      if (!isLocked) {
        lastActivityRef.current = Date.now();
      }
    };

    window.addEventListener('mousemove', handleUserActivity, { passive: true });
    window.addEventListener('keydown', handleUserActivity, { passive: true });
    window.addEventListener('click', handleUserActivity, { passive: true });

    const interval = setInterval(() => {
      if (isLocked) return;
      const elapsedSeconds = Math.floor((Date.now() - lastActivityRef.current) / 1000);
      const remaining = Math.max(0, sessionTimeoutMinutes * 60 - elapsedSeconds);
      setInactivitySecondsRemaining(remaining);

      if (remaining <= 0) {
        setIsLocked(true);
        // Log auto-lock
        auditRepo.log({
          user_id: currentUser.id,
          user_name: currentUser.name,
          user_role: currentUser.role,
          action_type: 'AUTH',
          entity_type: 'SESSION',
          entity_id: currentUser.id,
          before_value: 'جلسة نشطة',
          after_value: 'قفل تلقائي بسبب عدم النشاط (Inactivity Auto-Lock)',
          ip_address: '10.120.4.x (LAN)'
        }).catch(() => {});
      }
    }, 1000);

    return () => {
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      clearInterval(interval);
    };
  }, [isLocked, sessionTimeoutMinutes, currentUser]);

  const switchUser = async (userId: string) => {
    const target = usersList.find((u) => u.id === userId);
    if (!target) return;

    const prevUser = currentUser;
    setCurrentUser(target);
    resetInactivity();
    setIsLocked(false);

    // Audit log the user switch
    await auditRepo.log({
      user_id: target.id,
      user_name: target.name,
      user_role: target.role,
      action_type: 'AUTH',
      entity_type: 'USER_SWITCH',
      entity_id: target.id,
      before_value: `المستخدم السابق: ${prevUser.name} (${prevUser.role})`,
      after_value: `المستخدم الحالي: ${target.name} (${target.role})`,
      ip_address: '10.120.4.x (LAN)'
    });
  };

  const unlockSession = () => {
    setIsLocked(false);
    resetInactivity();
    auditRepo.log({
      user_id: currentUser.id,
      user_name: currentUser.name,
      user_role: currentUser.role,
      action_type: 'AUTH',
      entity_type: 'SESSION_UNLOCK',
      entity_id: currentUser.id,
      before_value: 'شاشة مقفلة',
      after_value: 'تم إلغاء القفل واستئناف العمل',
      ip_address: '10.120.4.x (LAN)'
    }).catch(() => {});
  };

  const lockSession = () => {
    setIsLocked(true);
  };

  const setSessionTimeoutMinutes = (mins: number) => {
    setSessionTimeoutMinutesState(mins);
    setInactivitySecondsRemaining(mins * 60);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        usersList,
        isLocked,
        inactivitySecondsRemaining,
        sessionTimeoutMinutes,
        switchUser,
        unlockSession,
        lockSession,
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
