import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../../i18n/i18nContext';
import {
  meetingRepo,
  correspondenceRepo,
  directiveRepo,
  matterRepo,
  auditRepo,
  notificationRepo
} from '../../data/sqlite/repositories';
import {
  Meeting,
  Correspondence,
  Directive,
  BriefingNote,
  Matter
} from '../../domain/types';
import { analyzeOverdue } from '../../domain/rules/overdueLogic';
import { maskConfidentialCorrespondence, maskConfidentialDirective, maskConfidentialMeeting } from '../../domain/rules/confidentiality';
import { MeetingDetailModal } from '../meetings/MeetingDetailModal';
import { CorrespondenceDetailModal } from '../correspondence/CorrespondenceDetailModal';
import { DirectiveDetailModal } from '../directives/DirectiveDetailModal';
import {
  Check,
  X,
  Clock,
  Send,
  FileText,
  AlertTriangle,
  Calendar,
  Building2,
  MapPin,
  Sparkles,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  FolderGit2,
  CheckCircle2
} from 'lucide-react';

interface ChairmanDashboardProps {
  onNavigate: (tab: string) => void;
}

export const ChairmanDashboard: React.FC<ChairmanDashboardProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const { t, formatNumber, formatDate } = useI18n();

  const [letters, setLetters] = useState<Correspondence[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [directives, setDirectives] = useState<Directive[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);

  const [selectedLetter, setSelectedLetter] = useState<Correspondence | null>(null);
  const [briefingNote, setBriefingNote] = useState<BriefingNote | null>(null);

  // Modal dialog states
  const [isEndorsementModalOpen, setIsEndorsementModalOpen] = useState(false);
  const [decisionType, setDecisionType] = useState<'approved' | 'rejected' | 'postponed' | 'referred'>('approved');
  const [standardPhrase, setStandardPhrase] = useState('موافق مع سرعة التنفيذ');
  const [customDirective, setCustomDirective] = useState('');
  const [referralDepartment, setReferralDepartment] = useState('قطاع العمليات والخدمات البريدية');
  const [referralDeadline, setReferralDeadline] = useState('2026-10-15');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dedicated detail modals
  const [detailMeeting, setDetailMeeting] = useState<Meeting | null>(null);
  const [detailLetter, setDetailLetter] = useState<Correspondence | null>(null);
  const [detailDirective, setDetailDirective] = useState<Directive | null>(null);

  const loadDashboardData = async () => {
    const [cList, mList, dList, matList] = await Promise.all([
      correspondenceRepo.getAll(),
      meetingRepo.getAll(),
      directiveRepo.getAll(),
      matterRepo.getAll()
    ]);

    const maskedLetters = cList.map((c) => maskConfidentialCorrespondence(c, currentUser));
    setLetters(maskedLetters);
    setMeetings(mList.map((m) => maskConfidentialMeeting(m, currentUser)));
    setDirectives(dList.map((d) => maskConfidentialDirective(d, currentUser)));
    setMatters(matList);

    const awaiting = maskedLetters.filter((l) => l.status === 'presented_to_chairman' || l.status === 'briefing_prepared');
    if (awaiting.length > 0 && !selectedLetter) {
      handleSelectLetter(awaiting[0]);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [currentUser]);

  const handleSelectLetter = async (letter: Correspondence) => {
    setSelectedLetter(letter);
    const note = await correspondenceRepo.getBriefingNote(letter.id);
    setBriefingNote(note);
  };

  const openDecisionModal = (type: 'approved' | 'rejected' | 'postponed' | 'referred') => {
    setDecisionType(type);
    if (type === 'approved') setStandardPhrase('موافق مع سرعة التنفيذ');
    if (type === 'rejected') setStandardPhrase('يُحفظ');
    if (type === 'postponed') setStandardPhrase('تؤجل للمزيد من الدراسة والمراجعة');
    if (type === 'referred') setStandardPhrase('يحال للقطاع المختص للإفادة بما تم');
    setIsEndorsementModalOpen(true);
  };

  const handleSaveDecision = async () => {
    if (!selectedLetter) return;
    setIsSubmitting(true);
    try {
      const phraseText = `${standardPhrase}${customDirective ? ` - ${customDirective}` : ''}`;

      await correspondenceRepo.recordApproval({
        correspondence_id: selectedLetter.id,
        decision_type: decisionType,
        standard_phrase: standardPhrase,
        custom_directive: customDirective,
        decided_at: new Date().toISOString(),
        decided_by_name: currentUser.name
      });

      const newStatus = decisionType === 'approved' ? 'approved' : decisionType === 'rejected' ? 'rejected' : decisionType === 'postponed' ? 'postponed' : 'referred';
      await correspondenceRepo.update(selectedLetter.id, { status: newStatus });

      if (decisionType === 'referred' || (decisionType === 'approved' && customDirective)) {
        await correspondenceRepo.addRouting({
          correspondence_id: selectedLetter.id,
          from_entity: 'مكتب رئيس مجلس الإدارة',
          to_department_id: 'dept-auto',
          to_department_name: referralDepartment,
          action_required: phraseText,
          deadline: referralDeadline,
          status: 'sent',
          routed_at: new Date().toISOString()
        });

        const nextCode = await directiveRepo.getNextCode();
        await directiveRepo.create({
          code: nextCode,
          title: `تكليف رئاسي بشأن: ${selectedLetter.subject}`,
          instruction: phraseText,
          assigned_department: referralDepartment,
          assigned_person: 'رئيس القطاع المختص',
          source_type: 'correspondence',
          source_id: selectedLetter.id,
          priority: selectedLetter.priority,
          confidentiality: selectedLetter.confidentiality,
          status: 'new',
          progress_percent: 0,
          issued_at: new Date().toISOString(),
          due_date: referralDeadline,
          matter_id: selectedLetter.matter_id || null,
          created_by: currentUser.name
        });
      }

      await auditRepo.log({
        user_id: currentUser.id,
        user_name: currentUser.name,
        user_role: currentUser.role,
        action_type: 'DECIDE',
        entity_type: 'CORRESPONDENCE',
        entity_id: selectedLetter.id,
        before_value: `الحالة: ${selectedLetter.status}`,
        after_value: `تأشيرة رئيس مجلس الإدارة (${decisionType}): ${phraseText}`,
        ip_address: '10.120.4.10 (المكتب الرئاسي)'
      });

      await notificationRepo.create({
        recipient_role: 'SECRETARY',
        title: `تأشيرة جديدة من السيد رئيس مجلس الإدارة`,
        body: `تم إصدار تأشيرة على الخطاب رقم ${selectedLetter.serial_number}: ${phraseText}`,
        confidentiality: selectedLetter.confidentiality,
        is_read: false
      });

      setIsEndorsementModalOpen(false);
      setCustomDirective('');
      await loadDashboardData();
    } finally {
      setIsSubmitting(false);
    }
  };

  const awaitingItems = letters.filter((l) => l.status === 'presented_to_chairman' || l.status === 'briefing_prepared');
  const overdueDirectives = directives.filter((d) => analyzeOverdue(d.due_date, d.status).isOverdue || d.status === 'overdue');

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Calm Executive Header */}
      <div className="bg-slate-900 border border-amber-900/40 rounded-3xl p-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 mb-2">
              <span>بوابة القرار الرئاسي</span>
              <span>•</span>
              <span>الهيئة القومية للبريد المصري</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">{currentUser.name}</h2>
            <p className="text-xs text-slate-300 mt-1">
              لديك <strong className="text-amber-400 font-bold">{formatNumber(awaitingItems.length)} معاملة</strong> بانتظار التأشيرة والتوجيه اليوم.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div
              onClick={() => onNavigate('meetings')}
              className="bg-slate-800/90 hover:bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-center min-w-[120px] cursor-pointer transition shadow"
            >
              <div className="text-xs text-slate-400">مواعيد اليوم</div>
              <div className="text-xl font-black text-emerald-400">{formatNumber(meetings.slice(0, 3).length)}</div>
            </div>

            <div
              onClick={() => onNavigate('directives')}
              className={`border rounded-2xl px-4 py-3 text-center min-w-[120px] cursor-pointer transition shadow ${
                overdueDirectives.length > 0
                  ? 'bg-rose-950/60 border-rose-800 text-rose-200'
                  : 'bg-slate-800/90 border-slate-700 text-slate-300'
              }`}
            >
              <div className="text-xs text-slate-400">تكليفات متأخرة</div>
              <div className={`text-xl font-black ${overdueDirectives.length > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                {formatNumber(overdueDirectives.length)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Studio: Items Awaiting Decision */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: List of Awaiting Letters (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
              <span>معاملات تتطلب التأشيرة ({formatNumber(awaitingItems.length)})</span>
            </h3>
          </div>

          <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
            {awaitingItems.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-500">
                لا توجد معاملات معلقة بانتظار التأشيرة حالياً.
              </div>
            ) : (
              awaitingItems.map((item) => {
                const isSelected = selectedLetter?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectLetter(item)}
                    className={`p-4 rounded-2xl border transition cursor-pointer text-right min-h-[56px] ${
                      isSelected
                        ? 'bg-amber-50/80 border-amber-500 ring-2 ring-amber-500/20 shadow-md'
                        : 'bg-white border-slate-200 hover:border-amber-300 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        {item.serial_number}
                      </span>
                      {item.priority === 'top_urgent' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                          عاجل جداً
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2 mb-1.5">
                      {item.subject}
                    </h4>
                    <div className="text-xs text-slate-500 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">{item.source_or_dest_entity}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Selected Letter Document & Big Decision Actions (8 cols) */}
        <div className="lg:col-span-8">
          {selectedLetter ? (
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 space-y-6">
              {/* Header Info */}
              <div className="border-b border-slate-100 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span className="font-mono text-sm font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                    {selectedLetter.serial_number}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>{formatDate(selectedLetter.date)}</span>
                    <span>•</span>
                    <span className="font-semibold text-slate-700">{selectedLetter.source_or_dest_entity}</span>
                  </div>
                </div>
                <h3 className="text-xl font-black text-slate-900 leading-snug">{selectedLetter.subject}</h3>
              </div>

              {/* Briefing Note (مذكرة العرض المُعدة من السكرتير) */}
              <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-amber-200/60">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-700" />
                    <span className="text-xs font-bold text-amber-900">مذكرة العرض المقدمة لرئيس مجلس الإدارة</span>
                  </div>
                  {briefingNote && (
                    <span className="text-[11px] text-amber-800 font-medium">إعداد: {briefingNote.prepared_by_name}</span>
                  )}
                </div>

                {briefingNote ? (
                  <div className="space-y-3 text-xs leading-relaxed">
                    <div>
                      <span className="font-bold text-slate-900 block mb-0.5">خلفية الموضوع:</span>
                      <p className="text-slate-700">{briefingNote.background}</p>
                    </div>
                    <div>
                      <span className="font-bold text-emerald-900 block mb-0.5">توصية ورأي السكرتارية التنفيذية:</span>
                      <p className="text-emerald-900 font-medium bg-emerald-50/80 p-2.5 rounded-lg border border-emerald-200">
                        {briefingNote.secretary_recommendation}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-amber-800 italic">
                    تم تقديم المعاملة مباشرة للعرض الرئاسي دون إرفاق مذكرة عرض منفصلة.
                  </p>
                )}
              </div>

              {/* Big Action Buttons (Touch targets ≥ 48px, Maximum 3 taps to decision) */}
              <div>
                <div className="text-xs font-bold text-slate-600 mb-3 flex items-center justify-between">
                  <span>تأشيرة وتوجيه السيد رئيس مجلس الإدارة:</span>
                  <span className="text-[11px] text-slate-400 font-normal">انقر على الإجراء المطلوب لتثبيته في السجل</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button
                    onClick={() => openDecisionModal('approved')}
                    className="min-h-[56px] py-3.5 px-4 rounded-2xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-sm shadow-md shadow-emerald-900/20 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    <Check className="w-5 h-5" />
                    <span>موافق / اعتمد</span>
                  </button>

                  <button
                    onClick={() => openDecisionModal('referred')}
                    className="min-h-[56px] py-3.5 px-4 rounded-2xl bg-blue-700 hover:bg-blue-600 text-white font-bold text-sm shadow-md shadow-blue-900/20 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    <Send className="w-5 h-5" />
                    <span>إحالة للقطاع</span>
                  </button>

                  <button
                    onClick={() => openDecisionModal('postponed')}
                    className="min-h-[56px] py-3.5 px-4 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-md shadow-amber-900/20 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    <Clock className="w-5 h-5" />
                    <span>تأجيل للدراسة</span>
                  </button>

                  <button
                    onClick={() => openDecisionModal('rejected')}
                    className="min-h-[56px] py-3.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm shadow-md flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                    <span>يُحفظ / نعتذر</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-500">
              يرجى اختيار معاملة من القائمة لعرض تفاصيلها ومذكرتها.
            </div>
          )}
        </div>
      </div>

      {/* Decision / Endorsement Modal */}
      {isEndorsementModalOpen && selectedLetter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 text-right">
            <h3 className="text-lg font-black text-slate-900 mb-1">
              تسجيل تأشيرة رئيس مجلس الإدارة
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              المعاملة: {selectedLetter.serial_number} — {selectedLetter.subject}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  الصيغة الرسمية المعتمدة للتأشيرة:
                </label>
                <select
                  value={standardPhrase}
                  onChange={(e) => setStandardPhrase(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm font-semibold text-slate-800 focus:outline-none focus:border-emerald-600 cursor-pointer"
                >
                  <option value="موافق مع سرعة التنفيذ">موافق مع سرعة التنفيذ</option>
                  <option value="لاتخاذ اللازم والتنفيذ الفوري">لاتخاذ اللازم والتنفيذ الفوري</option>
                  <option value="للدراسة وإبداء الرأي في موعد أقصاه 48 ساعة">للدراسة وإبداء الرأي في موعد أقصاه 48 ساعة</option>
                  <option value="للإفادة العاجلة بما تم">للإفادة العاجلة بما تم</option>
                  <option value="للتنسيق مع القطاع المالي والميزانية">للتنسيق مع القطاع المالي والميزانية</option>
                  <option value="لإبداء الرأي القانوني بمعرفة الشؤون القانونية">لإبداء الرأي القانوني بمعرفة الشؤون القانونية</option>
                  <option value="تؤجل للمزيد من الدراسة والمراجعة">تؤجل للمزيد من الدراسة والمراجعة</option>
                  <option value="يُحفظ">يُحفظ</option>
                </select>
              </div>

              {decisionType === 'referred' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      القطاع المحال إليه:
                    </label>
                    <select
                      value={referralDepartment}
                      onChange={(e) => setReferralDepartment(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-semibold text-slate-800"
                    >
                      <option value="قطاع العمليات والخدمات البريدية">قطاع العمليات والخدمات البريدية</option>
                      <option value="قطاع التوفير والخدمات المالية">قطاع التوفير والخدمات المالية</option>
                      <option value="قطاع التحول الرقمي وتكنولوجيا المعلومات">قطاع التحول الرقمي وتكنولوجيا المعلومات</option>
                      <option value="الإدارة العامة للشؤون القانونية">الإدارة العامة للشؤون القانونية</option>
                      <option value="إدارة المشروعات والأصول الهندسية">إدارة المشروعات والأصول الهندسية</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      المهلة الزمنية:
                    </label>
                    <input
                      type="date"
                      value={referralDeadline}
                      onChange={(e) => setReferralDeadline(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  توجيه خطي إضافي أو ملاحظة للرئيس:
                </label>
                <textarea
                  value={customDirective}
                  onChange={(e) => setCustomDirective(e.target.value)}
                  placeholder="اكتب التوجيه الرئاسي الإضافي هنا..."
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={handleSaveDecision}
                  disabled={isSubmitting}
                  className="flex-1 py-3.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2 min-h-[48px]"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmitting ? 'جاري الاعتماد...' : 'تثبيت التأشيرة في السجل الرسمي'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEndorsementModalOpen(false)}
                  className="py-3.5 px-5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs cursor-pointer min-h-[48px]"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modals */}
      {detailMeeting && (
        <MeetingDetailModal
          meeting={detailMeeting}
          isOpen={Boolean(detailMeeting)}
          onClose={() => setDetailMeeting(null)}
          onMeetingUpdated={loadDashboardData}
        />
      )}
      {detailLetter && (
        <CorrespondenceDetailModal
          correspondence={detailLetter}
          isOpen={Boolean(detailLetter)}
          onClose={() => setDetailLetter(null)}
          onUpdated={loadDashboardData}
        />
      )}
      {detailDirective && (
        <DirectiveDetailModal
          directive={detailDirective}
          isOpen={Boolean(detailDirective)}
          onClose={() => setDetailDirective(null)}
          onUpdated={loadDashboardData}
        />
      )}
    </div>
  );
};
