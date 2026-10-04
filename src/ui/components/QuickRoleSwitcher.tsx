import React from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import { useI18n } from '../../i18n/i18nContext';
import {
  ShieldCheck,
  Lock,
  Clock,
  User,
  LogOut,
  ShieldAlert,
  KeyRound
} from 'lucide-react';

export const QuickRoleSwitcher: React.FC = () => {
  const {
    currentUser,
    lockSession,
    logout,
    inactivitySecondsRemaining,
    sessionTimeoutMinutes
  } = useAuth();
  const { t, formatNumber } = useI18n();

  const minutes = Math.floor(inactivitySecondsRemaining / 60);
  const seconds = inactivitySecondsRemaining % 60;
  const isExpiringSoon = inactivitySecondsRemaining < 120; // less than 2 minutes

  return (
    <aside
      aria-label="شريط أمني وتنفيذي للجلسة"
      className="bg-slate-900 border-b border-emerald-950/60 text-slate-200 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-3 shadow-md"
    >
      {/* Current User Profile & Security Badge */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-slate-400 font-medium">المستخدم الموثق:</span>
          <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                currentUser.role === 'CHAIRMAN'
                  ? 'bg-amber-600 text-amber-50 shadow-sm'
                  : currentUser.role === 'SECRETARY'
                  ? 'bg-emerald-700 text-emerald-50 shadow-sm'
                  : 'bg-slate-700 text-slate-100'
              }`}
            >
              {currentUser.role === 'CHAIRMAN'
                ? 'رئيس مجلس الإدارة'
                : currentUser.role === 'SECRETARY'
                ? 'السكرتير الخاص'
                : 'مدير النظام (IT)'}
            </span>
            <span className="font-bold text-slate-100">{currentUser.name}</span>
            <span className="text-[10px] text-slate-400 font-mono">(@{currentUser.username})</span>
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

      {/* Session Controls: Inactivity Timer, Lock, Logout */}
      <div className="flex items-center gap-3">
        {/* Inactivity countdown */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] transition-colors ${
            isExpiringSoon
              ? 'bg-rose-950/60 border-rose-700/80 text-rose-300 animate-pulse'
              : 'bg-slate-800/80 border-slate-700 text-slate-300'
          }`}
          title="الوقت المتبقي حتى القفل التلقائي للشاشة بسبب عدم النشاط"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>القفل التلقائي:</span>
          <span className="font-mono font-bold">
            {formatNumber(minutes)}:{seconds < 10 ? '0' : ''}{formatNumber(seconds)}
          </span>
        </div>

        {/* Lock Screen Button */}
        <button
          onClick={lockSession}
          className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 transition flex items-center gap-1 text-[11px] cursor-pointer"
          title="قفل الشاشة فورياً لحماية المكتب"
        >
          <Lock className="w-3.5 h-3.5 text-amber-400" />
          <span>قفل الشاشة</span>
        </button>

        {/* Official Logout Button */}
        <button
          onClick={logout}
          className="px-2.5 py-1 rounded-md bg-rose-950/50 hover:bg-rose-900/60 text-rose-200 border border-rose-800/60 hover:border-rose-700 transition flex items-center gap-1.5 text-[11px] cursor-pointer"
          title="تسجيل الخروج والعودة لشاشة الدخول"
        >
          <LogOut className="w-3.5 h-3.5 text-rose-400" />
          <span>خروج</span>
        </button>
      </div>
    </aside>
  );
};
