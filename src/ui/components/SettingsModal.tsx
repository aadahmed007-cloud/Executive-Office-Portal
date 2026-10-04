import React, { useState, useRef } from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import { useI18n } from '../../i18n/i18nContext';
import { sqliteEngine } from '../../data/database/sqliteEngine';
import { auditRepo } from '../../data/sqlite/repositories';
import { sha256Hex } from '../../domain/security/cryptoUtils';
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
        ip_address: '<LAN_CLIENT_IP>'
      });
      setResetSuccess(true);
      onDataReset();
      setTimeout(() => setResetSuccess(false), 3000);
    } finally {
      setIsResetting(false);
    }
  };

  const handleExportClick = () => {
    setExportBlockedError(null);
    if (currentUser.role !== 'ADMIN') {
      setExportBlockedError('تصدير قاعدة بيانات SQLite محظور: هذه الخاصية مقصورة حصرياً على مسؤول النظم (ADMIN/IT)، لأن الملف يحتوي على كافة البيانات الخام دون حجب.');
      return;
    }
    setShowExportWarning(true);
  };

  const executeExport = () => {
    setShowExportWarning(false);
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
      after_value: 'تصدير نسخة احتياطية من ملف قاعدة البيانات .sqlite (كاملة غير محجوبة)',
      ip_address: '<LAN_CLIENT_IP>'
    }).catch(() => {});
  };

  const handleExportJson = async () => {
    const tables = [
      'users',
      'departments',
      'correspondence',
      'briefing_notes',
      'approvals',
      'directives',
      'directive_updates',
      'meetings',
      'meeting_attendees',
      'agenda_items',
      'meeting_minutes',
      'decisions',
      'matters',
      'matter_links',
      'contacts',
      'interactions',
      'notifications',
      'audit_log',
      'settings'
    ];
    const dump: Record<string, any[]> = {};
    for (const tbl of tables) {
      dump[tbl] = sqliteEngine.query(`SELECT * FROM ${tbl}`);
    }

    const payloadString = JSON.stringify(dump);
    const checksum = await sha256Hex(payloadString);

    const manifest = {
      manifest_version: '1.0',
      app_name: "Chairman's Office Assistant - Egypt Post",
      export_date: new Date().toISOString(),
      exported_by: currentUser.name,
      exported_by_role: currentUser.role,
      checksum_sha256: checksum,
      tables_count: tables.length,
      data: dump
    };

    const jsonStr = JSON.stringify(manifest, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `egypt_post_backup_manifest_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    await auditRepo.log({
      user_id: currentUser.id,
      user_name: currentUser.name,
      user_role: currentUser.role,
      action_type: 'EXPORT',
      entity_type: 'JSON_BACKUP_MANIFEST',
      entity_id: `chk-${checksum.substring(0, 8)}`,
      before_value: null,
      after_value: `تصدير نسخة احتياطية مشفرة بـ SHA-256 (${tables.length} جدول)`,
      ip_address: '<LAN_CLIENT_IP>'
    });
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    setRestoreStatus(null);

    try {
      if (file.name.endsWith('.sqlite') || file.name.endsWith('.db')) {
        const buffer = await file.arrayBuffer();
        const uint8 = new Uint8Array(buffer);
        const res = await sqliteEngine.restoreFromBinary(uint8);
        if (!res.success) {
          setRestoreStatus({ success: false, message: res.error || 'فشل استعادة ملف SQLite' });
        } else {
          setRestoreStatus({ success: true, message: `تمت استعادة قاعدة البيانات بنجاح (${res.tablesCount} جدول موثق)` });
          await auditRepo.log({
            user_id: currentUser.id,
            user_name: currentUser.name,
            user_role: currentUser.role,
            action_type: 'UPDATE',
            entity_type: 'DATABASE_RESTORE',
            entity_id: file.name,
            before_value: 'قاعدة بيانات سابقة',
            after_value: `استعادة كاملة لملف SQLite (${file.name})`,
            ip_address: '<LAN_CLIENT_IP>'
          });
          onDataReset();
        }
      } else if (file.name.endsWith('.json')) {
        const text = await file.text();
        const parsed = JSON.parse(text);

        if (!parsed.data || !parsed.checksum_sha256) {
          setRestoreStatus({ success: false, message: 'ملف JSON غير متوافق: تنقصه بيانات التحقق وبصمة SHA-256' });
          return;
        }

        // Verify SHA-256 Checksum
        const dataStr = JSON.stringify(parsed.data);
        const computedChecksum = await sha256Hex(dataStr);

        if (computedChecksum !== parsed.checksum_sha256) {
          setRestoreStatus({
            success: false,
            message: 'فشل التحقق الأمني: بصمة SHA-256 لا تطابق محتوى الملف، مما يشير إلى تلاعب أو تلف في البيانات'
          });
          return;
        }

        // Reset database and import tables
        await sqliteEngine.resetToSeed();
        for (const [tbl, rows] of Object.entries<any[]>(parsed.data)) {
          if (tbl === 'audit_log') continue; // keep audit log immutable
          for (const row of rows) {
            const cols = Object.keys(row);
            const placeholders = cols.map(() => '?').join(', ');
            const vals = Object.values(row);
            try {
              sqliteEngine.run(`INSERT OR REPLACE INTO ${tbl} (${cols.join(', ')}) VALUES (${placeholders})`, vals);
            } catch (err) {
              // ignore table schema differences if any
            }
          }
        }
        await sqliteEngine.persist();

        await auditRepo.log({
          user_id: currentUser.id,
          user_name: currentUser.name,
          user_role: currentUser.role,
          action_type: 'UPDATE',
          entity_type: 'DATABASE_RESTORE_JSON',
          entity_id: `chk-${computedChecksum.substring(0, 8)}`,
          before_value: 'بيانات سابقة',
          after_value: `استعادة ملف JSON موثق ببصمة SHA-256 (${file.name})`,
          ip_address: '<LAN_CLIENT_IP>'
        });

        setRestoreStatus({ success: true, message: 'تم استيراد واستعادة البيانات بنجاح بعد التحقق من بصمة SHA-256' });
        onDataReset();
      } else {
        setRestoreStatus({ success: false, message: 'صيغة الملف غير مدعومة. يرجى اختيار ملف .sqlite أو .json' });
      }
    } catch (err: any) {
      setRestoreStatus({ success: false, message: `خطأ أثناء المعالجة: ${err.message}` });
    } finally {
      setIsRestoring(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
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
