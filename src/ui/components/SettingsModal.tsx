import React, { useState } from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import { useI18n } from '../../i18n/i18nContext';
import { sqliteEngine } from '../../data/database/sqliteEngine';
import { auditRepo } from '../../data/sqlite/repositories';
import {
  X,
  Database,
  Download,
  RotateCcw,
  Clock,
  Binary,
  Calendar,
  ShieldCheck,
  AlertTriangle,
  HardDrive,
  FileText
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataReset: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onDataReset }) => {
  const { currentUser, sessionTimeoutMinutes, setSessionTimeoutMinutes } = useAuth();
  const { t, digitFormat, setDigitFormat, calendarFormat, setCalendarFormat, formatNumber } = useI18n();
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  if (!isOpen) return null;

  const handleResetData = async () => {
    if (!window.confirm('هل أنت متأكد من رغبتك في إعادة ضبط قاعدة بيانات SQLite للبيانات النموذجية الافتراضية؟')) {
      return;
    }
    setIsResetting(true);
    try {
      await sqliteEngine.resetToSeed();
      await auditRepo.log({
        user_id: currentUser.id,
        user_name: currentUser.name,
        user_role: currentUser.role,
        action_type: 'UPDATE',
        entity_type: 'DATABASE',
        entity_id: 'sqlite_seed_reset',
        before_value: 'بيانات معدلة محلياً',
        after_value: 'استعادة البيانات النموذجية الافتراضية لبريد مصر',
        ip_address: '10.120.4.x (LAN)'
      });
      setResetSuccess(true);
      onDataReset();
      setTimeout(() => setResetSuccess(false), 3000);
    } finally {
      setIsResetting(false);
    }
  };

  const handleExportBackup = () => {
    const blob = sqliteEngine.exportBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `egypt_post_chairmans_office_backup_${new Date().toISOString().split('T')[0]}.sqlite`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    auditRepo.log({
      user_id: currentUser.id,
      user_name: currentUser.name,
      user_role: currentUser.role,
      action_type: 'EXPORT',
      entity_type: 'SQLITE_DATABASE_BACKUP',
      entity_id: 'full_database',
      before_value: null,
      after_value: 'تصدير نسخة احتياطية من ملف قاعدة البيانات .sqlite',
      ip_address: '10.120.4.x (LAN)'
    }).catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-slate-900 border border-emerald-800/50 rounded-2xl shadow-2xl p-6 text-slate-100 relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-600/40 flex items-center justify-center text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{t('settings.title')}</h2>
              <p className="text-xs text-slate-400">إدارة التخزين الداخلي، النسخ الاحتياطي، وتفضيلات العرض</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6 py-4">
          {/* SQLite Status Box */}
          <div className="bg-slate-950/80 border border-emerald-800/40 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <HardDrive className="w-6 h-6 text-emerald-400" />
              <div>
                <div className="text-sm font-semibold text-slate-200">محرك قاعدة البيانات: SQLite 3.x (WASM)</div>
                <div className="text-xs text-slate-400">
                  الحفظ المحلي: <span className="text-emerald-400 font-mono">IndexedDB (chairmans_office_idb)</span>
                </div>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-700/60">
              نشط ومحفوظ
            </span>
          </div>

          {/* Preferences Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Digits Preference */}
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-2 mb-2">
                <Binary className="w-4 h-4 text-amber-400" />
                <span>{t('settings.digits_format')}</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDigitFormat('western')}
                  className={`py-2 px-3 rounded-lg text-xs font-medium border transition cursor-pointer ${
                    digitFormat === 'western'
                      ? 'bg-emerald-800 border-emerald-500 text-white font-bold'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  عربية غربية (1, 2, 3)
                </button>
                <button
                  type="button"
                  onClick={() => setDigitFormat('indic')}
                  className={`py-2 px-3 rounded-lg text-xs font-medium border transition cursor-pointer ${
                    digitFormat === 'indic'
                      ? 'bg-emerald-800 border-emerald-500 text-white font-bold'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  مشرقية (١، ٢، ٣)
                </button>
              </div>
            </div>

            {/* Calendar Preference */}
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span>{t('settings.calendar_format')}</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCalendarFormat('gregorian')}
                  className={`py-2 px-3 rounded-lg text-xs font-medium border transition cursor-pointer ${
                    calendarFormat === 'gregorian'
                      ? 'bg-emerald-800 border-emerald-500 text-white font-bold'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {t('settings.calendar_gregorian')}
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarFormat('with_hijri')}
                  className={`py-2 px-3 rounded-lg text-xs font-medium border transition cursor-pointer ${
                    calendarFormat === 'with_hijri'
                      ? 'bg-emerald-800 border-emerald-500 text-white font-bold'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {t('settings.calendar_with_hijri')}
                </button>
              </div>
            </div>
          </div>

          {/* Session Timeout */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>{t('settings.session_timeout_label')}</span>
            </label>
            <div className="flex gap-2">
              {[5, 15, 30, 60].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setSessionTimeoutMinutes(mins)}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition cursor-pointer ${
                    sessionTimeoutMinutes === mins
                      ? 'bg-emerald-800 border-emerald-500 text-white font-bold'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {formatNumber(mins)} دقائق
                </button>
              ))}
            </div>
          </div>

          {/* Backup & Reset Database Actions */}
          <div className="border-t border-slate-800 pt-4 space-y-3">
            <div className="text-xs font-semibold text-slate-300">النسخ الاحتياطي والصيانة الإدارية:</div>

            <div className="flex flex-wrap gap-3">
              {/* Export .sqlite binary */}
              <button
                type="button"
                onClick={handleExportBackup}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>{t('settings.export_db')}</span>
              </button>

              {/* Download Production Handoff Document */}
              <a
                href="/PRODUCTION_HANDOFF.md"
                target="_blank"
                rel="noreferrer"
                download="PRODUCTION_HANDOFF_EGYPT_POST.md"
                className="py-2.5 px-4 rounded-xl bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/70 text-emerald-200 text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer"
                title="تنزيل وثيقة التسليم والربط بالخادم المحلي ودليل النشر LAN"
              >
                <FileText className="w-4 h-4 text-amber-400" />
                <span>دليل النشر LAN وعقد API</span>
              </a>

              {/* Reset to Seed Data */}
              <button
                type="button"
                onClick={handleResetData}
                disabled={isResetting}
                className="py-2.5 px-4 rounded-xl bg-rose-950/80 hover:bg-rose-900/90 border border-rose-800/70 text-rose-200 text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <RotateCcw className={`w-4 h-4 text-rose-400 ${isResetting ? 'animate-spin' : ''}`} />
                <span>{isResetting ? 'جاري إعادة الضبط...' : t('settings.reset_demo_data')}</span>
              </button>
            </div>

            {resetSuccess && (
              <div className="p-3 bg-emerald-950/80 border border-emerald-600 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>تمت استعادة البيانات النموذجية لقاعدة بيانات SQLite بنجاح!</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
