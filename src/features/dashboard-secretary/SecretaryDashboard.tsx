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
import { maskConfidentialCorrespondence, maskConfidentialDirective, maskConfidentialMeeting } from '../../domain/rules/confidentiality';
import { RecentActivityWidget } from '../../ui/components/RecentActivityWidget';
import {
  Inbox,
  Calendar,
  CheckSquare,
  FolderGit2,
  AlertCircle,
  Clock,
  ArrowUpRight,
  FileText,
  User,
  MapPin,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  Building2
} from 'lucide-react';

interface SecretaryDashboardProps {
  onNavigate: (tab: string) => void;
}

export const SecretaryDashboard: React.FC<SecretaryDashboardProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const { t, formatNumber, formatDate } = useI18n();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [letters, setLetters] = useState<Correspondence[]>([]);
  const [directives, setDirectives] = useState<Directive[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const userCtx = { can_view_confidential: currentUser.can_view_confidential, role: currentUser.role, userId: currentUser.id };
        const [mList, cList, dList, matList] = await Promise.all([
          meetingRepo.getAll(undefined, userCtx),
          correspondenceRepo.getAll(undefined, userCtx),
          directiveRepo.getAll(undefined, userCtx),
          matterRepo.getAll(undefined, userCtx)
        ]);

        setMeetings(mList.map((m) => maskConfidentialMeeting(m, currentUser)));
        setLetters(cList.map((c) => maskConfidentialCorrespondence(c, currentUser)));
        setDirectives(dList.map((d) => maskConfidentialDirective(d, currentUser)));
        setMatters(matList);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [currentUser]);

  // Calculations
  const urgentLetters = letters.filter((l) => l.priority === 'top_urgent' || l.priority === 'urgent');
  const awaitingChairman = letters.filter((l) => l.status === 'presented_to_chairman' || l.status === 'briefing_prepared');
  const overdueDirectives = directives.filter((d) => analyzeOverdue(d.due_date, d.status).isOverdue || d.status === 'overdue');
  const activeDirectives = directives.filter((d) => d.status !== 'completed' && d.status !== 'closed');

  return (
    <div className="space-y-6">
      {/* Top Banner: Secretary Office Head */}
      <div className="bg-gradient-to-l from-emerald-950 via-slate-900 to-slate-900 border border-emerald-800/40 rounded-2xl p-5 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-800/80 text-emerald-200 border border-emerald-600/50">
              {t('nav.dashboard_secretary')}
            </span>
            <span className="text-xs text-slate-400 font-mono">LAN Local SQLite</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100">
            مرحباً، {currentUser.name}
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            {formatDate(new Date())} — جدول الأعمال اليومي والمراسلات الجارية بمكتب رئيس مجلس الإدارة
          </p>
        </div>

        {/* Action Shortcuts */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigate('correspondence')}
            className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold shadow transition flex items-center gap-1.5 cursor-pointer"
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>سجل الوارد والصادر</span>
          </button>
          <button
            onClick={() => onNavigate('meetings')}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            <span>المفكرة والاجتماعات</span>
          </button>
          <button
            onClick={() => onNavigate('directives')}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
          >
            <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
            <span>مركز التكليفات</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Urgent Correspondence */}
        <div
          onClick={() => onNavigate('correspondence')}
          className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm hover:border-emerald-500 hover:shadow-md transition cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">المراسلات بانتظار العرض</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Inbox className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{formatNumber(awaitingChairman.length)}</div>
          <div className="text-[11px] text-amber-700 mt-1 font-medium flex items-center gap-1">
            <span>منها {formatNumber(urgentLetters.length)} معاملة عاجلة</span>
          </div>
        </div>

        {/* KPI 2: Today / Upcoming Meetings */}
        <div
          onClick={() => onNavigate('meetings')}
          className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm hover:border-emerald-500 hover:shadow-md transition cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">الاجتماعات والمواعيد</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{formatNumber(meetings.length)}</div>
          <div className="text-[11px] text-emerald-700 mt-1 font-medium flex items-center gap-1">
            <span>جلسات مجدولة ومؤكدة</span>
          </div>
        </div>

        {/* KPI 3: Overdue & Active Directives */}
        <div
          onClick={() => onNavigate('directives')}
          className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm hover:border-emerald-500 hover:shadow-md transition cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">التكليفات الرئاسية النشطة</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{formatNumber(activeDirectives.length)}</div>
          <div className="text-[11px] text-rose-600 mt-1 font-bold flex items-center gap-1">
            {overdueDirectives.length > 0 ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{formatNumber(overdueDirectives.length)} تكليف متأخر يستوجب المتابعة</span>
              </>
            ) : (
              <span className="text-emerald-600">لا توجد تكليفات متأخرة</span>
            )}
          </div>
        </div>

        {/* KPI 4: Strategic Matters */}
        <div
          onClick={() => onNavigate('matters')}
          className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm hover:border-emerald-500 hover:shadow-md transition cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">الملفات والقضايا الاستراتيجية</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <FolderGit2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{formatNumber(matters.length)}</div>
          <div className="text-[11px] text-purple-700 mt-1 font-medium">
            <span>ملفات ذات أولوية عليا قيد المعالجة</span>
          </div>
        </div>
      </div>

      {/* Main Content Split: Awaiting Chairman & Upcoming Meetings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Letters Awaiting Action / Briefings */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">مذكرات العرض والمراسلات الجاهزة للعرض</h3>
                <p className="text-[11px] text-slate-500">معاملات تتطلب تأشيرة أو توجيه السيد رئيس مجلس الإدارة</p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('correspondence')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              <span>عرض السجل</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {awaitingChairman.slice(0, 4).map((letter) => (
              <div
                key={letter.id}
                onClick={() => onNavigate('correspondence')}
                className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-emerald-50/40 hover:border-emerald-200 transition cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-mono text-xs font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {letter.serial_number}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {letter.priority === 'top_urgent' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                        عاجل جداً
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-200">
                      معروض على الرئيس
                    </span>
                  </div>
                </div>
                <div className="text-xs font-bold text-slate-800 line-clamp-1 mb-1">{letter.subject}</div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1 text-slate-600">
                    <Building2 className="w-3 h-3 text-slate-400" />
                    {letter.source_or_dest_entity}
                  </span>
                  <span>{formatDate(letter.date)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Scheduled Meetings Studio */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">مواعيد واجتماعات المفكرة الرئاسية</h3>
                <p className="text-[11px] text-slate-500">الارتباطات المجدولة والقاعات المخصصة</p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('meetings')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              <span>المفكرة الكاملة</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {meetings.slice(0, 4).map((meeting) => (
              <div
                key={meeting.id}
                onClick={() => onNavigate('meetings')}
                className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-emerald-50/40 hover:border-emerald-200 transition cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    {formatDate(meeting.start_time, { showTime: true })}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800">
                    {meeting.status === 'confirmed' ? 'مؤكد' : 'مجدول'}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-800 mb-1">{meeting.title}</div>
                <div className="text-[11px] text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  <span>{meeting.location}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Activity & Transparency Stream Widget */}
      <div className="pt-2">
        <RecentActivityWidget onNavigateToAudit={() => onNavigate('audit')} maxItems={5} />
      </div>
    </div>
  );
};
