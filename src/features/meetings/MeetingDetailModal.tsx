import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../../i18n/i18nContext';
import {
  meetingRepo,
  directiveRepo,
  auditRepo,
  notificationRepo
} from '../../data/sqlite/repositories';
import { AuditLogger } from '../../domain/security/auditLogger';
import {
  Meeting,
  MeetingAttendee,
  AgendaItem,
  MeetingMinutes,
  Decision,
  Directive
} from '../../domain/types';
import {
  X,
  Calendar,
  Clock,
  MapPin,
  Users,
  FileText,
  CheckCircle2,
  AlertCircle,
  Plus,
  Printer,
  ShieldCheck,
  Send,
  Building,
  UserCheck,
  CheckSquare,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface MeetingDetailModalProps {
  meeting: Meeting;
  isOpen: boolean;
  onClose: () => void;
  onMeetingUpdated: () => void;
}

export const MeetingDetailModal: React.FC<MeetingDetailModalProps> = ({
  meeting,
  isOpen,
  onClose,
  onMeetingUpdated
}) => {
  const { currentUser } = useAuth();
  const { t, formatNumber, formatDate } = useI18n();

  const [activeTab, setActiveTab] = useState<'agenda' | 'attendees' | 'minutes' | 'decisions' | 'print'>('agenda');

  const [attendees, setAttendees] = useState<MeetingAttendee[]>([]);
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [minutes, setMinutes] = useState<MeetingMinutes | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [currentStatus, setCurrentStatus] = useState(meeting.status);

  // Form states
  const [newAgendaTitle, setNewAgendaTitle] = useState('');
  const [newAgendaDuration, setNewAgendaDuration] = useState(15);
  const [newAgendaPresenter, setNewAgendaPresenter] = useState('');

  const [newAttendeeName, setNewAttendeeName] = useState('');
  const [newAttendeeTitle, setNewAttendeeTitle] = useState('');
  const [newAttendeeEntity, setNewAttendeeEntity] = useState('الهيئة القومية للبريد');
  const [isAttendeeExternal, setIsAttendeeExternal] = useState(false);

  const [draftMinutesContent, setDraftMinutesContent] = useState('');
  const [approvedMinutesContent, setApprovedMinutesContent] = useState('');

  const [newDecisionContent, setNewDecisionContent] = useState('');
  const [newDecisionDept, setNewDecisionDept] = useState('قطاع العمليات والخدمات البريدية');
  const [newDecisionPerson, setNewDecisionPerson] = useState('رئيس قطاع العمليات');
  const [newDecisionDueDate, setNewDecisionDueDate] = useState('2026-10-20');

  const isChairman = currentUser.role === 'CHAIRMAN';
  const isSecretary = currentUser.role === 'SECRETARY';

  const loadDetails = async () => {
    const [attList, agList, minData, decList] = await Promise.all([
      meetingRepo.getAttendees(meeting.id),
      meetingRepo.getAgenda(meeting.id),
      meetingRepo.getMinutes(meeting.id),
      meetingRepo.getDecisions(meeting.id)
    ]);

    setAttendees(attList);
    setAgenda(agList);
    setMinutes(minData);
    setDecisions(decList);
    if (minData) {
      setDraftMinutesContent(minData.draft_content || '');
      setApprovedMinutesContent(minData.approved_content || '');
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDetails();
      setCurrentStatus(meeting.status);
    }
  }, [isOpen, meeting.id]);

  if (!isOpen) return null;

  // --- Handlers ---
  const handleTransitionStatus = async (newStatus: Meeting['status'], label: string) => {
    await meetingRepo.update(meeting.id, { status: newStatus });
    setCurrentStatus(newStatus);

    await auditRepo.log({
      user_id: currentUser.id,
      user_name: currentUser.name,
      user_role: currentUser.role,
      action_type: 'UPDATE',
      entity_type: 'MEETING_STATUS',
      entity_id: meeting.id,
      before_value: `الحالة السابقة: ${currentStatus}`,
      after_value: `تغيير حالة الاجتماع إلى: ${label}`,
      ip_address: '10.120.4.x (LAN)'
    });

    onMeetingUpdated();
  };

  const handleAddAgendaItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgendaTitle) return;

    const nextOrder = agenda.length + 1;
    const updated = [
      ...agenda,
      {
        order_index: nextOrder,
        title: newAgendaTitle,
        duration_minutes: Number(newAgendaDuration) || 15,
        presenter: newAgendaPresenter || currentUser.name
      }
    ];

    await meetingRepo.setAgenda(meeting.id, updated);
    await auditRepo.log({
      user_id: currentUser.id,
      user_name: currentUser.name,
      user_role: currentUser.role,
      action_type: 'CREATE',
      entity_type: 'AGENDA_ITEM',
      entity_id: meeting.id,
      before_value: null,
      after_value: `إضافة بند للأجندة: ${newAgendaTitle} (${newAgendaDuration} دقيقة)`,
      ip_address: '10.120.4.x (LAN)'
    });

    setNewAgendaTitle('');
    setNewAgendaPresenter('');
    await loadDetails();
  };

  const handleAddAttendee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAttendeeName) return;

    const updated = [
      ...attendees,
      {
        name: newAttendeeName,
        title: newAttendeeTitle || 'مشارك',
        entity: newAttendeeEntity || 'الهيئة القومية للبريد',
        is_external: isAttendeeExternal,
        attendance_status: 'confirmed' as const
      }
    ];

    await meetingRepo.setAttendees(meeting.id, updated);
    await auditRepo.log({
      user_id: currentUser.id,
      user_name: currentUser.name,
      user_role: currentUser.role,
      action_type: 'CREATE',
      entity_type: 'MEETING_ATTENDEE',
      entity_id: meeting.id,
      before_value: null,
      after_value: `إضافة مشارك للاجتماع: ${newAttendeeName} (${newAttendeeTitle} - ${newAttendeeEntity})`,
      ip_address: '10.120.4.x (LAN)'
    });

    setNewAttendeeName('');
    setNewAttendeeTitle('');
    await loadDetails();
  };

  const handleSaveDraftMinutes = async () => {
    await meetingRepo.saveMinutes({
      meeting_id: meeting.id,
      draft_content: draftMinutesContent,
      status: 'draft'
    });

    await auditRepo.log({
      user_id: currentUser.id,
      user_name: currentUser.name,
      user_role: currentUser.role,
      action_type: 'UPDATE',
      entity_type: 'MEETING_MINUTES',
      entity_id: meeting.id,
      before_value: null,
      after_value: 'حفظ مسودة محضر الجلسة بواسطة السكرتارية التنفيذية',
      ip_address: '10.120.4.x (LAN)'
    });

    await notificationRepo.create({
      recipient_role: 'CHAIRMAN',
      title: `مسودة محضر اجتماع جاهزة للاعتماد`,
      body: `تم تدوين مسودة محضر الاجتماع «${meeting.title}» ومتاحة الآن للمراجعة والاعتماد.`,
      confidentiality: meeting.confidentiality,
      is_read: false
    });

    await loadDetails();
    alert('تم حفظ مسودة محضر الاجتماع وإرسال إشعار للسيد رئيس مجلس الإدارة.');
  };

  const handleApproveMinutes = async () => {
    const approvalText = approvedMinutesContent || draftMinutesContent;
    await meetingRepo.saveMinutes({
      meeting_id: meeting.id,
      draft_content: draftMinutesContent,
      approved_content: approvalText,
      status: 'approved',
      approved_by: currentUser.name,
      approved_at: new Date().toISOString()
    });

    await meetingRepo.update(meeting.id, { status: 'minutes_approved' });
    setCurrentStatus('minutes_approved');

    await auditRepo.log({
      user_id: currentUser.id,
      user_name: currentUser.name,
      user_role: currentUser.role,
      action_type: 'DECIDE',
      entity_type: 'MEETING_MINUTES',
      entity_id: meeting.id,
      before_value: 'مسودة محضر الجلسة',
      after_value: `اعتماد محضر الاجتماع رسمياً من رئيس مجلس الإدارة: ${meeting.title}`,
      ip_address: '10.120.4.10 (المكتب الرئاسي)'
    });

    await loadDetails();
    onMeetingUpdated();
    alert('تم اعتماد محضر الجلسة رسمياً وتثبيت توقيع السيد رئيس مجلس الإدارة.');
  };

  const handleAddDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDecisionContent) return;

    const nextOrder = decisions.length + 1;
    await meetingRepo.addDecision({
      meeting_id: meeting.id,
      order_index: nextOrder,
      content: newDecisionContent,
      assigned_department_id: newDecisionDept,
      assigned_to_name: newDecisionPerson,
      due_date: newDecisionDueDate,
      status: 'in_progress'
    });

    await auditRepo.log({
      user_id: currentUser.id,
      user_name: currentUser.name,
      user_role: currentUser.role,
      action_type: 'CREATE',
      entity_type: 'MEETING_DECISION',
      entity_id: meeting.id,
      before_value: null,
      after_value: `تسجيل قرار اجتماع: ${newDecisionContent} (المكلف: ${newDecisionPerson})`,
      ip_address: '10.120.4.x (LAN)'
    });

    setNewDecisionContent('');
    await loadDetails();
  };

  const handleConvertToDirective = async (decision: Decision) => {
    const nextCode = await directiveRepo.getNextCode();
    const createdDirective = await directiveRepo.create({
      code: nextCode,
      title: `تكليف تنفيذي ناتج عن اجتماع: ${meeting.title}`,
      instruction: decision.content,
      assigned_department: decision.assigned_department_id || 'قطاع العمليات والخدمات البريدية',
      assigned_person: decision.assigned_to_name,
      source_type: 'meeting',
      source_id: meeting.id,
      priority: 'urgent',
      confidentiality: meeting.confidentiality,
      status: 'assigned',
      progress_percent: 0,
      issued_at: new Date().toISOString(),
      due_date: decision.due_date,
      matter_id: meeting.matter_id || null,
      created_by: currentUser.name
    });

    await AuditLogger.logDirectiveCreation(currentUser, createdDirective);

    await loadDetails();
    alert(`تم تحويل القرار بنجاح إلى التكليف الرئاسي الرسمي رقم ${createdDirective.code}.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-right flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-emerald-950 text-white p-5 flex items-start justify-between border-b border-emerald-900">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-800 text-emerald-200 border border-emerald-700">
                {meeting.meeting_type === 'board'
                  ? 'جلسة مجلس إدارة'
                  : meeting.meeting_type === 'external_entity'
                  ? 'جهة خارجية'
                  : meeting.meeting_type === 'ministerial'
                  ? 'لقاء وزاري'
                  : 'اجتماع داخلي'}
              </span>
              <span className="px-2.5 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-amber-300">
                {currentStatus === 'confirmed'
                  ? 'مؤكد وجاهز'
                  : currentStatus === 'in_session'
                  ? 'منعقد حالياً'
                  : currentStatus === 'minutes_approved'
                  ? 'المحضر معتمد رسمياً'
                  : currentStatus === 'minutes_drafted'
                  ? 'المحضر مسودة'
                  : 'مجدول مبدئياً'}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-100">{meeting.title}</h2>
            <div className="flex flex-wrap items-center gap-4 text-xs text-emerald-300/80 pt-1">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>{formatDate(meeting.start_time, { showTime: true })}</span>
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>{meeting.location}</span>
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-emerald-900 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workflow Lifecycle Transition Bar */}
        <div className="bg-slate-50 px-5 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="font-semibold text-slate-700">دورة سير الاجتماع:</div>
          <div className="flex items-center gap-1.5">
            {currentStatus === 'scheduled' && (
              <button
                onClick={() => handleTransitionStatus('confirmed', 'مؤكد')}
                className="px-3 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold transition cursor-pointer"
              >
                {t('meetings.transition_confirm')}
              </button>
            )}
            {currentStatus === 'confirmed' && (
              <button
                onClick={() => handleTransitionStatus('in_session', 'منعقد')}
                className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold transition cursor-pointer flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t('meetings.transition_start')}</span>
              </button>
            )}
            {currentStatus === 'in_session' && (
              <button
                onClick={() => handleTransitionStatus('minutes_drafted', 'المحضر مسودة')}
                className="px-3 py-1 rounded-lg bg-blue-700 hover:bg-blue-600 text-white font-bold transition cursor-pointer"
              >
                {t('meetings.transition_finish')}
              </button>
            )}
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="flex border-b border-slate-200 bg-white px-5 gap-2 overflow-x-auto text-xs font-semibold">
          {[
            { id: 'agenda', label: t('meetings.agenda_tab'), count: agenda.length },
            { id: 'attendees', label: t('meetings.attendees_tab'), count: attendees.length },
            { id: 'minutes', label: t('meetings.minutes_tab') },
            { id: 'decisions', label: t('meetings.decisions_tab'), count: decisions.length },
            { id: 'print', label: t('meetings.print_agenda') }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-4 border-b-2 transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'border-emerald-700 text-emerald-800 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 text-[10px]">
                  {formatNumber(tab.count)}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="p-5 flex-1 overflow-y-auto space-y-6">
          {/* TAB 1: AGENDA */}
          {activeTab === 'agenda' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">بنود جدول الأعمال المقررة</h3>
                <span className="text-xs text-slate-500">
                  إجمالي المدة المقدرة: {formatNumber(agenda.reduce((acc, cur) => acc + cur.duration_minutes, 0))} دقيقة
                </span>
              </div>

              <div className="space-y-2.5">
                {agenda.map((item) => (
                  <div
                    key={item.id || item.order_index}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex items-start justify-between gap-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-lg bg-emerald-800 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                        {formatNumber(item.order_index)}
                      </span>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{item.title}</h4>
                        {item.description && <p className="text-[11px] text-slate-500 mt-0.5">{item.description}</p>}
                        <div className="text-[11px] text-emerald-700 font-medium mt-1">
                          المتحدث / المسؤول: {item.presenter}
                        </div>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 whitespace-nowrap">
                      {formatNumber(item.duration_minutes)} دقيقة
                    </span>
                  </div>
                ))}
              </div>

              {/* Add Agenda Item Form (Secretary) */}
              {isSecretary && (
                <form onSubmit={handleAddAgendaItem} className="p-4 rounded-xl bg-slate-100/70 border border-slate-200 space-y-3">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-emerald-700" />
                    <span>{t('meetings.add_agenda_item')}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-6">
                      <input
                        type="text"
                        required
                        placeholder="عنوان البند والموضوع المراد مناقشته..."
                        value={newAgendaTitle}
                        onChange={(e) => setNewAgendaTitle(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        type="text"
                        placeholder="اسم المتحدث / المسؤول..."
                        value={newAgendaPresenter}
                        onChange={(e) => setNewAgendaPresenter(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="number"
                        min="5"
                        step="5"
                        placeholder="المدة (د)"
                        value={newAgendaDuration}
                        onChange={(e) => setNewAgendaDuration(Number(e.target.value))}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 text-center"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <button
                        type="submit"
                        className="w-full h-full py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        إضافة
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: ATTENDEES */}
          {activeTab === 'attendees' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">المشاركون والضيوف</h3>
                <span className="text-xs text-slate-500">إجمالي المدعوين: {formatNumber(attendees.length)}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {attendees.map((att) => (
                  <div
                    key={att.id || att.name}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                        {att.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">{att.name}</div>
                        <div className="text-[11px] text-slate-500">{att.title} — {att.entity}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {att.is_external ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          جهة خارجية
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          البريد المصري
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Attendee Form */}
              {isSecretary && (
                <form onSubmit={handleAddAttendee} className="p-4 rounded-xl bg-slate-100/70 border border-slate-200 space-y-3">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-emerald-700" />
                    <span>{t('meetings.add_attendee')}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-4">
                      <input
                        type="text"
                        required
                        placeholder="الاسم الثلاثي..."
                        value={newAttendeeName}
                        onChange={(e) => setNewAttendeeName(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        type="text"
                        placeholder="الصفة / المنصب..."
                        value={newAttendeeTitle}
                        onChange={(e) => setNewAttendeeTitle(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        type="text"
                        placeholder="الجهة..."
                        value={newAttendeeEntity}
                        onChange={(e) => setNewAttendeeEntity(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <button
                        type="submit"
                        className="w-full h-full py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        إضافة
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 3: MINUTES & SIGNOFF */}
          {activeTab === 'minutes' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">محضر الجلسة الرسمي والاعتماد</h3>
                {minutes?.status === 'approved' ? (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>معتمد رسمياً من رئيس مجلس الإدارة</span>
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    مسودة قيد المراجعة
                  </span>
                )}
              </div>

              {/* Secretary Draft Studio */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  نص مسودة المحضر (تدوين السكرتارية):
                </label>
                <textarea
                  value={draftMinutesContent}
                  onChange={(e) => setDraftMinutesContent(e.target.value)}
                  disabled={!isSecretary && minutes?.status === 'approved'}
                  placeholder={t('meetings.draft_minutes_placeholder')}
                  rows={5}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs leading-relaxed text-slate-800 focus:outline-none focus:border-emerald-600"
                />
                {isSecretary && (
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleSaveDraftMinutes}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer"
                    >
                      {t('meetings.save_draft_minutes')}
                    </button>
                  </div>
                )}
              </div>

              {/* Chairman Signoff & Approval */}
              {isChairman && (
                <div className="mt-4 p-5 rounded-2xl bg-amber-50/70 border border-amber-300 space-y-3">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                    <ShieldCheck className="w-4 h-4 text-amber-700" />
                    <span>اعتماد رئيس مجلس الإدارة:</span>
                  </div>
                  <p className="text-xs text-amber-800">
                    بالنقر على زر الاعتماد أدناه، يتم توثيق المحضر رسمياً بصفة نهائية وتسجيله في سجل الرقابة الحكومي.
                  </p>
                  <button
                    onClick={handleApproveMinutes}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-800 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{t('meetings.approve_minutes_btn')}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: DECISIONS & DIRECTIVES */}
          {activeTab === 'decisions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">القرارات الصادرة ومتابعة تحويلها لتكليفات</h3>
                <span className="text-xs text-slate-500">إجمالي القرارات: {formatNumber(decisions.length)}</span>
              </div>

              <div className="space-y-3">
                {decisions.map((dec) => (
                  <div
                    key={dec.id || dec.order_index}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-2.5">
                        <span className="w-6 h-6 rounded bg-purple-100 text-purple-900 font-bold text-xs flex items-center justify-center flex-shrink-0">
                          {formatNumber(dec.order_index)}
                        </span>
                        <div className="text-xs font-bold text-slate-900">{dec.content}</div>
                      </div>

                      {/* Convert to Directive Button */}
                      <button
                        onClick={() => handleConvertToDirective(dec)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white text-[11px] font-bold transition flex items-center gap-1 whitespace-nowrap cursor-pointer"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        <span>{t('meetings.convert_to_directive')}</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-600 pt-1 border-t border-slate-200">
                      <span>المسؤول: <strong className="text-slate-800">{dec.assigned_to_name}</strong></span>
                      <span>تاريخ الاستحقاق: <strong className="text-slate-800">{formatDate(dec.due_date)}</strong></span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Decision Form */}
              <form onSubmit={handleAddDecision} className="p-4 rounded-xl bg-slate-100/70 border border-slate-200 space-y-3">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-purple-700" />
                  <span>{t('meetings.add_decision')}</span>
                </div>
                <div>
                  <textarea
                    required
                    placeholder="نص القرار التنفيذي الصادر عن الاجتماع..."
                    value={newDecisionContent}
                    onChange={(e) => setNewDecisionContent(e.target.value)}
                    rows={2}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="المسؤول عن التنفيذ..."
                    value={newDecisionPerson}
                    onChange={(e) => setNewDecisionPerson(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                  />
                  <input
                    type="date"
                    required
                    value={newDecisionDueDate}
                    onChange={(e) => setNewDecisionDueDate(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                  />
                  <button
                    type="submit"
                    className="py-2 bg-purple-800 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    حفظ القرار
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 5: PRINT-READY AGENDA */}
          {activeTab === 'print' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer shadow"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة ملف الجلسة الرسمي (PDF)</span>
                </button>
              </div>

              {/* Printable Official Agenda Docket */}
              <div className="bg-white border-2 border-slate-800 p-8 rounded-2xl text-slate-900 space-y-6 print:border-none print:p-0">
                <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
                  <div>
                    <h3 className="font-extrabold text-base">الهيئة القومية للبريد المصري</h3>
                    <h4 className="text-xs font-bold text-slate-700">مكتب رئيس مجلس الإدارة</h4>
                    <div className="text-[11px] text-slate-500 mt-1">بطاقة جدول أعمال الاجتماع الرسمي</div>
                  </div>
                  <div className="text-left text-xs font-mono">
                    <div>التاريخ: {formatDate(meeting.start_time)}</div>
                    <div>المكان: {meeting.location}</div>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-sm text-slate-900 mb-1">موضوع الاجتماع: {meeting.title}</h4>
                  <div className="text-xs text-slate-600">
                    التوقيت: {formatDate(meeting.start_time, { showTime: true })} حتى {meeting.end_time.split('T')[1]}
                  </div>
                </div>

                <div>
                  <h5 className="font-bold text-xs text-slate-800 mb-2 border-b pb-1">جدول الأعمال:</h5>
                  <div className="space-y-2 text-xs">
                    {agenda.map((ag) => (
                      <div key={ag.id} className="flex justify-between border-b border-slate-100 pb-1">
                        <span>{formatNumber(ag.order_index)}. {ag.title}</span>
                        <span className="font-mono text-slate-500">{formatNumber(ag.duration_minutes)} دقيقة</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h5 className="font-bold text-xs text-slate-800 mb-2 border-b pb-1">قائمة المشاركين:</h5>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {attendees.map((att) => (
                      <div key={att.id} className="text-slate-700">
                        • {att.name} ({att.title} - {att.entity})
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-8 flex justify-between text-xs text-center border-t border-slate-300">
                  <div>
                    <div className="text-slate-500 mb-8">أمين السر / سكرتير أول</div>
                    <div className="font-bold">الأستاذة / ميادة أحمد رضوان</div>
                  </div>
                  <div>
                    <div className="text-slate-500 mb-8">رئيس مجلس الإدارة</div>
                    <div className="font-bold">السيد الأستاذ / طارق محمود الشناوي</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-between items-center text-xs">
          <span className="text-slate-500">
            معرف السجل: <strong className="font-mono">{meeting.id}</strong>
          </span>
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
