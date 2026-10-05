import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../../i18n/i18nContext';
import {
  meetingRepo,
  correspondenceRepo,
  directiveRepo,
  matterRepo
} from '../../data/api/apiRepositories';
import {
  Meeting,
  Correspondence,
  Directive,
  Matter
} from '../../domain/types';
import { analyzeOverdue } from '../../domain/rules/overdueLogic';
import { ExecutiveReportModal } from './ExecutiveReportModal';
import {
  FileSpreadsheet,
  Printer,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Building,
  CheckSquare,
  ShieldCheck,
  TrendingUp,
  Inbox,
  Send,
  Layers,
  FileText,
  Sparkles
} from 'lucide-react';

export const WeeklySummaryView: React.FC = () => {
  const { currentUser } = useAuth();
  const { t, formatNumber, formatDate } = useI18n();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [letters, setLetters] = useState<Correspondence[]>([]);
  const [directives, setDirectives] = useState<Directive[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [isExecutiveModalOpen, setIsExecutiveModalOpen] = useState(false);

  const [selectedWeek, setSelectedWeek] = useState('2026-W40');

  const loadData = async () => {
    const userCtx = { userId: currentUser.id, can_view_confidential: currentUser.can_view_confidential, role: currentUser.role };
    const [mList, cList, dList, matList] = await Promise.all([
      meetingRepo.getAll(undefined, userCtx),
      correspondenceRepo.getAll(undefined, userCtx),
      directiveRepo.getAll(undefined, userCtx),
      matterRepo.getAll(undefined, userCtx)
    ]);

    setMeetings(mList);
    setLetters(cList);
    setDirectives(dList);
    setMatters(matList);
  };

  useEffect(() => {
    loadData();
  }, []);

  const overdueList = directives.filter((d) => analyzeOverdue(d.due_date, d.status).isOverdue || d.status === 'overdue');
  const completedDirectives = directives.filter((d) => d.status === 'completed' || d.status === 'closed');
  const approvedLetters = letters.filter((l) => l.status === 'approved' || l.status === 'referred' || l.status === 'dispatched');

  return (
    <div className="space-y-6">
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm print:hidden">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
            <span>{t('reports_module.title')}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">{t('reports_module.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsExecutiveModalOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
          >
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>{t('reports_module.generate_executive_pdf')}</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{t('reports_module.print_weekly')}</span>
          </button>
        </div>
      </div>

      {/* Printable Official Weekly Report Document */}
      <div className="bg-white border-2 border-slate-800 p-8 sm:p-10 rounded-3xl text-slate-900 space-y-8 shadow-sm print:border-none print:p-0 print:shadow-none">
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-black text-lg">الهيئة القومية للبريد المصري</h3>
            <h4 className="text-sm font-bold text-emerald-900">مكتب رئيس مجلس الإدارة</h4>
            <div className="text-xs text-slate-600">التقرير الرئاسي التنفيذي الموحد — حصاد الأسبوع</div>
          </div>

          <div className="text-left text-xs font-mono bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>الفترة: <strong>الأسبوع الأول من أكتوبر 2026</strong></div>
            <div>تاريخ الاستخراج: <strong>{formatDate(new Date().toISOString(), { showTime: true })}</strong></div>
            <div>التصنيف: <strong>تقرير تنفيذي معتمد</strong></div>
          </div>
        </div>

        {/* Section 1: Executive KPIs */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-slate-900 border-r-4 border-emerald-700 pr-2.5">
            {t('reports_module.section_kpis')}
          </h4>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1">
              <div className="text-xs text-slate-500">الاجتماعات المنعقدة</div>
              <div className="text-xl font-black text-emerald-800">{formatNumber(meetings.length)}</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1">
              <div className="text-xs text-slate-500">المعاملات والتأشيرات</div>
              <div className="text-xl font-black text-emerald-800">{formatNumber(approvedLetters.length)}</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1">
              <div className="text-xs text-slate-500">التكليفات المستوفاة</div>
              <div className="text-xl font-black text-emerald-800">{formatNumber(completedDirectives.length)}</div>
            </div>

            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-center space-y-1">
              <div className="text-xs text-rose-600 font-semibold">تنبيهات التأخير</div>
              <div className="text-xl font-black text-rose-700">{formatNumber(overdueList.length)}</div>
            </div>
          </div>
        </div>

        {/* Section 2: Meetings and Minutes */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-slate-900 border-r-4 border-emerald-700 pr-2.5">
            {t('reports_module.section_meetings')}
          </h4>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 font-bold text-slate-700">
                <tr>
                  <th className="p-2.5">الاجتماع / الجلسة</th>
                  <th className="p-2.5">التوقيت والمكان</th>
                  <th className="p-2.5">النوع</th>
                  <th className="p-2.5">حالة المحضر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {meetings.slice(0, 5).map((m) => (
                  <tr key={m.id}>
                    <td className="p-2.5 font-bold">{m.title}</td>
                    <td className="p-2.5">{formatDate(m.start_time)} — {m.location}</td>
                    <td className="p-2.5 font-medium">{m.meeting_type}</td>
                    <td className="p-2.5 font-bold text-emerald-800">{m.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 3: Correspondence & Endorsements */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-slate-900 border-r-4 border-emerald-700 pr-2.5">
            {t('reports_module.section_correspondence')}
          </h4>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 font-bold text-slate-700">
                <tr>
                  <th className="p-2.5">رقم القيد</th>
                  <th className="p-2.5">الجهة</th>
                  <th className="p-2.5">الموضوع</th>
                  <th className="p-2.5">الحالة والتأشيرة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {letters.slice(0, 5).map((l) => (
                  <tr key={l.id}>
                    <td className="p-2.5 font-mono font-bold">{l.serial_number}</td>
                    <td className="p-2.5">{l.source_or_dest_entity}</td>
                    <td className="p-2.5 font-medium">{l.subject}</td>
                    <td className="p-2.5 font-bold text-emerald-800">{l.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 4: Directives & Overdue Items */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-slate-900 border-r-4 border-rose-700 pr-2.5">
            {t('reports_module.section_overdue')}
          </h4>

          <div className="overflow-x-auto border border-rose-200 rounded-xl">
            <table className="w-full text-right text-xs">
              <thead className="bg-rose-50 font-bold text-rose-900">
                <tr>
                  <th className="p-2.5">كود التكليف</th>
                  <th className="p-2.5">الموضوع والتعليمات</th>
                  <th className="p-2.5">القطاع والمسؤول</th>
                  <th className="p-2.5">الاستحقاق</th>
                  <th className="p-2.5">نسبة الإنجاز</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-100">
                {overdueList.map((d) => (
                  <tr key={d.id} className="bg-rose-50/30">
                    <td className="p-2.5 font-mono font-bold text-rose-900">{d.code}</td>
                    <td className="p-2.5 font-medium">{d.title}</td>
                    <td className="p-2.5">{d.assigned_department} ({d.assigned_person})</td>
                    <td className="p-2.5 font-bold text-rose-700">{formatDate(d.due_date)}</td>
                    <td className="p-2.5 font-bold">{formatNumber(d.progress_percent)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Official Signatures Footer */}
        <div className="pt-12 flex justify-between text-xs text-center border-t-2 border-slate-900">
          <div>
            <div className="text-slate-500 mb-8">إعداد وتنسيق / سكرتير أول</div>
            <div className="font-bold">السكرتير التنفيذي الأول</div>
          </div>
          <div>
            <div className="text-slate-500 mb-8">يعتمد / رئيس مجلس الإدارة</div>
            <div className="font-bold">رئيس مجلس الإدارة</div>
          </div>
        </div>
      </div>

      {/* Executive Report Generator Modal */}
      <ExecutiveReportModal
        isOpen={isExecutiveModalOpen}
        onClose={() => setIsExecutiveModalOpen(false)}
      />
    </div>
  );
};
