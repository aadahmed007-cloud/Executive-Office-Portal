import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../../i18n/i18nContext';
import {
  directiveRepo,
  matterRepo,
  notificationRepo
} from '../../data/api/apiRepositories';
import { Directive, DirectiveUpdate, Matter } from '../../domain/types';
import { analyzeOverdue } from '../../domain/rules/overdueLogic';
import {
  X,
  CheckSquare,
  Building,
  User,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Printer,
  Plus,
  ArrowRight,
  FolderGit2,
  Percent,
  FileText,
  ShieldCheck,
  Trash2,
  Edit3,
  Save,
  ShieldAlert
} from 'lucide-react';

interface DirectiveDetailModalProps {
  directive: Directive;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export const DirectiveDetailModal: React.FC<DirectiveDetailModalProps> = ({
  directive,
  isOpen,
  onClose,
  onUpdated
}) => {
  const { currentUser } = useAuth();
  const { t, formatNumber, formatDate } = useI18n();

  const [activeTab, setActiveTab] = useState<'overview' | 'progress_log' | 'edit' | 'print'>('overview');
  const [updates, setUpdates] = useState<DirectiveUpdate[]>([]);
  const [linkedMatter, setLinkedMatter] = useState<Matter | null>(null);

  // New Update Form State
  const [newProgress, setNewProgress] = useState(directive.progress_percent);
  const [updateNotes, setUpdateNotes] = useState('');

  // Edit Mode State
  const [editTitle, setEditTitle] = useState(directive.title);
  const [editInstruction, setEditInstruction] = useState(directive.instruction);
  const [editDept, setEditDept] = useState(directive.assigned_department);
  const [editPerson, setEditPerson] = useState(directive.assigned_person);
  const [editDueDate, setEditDueDate] = useState(directive.due_date);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const overdue = analyzeOverdue(directive.due_date, directive.status);
  const isCompleted = directive.status === 'completed' || directive.status === 'closed';

  const getUserCtx = () => ({ can_view_confidential: Boolean(currentUser.can_view_confidential), role: currentUser.role, userId: currentUser.id });

  const loadData = async () => {
    const userCtx = getUserCtx();
    const list = await directiveRepo.getUpdates(directive.id, userCtx);
    setUpdates(list);
    if (directive.matter_id) {
      matterRepo.getById(directive.matter_id, userCtx).then((m) => setLinkedMatter(m));
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      setNewProgress(directive.progress_percent);
      setEditTitle(directive.title);
      setEditInstruction(directive.instruction);
      setEditDept(directive.assigned_department);
      setEditPerson(directive.assigned_person);
      setEditDueDate(directive.due_date);
    }
  }, [isOpen, directive.id]);

  if (!isOpen) return null;

  if (directive.confidentiality !== 'normal' && !currentUser.can_view_confidential) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4" dir="rtl">
        <div className="bg-white rounded-3xl p-6 max-w-md w-full text-center space-y-4 shadow-2xl border border-rose-200">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">غير مصرح بالاطلاع</h3>
          <p className="text-xs text-slate-600">
            هذا التكليف مصنف بدرجة سرية تتطلب تصريحاً أمنياً معتمداً من مكتب رئيس مجلس الإدارة.
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

