import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../../i18n/i18nContext';
import {
  meetingRepo,
  directiveRepo,
  auditRepo,
  notificationRepo
} from '../../data/api/apiRepositories';
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
  Building,
  User,
  ArrowRight,
  Sparkles,
  Check,
  Layers,
  FileCheck,
  Send,
  Trash2,
  Lock,
  ShieldAlert
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

  const [activeTab, setActiveTab] = useState<'overview' | 'agenda' | 'attendees' | 'minutes' | 'decisions' | 'print'>('overview');
  const [attendees, setAttendees] = useState<MeetingAttendee[]>([]);
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [minutes, setMinutes] = useState<MeetingMinutes | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [currentStatus, setCurrentStatus] = useState<Meeting['status']>(meeting.status);

  // Forms State
  const [newAgendaTitle, setNewAgendaTitle] = useState('');
  const [newAgendaDuration, setNewAgendaDuration] = useState('15');
  const [newAgendaPresenter, setNewAgendaPresenter] = useState('');

  const [newAttendeeName, setNewAttendeeName] = useState('');
  const [newAttendeeTitle, setNewAttendeeTitle] = useState('');
  const [newAttendeeEntity, setNewAttendeeEntity] = useState('');
  const [isAttendeeExternal, setIsAttendeeExternal] = useState(false);

  const [draftMinutesContent, setDraftMinutesContent] = useState('');
  const [approvedMinutesContent, setApprovedMinutesContent] = useState('');

  const [newDecisionContent, setNewDecisionContent] = useState('');
  const [newDecisionDept, setNewDecisionDept] = useState('قطاع الشؤون المالية والادارية');
  const [newDecisionPerson, setNewDecisionPerson] = useState('');
  const [newDecisionDueDate, setNewDecisionDueDate] = useState('');

  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const getUserCtx = () => ({ can_view_confidential: Boolean(currentUser.can_view_confidential), role: currentUser.role, userId: currentUser.id });

  const loadDetails = async () => {
    const userCtx = getUserCtx();
    const [attList, agendaList, minObj, decList] = await Promise.all([
      meetingRepo.getAttendees(meeting.id, userCtx),
      meetingRepo.getAgenda(meeting.id, userCtx),
      meetingRepo.getMinutes(meeting.id, userCtx),
      meetingRepo.getDecisions(meeting.id, userCtx)
    ]);
    setAttendees(attList);
    setAgenda(agendaList);
    setMinutes(minObj);
    if (minObj) {
      setDraftMinutesContent(minObj.draft_content || '');
      setApprovedMinutesContent(minObj.approved_content || minObj.draft_content || '');
    }
    setDecisions(decList);
  };

  useEffect(() => {
    if (isOpen) {
      setCurrentStatus(meeting.status);
      loadDetails();
      setActionFeedback(null);
    }
  }, [isOpen, meeting.id]);

  if (!isOpen) return null;

  if (meeting.confidentiality !== 'normal' && !currentUser.can_view_confidential) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4" dir="rtl">
        <div className="bg-white rounded-3xl p-6 max-w-md w-full text-center space-y-4 shadow-2xl border border-rose-200">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">غير مصرح بالاطلاع</h3>
          <p className="text-xs text-slate-600">
            هذا الاجتماع محاط بتصنيف سري لا يمكن عرضه دون تفويض أمني معتمد.
          </p>
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    );
  }

  // --- Handlers ---
  const handleTransitionStatus = async (newStatus: Meeting['status'], label: string) => {
    const ctx = getUserCtx();
    await meetingRepo.update(meeting.id, { status: newStatus }, ctx);
    setCurrentStatus(newStatus);
    setActionFeedback(`تم تغيير حالة الاجتماع إلى: ${label}`);
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

    const ctx = getUserCtx();
    await meetingRepo.setAgenda(meeting.id, updated, ctx);
    setNewAgendaTitle('');
    setNewAgendaPresenter('');
    setActionFeedback('تمت إضافة بند جديد لجدول الأعمال بنجاح.');
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

    const ctx = getUserCtx();
    await meetingRepo.setAttendees(meeting.id, updated, ctx);
    setNewAttendeeName('');
    setNewAttendeeTitle('');
    setActionFeedback('تم قيد المشارك في قائمة الحضور الرسمية بنجاح.');
    await loadDetails();
  };

  const handleSaveDraftMinutes = async () => {
    const ctx = getUserCtx();
    await meetingRepo.saveMinutes({
      meeting_id: meeting.id,
      draft_content: draftMinutesContent,
      status: 'draft'
    }, ctx);

    await notificationRepo.create({
      recipient_role: 'CHAIRMAN',
      title: `مسودة محضر اجتماع جاهزة للاعتماد`,
      body: `تم تدوين مسودة محضر الاجتماع «${meeting.title}» ومتاحة الآن للمراجعة والاعتماد.`,
      confidentiality: meeting.confidentiality,
      is_read: false
    }, ctx);

    await loadDetails();
    setActionFeedback('تم حفظ مسودة محضر الاجتماع وإرسال إشعار للسيد رئيس مجلس الإدارة.');
  };

  const handleApproveMinutes = async () => {
    const approvalText = approvedMinutesContent || draftMinutesContent;
    const ctx = getUserCtx();
    await meetingRepo.saveMinutes({
      meeting_id: meeting.id,
      draft_content: draftMinutesContent,
      approved_content: approvalText,
      status: 'approved',
      approved_by: currentUser.name,
      approved_at: new Date().toISOString()
    }, ctx);

    await meetingRepo.update(meeting.id, { status: 'minutes_approved' }, ctx);
    setCurrentStatus('minutes_approved');

    await loadDetails();
    onMeetingUpdated();
    setActionFeedback('تم اعتماد محضر الجلسة رسمياً وتثبيت توقيع السيد رئيس مجلس الإدارة.');
  };

  const handleAddDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDecisionContent) return;

    const nextOrder = decisions.length + 1;
    const ctx = getUserCtx();
    await meetingRepo.addDecision({
      meeting_id: meeting.id,
      order_index: nextOrder,
      content: newDecisionContent,
      assigned_department_id: newDecisionDept,
      assigned_to_name: newDecisionPerson,
      due_date: newDecisionDueDate,
      status: 'in_progress'
    }, ctx);

    setNewDecisionContent('');
    setActionFeedback('تم قيد القرار التنفيذي بنجاح.');
    await loadDetails();
  };

  const handleConvertToDirective = async (decision: Decision) => {
    const nextCode = await directiveRepo.getNextCode();
    const ctx = getUserCtx();
    const createdDirective = await directiveRepo.create({
      code: nextCode,
      title: `تكليف تنفيذي ناتج عن اجتماع: ${meeting.title}`,
      instruction: decision.content,
      assigned_department: decision.assigned_department_id || 'قطاع العمليات والخدمات البريدية',
      assigned_person: decision.assigned_to_name || 'رئيس القطاع',
      source_type: 'meeting',
      source_id: meeting.id,
      priority: 'urgent',
      confidentiality: meeting.confidentiality,
      status: 'assigned',
      progress_percent: 0,
      issued_at: new Date().toISOString(),
      due_date: decision.due_date || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      matter_id: meeting.matter_id || null,
      created_by: currentUser.name
    }, ctx);

    setActionFeedback(`تم تحويل القرار بنجاح إلى تكليف رئاسي رسمي برمز: ${createdDirective.code}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-950 border border-emerald-600/40 flex items-center justify-center text-emerald-400 font-bold">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{meeting.title}</h3>
              <p className="text-xs text-emerald-400 font-medium">جلسة مجلس الإدارة والاجتماعات التنسيقية العليا</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-200 bg-slate-50 overflow-x-auto">
          {[
            { id: 'overview', label: 'تفاصيل الجلسة' },
            { id: 'agenda', label: `جدول الأعمال (${agenda.length})` },
            { id: 'attendees', label: `قائمة الحضور (${attendees.length})` },
            { id: 'minutes', label: 'محضر الجلسة' },
            { id: 'decisions', label: `القرارات التنفيذية (${decisions.length})` },
            { id: 'print', label: 'معاينة الطباعة والتوثيق' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 text-xs font-bold transition border-b-2 cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-emerald-600 text-emerald-800 bg-white rounded-t-xl'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
          {actionFeedback && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{actionFeedback}</span>
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                  <span className="text-slate-600 font-medium">موعد الانعقاد:</span>
                  <div className="text-sm font-bold text-slate-900 flex items-center gap-2 pt-1">
                    <Clock className="w-4 h-4 text-emerald-700" />
                    <span>{formatDate(meeting.start_time, { showTime: true })}</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                  <span className="text-slate-600 font-medium">المكان / قاعة الاجتماعات:</span>
                  <div className="text-sm font-bold text-slate-900 flex items-center gap-2 pt-1">
                    <MapPin className="w-4 h-4 text-emerald-700" />
                    <span>{meeting.location}</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                  <span className="text-slate-600 font-medium">حالة الجلسة الحالية:</span>
                  <div className="pt-1">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {currentStatus}
                    </span>
                  </div>
                </div>
              </div>

              {meeting.notes && (
                <div className="p-4 bg-emerald-950/5 border border-emerald-900/10 rounded-2xl space-y-2">
                  <span className="font-bold text-emerald-900">ملاحظات واشتراطات الجلسة:</span>
                  <p className="text-slate-800 leading-relaxed font-medium bg-white p-3 rounded-xl border border-emerald-900/10">
                    {meeting.notes}
                  </p>
                </div>
              )}

              {/* Status Switcher Actions */}
              <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-3 shadow-sm">
                <h4 className="font-bold text-slate-900">إدارة دورة حياة الاجتماع</h4>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleTransitionStatus('scheduled', 'مجدولة')}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold transition cursor-pointer"
                  >
                    جدولة الجلسة
                  </button>
                  <button
                    onClick={() => handleTransitionStatus('in_session', 'قيد الانعقاد حالياً')}
                    className="px-3.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold transition cursor-pointer"
                  >
                    بدء الانعقاد (In Session)
                  </button>
                  <button
                    onClick={() => handleTransitionStatus('minutes_drafted', 'رفعت الجلسة')}
                    className="px-3.5 py-2 rounded-xl bg-blue-100 hover:bg-blue-200 text-blue-900 font-bold transition cursor-pointer"
                  >
                    رفع الجلسة (Adjourned)
                  </button>
                  <button
                    onClick={() => handleTransitionStatus('minutes_approved', 'معتمدة المحضر')}
                    className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold transition cursor-pointer"
                  >
                    اعتماد المحضر نهائياً
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'agenda' && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h4 className="font-bold text-slate-900">بنود جدول الأعمال والموضوعات المعروضة</h4>
                {agenda.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 rounded-2xl text-slate-600 border border-slate-200">
                    لم تتم إضافة بنود لجدول الأعمال بعد.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {agenda.map((item, idx) => (
                      <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold font-mono">
                            {formatNumber(item.order_index)}
                          </span>
                          <div>
                            <h5 className="font-bold text-slate-900">{item.title}</h5>
                            <span className="text-[11px] text-slate-600">المقرر / العارض: {item.presenter}</span>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg bg-slate-200 text-slate-700 font-mono text-[11px]">
                          {formatNumber(item.duration_minutes)} دقيقة
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Agenda Form */}
              <form onSubmit={handleAddAgendaItem} className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-sm">
                <h4 className="font-bold text-slate-900">إضافة بند جديد لجدول الأعمال</h4>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">عنوان البند أو الموضوع:</label>
                  <input
                    type="text"
                    required
                    value={newAgendaTitle}
                    onChange={(e) => setNewAgendaTitle(e.target.value)}
                    placeholder="مثال: مناقشة الموازنة الاستثمارية للقطاع..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">المدة المقدرة (بالدقائق):</label>
                    <input
                      type="number"
                      value={newAgendaDuration}
                      onChange={(e) => setNewAgendaDuration(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">اسم العارض / المقرر:</label>
                    <input
                      type="text"
                      value={newAgendaPresenter}
                      onChange={(e) => setNewAgendaPresenter(e.target.value)}
                      placeholder={currentUser.name}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-xl transition shadow-sm cursor-pointer"
                  >
                    إضافة البند للقائمة
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'attendees' && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h4 className="font-bold text-slate-900">قائمة الحضور الرسمية وأعضاء المجلس</h4>
                {attendees.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 rounded-2xl text-slate-600 border border-slate-200">
                    لا توجد قائمة حضور مسجلة.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {attendees.map((att, idx) => (
                      <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                        <div className="space-y-0.5">
                          <h5 className="font-bold text-slate-900">{att.name}</h5>
                          <p className="text-[11px] text-slate-600">{att.title} — {att.entity}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          {att.attendance_status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Attendee Form */}
              <form onSubmit={handleAddAttendee} className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-sm">
                <h4 className="font-bold text-slate-900">قيد مشارك / ضيف جديد</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">اسم المشارك:</label>
                    <input
                      type="text"
                      required
                      value={newAttendeeName}
                      onChange={(e) => setNewAttendeeName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">الصفة / المسمى:</label>
                    <input
                      type="text"
                      value={newAttendeeTitle}
                      onChange={(e) => setNewAttendeeTitle(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">الجهة / القطاع:</label>
                    <input
                      type="text"
                      value={newAttendeeEntity}
                      onChange={(e) => setNewAttendeeEntity(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-xl transition shadow-sm cursor-pointer"
                  >
                    تسجيل الحضور
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'minutes' && (
            <div className="space-y-6">
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                <h4 className="font-bold text-slate-900">مسودة محضر الجلسة (تدوين السكرتارية التنفيذية)</h4>
                <textarea
                  rows={6}
                  value={draftMinutesContent}
                  onChange={(e) => setDraftMinutesContent(e.target.value)}
                  placeholder="اكتب مسودة ما دار في الاجتماع ومجريات النقاش..."
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-emerald-600 leading-relaxed"
                />
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={handleSaveDraftMinutes}
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition shadow-sm cursor-pointer"
                  >
                    حفظ مسودة المحضر وإرسالها للرئيس
                  </button>
                </div>
              </div>

              {currentUser.role === 'CHAIRMAN' && (
                <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-4">
                  <h4 className="font-bold text-emerald-950">اعتماد المحضر الرسمي وتوقيع رئيس مجلس الإدارة</h4>
                  <textarea
                    rows={6}
                    value={approvedMinutesContent}
                    onChange={(e) => setApprovedMinutesContent(e.target.value)}
                    placeholder="مراجعة المحضر وإقرار اعتماده..."
                    className="w-full bg-white border border-emerald-300 rounded-xl p-3 focus:outline-none focus:border-emerald-600 leading-relaxed"
                  />
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={handleApproveMinutes}
                      className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-xl transition shadow-sm cursor-pointer"
                    >
                      اعتماد وتوقيع المحضر رسمياً
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'decisions' && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h4 className="font-bold text-slate-900">القرارات التنفيذية الصادرة عن الجلسة</h4>
                {decisions.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 rounded-2xl text-slate-600 border border-slate-200">
                    لا توجد قرارات مسجلة لهذا الاجتماع بعد.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {decisions.map((dec) => (
                      <div key={dec.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <span className="text-[11px] font-mono font-bold text-emerald-800">قرار رقم ({formatNumber(dec.order_index)})</span>
                            <p className="text-slate-900 font-bold leading-relaxed">{dec.content}</p>
                            <p className="text-xs text-slate-600">المكلف بالتنفيذ: {dec.assigned_department_id} ({dec.assigned_to_name})</p>
                          </div>
                          <button
                            onClick={() => handleConvertToDirective(dec)}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer flex-shrink-0"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>تحويل لتكليف رئاسي</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Decision Form */}
              <form onSubmit={handleAddDecision} className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-sm">
                <h4 className="font-bold text-slate-900">إصدار وقيد قرار تنفيذي جديد</h4>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">نص القرار:</label>
                  <textarea
                    required
                    rows={2}
                    value={newDecisionContent}
                    onChange={(e) => setNewDecisionContent(e.target.value)}
                    placeholder="اكتب منطوق القرار..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">القطاع المكلف:</label>
                    <input
                      type="text"
                      value={newDecisionDept}
                      onChange={(e) => setNewDecisionDept(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">المسؤول:</label>
                    <input
                      type="text"
                      value={newDecisionPerson}
                      onChange={(e) => setNewDecisionPerson(e.target.value)}
                      placeholder="رئيس القطاع"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">تاريخ الاستحقاق:</label>
                    <input
                      type="date"
                      value={newDecisionDueDate}
                      onChange={(e) => setNewDecisionDueDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-xl transition shadow-sm cursor-pointer"
                  >
                    قيد القرار بالسجل
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'print' && (
            <div className="p-8 bg-white border border-slate-300 rounded-2xl space-y-6 text-slate-900 shadow-inner">
              <div className="text-center space-y-1 border-b border-slate-200 pb-4">
                <h3 className="font-bold text-sm">جمهورية مصر العربية — الهيئة القومية للبريد</h3>
                <h4 className="font-bold text-xs text-emerald-800">مكتب مساعد رئيس مجلس الإدارة</h4>
                <div className="text-[11px] font-mono text-slate-600 pt-1">محضر اجتماع رسمي معتمد: {meeting.title}</div>
              </div>
              <div className="space-y-3 text-xs">
                <div><strong>الموعد:</strong> {formatDate(meeting.start_time, { showTime: true })}</div>
                <div><strong>المكان:</strong> {meeting.location}</div>
                <div><strong>عدد الحضور:</strong> {attendees.length} مشاركاً</div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <strong>خلاصة المحضر:</strong>
                  <p className="leading-relaxed">{approvedMinutesContent || draftMinutesContent || 'لم يتم اعتماد محضر بعد.'}</p>
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-slate-800 transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة المحضر</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-mono">معرف الجلسة: {meeting.id}</span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold transition cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
