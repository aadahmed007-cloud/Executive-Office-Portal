import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { useI18n } from '../../i18n/i18nContext';
import { Lock, ShieldCheck, KeyRound, UserCheck } from 'lucide-react';

export const LockScreen: React.FC = () => {
  const { currentUser, unlockSession, switchUser, usersList } = useAuth();
  const { t } = useI18n();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    // In prototype simulation, any 4+ char PIN or default unlocks
    if (password.length >= 3 || password === '') {
      unlockSession();
    } else {
      setError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 text-white">
      <div className="w-full max-w-md bg-slate-900 border border-emerald-800/40 rounded-2xl shadow-2xl p-8 text-center relative overflow-hidden">
        {/* Subtle postal green ambient accent */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-16 h-16 mx-auto mb-4 bg-emerald-950/80 border border-emerald-600/40 rounded-2xl flex items-center justify-center text-emerald-400 shadow-inner">
          <Lock className="w-8 h-8" />
        </div>

        <h2 className="text-xl font-bold text-slate-100 mb-1">{t('app.title')}</h2>
        <p className="text-xs text-emerald-400 font-medium tracking-wide mb-6">{t('app.authority')}</p>

        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 mb-6 text-right">
          <div className="text-xs text-slate-400 mb-1">{t('auth.current_user')}</div>
          <div className="font-semibold text-slate-100 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            {currentUser.name}
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

        <form onSubmit={handleUnlock} className="space-y-4">
          <div className="text-right">
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
              <span>رمز التحقق الشخصي (PIN / كلمة السر)</span>
              <span className="text-[11px] text-slate-500 font-normal">أدخل أي 4 أرقام أو انقر فك القفل</span>
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(false);
                }}
                placeholder="••••"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-center text-lg tracking-widest text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                autoFocus
              />
              <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
            </div>
            {error && <p className="text-xs text-rose-400 mt-1">الرمز غير صحيح، يرجى المحاولة مرة أخرى.</p>}
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-medium shadow-lg shadow-emerald-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <UserCheck className="w-4 h-4" />
            استئناف الجلسة الإدارية
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-800 text-xs text-slate-400">
          <div className="mb-2">أو التبديل إلى مستخدم آخر:</div>
          <div className="flex gap-2 justify-center">
            {usersList
              .filter((u) => u.id !== currentUser.id)
              .map((u) => (
                <button
                  key={u.id}
                  onClick={() => switchUser(u.id)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition"
                >
                  {u.role === 'CHAIRMAN' ? 'رئيس المجلس' : u.role === 'SECRETARY' ? 'السكرتير الخاص' : 'مسؤول IT'}
                </button>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};