  const handleAddProgressUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateNotes) return;
    const ctx = getUserCtx();

    await directiveRepo.addUpdate({
      directive_id: directive.id,
      notes: updateNotes,
      progress_percent: newProgress,
      updated_by: currentUser.name
    }, ctx);

    const isNowDone = newProgress >= 100;
    if (isNowDone && directive.status !== 'completed' && directive.status !== 'closed') {
      await directiveRepo.update(directive.id, {
        status: 'completed',
        progress_percent: 100
      }, ctx);
    }

    setUpdateNotes('');
    await loadData();
    onUpdated();
    setActionFeedback('تم حفظ تقرير المتابعة وتوثيق العملية في سجل الرقابة المحلي بنجاح.');
  };

  const handleCloseDirective = async () => {
    const ctx = getUserCtx();
    await directiveRepo.update(directive.id, {
      status: 'closed',
      progress_percent: 100
    }, ctx);

    onUpdated();
    onClose();
  };

  const handleDeleteDirective = async () => {
    const ctx = getUserCtx();
    await directiveRepo.softDelete(directive.id, ctx);
    onUpdated();
    onClose();
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingEdit(true);
    try {
      const ctx = getUserCtx();
      await directiveRepo.update(directive.id, {
        title: editTitle,
        instruction: editInstruction,
        assigned_department: editDept,
        assigned_person: editPerson,
        due_date: editDueDate
      }, ctx);

      await loadData();
      onUpdated();
      setActiveTab('overview');
      setActionFeedback('تم تعديل بيانات التكليف بنجاح.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-950 border border-emerald-600/40 flex items-center justify-center text-emerald-400 font-mono font-bold">
              {directive.code}
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{directive.title}</h3>
              <p className="text-xs text-emerald-400 font-medium">متابعة تنفيذ التكليف الرئاسي والتوجيهات التنفيذية</p>
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
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-slate-200 bg-slate-50">
          {[
            { id: 'overview', label: 'تفاصيل التكليف' },
            { id: 'progress_log', label: `سجل التقارير (${updates.length})` },
            { id: 'edit', label: 'تعديل البيانات' },
            { id: 'print', label: 'معاينة الطباعة' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 text-xs font-bold transition border-b-2 cursor-pointer ${
                activeTab === tab.id
                  ? 'border-emerald-600 text-emerald-800 bg-white rounded-t-xl'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
          {actionFeedback && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{actionFeedback}</span>
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <span className="text-slate-600 font-medium block">الجهة المكلفة بالتنفيذ:</span>
                  <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Building className="w-4 h-4 text-emerald-700" />
                    <span>{directive.assigned_department}</span>
                  </div>
                  <div className="text-xs text-slate-600">المسؤول المباشر: {directive.assigned_person}</div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <span className="text-slate-600 font-medium block">الموعد المستهدف للاستحقاق:</span>
                  <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-700" />
                    <span>{formatDate(directive.due_date)}</span>
                  </div>
                  {overdue.isOverdue && !isCompleted && (
                    <span className="inline-block px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">
                      متأخر بـ {formatNumber(Math.abs(overdue.daysRemaining))} يوم
                    </span>
                  )}
                </div>
              </div>

              {/* Instruction Box */}
              <div className="p-5 bg-emerald-950/5 border border-emerald-900/10 rounded-2xl space-y-2">
                <span className="text-emerald-900 font-bold block">نص التوجيه / التعليمات الرئاسية:</span>
                <p className="text-slate-800 leading-relaxed font-medium bg-white p-4 rounded-xl border border-emerald-900/10">
                  {directive.instruction}
                </p>
              </div>

              {/* Progress Slider */}
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">نسبة الإنجاز الحالية:</span>
                  <span className="font-mono font-bold text-emerald-700 text-sm">{formatNumber(directive.progress_percent)}%</span>
                </div>
                <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full transition-all duration-500 rounded-full"
                    style={{ width: `${directive.progress_percent}%` }}
                  />
                </div>
              </div>

              {/* Quick Update Form */}
              {!isCompleted && (
                <form onSubmit={handleAddProgressUpdate} className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-sm">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-emerald-700" />
                    <span>تسجيل تقرير متابعة وتحديث نسبة الإنجاز</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">نسبة الإنجاز المحدثة (%):</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={newProgress}
                        onChange={(e) => setNewProgress(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono font-bold focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">بيان الموقف التنفيذي والملاحظات:</label>
                    <textarea
                      required
                      rows={3}
                      value={updateNotes}
                      onChange={(e) => setUpdateNotes(e.target.value)}
                      placeholder="اكتب تفاصيل ما تم إنجازه أو أي معوقات..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold transition shadow-sm cursor-pointer"
                    >
                      حفظ التقرير وإثباته بالسجل
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {activeTab === 'progress_log' && (
            <div className="space-y-4">
              <h4 className="font-bold text-slate-900">سجل تقارير المتابعة الدورية</h4>
              {updates.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl text-slate-600 border border-slate-200">
                  لا توجد تقارير متابعة مسجلة حتى الآن لهذا التكليف.
                </div>
              ) : (
                <div className="space-y-3">
                  {updates.map((u) => (
                    <div key={u.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-slate-600 font-mono">
                        <span>بواسطة: {u.updated_by}</span>
                        <span>{formatDate(u.created_at, { showTime: true })}</span>
                      </div>
                      <p className="text-slate-800 font-medium">{u.notes}</p>
                      <div className="flex items-center gap-2 pt-1">
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">
                          الإنجاز: {formatNumber(u.progress_percent)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'edit' && (
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <h4 className="font-bold text-slate-900">تعديل بيانات التكليف الرئاسي الأساسية</h4>
              <div>
                <label className="block text-slate-600 font-medium mb-1">عنوان التكليف:</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:border-emerald-600"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">التعليمات والتوجيه:</label>
                <textarea
                  required
                  rows={4}
                  value={editInstruction}
                  onChange={(e) => setEditInstruction(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-emerald-600"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">القطاع / الإدارة المكلفة:</label>
                  <input
                    type="text"
                    required
                    value={editDept}
                    onChange={(e) => setEditDept(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">تاريخ الاستحقاق:</label>
                  <input
                    type="date"
                    required
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:border-emerald-600 font-mono"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold transition shadow-sm cursor-pointer flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>حفظ التعديلات</span>
                </button>
              </div>
            </form>
          )}

          {activeTab === 'print' && (
            <div className="p-8 bg-white border border-slate-300 rounded-2xl space-y-6 text-slate-900 shadow-inner">
              <div className="text-center space-y-1 border-b border-slate-200 pb-4">
                <h3 className="font-bold text-sm">جمهورية مصر العربية — الهيئة القومية للبريد</h3>
                <h4 className="font-bold text-xs text-emerald-800">مكتب مساعد رئيس مجلس الإدارة</h4>
                <div className="text-[11px] font-mono text-slate-600 pt-1">وثيقة تكليف رئاسي رسمي رقم: {directive.code}</div>
              </div>
              <div className="space-y-3 text-xs">
                <div><strong>الموضوع:</strong> {directive.title}</div>
                <div><strong>الجهة المكلفة:</strong> {directive.assigned_department} ({directive.assigned_person})</div>
                <div><strong>تاريخ الإصدار:</strong> {formatDate(directive.issued_at)}</div>
                <div><strong>الموعد المستهدف:</strong> {formatDate(directive.due_date)}</div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <strong>التوجيهات التفصيلية:</strong>
                  <p className="mt-1 leading-relaxed">{directive.instruction}</p>
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-slate-800 transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة الوثيقة</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {!isCompleted && (
              <button
                onClick={handleCloseDirective}
                className="px-4 py-2 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-950 font-bold transition cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>إتمام وإغلاق التكليف</span>
              </button>
            )}
            <button
              onClick={handleDeleteDirective}
              className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold transition cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>أرشفة / حذف</span>
            </button>
          </div>
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
