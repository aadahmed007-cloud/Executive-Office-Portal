import React, { useState, useEffect } from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import { useI18n } from '../../i18n/i18nContext';
import { notificationRepo } from '../../data/sqlite/repositories';
import {
  Bell,
  Settings,
  Database,
  Calendar,
  Binary,
  CheckCircle2,
  HardDrive
} from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings, activeTab, setActiveTab }) => {
  const { currentUser } = useAuth();
  const { t, digitFormat, setDigitFormat, calendarFormat, setCalendarFormat, formatNumber } = useI18n();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    notificationRepo
      .getAllForRole(currentUser.role)
      .then((items) => {
        const unread = items.filter((n) => !n.is_read).length;
        setUnreadCount(unread);
      })
      .catch(() => {});
  }, [currentUser.role, activeTab]);

  return (
    <header className="bg-emerald-950 text-white border-b border-emerald-900/60 sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Brand & Postal Authority Identity */}
        <div className="flex items-center gap-4">
          {/* Logo seal simulation with high-trust postal stamp aesthetics */}
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 border border-emerald-400/30 flex items-center justify-center shadow-lg relative overflow-hidden group">
            <div className="absolute inset-0 bg-radial from-amber-400/20 to-transparent" />
            <div className="text-center font-serif leading-none z-10">
              <span className="block text-[10px] text-amber-300 font-bold tracking-tighter">بريد</span>
              <span className="block text-xs text-white font-extrabold">مصر</span>
              <span className="block text-[8px] text-emerald-200">1865</span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight flex items-center gap-2">
                <span>{t('app.title')}</span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-900/80 text-emerald-300 border border-emerald-700/50">
                  {currentUser.role === 'CHAIRMAN' ? 'النسخة التنفيذية للرئيس' : 'مركز السكرتارية التنفيذي'}
                </span>
              </h1>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-300/80">
              <span className="font-semibold">{t('app.authority')}</span>
              <span className="text-emerald-500">•</span>
              <span className="flex items-center gap-1 text-[11px] text-emerald-400/90 font-mono">
                <HardDrive className="w-3 h-3 text-emerald-400" />
                <span>نواة SQLite مغلقة</span>
              </span>
            </div>
          </div>
        </div>

        {/* Global Controls & Preferences */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Digits format toggle (Western 123 vs Indic ١٢٣) */}
          <button
            onClick={() => setDigitFormat(digitFormat === 'western' ? 'indic' : 'western')}
            className="px-2.5 py-1.5 rounded-lg bg-emerald-900/70 hover:bg-emerald-800/80 border border-emerald-700/50 text-emerald-200 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
            title="تبديل نسق الأرقام بين الأرقام العربية الغربية والمشرقية"
          >
            <Binary className="w-3.5 h-3.5 text-amber-400" />
            <span>{digitFormat === 'western' ? '١٢٣' : '123'}</span>
          </button>

          {/* Calendar Format toggle (Gregorian vs Gregorian + Hijri) */}
          <button
            onClick={() => setCalendarFormat(calendarFormat === 'gregorian' ? 'with_hijri' : 'gregorian')}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
              calendarFormat === 'with_hijri'
                ? 'bg-amber-900/60 border-amber-600/70 text-amber-200'
                : 'bg-emerald-900/70 hover:bg-emerald-800/80 border-emerald-700/50 text-emerald-200'
            }`}
            title="تفعيل أو إلغاء عرض التاريخ الهجري المقابل"
          >
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">{calendarFormat === 'with_hijri' ? 'هجري وميلادي' : 'ميلادي فقط'}</span>
            <span className="sm:hidden">تقويم</span>
          </button>

          {/* Notifications button */}
          <button
            onClick={() => setActiveTab('notifications')}
            className={`relative p-2 rounded-lg border transition cursor-pointer ${
              activeTab === 'notifications'
                ? 'bg-emerald-800 border-emerald-500 text-white'
                : 'bg-emerald-900/70 hover:bg-emerald-800/80 border-emerald-700/50 text-emerald-200'
            }`}
            title="التنبيهات والإشعارات الرئاسية"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce shadow">
                {formatNumber(unreadCount)}
              </span>
            )}
          </button>

          {/* Settings / SQLite Management Modal trigger */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-lg bg-emerald-900/70 hover:bg-emerald-800/80 border border-emerald-700/50 text-emerald-200 transition cursor-pointer"
            title="إعدادات قاعدة البيانات المحلية والنسخ الاحتياطي"
          >
            <Settings className="w-4 h-4 text-emerald-300" />
          </button>

          {/* User Profile Capsule */}
          <div className="hidden lg:flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl bg-emerald-900/50 border border-emerald-800/70">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-600 to-amber-400 text-slate-950 font-bold flex items-center justify-center text-xs shadow">
              {currentUser.role === 'CHAIRMAN' ? 'ر' : 'س'}
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold text-slate-100 leading-tight">{currentUser.name}</div>
              <div className="text-[10px] text-amber-300/90 leading-none mt-0.5">{currentUser.title}</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
