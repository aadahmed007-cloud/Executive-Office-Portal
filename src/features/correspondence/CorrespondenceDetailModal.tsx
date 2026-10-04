import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../../i18n/i18nContext';
import {
  correspondenceRepo,
  directiveRepo,
  auditRepo,
  notificationRepo,
  matterRepo
} from '../../data/sqlite/repositories';
import { CommandService } from '../../domain/services/commandService';
import {
  Correspondence,
  BriefingNote,
  Approval,
  CorrespondenceRouting,
  Attachment,
  Matter
} from '../../domain/types';
import {
  X,
  Inbox,
  Send,
  FileText,
  ShieldCheck,
  Building2,
  Clock,
  Calendar,
  AlertTriangle,
  Lock,
  Printer,
  CheckCircle2,
  FileSpreadsheet,
  Paperclip,
  Check,
  FolderGit2,
  ArrowRight,
  ShieldAlert,
  Tag,
  Layers,
  Plus
} from 'lucide-react';

const PRESET_QUICK_TAGS = [
  'عاجل جداً',
  'سري للغاية',
  'روتيني / عادي',
  'متابعة مجلس الوزراء',
  'جلسة مجلس الإدارة',
  'مهلة حرجة 48 ساعة',
  'جاهز للتأشيرة',
  'خطة استثمارية'
];

