import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../../i18n/i18nContext';
import {
  correspondenceRepo,
  directiveRepo,
  auditRepo,
  notificationRepo,
  matterRepo
} from '../../data/api/apiRepositories';
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

  const [activeTab, setActiveTab] = useState<'overview' | 'briefing' | 'endorsement' | 'routings' | 'attachments' | 'print'>('overview');
  const [briefingNote, setBriefingNote] = useState<BriefingNote | null>(null);
  const [approval, setApproval] = useState<Approval | null>(null);
  const [routings, setRoutings] = useState<CorrespondenceRouting[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [linkedMatter, setLinkedMatter] = useState<Matter | null>(null);
  const [currentStatus, setCurrentStatus] = useState<Correspondence['status']>(correspondence.status);

  // Briefing Form State
  const [background, setBackground] = useState('');
  const [secretaryRec, setSecretaryRec] = useState('');
  const [execOpinion, setExecOpinion] = useState('');

  // Endorsement / Decision Form State
  const [decisionType, setDecisionType] = useState<'approved' | 'rejected' | 'postponed' | 'referred'>('approved');
  const [standardPhrase, setStandardPhrase] = useState('موافق مع سرعة التنفيذ');
  const [customDirective, setCustomDirective] = useState('');
  const [referralDept, setReferralDept] = useState('قطاع الشؤون المالية والادارية');
  const [referralDeadline, setReferralDeadline] = useState('');

  // Routing Form State
  const [newRoutingTo, setNewRoutingTo] = useState('قطاع التشغيل ومنطقة بريد القاهرة');
  const [newRoutingAction, setNewRoutingAction] = useState('');
  const [newRoutingDeadline, setNewRoutingDeadline] = useState('');

  // Attachment Form State
  const [newFileName, setNewFileName] = useState('');
  const [newFileSize, setNewFileSize] = useState(1200);

  // Tags Form State
  const [currentTags, setCurrentTags] = useState<string[]>(correspondence.tags || []);
  const [tagInput, setTagInput] = useState('');

  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const getUserCtx = () => ({ can_view_confidential: Boolean(currentUser.can_view_confidential), role: currentUser.role, userId: currentUser.id });

  const loadData = async () => {
    const userCtx = getUserCtx();
    const [bNote, appObj, routList, attList] = await Promise.all([
      correspondenceRepo.getBriefingNote(correspondence.id, userCtx),
      correspondenceRepo.getApproval(correspondence.id, userCtx),
      correspondenceRepo.getRoutings(correspondence.id, userCtx),
      correspondenceRepo.getAttachments(correspondence.id, userCtx)
    ]);

    setBriefingNote(bNote);
    if (bNote) {
      setBackground(bNote.background);
      setSecretaryRec(bNote.secretary_recommendation);
      setExecOpinion(bNote.executive_opinion);
    }
    setApproval(appObj);
    setRoutings(routList);
    setAttachments(attList);

    if (correspondence.matter_id) {
      matterRepo.getById(correspondence.matter_id, userCtx).then((m) => setLinkedMatter(m));
    }
  };

  useEffect(() => {
    if (isOpen) {
      setCurrentStatus(correspondence.status);
      setCurrentTags(correspondence.tags || []);
      loadData();
      setActionFeedback(null);
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
            هذه المعاملة مصنفة كسرية ولا يمكنك معاينتها دون تصريح أمني.
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
    const ctx = getUserCtx();
    await correspondenceRepo.saveBriefingNote({
      correspondence_id: correspondence.id,
      background,
      secretary_recommendation: secretaryRec,
      executive_opinion: execOpinion,
      prepared_by_name: currentUser.name,
      prepared_at: new Date().toISOString()
    }, ctx);

    const newStatus = presentToChairman ? 'presented_to_chairman' : 'briefing_prepared';
    await correspondenceRepo.update(correspondence.id, { status: newStatus }, ctx);
    setCurrentStatus(newStatus);

    if (presentToChairman) {
      await notificationRepo.create({
        recipient_role: 'CHAIRMAN',
        title: `مذكرة عرض جديدة جاهزة للتأشيرة (${correspondence.serial_number})`,
        body: `تم إعداد مذكرة العرض الخاصة بـ «${correspondence.subject}» وجاهزة لاتخاذ القرار.`,
        confidentiality: correspondence.confidentiality,
        is_read: false
      }, ctx);
      setActionFeedback('تم تقديم مذكرة العرض رسمياً على شاشة السيد رئيس مجلس الإدارة.');
    } else {
      setActionFeedback('تم حفظ مسودة مذكرة العرض بنجاح.');
    }

    await loadData();
    onUpdated();
  };

  const handleRecordEndorsement = async () => {
    const phraseText = `${standardPhrase}${customDirective ? ` - ${customDirective}` : ''}`;
    const ctx = getUserCtx();

    await correspondenceRepo.recordApproval({
      correspondence_id: correspondence.id,
      decision_type: decisionType,
      standard_phrase: standardPhrase,
      custom_directive: customDirective,
      decided_at: new Date().toISOString(),
      decided_by_name: currentUser.name
    }, ctx);

    const nextStatus = decisionType === 'approved' ? 'approved' : decisionType === 'rejected' ? 'rejected' : decisionType === 'postponed' ? 'postponed' : 'referred';
    await correspondenceRepo.update(correspondence.id, { status: nextStatus }, ctx);
    setCurrentStatus(nextStatus);

    // If referral, auto add routing entry & directive
    if (decisionType === 'referred' || (decisionType === 'approved' && customDirective)) {
      await correspondenceRepo.addRouting({
        correspondence_id: correspondence.id,
        from_entity: 'مكتب رئيس مجلس الإدارة',
        to_department_id: 'dept-auto',
        to_department_name: referralDept,
        action_required: phraseText,
        deadline: referralDeadline,
        status: 'sent',
        routed_at: new Date().toISOString()
      }, ctx);

      const nextCode = await directiveRepo.getNextCode();
      await directiveRepo.create({
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
      }, ctx);
    }

    await notificationRepo.create({
      recipient_role: 'SECRETARY',
      title: `تأشيرة رئيس مجلس الإدارة على الخطاب ${correspondence.serial_number}`,
      body: `أصدر السيد رئيس المجلس تأشيرة: ${phraseText}`,
      confidentiality: correspondence.confidentiality,
      is_read: false
    }, ctx);

    await loadData();
    onUpdated();
    setActionFeedback('تم تثبيت تأشيرة السيد رئيس مجلس الإدارة في السجل الرسمي بنجاح.');
  };

  const handleAddRouting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoutingAction) return;

    const ctx = getUserCtx();
    await correspondenceRepo.addRouting({
      correspondence_id: correspondence.id,
      from_entity: 'مكتب رئيس مجلس الإدارة',
      to_department_id: 'dept-manual',
      to_department_name: newRoutingTo,
      action_required: newRoutingAction,
      deadline: newRoutingDeadline,
      status: 'sent',
      routed_at: new Date().toISOString()
    }, ctx);

    setNewRoutingAction('');
    setActionFeedback('تم تسجيل إحالة المعاملة بنجاح.');
    await loadData();
  };

  const handleAddAttachment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName) return;

    const ctx = getUserCtx();
    await correspondenceRepo.addAttachment({
      entity_type: 'correspondence',
      entity_id: correspondence.id,
      file_name: newFileName,
      file_size_kb: newFileSize,
      mime_type: 'application/pdf',
      confidentiality: correspondence.confidentiality,
      uploaded_at: new Date().toISOString()
    }, ctx);

    setNewFileName('');
    setActionFeedback('تم إرفاق المستند الرسمي بنجاح.');
    await loadData();
  };

  const handleAddTag = async (tagText: string) => {
    const trimmed = tagText.trim();
    if (!trimmed || currentTags.includes(trimmed)) return;
    const updated = [...currentTags, trimmed];
    setCurrentTags(updated);
    const ctx = getUserCtx();
    await correspondenceRepo.update(correspondence.id, { tags: updated }, ctx);
    setTagInput('');
    onUpdated();
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    const updated = currentTags.filter((t) => t !== tagToRemove);
    setCurrentTags(updated);
    const ctx = getUserCtx();
    await correspondenceRepo.update(correspondence.id, { tags: updated }, ctx);
    onUpdated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-950 border border-emerald-600/40 flex items-center justify-center text-emerald-400 font-mono font-bold">
              {correspondence.serial_number}
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{correspondence.subject}</h3>
              <p className="text-xs text-emerald-400 font-medium">الجهة الوارد منها/المصدر: {correspondence.source_or_dest_entity}</p>
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
            { id: 'overview', label: 'تفاصيل المعاملة' },
            { id: 'briefing', label: 'مذكرة العرض الرئاسية' },
            { id: 'endorsement', label: 'تأشيرة الرئيس والقرار' },
            { id: 'routings', label: `سجل الإحالات (${routings.length})` },
            { id: 'attachments', label: `المرفقات (${attachments.length})` },
            { id: 'print', label: 'معاينة الطباعة' }
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

        {/* Body Content */}
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
                  <span className="text-slate-600 font-medium">رقم القيد / الصادر:</span>
                  <div className="text-sm font-bold text-slate-900 font-mono pt-1">{correspondence.serial_number}</div>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                  <span className="text-slate-600 font-medium">تاريخ المعاملة:</span>
                  <div className="text-sm font-bold text-slate-900 font-mono pt-1">{formatDate(correspondence.date)}</div>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                  <span className="text-slate-600 font-medium">درجة الأهمية:</span>
                  <div className="pt-1">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900">
                      {correspondence.priority}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <h4 className="font-bold text-slate-900">ملخص وموضوع الخطاب:</h4>
                <p className="text-slate-800 leading-relaxed font-medium bg-white p-4 rounded-xl border border-slate-200">
                  {correspondence.summary}
                </p>
              </div>

              {/* Tags Management */}
              <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-3 shadow-sm">
                <h4 className="font-bold text-slate-900">وسوم التصنيف والبحث (Tags):</h4>
                <div className="flex flex-wrap items-center gap-2">
                  {currentTags.map((tag, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-medium text-xs">
                      <Tag className="w-3 h-3 text-emerald-700" />
                      <span>{tag}</span>
                      <button onClick={() => handleRemoveTag(tag)} className="text-emerald-700 hover:text-rose-600 cursor-pointer">×</button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="إضافة وسوم مخصصة..."
                    className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-600"
                  />
                  <button
                    onClick={() => handleAddTag(tagInput)}
                    className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition cursor-pointer"
                  >
                    إضافة وسم
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'briefing' && (
            <div className="space-y-6">
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-700" />
                  <span>إعداد مذكرة العرض (Briefing Note) للعرض على السيد الرئيس</span>
                </h4>

                <div>
                  <label className="block text-slate-600 font-medium mb-1">الخلفية والسياق الموضوعي:</label>
                  <textarea
                    rows={4}
                    value={background}
                    onChange={(e) => setBackground(e.target.value)}
                    placeholder="استعراض خلفية الموضوع وتاريخه..."
                    className="w-full bg-white border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-emerald-600 leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-medium mb-1">رأي السكرتارية التنفيذية / المقترح:</label>
                  <textarea
                    rows={3}
                    value={secretaryRec}
                    onChange={(e) => setSecretaryRec(e.target.value)}
                    placeholder="التوصية المقترحة..."
                    className="w-full bg-white border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-emerald-600 leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-medium mb-1">الرأي القانوني أو التنفيذي للقطاعات:</label>
                  <textarea
                    rows={3}
                    value={execOpinion}
                    onChange={(e) => setExecOpinion(e.target.value)}
                    placeholder="رأي القطاع المختص..."
                    className="w-full bg-white border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-emerald-600 leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => handleSaveBriefingNote(false)}
                    className="px-4 py-2.5 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition cursor-pointer"
                  >
                    حفظ مسودة المذكرة
                  </button>
                  <button
                    onClick={() => handleSaveBriefingNote(true)}
                    className="px-5 py-2.5 bg-emerald-700 text-white font-bold rounded-xl hover:bg-emerald-600 transition shadow-sm cursor-pointer"
                  >
                    تقديم ومراسلة شاشة السيد الرئيس رسمياً
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'endorsement' && (
            <div className="space-y-6">
              {approval ? (
                <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-4">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                    <ShieldCheck className="w-5 h-5 text-emerald-700" />
                    <span>تم اعتماد وتثبيت تأشيرة السيد رئيس مجلس الإدارة بالفعل</span>
                  </div>
                  <div className="p-4 bg-white rounded-xl border border-emerald-200 space-y-2">
                    <div className="text-xs text-slate-600 font-mono">تاريخ التأشيرة: {formatDate(approval.decided_at, { showTime: true })}</div>
                    <div className="font-bold text-slate-900">العبارة المعتمدة: {approval.standard_phrase}</div>
                    {approval.custom_directive && <div className="text-slate-700">التوجيه الخطي: {approval.custom_directive}</div>}
                  </div>
                </div>
              ) : currentUser.role === 'CHAIRMAN' ? (
                <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-sm">
                  <h4 className="font-bold text-slate-900">إصدار التأشيرة الرئاسية والقرار التنفيذي</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'approved', label: 'موافق / اعتماد' },
                      { id: 'rejected', label: 'رفض / يُحفظ' },
                      { id: 'postponed', label: 'تؤجل للمزيد' },
                      { id: 'referred', label: 'تحويل وتكليف' }
                    ].map((btn) => (
                      <button
                        key={btn.id}
                        onClick={() => setDecisionType(btn.id as any)}
                        className={`py-2.5 px-3 rounded-xl font-bold text-xs transition cursor-pointer ${
                          decisionType === btn.id
                            ? 'bg-emerald-700 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">العبارة القياسية المعتمدة:</label>
                    <select
                      value={standardPhrase}
                      onChange={(e) => setStandardPhrase(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:border-emerald-600 font-medium"
                    >
                      <option value="موافق مع سرعة التنفيذ">موافق مع سرعة التنفيذ</option>
                      <option value="يُعتمد المقترح ويرفع تقرير دوري">يُعتمد المقترح ويرفع تقرير دوري</option>
                      <option value="تؤجل للمزيد من الدراسة والمراجعة المالية">تؤجل للمزيد من الدراسة والمراجعة المالية</option>
                      <option value="يُحفظ لانتفاء الحاجة">يُحفظ لانتفاء الحاجة</option>
                      <option value="يحال للقطاع المختص للإفادة العاجلة">يحال للقطاع المختص للإفادة العاجلة</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">توجيه خطي إضافي (اختياري):</label>
                    <input
                      type="text"
                      value={customDirective}
                      onChange={(e) => setCustomDirective(e.target.value)}
                      placeholder="مثال: التنسيق مع الشئون القانونية..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">القطاع المحال إليه:</label>
                      <input
                        type="text"
                        value={referralDept}
                        onChange={(e) => setReferralDept(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">الموعد النهائي (Deadline):</label>
                      <input
                        type="date"
                        value={referralDeadline}
                        onChange={(e) => setReferralDeadline(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-slate-200">
                    <button
                      onClick={handleRecordEndorsement}
                      className="px-6 py-3 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-xl transition shadow-md cursor-pointer flex items-center gap-2"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>تثبيت وإصدار التأشيرة رسمياً</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 rounded-2xl text-slate-600 border border-slate-200">
                  لم يتم إصدار تأشيرة بعد. هذه الصلاحية مقصورة حصرياً على السيد رئيس مجلس الإدارة.
                </div>
              )}
            </div>
          )}

          {activeTab === 'routings' && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h4 className="font-bold text-slate-900">سجل الإحالات والتوجيهات للقطاعات</h4>
                {routings.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 rounded-2xl text-slate-600 border border-slate-200">
                    لا توجد إحالات مسجلة لهذه المعاملة.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {routings.map((r) => (
                      <div key={r.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                        <div className="flex items-center justify-between font-mono text-[11px] text-slate-500">
                          <span>من: {r.from_entity} ⟵ إلى: {r.to_department_name}</span>
                          <span>{formatDate(r.routed_at, { showTime: true })}</span>
                        </div>
                        <p className="font-bold text-slate-900">{r.action_required}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <form onSubmit={handleAddRouting} className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-sm">
                <h4 className="font-bold text-slate-900">إحالة يدوية جديدة لقطاع</h4>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">القطاع / الإدارة المستهدفة:</label>
                  <input
                    type="text"
                    required
                    value={newRoutingTo}
                    onChange={(e) => setNewRoutingTo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">الإجراء المطلوب:</label>
                  <input
                    type="text"
                    required
                    value={newRoutingAction}
                    onChange={(e) => setNewRoutingAction(e.target.value)}
                    placeholder="مثال: اتخاذ اللازم قانوناً وإفادتنا..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-xl transition shadow-sm cursor-pointer"
                  >
                    إرسال الإحالة وتسجيلها
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'attachments' && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h4 className="font-bold text-slate-900">المستندات والمرفقات الرقمية</h4>
                {attachments.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 rounded-2xl text-slate-600 border border-slate-200">
                    لا توجد مرفقات مسجلة.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {attachments.map((att) => (
                      <div key={att.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
                          <div>
                            <h5 className="font-bold text-slate-900">{att.file_name}</h5>
                            <span className="text-[11px] text-slate-500 font-mono">{formatNumber(att.file_size_kb)} كيلوبايت</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <form onSubmit={handleAddAttachment} className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-sm">
                <h4 className="font-bold text-slate-900">إرفاق مستند رقمي جديد</h4>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">اسم الملف (PDF):</label>
                  <input
                    type="text"
                    required
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    placeholder="مثال: تقرير_الموازنة_السنوية.pdf"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-xl transition shadow-sm cursor-pointer"
                  >
                    رفع وإرفاق المستند
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
                <div className="text-[11px] font-mono text-slate-600 pt-1">بطاقة معاملة رسمية رقم: {correspondence.serial_number}</div>
              </div>
              <div className="space-y-3 text-xs">
                <div><strong>الموضوع:</strong> {correspondence.subject}</div>
                <div><strong>الجهة:</strong> {correspondence.source_or_dest_entity}</div>
                <div><strong>التاريخ:</strong> {formatDate(correspondence.date)}</div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <strong>الملخص التنفيذي:</strong>
                  <p className="mt-1 leading-relaxed">{correspondence.summary}</p>
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-slate-800 transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة البطاقة</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-mono">معرف المعاملة: {correspondence.id}</span>
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
