import React from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import { useI18n } from '../../i18n/i18nContext';
import {
  LayoutDashboard,
  CalendarDays,
  Inbox,
  CheckSquare,
  FolderGit2,
  Users2,
  ScrollText,
  FileSpreadsheet,
  FileCheck,
  Shield,
  SlidersHorizontal
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { currentUser } = useAuth();
  const { t } = useI18n();

  const isChairman = currentUser.role === 'CHAIRMAN';

  // Navigation items tailored to roles
  const secretaryNav = [
    { id: 'dashboard_secretary', label: t('nav.dashboard_secretary'), icon: LayoutDashboard },
    { id: 'correspondence', label: t('nav.correspondence'), icon: Inbox, badge: '20' },
    { id: 'meetings', label: t('nav.meetings'), icon: CalendarDays, badge: '10' },
    { id: 'directives', label: t('nav.directives'), icon: CheckSquare, badge: '15' },
    { id: 'matters', label: t('nav.matters'), icon: FolderGit2, badge: '5' },
    { id: 'contacts', label: t('nav.contacts'), icon: Users2 },
    { id: 'reports', label: t('nav.reports'), icon: FileSpreadsheet },
    { id: 'audit_log', label: t('nav.audit_log'), icon: ScrollText },
    { id: 'settings', label: t('nav.settings'), icon: SlidersHorizontal }
  ];

  const chairmanNav = [
    { id: 'dashboard_chairman', label: t('nav.dashboard_chairman'), icon: LayoutDashboard, primary: true },
    { id: 'correspondence', label: 'المذكرات والتأشيرات الرئاسية', icon: FileCheck, badge: 'عاجل' },
    { id: 'meetings', label: 'جدول مواعيد الرئيس', icon: CalendarDays },
    { id: 'directives', label: 'متابعة تنفيذ التكليفات', icon: CheckSquare },
    { id: 'matters', label: 'الملفات الاستراتيجية النشطة', icon: FolderGit2 },
    { id: 'contacts', label: t('nav.contacts'), icon: Users2 },
    { id: 'audit_log', label: 'سجل الرقابة الرئاسي', icon: Shield }
  ];

  const items = isChairman ? chairmanNav : secretaryNav;

  return (
    <nav className="w-full md:w-64 bg-slate-900/95 border-b md:border-b-0 md:border-l border-slate-800 flex-shrink-0 p-3 md:p-4">
      {/* Role banner inside sidebar */}
      <div className="mb-4 pb-3 border-b border-slate-800">
        <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          {isChairman ? 'بوابة القرار الرئاسي' : 'وحدات إدارة المكتب'}
        </div>
        <div className="text-xs text-emerald-400 font-medium mt-0.5">
          {isChairman ? 'رئيس مجلس الإدارة' : 'السكرتارية التنفيذية'}
        </div>
      </div>

      {/* Nav Link List */}
      <ul className="space-y-1 md:space-y-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <li key={item.id}>
              <button
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                  isActive
                    ? isChairman
                      ? 'bg-amber-600/90 text-white shadow-lg shadow-amber-950/40 font-semibold'
                      : 'bg-emerald-800 text-white shadow-md shadow-emerald-950/40 font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : item.badge === 'عاجل'
                        ? 'bg-rose-950 border border-rose-700/60 text-rose-300'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Offline Verification Footer */}
      <div className="mt-6 pt-4 border-t border-slate-800/80 hidden md:block">
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-400">
          <div className="font-semibold text-slate-300 flex items-center gap-1.5 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            نظام محلي آمن ومغلق
          </div>
          <div>قاعدة بيانات SQLite WASM داخل المتصفح مع حفظ تلقائي بـ IndexedDB.</div>
        </div>
      </div>
    </nav>
  );
};
