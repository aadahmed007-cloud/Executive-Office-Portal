import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../../i18n/i18nContext';
import {
  directiveRepo,
  matterRepo,
  notificationRepo
} from '../../data/sqlite/repositories';
import { AuditLogger } from '../../domain/security/auditLogger';
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
  Save
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

  const overdue = analyzeOverdue(directive.due_date, directive.status);
  const isCompleted = directive.status === 'completed' || directive.status === 'closed';

  const loadData = async () => {
    const list = await directiveRepo.getUpdates(directive.id);
    setUpdates(list);
    if (directive.matter_id) {
      matterRepo.getById(directive.matter_id).then((m) => setLinkedMatter(m));
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

  const handleAddProgressUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateNotes) return;

    await directiveRepo.addUpdate({
      directive_id: directive.id,
      notes: updateNotes,
      progress_percent: newProgress,
      updated_by: currentUser.name
    });

    const isNowDone = newProgress >= 100;
    if (isNowDone && directive.status !== 'completed' && directive.status !== 'closed') {
      await directiveRepo.update(directive.id, {
        status: 'completed',
        progress_percent: 100
      });
    }

    // Secure Audit Log
    await AuditLogger.logDirectiveProgress(
      currentUser,
      directive,
      newProgress,
      updateNotes
    );

    setUpdateNotes('');
    await loadData();
    onUpdated();
    alert('تم حفظ تقرير المتابعة وتوثيق العملية في سجل الرقابة المحلي بنجاح.');
  };

  const handleCloseDirective = async () => {
    if (!window.confirm('هل ترغب في إغلاق واعتماد استيفاء هذا التكليف نهائياً؟')) return;

    await directiveRepo.update(directive.id, {
      status: 'closed',
      progress_percent: 100
    });

    // Secure Audit Log
    await AuditLogger.logDirectiveClosure(currentUser, directive);

    onUpdated();
    onClose();
  };

  const handleDeleteDirective = async () => {
    const reason = window.prompt('يرجى كتابة سبب حذف/أرشفة هذا التكليف الرئاسي لتوثيقه في سجل الرقابة:');
    if (reason === null) return;

    await directiveRepo.softDelete(directive.id);

    // Secure Audit Log
    await AuditLogger.logDirectiveDeletion(currentUser, directive, reason || 'حذف بواسطة المستخدم');

    onUpdated();
    onClose();
    alert('تم حذف التكليف وتوثيق القيد في سجل الرقابة بنجاح.');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingEdit(true);
    try {
      const beforeState = {
        title: directive.title,
        status: directive.status,
        progress: directive.progress_percent
      };

      await directiveRepo.update(directive.id, {
        title: editTitle,
        instruction: editInstruction,
        assigned_department: editDept,
        assigned_person: editPerson,
        due_date: editDueDate
      });

      // Secure Audit Log
      await AuditLogger.logDirectiveUpdate(
        currentUser,
        directive.id,
        beforeState,
        {
          title: editTitle,
          status: directive.status,
          progress: directive.progress_percent,
          reason: 'تعديل البيانات الأساسية للتكليف'
        }
      );

      await loadData();
      onUpdated();
      setActiveTab('overview');
      alert('تم تحديث بيانات التكليف وتوثيق التغيير في سجل الرقابة.');
    } finally {
      setIsSavingEdit(false);
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
                {directive.code}
              </span>
              <span className="px-2.5 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-amber-300">
                {directive.source_type === 'correspondence'
                  ? 'منبثق عن مكاتبة'
                  : directive.source_type === 'meeting'
                  ? 'منبثق عن اجتماع'
                  : 'توجيه رئاسي مباشر'}
              </span>
              {overdue.isOverdue && !isCompleted && (
                <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-rose-900 text-rose-200 border border-rose-700 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>متأخر عن الموعد</span>
                </span>
              )}
              {isCompleted && (
                <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-800 text-emerald-200 border border-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>مكتمل ومستوفى</span>
                </span>
              )}
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-slate-100">{directive.title}</h2>
            <div className="flex flex-wrap items-center gap-4 text-xs text-emerald-300/80 pt-1">
              <span className="flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-emerald-400" />
                <span>{directive.assigned_department}</span>
              </span>
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                <span>{directive.assigned_person}</span>
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                <span>الاستحقاق: {formatDate(directive.due_date)}</span>
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

        {/* Progress & Status Ribbon */}
        <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-700">مؤشر الإنجاز الكلي:</span>
            <div className="w-36 bg-slate-200 rounded-full h-3 overflow-hidden border border-slate-300">
              <div
                className={`h-3 rounded-full transition-all ${
                  isCompleted ? 'bg-emerald-600' : overdue.isOverdue ? 'bg-rose-500' : 'bg-emerald-600'
                }`}
                style={{ width: `${directive.progress_percent}%` }}
              />
            </div>
            <span className="font-bold text-slate-900 text-sm">{formatNumber(directive.progress_percent)}%</span>
          </div>

          <div className="flex items-center gap-2">
            {linkedMatter && (
              <div className="flex items-center gap-1 text-[11px] text-purple-900 font-bold bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
                <FolderGit2 className="w-3.5 h-3.5 text-purple-700" />
                <span>القضية: {linkedMatter.code} — {linkedMatter.title}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="flex border-b border-slate-200 bg-white px-5 gap-2 overflow-x-auto text-xs font-semibold">
          {[
            { id: 'overview', label: t('directives_module.tab_overview') },
            { id: 'progress_log', label: t('directives_module.tab_progress_log'), count: updates.length },
            { id: 'edit', label: 'تعديل التكليف' },
            { id: 'print', label: t('directives_module.tab_print') }
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
          {/* TAB 1: OVERVIEW & INSTRUCTIONS */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <h4 className="text-xs font-bold text-slate-700">{t('directives_module.directive_instruction')}:</h4>
                <p className="text-xs text-slate-900 leading-relaxed bg-white p-3 rounded-xl border border-slate-200 font-medium">
                  {directive.instruction}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1">
                  <div className="text-xs text-slate-500">القطاع والمسؤول المنفذ:</div>
                  <div className="text-xs font-bold text-slate-900">{directive.assigned_department}</div>
                  <div className="text-xs text-emerald-700 font-medium">{directive.assigned_person}</div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1">
                  <div className="text-xs text-slate-500">تاريخ الإصدار والاستحقاق:</div>
                  <div className="text-xs font-semibold text-slate-800">تاريخ الإصدار: {formatDate(directive.issued_at)}</div>
                  <div className="text-xs font-bold text-rose-700">تاريخ الاستحقاق: {formatDate(directive.due_date)}</div>
                </div>
              </div>

              {/* Action Buttons: Close or Delete */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={handleDeleteDirective}
                  className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف وأرشفة التكليف</span>
                </button>

                {isCompleted ? (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>{t('directives_module.directive_closed_badge')}</span>
                  </div>
                ) : (
                  <button
                    onClick={handleCloseDirective}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>{t('directives_module.close_directive_btn')}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PROGRESS LOG & REPORTING */}
          {activeTab === 'progress_log' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">سجل تقارير المتابعة الدورية</h3>
                <span className="text-xs text-slate-500">إجمالي التقارير: {formatNumber(updates.length)}</span>
              </div>

              <div className="space-y-2.5">
                {updates.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
                    لم تسجل تقارير متابعة مرحلية بعد.
                  </div>
                ) : (
                  updates.map((up) => (
                    <div
                      key={up.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                          <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                          <span>نسبة الإنجاز: {formatNumber(up.progress_percent)}%</span>
                        </span>
                        <span className="text-[11px] font-mono text-slate-500">{formatDate(up.created_at, { showTime: true })}</span>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-100">
                        {up.notes}
                      </p>
                      <div className="text-[11px] text-slate-400 text-left">
                        المسجل: {up.updated_by}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add Progress Report Form */}
              <form onSubmit={handleAddProgressUpdate} className="p-4 rounded-xl bg-slate-100/70 border border-slate-200 space-y-3">
                <div className="text-xs font-bold text-slate-800">{t('directives_module.add_progress_report')}</div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    نسبة الإنجاز: ({formatNumber(newProgress)}%)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={newProgress}
                    onChange={(e) => setNewProgress(Number(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                </div>
                <textarea
                  required
                  rows={2}
                  placeholder={t('directives_module.progress_notes')}
                  value={updateNotes}
                  onChange={(e) => setUpdateNotes(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                />
                <button
                  type="submit"
                  className="py-2 px-4 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  حفظ وتوثيق تقرير المتابعة
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: EDIT DIRECTIVE FORM */}
          {activeTab === 'edit' && (
            <form onSubmit={handleSaveEdit} className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-emerald-700" />
                <span>تعديل بيانات التكليف الرئاسي (يتم توثيق كل تعديل في سجل الرقابة)</span>
              </h3>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">موضوع التكليف:</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نص التعليمات والتوجيه:</label>
                <textarea
                  required
                  rows={3}
                  value={editInstruction}
                  onChange={(e) => setEditInstruction(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">القطاع المكلف:</label>
                  <input
                    type="text"
                    required
                    value={editDept}
                    onChange={(e) => setEditDept(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المسؤول عن التنفيذ:</label>
                  <input
                    type="text"
                    required
                    value={editPerson}
                    onChange={(e) => setEditPerson(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ الاستحقاق:</label>
                <input
                  type="date"
                  required
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs text-slate-800 max-w-xs"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingEdit ? 'جاري الحفظ...' : 'حفظ التعديلات وتوثيق القيد'}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 4: PRINT DOCKET (PDF Ready) */}
          {activeTab === 'print' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer shadow"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة بطاقة التكليف الرسمي (PDF)</span>
                </button>
              </div>

              {/* Printable Docket */}
              <div className="bg-white border-2 border-slate-900 p-8 rounded-2xl text-slate-900 space-y-6 print:border-none print:p-0">
                <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
                  <div>
                    <h3 className="font-extrabold text-base">الهيئة القومية للبريد المصري</h3>
                    <h4 className="text-xs font-bold text-slate-700">مكتب رئيس مجلس الإدارة</h4>
                    <div className="text-[11px] text-slate-500 mt-1">بطاقة تكليف رئاسي تنفيذي ملزم</div>
                  </div>
                  <div className="text-left text-xs font-mono">
                    <div className="font-bold text-sm bg-slate-100 px-2 py-1 border border-slate-300 rounded">
                      {directive.code}
                    </div>
                    <div className="mt-1">تاريخ الإصدار: {formatDate(directive.issued_at)}</div>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-sm mb-1">الموضوع: {directive.title}</h4>
                  <div className="text-xs text-slate-700">القطاع المكلف: {directive.assigned_department} ({directive.assigned_person})</div>
                </div>

                <div className="border-2 border-slate-800 p-4 rounded-xl bg-slate-50 text-xs space-y-1">
                  <h5 className="font-bold text-slate-900">نص التعليمات والتوجيه الرئاسي:</h5>
                  <p className="text-slate-800 leading-relaxed">{directive.instruction}</p>
                  <div className="text-rose-700 font-bold pt-2">
                    المهلة النهائية للإنجاز: {formatDate(directive.due_date)}
                  </div>
                </div>

                <div className="pt-8 flex justify-between text-xs text-center border-t border-slate-300">
                  <div>
                    <div className="text-slate-500 mb-8">استلم للتنفيذ / المكلف</div>
                    <div className="font-bold">{directive.assigned_person}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 mb-8">يعتمد / رئيس مجلس الإدارة</div>
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
            كود التكليف: <strong className="font-mono text-slate-800">{directive.code}</strong>
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
