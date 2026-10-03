import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../../i18n/i18nContext';
import { auditRepo } from '../../data/sqlite/repositories';
import { AuditLogEntry } from '../../domain/types';
import {
  ShieldAlert,
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
  Download
} from 'lucide-react';

export const AuditLogView: React.FC = () => {
  const { currentUser } = useAuth();
  const { t, formatNumber, formatDate } = useI18n();

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [filterAction, setFilterAction] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const loadAuditLogs = async () => {
    const list = await auditRepo.getAll({ limit: 150 });
    setLogs(list);
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const filteredLogs = logs.filter((entry) => {
    if (filterAction === 'DECIDE' && entry.action_type !== 'DECIDE') return false;
    if (filterAction === 'AUTH' && entry.action_type !== 'AUTH') return false;
    if (filterAction === 'CREATE' && entry.action_type !== 'CREATE') return false;
    if (filterAction === 'ROUTING' && entry.action_type !== 'ROUTING') return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        entry.user_name.toLowerCase().includes(q) ||
        entry.action_type.toLowerCase().includes(q) ||
        entry.entity_type.toLowerCase().includes(q) ||
        (entry.after_value && entry.after_value.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const toggleRow = (id: string) => {
    setExpandedRowId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      {/* Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-emerald-700" />
            <span>{t('audit_module.title')}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">{t('audit_module.subtitle')}</p>
        </div>

        <button
          onClick={() => window.print()}
          className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>{t('audit_module.export_audit')}</span>
        </button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'all', label: t('audit_module.filter_all') },
            { id: 'DECIDE', label: t('audit_module.filter_decisions') },
            { id: 'AUTH', label: t('audit_module.filter_auth') },
            { id: 'CREATE', label: 'إنشاء قيود جديدة' },
            { id: 'ROUTING', label: 'الإحالات والتوجيه' }
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

        <div className="relative min-w-[260px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث في سجل العمليات..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 pl-8 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
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
                <th className="p-3.5 text-center">تفاصيل التغيير</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    لا توجد سجلات رقابة مطابقة.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((entry) => {
                  const isExpanded = expandedRowId === entry.id;
                  return (
                    <React.Fragment key={entry.id}>
                      <tr className="hover:bg-slate-50/70 transition">
                        <td className="p-3.5 whitespace-nowrap font-mono text-slate-600">
                          <div>{formatDate(entry.timestamp, { showTime: true })}</div>
                          <div className="text-[10px] text-slate-400">{entry.ip_address}</div>
                        </td>

                        <td className="p-3.5 whitespace-nowrap">
                          <div className="font-bold text-slate-900">{entry.user_name}</div>
                          <div className="text-[10px] text-emerald-700 font-semibold">{entry.user_role}</div>
                        </td>

                        <td className="p-3.5 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              entry.action_type === 'DECIDE'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : entry.action_type === 'CREATE'
                                ? 'bg-emerald-100 text-emerald-900'
                                : entry.action_type === 'ROUTING'
                                ? 'bg-blue-100 text-blue-900'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {entry.action_type}
                          </span>
                        </td>

                        <td className="p-3.5 whitespace-nowrap font-mono text-[11px] text-slate-600">
                          {entry.entity_type}
                        </td>

                        <td className="p-3.5 text-slate-800 max-w-[320px] truncate">
                          {entry.after_value || entry.before_value || '-'}
                        </td>

                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => toggleRow(entry.id)}
                            className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition cursor-pointer"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Diff Details */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90">
                          <td colSpan={6} className="p-4 border-t border-b border-slate-200">
                            <div className="space-y-2 text-xs">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="p-3 rounded-xl bg-white border border-slate-200">
                                  <div className="font-bold text-slate-500 mb-1">الحالة السابقة (Before):</div>
                                  <div className="text-slate-700 font-mono text-[11px]">
                                    {entry.before_value || '<لا توجد قيمة سابقة / سجل جديد>'}
                                  </div>
                                </div>
                                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                                  <div className="font-bold text-emerald-900 mb-1">الحالة الجديدة (After):</div>
                                  <div className="text-emerald-900 font-mono text-[11px]">
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
