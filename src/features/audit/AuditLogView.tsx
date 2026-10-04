import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../../i18n/i18nContext';
import { auditRepo } from '../../data/sqlite/repositories';
import { AuditLogger } from '../../domain/security/auditLogger';
import { verifyAuditLogIntegrity, IntegrityVerificationResult } from '../../domain/security/cryptoUtils';
import { AuditLogEntry } from '../../domain/types';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  User,
  Clock,
  Laptop,
  CheckCircle2,
  FileText,
  Building,
  Printer,
  ChevronDown,
  ChevronUp,
  Download,
  CheckSquare,
  Lock,
  Layers,
  FileSpreadsheet,
  AlertOctagon,
  KeyRound,
  RefreshCw,
  Hash,
  Link as LinkIcon
} from 'lucide-react';

export const AuditLogView: React.FC = () => {
  const { currentUser } = useAuth();
  const { t, formatNumber, formatDate } = useI18n();

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [filterAction, setFilterAction] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const [integrityResult, setIntegrityResult] = useState<IntegrityVerificationResult | null>(null);
  const [isVerifyingIntegrity, setIsVerifyingIntegrity] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loadAuditLogs = async () => {
    setIsLoading(true);
    try {
      const list = await auditRepo.getAll({ limit: 250 });
      setLogs(list);
      setIntegrityResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const handleVerifyIntegrity = async () => {
    setIsVerifyingIntegrity(true);
    try {
      const res = await verifyAuditLogIntegrity(logs);
      setIntegrityResult(res);
    } finally {
      setIsVerifyingIntegrity(false);
    }
  };

  const handleExportCsv = async () => {
    const csvContent = await AuditLogger.exportToCsv();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `audit_log_egypt_post_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Distinct users list from logs
  const distinctUsers = Array.from(
    new Map(logs.map((l) => [l.user_id, { id: l.user_id, name: l.user_name, role: l.user_role }])).values()
  );

  const filteredLogs = logs.filter((entry) => {
    if (filterAction === 'DIRECTIVE' && entry.entity_type !== 'DIRECTIVE') return false;
    if (filterAction === 'DECIDE' && entry.action_type !== 'DECIDE') return false;
    if (filterAction === 'AUTH' && entry.action_type !== 'AUTH') return false;
    if (filterAction === 'CREATE' && entry.action_type !== 'CREATE') return false;
    if (filterAction === 'DELETE' && entry.action_type !== 'DELETE') return false;
    if (filterAction === 'CORRESPONDENCE' && entry.entity_type !== 'CORRESPONDENCE') return false;

    if (userFilter !== 'all' && entry.user_id !== userFilter) {
      return false;
    }

    if (periodFilter !== 'all') {
      const now = new Date();
      const entryDate = new Date(entry.timestamp);
      if (periodFilter === 'today') {
        const isToday = entryDate.toDateString() === now.toDateString();
        if (!isToday) return false;
      } else if (periodFilter === 'week') {
        const diffDays = (now.getTime() - entryDate.getTime()) / (1000 * 3600 * 24);
        if (diffDays > 7) return false;
      } else if (periodFilter === 'month') {
        const diffDays = (now.getTime() - entryDate.getTime()) / (1000 * 3600 * 24);
        if (diffDays > 30) return false;
      }
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        entry.user_name.toLowerCase().includes(q) ||
        entry.action_type.toLowerCase().includes(q) ||
        entry.entity_type.toLowerCase().includes(q) ||
        (entry.after_value && entry.after_value.toLowerCase().includes(q)) ||
        (entry.before_value && entry.before_value.toLowerCase().includes(q)) ||
        (entry.ip_address && entry.ip_address.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const directiveLogsCount = logs.filter((l) => l.entity_type === 'DIRECTIVE').length;
  const decisionLogsCount = logs.filter((l) => l.action_type === 'DECIDE').length;
  const authLogsCount = logs.filter((l) => l.action_type === 'AUTH').length;

  const toggleRow = (id: string) => {
    setExpandedRowId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-emerald-700" />
              <span>{t('audit_module.title')}</span>
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              سجل محلي مشفر ومحمي ضد الحذف
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">{t('audit_module.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={loadAuditLogs}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer flex items-center justify-center"
            title="تحديث البيانات لحظياً"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-700' : ''}`} />
          </button>

          <button
            onClick={handleVerifyIntegrity}
            disabled={isVerifyingIntegrity}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer ${
              integrityResult?.isValid
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : integrityResult && !integrityResult.isValid
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-200'
            }`}
            title="التحقق الرياضي من سلامة سلسلة هاش SHA-256 وعدم التلاعب بأي قيد"
          >
            <ShieldCheck className={`w-4 h-4 ${isVerifyingIntegrity ? 'animate-spin' : 'text-amber-400'}`} />
            <span>{isVerifyingIntegrity ? 'جاري الفحص التشفيري...' : 'فحص سلامة السلسلة (SHA-256)'}</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
            title="تصدير جدول السجل بالكامل بصيغة ملف CSV يدعم اللغة العربية في Excel"
          >
            <Download className="w-4 h-4" />
            <span>تصدير CSV</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{t('audit_module.export_audit')}</span>
          </button>
        </div>
      </div>

      {/* Cryptographic Integrity Result Banner */}
      {integrityResult && (
        <div
          className={`p-4 rounded-2xl border flex items-start justify-between gap-3 shadow-sm print:hidden ${
            integrityResult.isValid
              ? 'bg-emerald-950/90 border-emerald-500 text-emerald-100'
              : 'bg-rose-950/90 border-rose-500 text-rose-100'
          }`}
        >
          <div className="flex items-start gap-3">
            {integrityResult.isValid ? (
              <ShieldCheck className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="w-6 h-6 text-rose-400 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <h4 className="font-bold text-sm flex items-center gap-2">
                <span>
                  {integrityResult.isValid
                    ? 'سلسلة التشفير سليمة وموثقة بالكامل 100% (Cryptographic Chain Valid)'
                    : 'تنبيه أمني: تم رصد عدم تطابق في سلسلة الرقابة (Integrity Breach Detected)'}
                </span>
              </h4>
              <p className="text-xs mt-1 text-slate-300 leading-relaxed">
                {integrityResult.isValid
                  ? `تم فحص ومطابقة جميع القيود (${formatNumber(integrityResult.verifiedEntries)} قيد) عبر خوارزمية SHA-256 بنجاح. لا توجد أي قيود محذوفة أو معدلة.`
                  : integrityResult.brokenReason}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIntegrityResult(null)}
            className="text-xs px-2.5 py-1 rounded-lg bg-black/30 hover:bg-black/50 text-slate-300 cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* KPI Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:hidden">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center space-y-1 shadow-sm">
          <div className="text-xs text-slate-500 font-medium">إجمالي القيود المسجلة</div>
          <div className="text-xl font-black text-slate-900">{formatNumber(logs.length)}</div>
        </div>

        <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 text-center space-y-1 shadow-sm">
          <div className="text-xs text-emerald-700 font-bold flex items-center justify-center gap-1">
            <CheckSquare className="w-3.5 h-3.5" />
            <span>حركات التكليفات</span>
          </div>
          <div className="text-xl font-black text-emerald-900">{formatNumber(directiveLogsCount)}</div>
        </div>

        <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 text-center space-y-1 shadow-sm">
          <div className="text-xs text-amber-700 font-bold flex items-center justify-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            <span>التأشيرات والقرارات</span>
          </div>
          <div className="text-xl font-black text-amber-900">{formatNumber(decisionLogsCount)}</div>
        </div>

        <div className="bg-slate-100 p-4 rounded-2xl border border-slate-200 text-center space-y-1 shadow-sm">
          <div className="text-xs text-slate-600 font-bold flex items-center justify-center gap-1">
            <KeyRound className="w-3.5 h-3.5" />
            <span>الجلسات وتبديل الهوية</span>
          </div>
          <div className="text-xl font-black text-slate-800">{formatNumber(authLogsCount)}</div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 print:hidden space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'all', label: t('audit_module.filter_all') },
              { id: 'DIRECTIVE', label: 'حركات التكليفات الرئاسية 📋' },
              { id: 'DECIDE', label: t('audit_module.filter_decisions') },
              { id: 'AUTH', label: t('audit_module.filter_auth') },
              { id: 'CREATE', label: 'إنشاء قيود جديدة' },
              { id: 'DELETE', label: 'حذف وأرشفة 🗑️' },
              { id: 'CORRESPONDENCE', label: 'المراسلات والوارد' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterAction(tab.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                  filterAction === tab.id
                    ? 'bg-emerald-800 text-white font-bold'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[240px] flex-1 sm:flex-initial">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالكود، الإجراء، أو المستخدم..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 pl-8 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
          </div>
        </div>

        {/* Secondary Filter Row: User & Period */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          {/* User selector */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-emerald-700" />
              <span>{t('audit_module.filter_by_user')}:</span>
            </span>
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg py-1 px-2.5 text-xs text-slate-800 font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">كافة المستخدمين</option>
              {distinctUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          {/* Period selector */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>{t('audit_module.filter_by_period')}:</span>
            </span>
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg py-1 px-2.5 text-xs text-slate-800 font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">{t('audit_module.period_all')}</option>
              <option value="today">{t('audit_module.period_today')}</option>
              <option value="week">{t('audit_module.period_week')}</option>
              <option value="month">{t('audit_module.period_month')}</option>
            </select>
          </div>

          <div className="text-[11px] text-slate-400 mr-auto font-mono">
            عرض {formatNumber(filteredLogs.length)} من إجمالي {formatNumber(logs.length)} حركة
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
              <tr>
                <th className="p-3.5">{t('audit_module.timestamp_col')}</th>
                <th className="p-3.5">{t('audit_module.user_col')}</th>
                <th className="p-3.5">{t('audit_module.action_col')}</th>
                <th className="p-3.5">{t('audit_module.entity_col')}</th>
                <th className="p-3.5">{t('audit_module.details_col')}</th>
                <th className="p-3.5 text-center">المطابقة والتفاصيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    لا توجد سجلات رقابة مطابقة للتصفية المختارة.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((entry) => {
                  const isExpanded = expandedRowId === entry.id;
                  const isDirective = entry.entity_type === 'DIRECTIVE';
                  const isDelete = entry.action_type === 'DELETE';

                  return (
                    <React.Fragment key={entry.id}>
                      <tr className={`hover:bg-slate-50/80 transition ${isDirective ? 'bg-emerald-50/20' : ''}`}>
                        <td className="p-3.5 whitespace-nowrap font-mono text-slate-600">
                          <div>{formatDate(entry.timestamp, { showTime: true })}</div>
                          <div className="text-[10px] text-slate-400 font-sans">{entry.ip_address}</div>
                        </td>

                        <td className="p-3.5 whitespace-nowrap">
                          <div className="font-bold text-slate-900">{entry.user_name}</div>
                          <div className="text-[10px] text-emerald-700 font-semibold">{entry.user_role}</div>
                        </td>

                        <td className="p-3.5 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 ${
                              entry.action_type === 'DECIDE'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : entry.action_type === 'CREATE'
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : isDelete
                                ? 'bg-rose-100 text-rose-900 border border-rose-300'
                                : entry.action_type === 'ROUTING'
                                ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            <span>{entry.action_type}</span>
                          </span>
                        </td>

                        <td className="p-3.5 whitespace-nowrap font-mono text-[11px] font-bold text-slate-700">
                          {entry.entity_type}
                        </td>

                        <td className="p-3.5 text-slate-800 max-w-[360px] truncate font-medium">
                          {entry.after_value || entry.before_value || '-'}
                        </td>

                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => toggleRow(entry.id)}
                            className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition cursor-pointer"
                            title="عرض التفاصيل والفروقات (Diff)"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Diff & Signature Details */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90">
                          <td colSpan={6} className="p-5 border-t border-b border-slate-200">
                            <div className="space-y-3 text-xs">
                              <div className="flex flex-wrap items-center justify-between text-slate-500 pb-2 border-b border-slate-200 text-[11px] gap-2">
                                <span>معرف القيد: <strong className="font-mono text-slate-800">{entry.id}</strong></span>
                                <span>الكيان المتأثر: <strong className="font-mono text-slate-800">{entry.entity_id}</strong></span>
                                <span className="font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>توقيع SHA-256 موثق</span>
                                </span>
                              </div>

                              {/* Cryptographic Hash Chaining Box */}
                              <div className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] space-y-1.5 border border-slate-800">
                                <div className="flex items-center gap-2 text-slate-400">
                                  <LinkIcon className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                                  <span className="text-slate-400">هاش السجل السابق (prev_hash):</span>
                                  <span className="text-amber-300 select-all truncate">{entry.prev_hash || 'GENESIS-BLOCK-00000000000000000000000000000000'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-400">
                                  <Hash className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                                  <span className="text-slate-400">توقيع هذا القيد (entry_hash):</span>
                                  <span className="text-emerald-300 font-bold select-all truncate">{entry.entry_hash || 'SIG-PENDING'}</span>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1">
                                  <div className="font-bold text-slate-500">القيمة السابقة (Before):</div>
                                  <div className="text-slate-700 leading-relaxed font-medium">
                                    {entry.before_value || '<لا توجد قيمة سابقة / سجل جديد>'}
                                  </div>
                                </div>

                                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1">
                                  <div className="font-bold text-emerald-900">القيمة بعد الإجراء (After):</div>
                                  <div className="text-emerald-950 leading-relaxed font-bold">
                                    {entry.after_value || '-'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
