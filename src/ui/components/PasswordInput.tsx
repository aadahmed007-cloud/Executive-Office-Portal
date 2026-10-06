import React, { useState, forwardRef } from 'react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';

export interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
  containerClassName?: string;
  labelClassName?: string;
  error?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(({
  label,
  icon = <KeyRound className="w-3.5 h-3.5 text-slate-400" />,
  containerClassName = "space-y-1.5 w-full text-xs",
  labelClassName = "block text-slate-300 font-bold flex items-center gap-1.5 mb-1.5",
  className = "",
  error,
  ...props
}, ref) => {
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  return (
    <div className={containerClassName}>
      {label && (
        <label className={labelClassName}>
          {icon}
          <span>{label}</span>
        </label>
      )}
      <div className="relative group">
        <input
          {...props}
          ref={ref}
          type={showPassword ? 'text' : 'password'}
          className={`w-full pr-3 pl-11 text-right dir-rtl bg-slate-950/80 border border-slate-700/80 rounded-xl px-3 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 text-xs transition-all ${
            error ? 'border-rose-500/80 focus:ring-rose-500/30 focus:border-rose-500' : ''
          } ${className}`}
        />
        <button
          type="button"
          onClick={togglePasswordVisibility}
          className="absolute left-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20 rounded-md cursor-pointer z-10"
          aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
          title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
          tabIndex={0}
        >
          {showPassword ? (
            <EyeOff className="w-4 h-4" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
        </button>
      </div>
      {error && (
        <p className="text-[11px] text-rose-400 font-medium">{error}</p>
      )}
    </div>
  );
});

PasswordInput.displayName = 'PasswordInput';

export const PasswordField = PasswordInput;