interface CorrespondenceDetailModalProps {
  correspondence: Correspondence;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export const CorrespondenceDetailModal: React.FC<CorrespondenceDetailModalProps> = ({
  correspondence,
  isOpen,
  onClose,
  onUpdated
}) => {
  const { currentUser } = useAuth();
  const { t, formatNumber, formatDate } = useI18n();

  const [activeTab, setActiveTab] = useState<'details' | 'briefing' | 'approval' | 'routing' | 'print'>('details');

  const [briefingNote, setBriefingNote] = useState<BriefingNote | null>(null);
  const [approval, setApproval] = useState<Approval | null>(null);
  const [routings, setRoutings] = useState<CorrespondenceRouting[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [linkedMatter, setLinkedMatter] = useState<Matter | null>(null);
  const [currentStatus, setCurrentStatus] = useState(correspondence.status);
  const [currentTags, setCurrentTags] = useState<string[]>(correspondence.tags || []);
  const [currentCategory, setCurrentCategory] = useState<string>(correspondence.category || 'operations');
  const [tagInput, setTagInput] = useState('');

  // Briefing Form State
  const [background, setBackground] = useState('');
  const [secretaryRec, setSecretaryRec] = useState('');
  const [execOpinion, setExecOpinion] = useState('');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Approval Form State (Chairman)
  const [decisionType, setDecisionType] = useState<'approved' | 'rejected' | 'postponed' | 'referred'>('approved');
  const [standardPhrase, setStandardPhrase] = useState('موافق مع سرعة التنفيذ');
  const [customDirective, setCustomDirective] = useState('');
  const [referralDept, setReferralDept] = useState('قطاع العمليات والخدمات البريدية');
  const [referralDeadline, setReferralDeadline] = useState('2026-10-15');

  // Routing Form State
  const [newRoutingTo, setNewRoutingTo] = useState('قطاع التحول الرقمي وتكنولوجيا المعلومات');
  const [newRoutingAction, setNewRoutingAction] = useState('');
  const [newRoutingDeadline, setNewRoutingDeadline] = useState('2026-10-20');

  // Attachment Mock Form State
  const [newFileName, setNewFileName] = useState('');
  const [newFileSize, setNewFileSize] = useState(250);

  const isChairman = currentUser.role === 'CHAIRMAN';
  const isSecretary = currentUser.role === 'SECRETARY';

  const loadData = async () => {
    const userCtx = { can_view_confidential: currentUser.can_view_confidential, role: currentUser.role, userId: currentUser.id };
    const [note, appr, routList, attList] = await Promise.all([
      correspondenceRepo.getBriefingNote(correspondence.id, userCtx),
      correspondenceRepo.getApproval(correspondence.id, userCtx),
      correspondenceRepo.getRoutings(correspondence.id, userCtx),
      correspondenceRepo.getAttachments(correspondence.id, userCtx)
    ]);

    setBriefingNote(note);
    setApproval(appr);
    setRoutings(routList);
    setAttachments(attList);

    if (note) {
      setBackground(note.background || '');
      setSecretaryRec(note.secretary_recommendation || '');
      setExecOpinion(note.executive_opinion || '');
    }

    if (correspondence.matter_id) {
      matterRepo.getById(correspondence.matter_id, userCtx).then((m) => setLinkedMatter(m));
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      setCurrentStatus(correspondence.status);
    }
  }, [isOpen, correspondence.id]);

  if (!isOpen) return null;

  if (correspondence.confidentiality !== 'normal' && !currentUser.can_view_confidential) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4" dir="rtl">
        <div className="bg-white rounded-3xl p-6 max-w-md w-full text-center space-y-4 shadow-2xl border border-rose-200">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">غير مصرح بالاطلاع</h3>
          <p className="text-xs text-slate-600">
            هذه المعاملة مصنفة بدرجة سرية تتطلب تصريحاً أمنياً معتمداً من مكتب رئيس مجلس الإدارة.
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
  const handleSaveBriefingNote = async (presentToChairman: boolean = false) => {
    await CommandService.saveBriefingNote({
      correspondence_id: correspondence.id,
      background,
      secretary_recommendation: secretaryRec,
      executive_opinion: execOpinion,
      prepared_by_name: currentUser.name,
      prepared_at: new Date().toISOString()
    }, currentUser);

    const newStatus = presentToChairman ? 'presented_to_chairman' : 'briefing_prepared';
    await CommandService.updateCorrespondence(correspondence.id, { status: newStatus }, currentUser);
    setCurrentStatus(newStatus);

    if (presentToChairman) {
      await CommandService.createNotification({
        recipient_role: 'CHAIRMAN',
        title: `مذكرة عرض جديدة جاهزة للتأشيرة (${correspondence.serial_number})`,
        body: `تم إعداد مذكرة العرض الخاصة بـ «${correspondence.subject}» وجاهزة لاتخاذ القرار.`,
        confidentiality: correspondence.confidentiality,
        is_read: false
      }, currentUser);
      setActionFeedback('تم تقديم مذكرة العرض رسمياً على شاشة السيد رئيس مجلس الإدارة.');
    } else {
      setActionFeedback('تم حفظ مسودة مذكرة العرض بنجاح.');
    }

    await loadData();
    onUpdated();
  };

  const handleRecordEndorsement = async () => {
    const phraseText = `${standardPhrase}${customDirective ? ` - ${customDirective}` : ''}`;

    await CommandService.recordApproval({
      correspondence_id: correspondence.id,
      decision_type: decisionType,
      standard_phrase: standardPhrase,
      custom_directive: customDirective,
      decided_at: new Date().toISOString(),
      decided_by_name: currentUser.name
    }, currentUser);

    const nextStatus = decisionType === 'approved' ? 'approved' : decisionType === 'rejected' ? 'rejected' : decisionType === 'postponed' ? 'postponed' : 'referred';
    await CommandService.updateCorrespondence(correspondence.id, { status: nextStatus }, currentUser);
    setCurrentStatus(nextStatus);

    // If referral, auto add routing entry & directive
    if (decisionType === 'referred' || (decisionType === 'approved' && customDirective)) {
      await CommandService.addRouting({
        correspondence_id: correspondence.id,
        from_entity: 'مكتب رئيس مجلس الإدارة',
        to_department_id: 'dept-auto',
        to_department_name: referralDept,
        action_required: phraseText,
        deadline: referralDeadline,
        status: 'sent',
        routed_at: new Date().toISOString()
      }, currentUser);

      const nextCode = await directiveRepo.getNextCode();
      await CommandService.createDirective({
        code: nextCode,
        title: `تكليف رئاسي بشأن: ${correspondence.subject}`,
        instruction: phraseText,
        assigned_department: referralDept,
        assigned_person: 'رئيس القطاع المختص',
        source_type: 'correspondence',
        source_id: correspondence.id,
        priority: correspondence.priority,
        confidentiality: correspondence.confidentiality,
        status: 'new',
        progress_percent: 0,
        issued_at: new Date().toISOString(),
        due_date: referralDeadline,
        matter_id: correspondence.matter_id || null,
        created_by: currentUser.name
      }, currentUser);
    }

    await CommandService.createNotification({
      recipient_role: 'SECRETARY',
      title: `تأشيرة رئيس مجلس الإدارة على الخطاب ${correspondence.serial_number}`,
      body: `أصدر السيد رئيس المجلس تأشيرة: ${phraseText}`,
      confidentiality: correspondence.confidentiality,
      is_read: false
    }, currentUser);

    await loadData();
    onUpdated();
    setActionFeedback('تم تثبيت تأشيرة السيد رئيس مجلس الإدارة في السجل الرسمي بنجاح.');
  };

  const handleAddRouting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoutingAction) return;

