import React, { useState, useRef } from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import { useI18n } from '../../i18n/i18nContext';
import { auditRepo } from '../../data/api/apiRepositories';
import {
  X,
  Database,
  Download,
  Upload,
  RotateCcw,
  Clock,
  Binary,
  Calendar,
  ShieldCheck,
  AlertTriangle,
  HardDrive,
  FileText,
  FileCode,
  CheckCircle2
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
  const [showExportWarning, setShowExportWarning] = useState(false);
  const [exportBlockedError, setExportBlockedError] = useState<string | null>(null);

  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState<{ success: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleResetData = async () => {
    alert('إعادة الضبط متاحة عبر خادم النظام.');
  };

  const handleExportClick = () => {
    alert('تصدير النسخ الاحتياطية يتاح عبر خادم النظام.');
  };

  const executeExport = () => {};

  const handleExportJson = async () => {
    alert('تصدير النسخ الاحتياطية متاح عبر خادم النظام للمسؤولين.');
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    alert('استعادة قاعدة البيانات تدار عبر الخادم الخاطف.');
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
              {/* Export JSON Manifest with SHA-256 Checksum */}
              <button
                type="button"
                onClick={handleExportJson}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/80 text-emerald-200 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                title="تصدير حزمة بيانات كاملة بصيغة JSON مع بصمة تشفير SHA-256 للتحقق من سلامة البيانات"
              >
                <FileCode className="w-4 h-4 text-emerald-400" />
                <span>تصدير حزمة مشفرة (JSON + SHA-256)</span>
              </button>

              {/* Restore File Button with hidden file input */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isRestoring}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                title="استعادة قاعدة البيانات من ملف نسخة احتياطية (.sqlite أو .json)"
              >
                <Upload className={`w-4 h-4 text-amber-400 ${isRestoring ? 'animate-bounce' : ''}`} />
                <span>{isRestoring ? 'جاري الفحص والاستعادة...' : 'استعادة نسخة احتياطية'}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".sqlite,.db,.json"
                onChange={handleRestoreFile}
                className="hidden"
              />

              {/* Export .sqlite binary */}
              <button
                type="button"
                onClick={handleExportClick}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer"
                title={currentUser.role === 'ADMIN' ? 'تصدير نسخة احتياطية من ملف SQLite' : 'محصور بمسؤول النظم (ADMIN/IT)'}
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>{t('settings.export_db')} (.sqlite)</span>
              </button>

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

            {/* Restore Status Alert */}
            {restoreStatus && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
                  restoreStatus.success
                    ? 'bg-emerald-950/90 border-emerald-600 text-emerald-200'
                    : 'bg-rose-950/90 border-rose-700 text-rose-200'
                }`}
              >
                {restoreStatus.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                )}
                <span>{restoreStatus.message}</span>
              </div>
            )}

            {exportBlockedError && (
              <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-xs text-rose-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{exportBlockedError}</span>
              </div>
            )}

            {/* Admin Export Confirmation Warning Dialog */}
            {showExportWarning && (
              <div className="p-4 bg-amber-950/90 border border-amber-500 rounded-2xl text-xs text-amber-100 space-y-3">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <span>تحذير أمني هام: تصدير قاعدة بيانات SQLite غير محجوبة</span>
                </div>
                <p className="text-amber-200/90 leading-relaxed">
                  الملف المصدّر (<code>.sqlite</code>) يحتوي على قاعدة البيانات كاملة بما في ذلك كافة المعاملات والخطابات المصنفة بدرجة <strong>«سري»</strong> و <strong>«سري للغاية»</strong> دون أي حجب برمجي.
                </p>
                <p className="text-[11px] text-amber-400 font-mono">
                  * ملاحظة فنية: في بيئات المتصفح، الحجب يتم على مستوى العرض فقط. الحماية السيادية الحقيقية ضد تسريب الملفات تتطلب خادماً خلفياً مشفراً مع قصر التصدير على واجهات محددة.
                </p>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowExportWarning(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                  >
                    إلغاء الأمر
                  </button>
                  <button
                    type="button"
                    onClick={executeExport}
                    className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold cursor-pointer"
                  >
                    متابعة وتنزيل النسخة الخام (.sqlite)
                  </button>
                </div>
              </div>
            )}

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
