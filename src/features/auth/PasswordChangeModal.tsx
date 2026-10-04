import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { KeyRound, ShieldAlert, CheckCircle2 } from 'lucide-react';

export const PasswordChangeModal: React.FC = () => {
  const { changePassword, dismissPasswordChangePrompt } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('يجب ألا تقل كلمة المرور عن 8 أحرف وأرقام');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('كلمة المرور وتأكيدها غير متطابقين');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await changePassword(newPassword);
      if (!res.success) {
        setError(res.error || 'تعذر تحديث كلمة المرور');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-amber-300 overflow-hidden text-right p-6 space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
          <div className="p-2.5 rounded-xl bg-amber-100 text-amber-900">
            <KeyRound className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">إلزامية تغيير كلمة المرور عند أول تسجيل دخول</h3>
            <p className="text-xs text-slate-500">تم ضبط الحساب لإلزامك بتعيين كلمة مرور شخصية جديدة</p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">كلمة المرور الجديدة:</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="8 أحرف أو أرقام على الأقل"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">تأكيد كلمة المرور الجديدة:</label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="إعادة كتابة كلمة المرور"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={dismissPasswordChangePrompt}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
            >
              تذكيري لاحقاً
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold flex items-center gap-1.5 shadow cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'جاري الحفظ...' : 'حفظ وتأمين الحساب'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