    await CommandService.addRouting({
      correspondence_id: correspondence.id,
      from_entity: 'مكتب رئيس مجلس الإدارة',
      to_department_id: 'dept-manual',
      to_department_name: newRoutingTo,
      action_required: newRoutingAction,
      deadline: newRoutingDeadline,
      status: 'sent',
      routed_at: new Date().toISOString()
    }, currentUser);

    setNewRoutingAction('');
    setActionFeedback('تم تسجيل إحالة المعاملة بنجاح.');
    await loadData();
  };

  const handleAddAttachment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName) return;

    await CommandService.addAttachment({
      entity_type: 'correspondence',
      entity_id: correspondence.id,
      file_name: newFileName,
      file_size_kb: newFileSize,
      mime_type: 'application/pdf',
      confidentiality: correspondence.confidentiality,
      uploaded_at: new Date().toISOString()
    }, currentUser);

    setNewFileName('');
    setActionFeedback('تم إرفاق المستند الرسمي بنجاح.');
    await loadData();
  };

  const handleAddTag = async (tagText: string) => {
    const trimmed = tagText.trim();
    if (!trimmed || currentTags.includes(trimmed)) return;
    const updated = [...currentTags, trimmed];
    setCurrentTags(updated);
    await CommandService.updateCorrespondence(correspondence.id, { tags: updated }, currentUser);
    setTagInput('');
    onUpdated();
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    const updated = currentTags.filter((t) => t !== tagToRemove);
    setCurrentTags(updated);
    await CommandService.updateCorrespondence(correspondence.id, { tags: updated }, currentUser);
    onUpdated();
  };

  const getCategoryName = (cat?: string) => {
    switch (cat) {
      case 'financial':
        return t('correspondence_module.category_financial');
      case 'legal':
        return t('correspondence_module.category_legal');
      case 'technology':
        return t('correspondence_module.category_technology');
      case 'sovereign':
        return t('correspondence_module.category_sovereign');
      case 'projects':
        return t('correspondence_module.category_projects');
      case 'citizens':
        return t('correspondence_module.category_citizens');
      case 'operations':
      default:
        return t('correspondence_module.category_operations');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-right flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-emerald-950 text-white p-5 flex items-start justify-between border-b border-emerald-900">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold bg-emerald-800 text-emerald-200 px-2.5 py-0.5 rounded-full border border-emerald-700">
                {correspondence.serial_number}
              </span>
              <span className="px-2.5 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-amber-300">
                {correspondence.type === 'incoming' ? 'وارد رسمي' : 'صادر رسمي'}
              </span>
              <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-900 text-emerald-200 border border-emerald-700">
                {getCategoryName(currentCategory)}
              </span>
              {correspondence.priority === 'top_urgent' && (
                <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-rose-900 text-rose-200 border border-rose-700">
                  عاجل جداً
                </span>
              )}
              {correspondence.confidentiality !== 'normal' && (
                <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-purple-900 text-purple-200 border border-purple-700 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  <span>{correspondence.confidentiality === 'top_secret' ? 'سري للغاية' : 'سري'}</span>
                </span>
              )}
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-slate-100">{correspondence.subject}</h2>
            <div className="flex flex-wrap items-center gap-4 text-xs text-emerald-300/80 pt-1">
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{correspondence.source_or_dest_entity}</span>
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                <span>{formatDate(correspondence.date)}</span>
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

        {/* Action Feedback Toast */}
        {actionFeedback && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-2.5 flex items-center justify-between text-xs text-emerald-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="font-semibold">{actionFeedback}</span>
            </div>
            <button
              onClick={() => setActionFeedback(null)}
              className="text-emerald-600 hover:text-emerald-900 text-sm font-bold cursor-pointer"
            >
              ×
            </button>
          </div>
        )}

        {/* Workflow State Progression Ribbon */}
        <div className="bg-slate-50 px-5 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">الحالة الراهنة:</span>
            <span className="px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              {currentStatus === 'registered'
                ? 'مسجل حديثاً'
                : currentStatus === 'briefing_prepared'
                ? 'أُعدت مذكرة العرض'
                : currentStatus === 'presented_to_chairman'
                ? 'معروض على السيد رئيس المجلس'
                : currentStatus === 'approved'
                ? 'معتمد / موافقة'
                : currentStatus === 'referred'
                ? 'محال للقطاع للتنفيذ'
                : currentStatus === 'dispatched'
                ? 'صادر رسمياً'
                : 'قيد المعالجة'}
            </span>
          </div>

          {linkedMatter && (
            <div className="flex items-center gap-1 text-[11px] text-purple-900 font-bold bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
              <FolderGit2 className="w-3.5 h-3.5 text-purple-700" />
              <span>ملف القضية: {linkedMatter.code} — {linkedMatter.title}</span>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-white px-5 gap-2 overflow-x-auto text-xs font-semibold">
          {[
            { id: 'details', label: t('correspondence_module.tab_details') },
            { id: 'briefing', label: t('correspondence_module.tab_briefing') },
            { id: 'approval', label: t('correspondence_module.tab_approval') },
            { id: 'routing', label: t('correspondence_module.tab_routing'), count: routings.length },
            { id: 'print', label: t('correspondence_module.tab_print') }
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

        {/* Content Tabs */}
        <div className="p-5 flex-1 overflow-y-auto space-y-6">
          {/* TAB 1: DETAILS & ATTACHMENTS */}
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Summary Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700">ملخص ومضمون المعاملة:</h4>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-emerald-700" />
                    <span>التصنيف: {getCategoryName(currentCategory)}</span>
                  </span>
                </div>
                <p className="text-xs text-slate-800 leading-relaxed">{correspondence.summary}</p>
              </div>

              {/* Tags Management Studio */}
              <div className="bg-amber-50/40 border border-amber-200/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-amber-600" />
                    <span>الوسوم والتصنيفات الدلالية للمتابعة ({formatNumber(currentTags.length)})</span>
                  </h4>
                </div>

                {/* Display Current Tags */}
                <div className="flex flex-wrap items-center gap-1.5 min-h-[32px]">
                  {currentTags.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">لا توجد وسوم مخصصة لهذه المعاملة حالياً.</span>
                  ) : (
                    currentTags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1.5 shadow-2xs"
                      >
                        <span>#{tag}</span>
                        <X
                          className="w-3.5 h-3.5 hover:text-rose-600 cursor-pointer transition"
                          onClick={() => handleRemoveTag(tag)}
                        />
                      </span>
                    ))
                  )}
                </div>

                {/* Interactive Add Tag Controls */}
                <div className="pt-2 border-t border-amber-200/60 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag(tagInput);
                        }
                      }}
                      placeholder="إضافة وسم مخصص والضغط على Enter..."
                      className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddTag(tagInput)}
                      className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة وسم</span>
                    </button>
                  </div>

                  {/* Preset quick tag buttons */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-slate-500 font-semibold">مقترحات شائعة:</span>
                    {PRESET_QUICK_TAGS.map((pTag) => {
                      const isAdded = currentTags.includes(pTag);
                      return (
                        <button
                          key={pTag}
                          type="button"
                          onClick={() => (isAdded ? handleRemoveTag(pTag) : handleAddTag(pTag))}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition cursor-pointer border ${
                            isAdded
                              ? 'bg-amber-200 border-amber-400 text-amber-950 font-bold'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-amber-100'
                          }`}
                        >
                          {isAdded ? `✓ ${pTag}` : `+ ${pTag}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Mock Attachments Studio */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Paperclip className="w-4 h-4 text-emerald-700" />
                    <span>المرفقات والمستندات الرسمية ({formatNumber(attachments.length)} ملف)</span>
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {attachments.length === 0 ? (
                    <div className="col-span-2 p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      لم يتم إرفاق مستندات إضافية حتى الآن.
                    </div>
                  ) : (
                    attachments.map((att) => (
                      <div
                        key={att.id}
                        className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/80 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-bold text-[10px] flex items-center justify-center">
                            PDF
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 line-clamp-1">{att.file_name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{formatNumber(att.file_size_kb)} KB</div>
                          </div>
                        </div>

                        <button
                          onClick={() => alert(`معاينة المستند: ${att.file_name}\n(مستند مؤمن محلياً داخل نظام مكتب الرئيس)`)}
                          className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200 cursor-pointer"
                        >
                          معاينة
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Attachment Form */}
                {isSecretary && (
                  <form onSubmit={handleAddAttachment} className="p-3.5 rounded-xl bg-slate-100/70 border border-slate-200 flex flex-wrap gap-2 items-center">
                    <input
                      type="text"
                      required
                      placeholder="اسم المستند (مثال: تقرير_المطابقة_الفنية.pdf)..."
                      value={newFileName}
                      onChange={(e) => setNewFileName(e.target.value)}
                      className="flex-1 min-w-[200px] bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                    />
                    <input
                      type="number"
                      value={newFileSize}
                      onChange={(e) => setNewFileSize(Number(e.target.value))}
                      className="w-24 bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 text-center"
                      placeholder="الحجم KB"
                    />
                    <button
                      type="submit"
                      className="py-2 px-4 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                    >
                      إرفاق
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: BRIEFING NOTE (مذكرة عرض) */}
          {activeTab === 'briefing' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">مذكرة العرض المقدمة لرئيس مجلس الإدارة</h3>
                  <p className="text-xs text-slate-500">صياغة السكرتارية التنفيذية لتوضيح أبعاد الموضوع والتوصيات</p>
                </div>
                {briefingNote && (
                  <span className="text-xs text-slate-500 font-mono">
                    إعداد: <strong>{briefingNote.prepared_by_name}</strong>
                  </span>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    1. {t('correspondence_module.briefing_background')}:
                  </label>
                  <textarea
                    value={background}
                    onChange={(e) => setBackground(e.target.value)}
                    disabled={!isSecretary}
                    rows={3}
                    placeholder="شرح وافٍ لأصل الموضوع وتاريخ المراسلات السابقة..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs leading-relaxed text-slate-800 focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-emerald-900 mb-1">
                    2. {t('correspondence_module.briefing_recommendation')}:
                  </label>
                  <textarea
                    value={secretaryRec}
                    onChange={(e) => setSecretaryRec(e.target.value)}
                    disabled={!isSecretary}
                    rows={3}
                    placeholder="الرأي الإداري ومقترح السكرتارية للتأشيرة الرئاسية..."
                    className="w-full bg-emerald-50/50 border border-emerald-200 rounded-xl p-3 text-xs leading-relaxed text-emerald-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    3. {t('correspondence_module.briefing_executive_opinion')}:
                  </label>
                  <textarea
                    value={execOpinion}
                    onChange={(e) => setExecOpinion(e.target.value)}
                    disabled={!isSecretary}
                    rows={2}
                    placeholder="ملاحظات المتابعة والجهات ذات الصلة..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs leading-relaxed text-slate-800 focus:outline-none focus:border-emerald-600"
                  />
                </div>

                {isSecretary && (
                  <div className="flex flex-wrap gap-3 pt-2 justify-end">
                    <button
                      type="button"
                      onClick={() => handleSaveBriefingNote(false)}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer"
                    >
                      {t('correspondence_module.save_briefing')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveBriefingNote(true)}
                      className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold shadow-md transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Send className="w-4 h-4" />
                      <span>{t('correspondence_module.present_to_chairman')}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: CHAIRMAN ENDORSEMENT (تأشيرة الرئيس) */}
          {activeTab === 'approval' && (
            <div className="space-y-6">
              {approval ? (
                <div className="p-6 rounded-3xl bg-amber-50/80 border-2 border-amber-300 space-y-4">
                  <div className="flex items-center justify-between border-b border-amber-200 pb-3">
                    <div className="flex items-center gap-2 text-amber-900 font-extrabold text-sm">
                      <ShieldCheck className="w-5 h-5 text-amber-700" />
                      <span>تأشيرة السيد رئيس مجلس الإدارة الرسمية</span>
                    </div>
                    <span className="text-xs font-mono text-amber-800">
                      {formatDate(approval.decided_at, { showTime: true })}
                    </span>
                  </div>

                  <div className="text-sm font-bold text-slate-900 bg-white p-4 rounded-2xl border border-amber-200 leading-relaxed shadow-sm">
                    {approval.standard_phrase}
                    {approval.custom_directive && <span className="block mt-1 text-slate-700">{approval.custom_directive}</span>}
                  </div>

                  <div className="text-xs text-amber-900 font-semibold flex justify-between pt-1">
                    <span>الموقّع: {approval.decided_by_name}</span>
                    <span className="font-mono">نوع القرار: {approval.decision_type}</span>
                  </div>
                </div>
              ) : isChairman ? (
                <div className="p-6 rounded-3xl bg-amber-50/70 border border-amber-300 space-y-4">
                  <h3 className="text-sm font-bold text-amber-950">تسجيل تأشيرة رئيس مجلس الإدارة الرسمية:</h3>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {t('correspondence_module.select_phrase')}
                      </label>
                      <select
                        value={standardPhrase}
                        onChange={(e) => setStandardPhrase(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600"
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          {t('correspondence_module.referral_dept')}
                        </label>
                        <select
                          value={referralDept}
                          onChange={(e) => setReferralDept(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800"
                        >
                          <option value="قطاع العمليات والخدمات البريدية">قطاع العمليات والخدمات البريدية</option>
                          <option value="قطاع التوفير والخدمات المالية">قطاع التوفير والخدمات المالية</option>
                          <option value="قطاع التحول الرقمي وتكنولوجيا المعلومات">قطاع التحول الرقمي وتكنولوجيا المعلومات</option>
                          <option value="الإدارة العامة للشؤون القانونية">الإدارة العامة للشؤون القانونية</option>
                          <option value="إدارة المشروعات والأصول الهندسية">إدارة المشروعات والأصول الهندسية</option>
                          <option value="الإدارة العامة للأمن ومراقبة الأصول">الإدارة العامة للأمن ومراقبة الأصول</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          {t('correspondence_module.referral_deadline')}
                        </label>
                        <input
                          type="date"
                          value={referralDeadline}
                          onChange={(e) => setReferralDeadline(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {t('correspondence_module.custom_instruction')}
                      </label>
                      <textarea
                        value={customDirective}
                        onChange={(e) => setCustomDirective(e.target.value)}
                        placeholder="أي توجيه إضافي أو ملحوظة خاصة للقطاع المنفذ..."
                        rows={2}
                        className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800"
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDecisionType('approved');
                          handleRecordEndorsement();
                        }}
                        className="py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shadow transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-4 h-4" />
                        <span>موافق / اعتمد</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDecisionType('referred');
                          handleRecordEndorsement();
                        }}
                        className="py-3 px-4 rounded-xl bg-blue-700 hover:bg-blue-600 text-white font-bold text-xs shadow transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Send className="w-4 h-4" />
                        <span>إحالة للقطاع</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDecisionType('postponed');
                          handleRecordEndorsement();
                        }}
                        className="py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow transition cursor-pointer"
                      >
                        تأجيل للدراسة
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDecisionType('rejected');
                          handleRecordEndorsement();
                        }}
                        className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs shadow transition cursor-pointer"
                      >
                        يُحفظ
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
                  لم تصدر تأشيرة رسمية من السيد رئيس مجلس الإدارة على هذه المعاملة بعد.
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ROUTING & REFERRAL TRACKER */}
          {activeTab === 'routing' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">مسار الإحالات ومتابعة الردود الواردة</h3>
                <span className="text-xs text-slate-500">إجمالي الإحالات: {formatNumber(routings.length)}</span>
              </div>

              <div className="space-y-2.5">
                {routings.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
                    لم تسجل إحالات رسمية لهذه المعاملة بعد.
                  </div>
                ) : (
                  routings.map((r) => (
                    <div
                      key={r.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">{r.to_department_name}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                          {r.status === 'completed' ? 'تمت الإفادة' : 'قيد المتابعة'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-100">
                        {r.action_required}
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                        <span>تاريخ الإحالة: {formatDate(r.routed_at)}</span>
                        <span>المهلة المحددة: <strong className="text-slate-800">{formatDate(r.deadline)}</strong></span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add Routing Form */}
              {isSecretary && (
                <form onSubmit={handleAddRouting} className="p-4 rounded-xl bg-slate-100/70 border border-slate-200 space-y-3">
                  <div className="text-xs font-bold text-slate-800">{t('correspondence_module.add_routing_step')}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select
                      value={newRoutingTo}
                      onChange={(e) => setNewRoutingTo(e.target.value)}
                      className="bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                    >
                      <option value="قطاع العمليات والخدمات البريدية">قطاع العمليات والخدمات البريدية</option>
                      <option value="قطاع التوفير والخدمات المالية">قطاع التوفير والخدمات المالية</option>
                      <option value="قطاع التحول الرقمي وتكنولوجيا المعلومات">قطاع التحول الرقمي وتكنولوجيا المعلومات</option>
                      <option value="الإدارة العامة للشؤون القانونية">الإدارة العامة للشؤون القانونية</option>
                      <option value="إدارة المشروعات والأصول الهندسية">إدارة المشروعات والأصول الهندسية</option>
                    </select>
                    <input
                      type="date"
                      required
                      value={newRoutingDeadline}
                      onChange={(e) => setNewRoutingDeadline(e.target.value)}
                      className="bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                    />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="الإجراء المطلوب تنفيذه أو الإفادة بشأنه..."
                    value={newRoutingAction}
                    onChange={(e) => setNewRoutingAction(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                  />
                  <button
                    type="submit"
                    className="py-2 px-4 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    تسجيل الإحالة
                  </button>
                </form>
              )}
            </div>
          )}

          {/* TAB 5: PRINT DOCKET (PDF Ready) */}
          {activeTab === 'print' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer shadow"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة كشف المعاملة والتأشيرة (PDF)</span>
                </button>
              </div>

              {/* Printable Government Docket */}
              <div className="bg-white border-2 border-slate-900 p-8 rounded-2xl text-slate-900 space-y-6 print:border-none print:p-0">
                <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
                  <div>
                    <h3 className="font-extrabold text-base">الهيئة القومية للبريد المصري</h3>
                    <h4 className="text-xs font-bold text-slate-700">مكتب رئيس مجلس الإدارة</h4>
                    <div className="text-[11px] text-slate-500 mt-1">كشف قيد المعاملة ومذكرة العرض والتأشيرة</div>
                  </div>
                  <div className="text-left text-xs font-mono">
                    <div className="font-bold text-sm bg-slate-100 px-2 py-1 border border-slate-300 rounded">
                      {correspondence.serial_number}
                    </div>
                    <div className="mt-1">التاريخ: {formatDate(correspondence.date)}</div>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-sm mb-1">الموضوع: {correspondence.subject}</h4>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700">
                    <span>الجهة: <strong>{correspondence.source_or_dest_entity}</strong></span>
                    <span>التصنيف: <strong>{getCategoryName(currentCategory)}</strong></span>
                  </div>
                  {currentTags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 mt-2">
                      <span className="text-slate-500 text-[11px]">الوسوم:</span>
                      {currentTags.map((t) => (
                        <span key={t} className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 border border-slate-300">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {briefingNote && (
                  <div className="space-y-2 border-t border-slate-200 pt-3 text-xs">
                    <h5 className="font-bold text-slate-900">مذكرة العرض:</h5>
                    <p className="text-slate-700"><strong>الخلفية:</strong> {briefingNote.background}</p>
                    <p className="text-emerald-900"><strong>التوصية:</strong> {briefingNote.secretary_recommendation}</p>
                  </div>
                )}

                {approval && (
                  <div className="border-2 border-amber-600 bg-amber-50/50 p-4 rounded-xl text-xs space-y-1">
                    <h5 className="font-bold text-amber-900">تأشيرة السيد رئيس مجلس الإدارة:</h5>
                    <div className="font-bold text-slate-900 text-sm">{approval.standard_phrase} {approval.custom_directive}</div>
                    <div className="text-[11px] text-slate-500 pt-1">المعتمد: {approval.decided_by_name} ({formatDate(approval.decided_at)})</div>
                  </div>
                )}

                <div className="pt-8 flex justify-between text-xs text-center border-t border-slate-300">
                  <div>
                    <div className="text-slate-500 mb-8">إعداد / سكرتير أول</div>
                    <div className="font-bold">السكرتير التنفيذي الأول</div>
                  </div>
                  <div>
                    <div className="text-slate-500 mb-8">يعتمد / رئيس مجلس الإدارة</div>
                    <div className="font-bold">رئيس مجلس الإدارة</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-between items-center text-xs">
          <span className="text-slate-500">
            الرقم المتسلسل: <strong className="font-mono text-slate-800">{correspondence.serial_number}</strong>
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
