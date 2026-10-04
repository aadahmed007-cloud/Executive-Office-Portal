import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { useI18n } from '../../i18n/i18nContext';
import {
  Lock,
  User,
  KeyRound,
  ShieldCheck,
  AlertTriangle,
  LogIn,
  Clock,
  Sparkles
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login, throttleSecondsRemaining } = useAuth();
  const { t } = useI18n();

  const [username, setUsername] = useState('secretary');
  const [password, setPassword] = useState('Pass#Secr2026');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (throttleSecondsRemaining > 0) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const result = await login(username, password);
      if (!result.success) {
        setErrorMessage(result.error || 'فشل تسجيل الدخول');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const setPreset = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden text-right">
      {/* Postal subtle ambient lighting */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-700/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 relative z-10 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto bg-emerald-950 border border-emerald-600/40 rounded-2xl flex items-center justify-center text-emerald-400 shadow-inner">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-white tracking-wide">{t('app.title')}</h1>
          <p className="text-xs text-emerald-400 font-medium">{t('app.authority')}</p>
          <div className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
            نموذج محمي بتشفير PBKDF2 Web Crypto
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Throttle Notice */}
        {throttleSecondsRemaining > 0 && (
          <div className="p-3 bg-amber-950/60 border border-amber-700/80 rounded-xl text-amber-200 text-xs flex items-center gap-2 animate-pulse">
            <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              تم تفعيل كبح محاولات تسجيل الدخول مؤقتاً. يرجى الانتظار (<strong>{throttleSecondsRemaining}</strong> ثانية).
            </span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-bold mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>اسم المستخدم (Username):</span>
            </label>
            <input
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="مثال: secretary أو chairman"
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl p-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1.5 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-slate-400" />
              <span>كلمة المرور (Password):</span>
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl p-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || throttleSecondsRemaining > 0}
            className={`w-full py-3 rounded-xl font-bold text-xs shadow-lg transition flex items-center justify-center gap-2 cursor-pointer ${
              throttleSecondsRemaining > 0
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-emerald-700 hover:bg-emerald-600 text-white active:scale-[0.99]'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>
              {isSubmitting
                ? 'جاري التحقق...'
                : throttleSecondsRemaining > 0
                ? `انتظر ${throttleSecondsRemaining} ثانية`
                : 'تسجيل الدخول الآمن'}
            </span>
          </button>
        </form>

        {/* Prototype Preset Accounts Helper */}
        <div className="pt-4 border-t border-slate-800 text-slate-400 text-[11px] space-y-2">
          <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>بيانات الاعتماد التجريبية المشفرة (انقر للتعيين):</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => setPreset('secretary', 'Pass#Secr2026')}
              className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 text-right cursor-pointer transition"
            >
              <div className="font-bold text-slate-200">السكرتير التنفيذي الأول</div>
              <div className="text-[10px] text-emerald-400 font-mono">secretary / Pass#Secr2026</div>
            </button>

            <button
              type="button"
              onClick={() => setPreset('chairman', 'Pass#Chair2026')}
              className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 text-right cursor-pointer transition"
            >
              <div className="font-bold text-slate-200">رئيس مجلس الإدارة</div>
              <div className="text-[10px] text-amber-400 font-mono">chairman / Pass#Chair2026</div>
            </button>
          </div>
          <p className="text-[10px] text-slate-500 text-center pt-2">
            يتم فحص الهاش والملح (PBKDF2 100K iterations) محلياً دون إرسال أي بيانات نصية.
          </p>
        </div>
      </div>
    </div>
  );
};
