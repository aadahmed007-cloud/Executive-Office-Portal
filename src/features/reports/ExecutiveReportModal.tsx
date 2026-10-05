import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../../i18n/i18nContext';
import {
  correspondenceRepo,
  directiveRepo,
  matterRepo,
  meetingRepo,
  auditRepo
} from '../../data/api/apiRepositories';
import {
  Correspondence,
  Directive,
  Matter,
  Meeting
} from '../../domain/types';
import {
  FileText,
  Printer,
  X,
  Calendar,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Building2,
  Lock,
  Layers,
  Tag,
  ShieldCheck,
  FolderGit2
} from 'lucide-react';

interface ExecutiveReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExecutiveReportModal: React.FC<ExecutiveReportModalProps> = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
  const { t, formatNumber, formatDate } = useI18n();

  const [reportType, setReportType] = useState<'weekly' | 'monthly' | 'matter'>('weekly');
  const [periodPreset, setReportPeriodPreset] = useState<'this_week' | 'this_month' | 'last_month' | 'custom'>('this_week');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [selectedMatterId, setSelectedMatterId] = useState<string>('all');
  const [includeConfidential, setIncludeConfidential] = useState<boolean>(currentUser.can_view_confidential);

  const [letters, setLetters] = useState<Correspondence[]>([]);
  const [directives, setDirectives] = useState<Directive[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Period Preset Change Handler
  useEffect(() => {
    const now = new Date();
    if (periodPreset === 'this_week') {
      const start = new Date();
      start.setDate(now.getDate() - 7);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (periodPreset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (periodPreset === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
    }
  }, [periodPreset]);

  // Load Aggregated Data
  const loadReportData = async () => {
    setIsLoading(true);
    const userCtx = {
      can_view_confidential: includeConfidential && currentUser.can_view_confidential,
      role: currentUser.role,
      userId: currentUser.id
    };

    const [cList, dList, mList, meetList] = await Promise.all([
      correspondenceRepo.getAll(undefined, userCtx),
      directiveRepo.getAll(undefined, userCtx),
      matterRepo.getAll(undefined, userCtx),
      meetingRepo.getAll(undefined, userCtx)
    ]);

    setLetters(cList);
    setDirectives(dList);
    setMatters(mList);
    setMeetings(meetList);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadReportData();
    }
  }, [isOpen, includeConfidential, reportType]);

  if (!isOpen) return null;

  // Filter Data based on selected date range & selected matter
  const filteredLetters = letters.filter((l) => {
    if (selectedMatterId !== 'all' && l.matter_id !== selectedMatterId) return false;
    if (startDate && l.date < startDate) return false;
    if (endDate && l.date > endDate) return false;
    return true;
  });

  const filteredDirectives = directives.filter((d) => {
    if (selectedMatterId !== 'all' && d.matter_id !== selectedMatterId) return false;
    if (startDate && d.issued_at && d.issued_at.split('T')[0] < startDate) return false;
    if (endDate && d.issued_at && d.issued_at.split('T')[0] > endDate) return false;
    return true;
  });

  const filteredMeetings = meetings.filter((m) => {
    if (selectedMatterId !== 'all' && m.matter_id !== selectedMatterId) return false;
    const mDate = m.start_time ? m.start_time.split('T')[0] : '';
    if (startDate && mDate < startDate) return false;
    if (endDate && mDate > endDate) return false;
    return true;
  });

  const filteredMatters = matters.filter((m) => {
    if (selectedMatterId !== 'all' && m.id !== selectedMatterId) return false;
    return true;
  });

  // Calculate Metrics
  const totalLetters = filteredLetters.length;
  const incomingLetters = filteredLetters.filter((l) => l.type === 'incoming').length;
  const outgoingLetters = filteredLetters.filter((l) => l.type === 'outgoing').length;
  const approvedLetters = filteredLetters.filter((l) => l.status === 'approved').length;

  const totalDirectives = filteredDirectives.length;
  const completedDirectives = filteredDirectives.filter((d) => d.status === 'completed' || d.progress_percent === 100).length;
  const overdueDirectives = filteredDirectives.filter((d) => d.status === 'overdue' || (d.progress_percent < 100 && d.due_date < new Date().toISOString().split('T')[0])).length;

  const totalMeetings = filteredMeetings.length;

  const reportCode = `REP-${new Date().getFullYear()}-${reportType === 'weekly' ? 'WK' : reportType === 'monthly' ? 'M' : 'STR'}-${Math.floor(Math.random() * 900 + 100)}`;

  const handlePrint = async () => {
    const userCtx = { can_view_confidential: Boolean(currentUser?.can_view_confidential), role: currentUser?.role || 'SECRETARY', userId: currentUser?.id || 'system' };
    await auditRepo.log({
      user_id: currentUser.id,
      user_name: currentUser.name,
      user_role: currentUser.role,
      action_type: 'EXPORT',
      entity_type: 'SYSTEM_SETTINGS',
      entity_id: reportCode,
      before_value: null,
      after_value: `تصدير وطباعة تقرير ينفيذي (${reportType === 'weekly' ? 'أسبوعي' : reportType === 'monthly' ? 'شهري' : 'استراتيجي'}) للفترة من ${startDate} إلى ${endDate}`,
      ip_address: ''
    }, userCtx);

    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-right flex flex-col max-h-[92vh]">
        {/* Modal Controls Bar */}
        <div className="bg-slate-900 text-white p-5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 print:hidden">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-400" />
              <span>{t('reports_module.report_modal_title')}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">{t('reports_module.report_modal_subtitle')}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{t('reports_module.export_pdf_btn')}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Report Customizer Filters Bar (Hidden in Print) */}
        <div className="bg-slate-50 p-4 border-b border-slate-200 text-xs space-y-3 print:hidden">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Report Type */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">{t('reports_module.report_type_label')}</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as any)}
                className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs text-slate-800 font-semibold focus:outline-none focus:border-emerald-600"
              >
                <option value="weekly">{t('reports_module.report_type_weekly')}</option>
                <option value="monthly">{t('reports_module.report_type_monthly')}</option>
                <option value="matter">{t('reports_module.report_type_matter')}</option>
              </select>
            </div>

            {/* Period Preset */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">{t('reports_module.report_period_label')}</label>
              <select
                value={periodPreset}
                onChange={(e) => setReportPeriodPreset(e.target.value as any)}
                className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs text-slate-800 font-semibold focus:outline-none focus:border-emerald-600"
              >
                <option value="this_week">{t('reports_module.report_period_this_week')}</option>
                <option value="this_month">{t('reports_module.report_period_this_month')}</option>
                <option value="last_month">{t('reports_module.report_period_last_month')}</option>
                <option value="custom">{t('reports_module.report_period_custom')}</option>
              </select>
            </div>

            {/* Strategic Matter Filter */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">{t('reports_module.matter_filter_label')}</label>
              <select
                value={selectedMatterId}
                onChange={(e) => setSelectedMatterId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs text-slate-800 font-semibold focus:outline-none focus:border-emerald-600"
              >
                <option value="all">{t('reports_module.matter_filter_all')}</option>
                {matters.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.code} - {m.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Custom Date Pickers & Confidential Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
            {periodPreset === 'custom' && (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-600">من:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg p-1.5 text-xs text-slate-800"
                />
                <span className="font-semibold text-slate-600">إلى:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg p-1.5 text-xs text-slate-800"
                />
              </div>
            )}

            {currentUser.can_view_confidential && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeConfidential}
                  onChange={(e) => setIncludeConfidential(e.target.checked)}
                  className="rounded text-emerald-700 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span className="font-semibold text-slate-700 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-purple-700" />
                  <span>{t('reports_module.include_confidential_label')}</span>
                </span>
              </label>
            )}
          </div>
        </div>

        {/* Printable Executive Document Area */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 bg-white space-y-6 text-slate-900 print:p-0 print:overflow-visible">
          {isLoading ? (
            <div className="p-12 text-center text-slate-500 font-semibold">جاري تحضير وتجميع بيانات التقرير التنفيذي...</div>
          ) : (
            <div className="border-2 border-slate-900 p-8 rounded-3xl space-y-6 print:border-none print:p-0">
              {/* Official Header */}
              <div className="border-b-2 border-slate-900 pb-5 flex items-start justify-between">
                <div>
                  <h1 className="text-xl font-extrabold text-slate-950">{t('reports_module.official_authority_name')}</h1>
                  <h2 className="text-sm font-bold text-slate-700">{t('reports_module.office_title')}</h2>
                  <div className="text-xs font-semibold text-emerald-800 mt-1">
                    {reportType === 'weekly'
                      ? 'التقرير الأسبوعي الشامل للإنجاز والمتابعة الرئاسية'
                      : reportType === 'monthly'
                      ? 'التقرير التنفيذي الشهري لقياس الأداء والمؤشرات'
                      : 'تقرير المتابعة الخاص بالملف الاستراتيجي'}
                  </div>
                </div>

                <div className="text-left text-xs font-mono space-y-1">
                  <div className="font-bold text-sm bg-slate-100 px-3 py-1 border border-slate-300 rounded-lg text-slate-900">
                    {reportCode}
                  </div>
                  <div>الفترة: <strong>{formatDate(startDate)}</strong> — <strong>{formatDate(endDate)}</strong></div>
                  <div className="text-[11px] text-slate-500">تاريخ الإصدار: {formatDate(new Date().toISOString().split('T')[0])}</div>
                </div>
              </div>

              {/* 1. Executive KPIs Section */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider bg-slate-100 p-2 rounded-lg border border-slate-200">
                  {t('reports_module.executive_summary_heading')}
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                    <div className="text-lg font-extrabold text-emerald-900">{formatNumber(totalLetters)}</div>
                    <div className="text-slate-600 mt-0.5">إجمالي المراسلات المعالجة</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">({formatNumber(incomingLetters)} وارد / {formatNumber(outgoingLetters)} صادر)</div>
                  </div>

                  <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200">
                    <div className="text-lg font-extrabold text-blue-900">{formatNumber(approvedLetters)}</div>
                    <div className="text-slate-600 mt-0.5">مراسلات معتمدة بتأشيرة</div>
                    <div className="text-[10px] text-blue-700 mt-0.5">جاهزة للتنفيذ والإحالة</div>
                  </div>

                  <div className="p-3 rounded-2xl bg-purple-50 border border-purple-200">
                    <div className="text-lg font-extrabold text-purple-900">{formatNumber(completedDirectives)} / {formatNumber(totalDirectives)}</div>
                    <div className="text-slate-600 mt-0.5">التكليفات المستوفاة</div>
                    <div className="text-[10px] text-purple-700 mt-0.5">نسبة الإنجاز: {totalDirectives > 0 ? formatNumber(Math.round((completedDirectives / totalDirectives) * 100)) : 100}%</div>
                  </div>

                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200">
                    <div className="text-lg font-extrabold text-amber-900">{formatNumber(totalMeetings)}</div>
                    <div className="text-slate-600 mt-0.5">الاجتماعات الرئاسية</div>
                    <div className="text-[10px] text-amber-700 mt-0.5">محاضر معتمدة رسمياً</div>
                  </div>
                </div>
              </div>

              {/* 2. Strategic Matters Section */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider bg-slate-100 p-2 rounded-lg border border-slate-200">
                  {t('reports_module.matters_summary_heading')}
                </h3>

                <div className="space-y-2 text-xs">
                  {filteredMatters.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 italic bg-slate-50 rounded-xl">لا توجد ملفات استراتيجية مطابقة لشروط التقرير.</div>
                  ) : (
                    filteredMatters.map((m) => (
                      <div key={m.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1">
                        <div className="flex items-center justify-between font-bold">
                          <span className="text-slate-900">{m.code} — {m.title}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-200 text-slate-800">{m.lead_entity}</span>
                        </div>
                        <p className="text-slate-700 text-[11px] leading-relaxed">{m.description}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 3. Presidential Directives Section */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider bg-slate-100 p-2 rounded-lg border border-slate-200">
                  {t('reports_module.directives_summary_heading')}
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs border border-slate-200 rounded-xl overflow-hidden">
                    <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">الكود والتكليف</th>
                        <th className="p-2.5">القطاع المكلف</th>
                        <th className="p-2.5">تاريخ الاستحقاق</th>
                        <th className="p-2.5 text-center">نسبة الإنجاز</th>
                        <th className="p-2.5 text-center">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px]">
                      {filteredDirectives.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-slate-400">لا توجد تكليفات رئاسية مسجلة خلال الفترة.</td>
                        </tr>
                      ) : (
                        filteredDirectives.map((d) => (
                          <tr key={d.id} className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold text-slate-900">{d.code} - {d.title}</td>
                            <td className="p-2.5 text-slate-700">{d.assigned_department}</td>
                            <td className="p-2.5 text-slate-700 font-mono">{formatDate(d.due_date)}</td>
                            <td className="p-2.5 text-center font-bold font-mono">{formatNumber(d.progress_percent)}%</td>
                            <td className="p-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                d.status === 'completed'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : d.status === 'overdue'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-900'
                              }`}>
                                {d.status === 'completed' ? 'مستوفى' : d.status === 'overdue' ? 'متأخر' : 'قيد التنفيذ'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. Correspondence Summary Table */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider bg-slate-100 p-2 rounded-lg border border-slate-200">
                  {t('reports_module.correspondence_summary_heading')}
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs border border-slate-200 rounded-xl overflow-hidden">
                    <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">الرقم والنوع</th>
                        <th className="p-2.5">الجهة</th>
                        <th className="p-2.5">الموضوع والتصنيفات</th>
                        <th className="p-2.5">التاريخ</th>
                        <th className="p-2.5 text-center">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px]">
                      {filteredLetters.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-slate-400">لا توجد مراسلات مطابقة.</td>
                        </tr>
                      ) : (
                        filteredLetters.slice(0, 10).map((l) => (
                          <tr key={l.id} className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold font-mono text-slate-900">{l.serial_number} ({l.type === 'incoming' ? 'وارد' : 'صادر'})</td>
                            <td className="p-2.5 text-slate-700 max-w-[180px] truncate">{l.source_or_dest_entity}</td>
                            <td className="p-2.5 text-slate-900 font-medium">
                              <div>{l.subject}</div>
                              {l.tags && l.tags.length > 0 && (
                                <div className="text-[10px] text-amber-800 mt-0.5">الوسوم: {l.tags.map(t => `#${t}`).join(' ')}</div>
                              )}
                            </td>
                            <td className="p-2.5 font-mono text-slate-600">{formatDate(l.date)}</td>
                            <td className="p-2.5 text-center">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 border border-slate-200 text-slate-800">
                                {l.status === 'approved' ? 'معتمد' : l.status === 'presented_to_chairman' ? 'معروض' : 'مسجل'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  {filteredLetters.length > 10 && (
                    <div className="text-[11px] text-slate-500 text-center py-2 italic bg-slate-50 border-t border-slate-200">
                      يتم عرض 10 معاملات رئيسية من أصل {formatNumber(filteredLetters.length)} معاملة بالتقرير المرفق.
                    </div>
                  )}
                </div>
              </div>

              {/* 5. Official Endorsement Footer */}
              <div className="pt-8 border-t-2 border-slate-900 space-y-6">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  {t('reports_module.signatures_heading')}
                </h3>

                <div className="grid grid-cols-2 text-center text-xs pt-4 gap-8">
                  <div className="space-y-8">
                    <div className="text-slate-600">إعداد / السكرتارية التنفيذية</div>
                    <div className="font-bold text-slate-950 underline underline-offset-4">السكرتير التنفيذي الأول</div>
                  </div>
                  <div className="space-y-8">
                    <div className="text-slate-600">اعتماد / رئيس مجلس الإدارة</div>
                    <div className="font-bold text-slate-950 underline underline-offset-4">رئيس مجلس الإدارة</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer (Hidden in Print) */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-between items-center text-xs print:hidden">
          <span className="text-slate-500 font-mono">رمز التقرير المرجعي: <strong>{reportCode}</strong></span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
