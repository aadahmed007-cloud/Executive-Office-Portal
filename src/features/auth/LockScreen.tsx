import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { useI18n } from '../../i18n/i18nContext';
import { Lock, ShieldCheck, KeyRound, LogOut, AlertTriangle, Unlock } from 'lucide-react';

export const LockScreen: React.FC = () => {
  const { currentUser, unlockSession, logout } = useAuth();
  const { t } = useI18n();
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const res = await unlockSession(password);
      if (!res.success) {
        setErrorMessage(res.error || 'كلمة المرور غير صحيحة');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 text-white">
      <div className="w-full max-w-md bg-slate-900 border border-emerald-800/40 rounded-3xl shadow-2xl p-6 sm:p-8 text-center relative overflow-hidden">
        {/* Subtle postal green ambient accent */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-16 h-16 mx-auto mb-4 bg-emerald-950/80 border border-emerald-600/40 rounded-2xl flex items-center justify-center text-emerald-400 shadow-inner">
          <Lock className="w-8 h-8" />
        </div>

        <h2 className="text-xl font-bold text-slate-100 mb-1">{t('app.title')}</h2>
        <p className="text-xs text-emerald-400 font-medium tracking-wide mb-6">{t('app.authority')}</p>

        {/* Current Active Account Box */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 mb-6 text-right">
          <div className="text-xs text-slate-400 mb-1">الجلسة النشطة الحالية:</div>
          <div className="font-semibold text-slate-100 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span>{currentUser.name}</span>
            <span className="font-mono text-xs text-slate-400">({currentUser.username})</span>
          </div>
          <div className="text-xs text-amber-400 mt-0.5">{currentUser.title}</div>
          <div className="mt-2 pt-2 border-t border-slate-700/40 flex items-center justify-between text-[11px] text-slate-400">
            <span>{t('auth.security_clearance')}:</span>
            <span className="flex items-center gap-1 text-emerald-300 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              {currentUser.can_view_confidential ? t('auth.confidential_authorized') : t('auth.confidential_restricted')}
            </span>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 mb-4 bg-rose-950/70 border border-rose-800 rounded-xl text-rose-200 text-xs flex items-center gap-2 text-right">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleUnlock} className="space-y-4">
          <div className="text-right">
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
              <span>أدخل كلمة المرور لفك القفل:</span>
              <span className="text-[10px] text-slate-500 font-mono">التحقق من الهوية</span>
            </label>
            <div className="relative">
              <input
                type="password"
                required
                autoFocus
                placeholder="كلمة مرور الحساب..."
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMessage(null);
                }}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl py-3 px-4 pl-10 text-white placeholder-slate-500 text-center font-mono text-sm tracking-wider focus:outline-none focus:border-emerald-500"
              />
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <Unlock className="w-4 h-4" />
              <span>{isSubmitting ? 'جاري التحقق...' : 'فك القفل واستئناف العمل'}</span>
            </button>

            <button
              type="button"
              onClick={logout}
              className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
              title="تسجيل الخروج والتبديل لحساب آخر"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              <span>تسجيل خروج</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
