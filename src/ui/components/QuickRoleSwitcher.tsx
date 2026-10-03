import React from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import { useI18n } from '../../i18n/i18nContext';
import { ShieldCheck, Lock, Clock, RefreshCw, UserCheck, ShieldAlert } from 'lucide-react';

export const QuickRoleSwitcher: React.FC = () => {
  const { currentUser, switchUser, usersList, lockSession, inactivitySecondsRemaining, sessionTimeoutMinutes } = useAuth();
  const { t, formatNumber } = useI18n();

  const minutes = Math.floor(inactivitySecondsRemaining / 60);
  const seconds = inactivitySecondsRemaining % 60;
  const isExpiringSoon = inactivitySecondsRemaining < 120; // less than 2 minutes

  return (
    <aside aria-label="شريط أمني وتنفيذي للتحكم" className="bg-slate-900 border-b border-emerald-950/60 text-slate-200 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-3 shadow-md">
      {/* Current User Badge & Security Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">{t('auth.switch_role')}</span>
          <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 rounded-lg p-0.5">
            {usersList.map((user) => {
              const isActive = user.id === currentUser.id;
              return (
                <button
                  key={user.id}
                  onClick={() => switchUser(user.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? user.role === 'CHAIRMAN'
                        ? 'bg-amber-600 text-amber-50 shadow-sm'
                        : user.role === 'SECRETARY'
                        ? 'bg-emerald-700 text-emerald-50 shadow-sm'
                        : 'bg-slate-700 text-slate-100'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                  title={`${user.name} - ${user.title}`}
                >
                  {isActive && <UserCheck className="w-3.5 h-3.5" />}
                  <span>
                    {user.role === 'CHAIRMAN'
                      ? 'رئيس مجلس الإدارة'
                      : user.role === 'SECRETARY'
                      ? 'السكرتير الخاص'
                      : 'مدير النظام (IT)'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Security Clearance Indicator */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700 text-[11px]">
          {currentUser.can_view_confidential ? (
            <span className="flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('auth.confidential_authorized')}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-400">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('auth.confidential_restricted')}</span>
            </span>
          )}
        </div>
      </div>

      {/* Auto-logout Inactivity Countdown & Lock Action */}
      <div className="flex items-center gap-3">
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono border transition-colors ${
            isExpiringSoon
              ? 'bg-rose-950/60 border-rose-800 text-rose-300 animate-pulse'
              : 'bg-slate-950/80 border-slate-800 text-slate-300'
          }`}
          title={`سيتم قفل الشاشة بعد انقضاء ${sessionTimeoutMinutes} دقيقة من عدم النشاط`}
        >
          <Clock className={`w-3.5 h-3.5 ${isExpiringSoon ? 'text-rose-400' : 'text-slate-400'}`} />
          <span className="font-sans text-slate-400">{t('auth.inactivity_timer')}:</span>
          <span className="font-bold">
            {formatNumber(String(minutes).padStart(2, '0'))}:{formatNumber(String(seconds).padStart(2, '0'))}
          </span>
        </div>

        <button
          onClick={lockSession}
          className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 cursor-pointer"
          title="قفل الشاشة فوراً لحماية البيانات"
        >
          <Lock className="w-3 h-3 text-slate-400" />
          <span>قفل الجلسة</span>
        </button>
      </div>
    </aside>
  );
};
