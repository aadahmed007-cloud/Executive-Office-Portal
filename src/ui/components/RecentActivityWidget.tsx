import React, { useState, useEffect } from 'react';
import { auditRepo } from '../../data/sqlite/repositories';
import { useI18n } from '../../i18n/i18nContext';
import { AuditLogEntry } from '../../domain/types';
import {
  Activity,
  ShieldCheck,
  Clock,
  ArrowLeft,
  FileText,
  CheckCircle2,
  Calendar,
  KeyRound,
  RotateCw,
  Layers,
  Sparkles
} from 'lucide-react';

interface RecentActivityWidgetProps {
  onNavigateToAudit?: () => void;
  maxItems?: number;
}

export const RecentActivityWidget: React.FC<RecentActivityWidgetProps> = ({
  onNavigateToAudit,
  maxItems = 5
}) => {
  const { t, formatDate } = useI18n();
  const [activities, setActivities] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const list = await auditRepo.getAll({ limit: maxItems });
      setActivities(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [maxItems]);

  const getActionBadge = (entry: AuditLogEntry) => {
    switch (entry.action_type) {
      case 'DECIDE':
        return {
          label: 'تأشيرة / قرار',
          bg: 'bg-amber-100 text-amber-900 border-amber-300'
        };
      case 'CREATE':
        return {
          label: 'إنشاء وتسجيل',
          bg: 'bg-emerald-100 text-emerald-900 border-emerald-300'
        };
      case 'UPDATE':
        return {
          label: 'تحديث ومتابعة',
          bg: 'bg-blue-100 text-blue-900 border-blue-300'
        };
      case 'ROUTING':
        return {
          label: 'إحالة وتوجيه',
          bg: 'bg-purple-100 text-purple-900 border-purple-300'
        };
      case 'DELETE':
        return {
          label: 'حذف وأرشفة',
          bg: 'bg-rose-100 text-rose-900 border-rose-300'
        };
      case 'AUTH':
        return {
          label: 'أمان وجلسات',
          bg: 'bg-slate-100 text-slate-800 border-slate-300'
        };
      default:
        return {
          label: entry.action_type,
          bg: 'bg-slate-100 text-slate-700 border-slate-200'
        };
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>{t('audit_module.recent_activity_title')}</span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">{t('audit_module.recent_activity_subtitle')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchActivities}
            disabled={loading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            title="تحديث الأنشطة اللحظية"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>

          {onNavigateToAudit && (
            <button
              onClick={onNavigateToAudit}
              className="text-xs text-emerald-800 hover:text-emerald-950 font-bold flex items-center gap-1 cursor-pointer transition"
            >
              <span>السجل الكامل</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Activity Timeline List */}
      <div className="space-y-3">
        {activities.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            {t('audit_module.no_activities_found')}
          </div>
        ) : (
          activities.map((entry, index) => {
            const badge = getActionBadge(entry);
            const isLatest = index === 0;

            return (
              <div
                key={entry.id}
                className={`p-3 rounded-xl border transition flex items-start justify-between gap-3 ${
                  isLatest
                    ? 'bg-emerald-50/40 border-emerald-200/80 shadow-xs'
                    : 'bg-slate-50/60 border-slate-100 hover:bg-slate-50'
                }`}
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-xs text-slate-900 truncate">
                      {entry.user_name}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      ({entry.user_role})
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-bold border ${badge.bg}`}
                    >
                      {badge.label}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 font-medium leading-relaxed line-clamp-2">
                    {entry.after_value || entry.before_value || 'إجراء بدون بيان تفصيلي'}
                  </p>
                </div>

                <div className="text-left flex-shrink-0 space-y-1 font-mono text-[10px] text-slate-400">
                  <div>{formatDate(entry.timestamp, { showTime: true })}</div>
                  <div className="text-[9px] text-emerald-700/80 font-bold flex items-center justify-end gap-0.5">
                    <ShieldCheck className="w-3 h-3" />
                    <span>SHA-256</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer info note */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
          <span>سجل رقابي محلي مشفر ومترابط بالسلسلة</span>
        </span>
        <span className="font-mono text-[10px] text-slate-400">
          محطة مؤمنة LAN
        </span>
      </div>
    </div>
  );
};
