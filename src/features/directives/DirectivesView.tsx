import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../../i18n/i18nContext';
import {
  directiveRepo,
  auditRepo,
  matterRepo,
  notificationRepo
} from '../../data/sqlite/repositories';
import { Directive, Matter } from '../../domain/types';
import { analyzeOverdue } from '../../domain/rules/overdueLogic';
import { maskConfidentialDirective } from '../../domain/rules/confidentiality';
import { DirectiveDetailModal } from './DirectiveDetailModal';
import {
  CheckSquare,
  AlertTriangle,
  Clock,
  Building,
  User,
  CheckCircle2,
  Calendar,
  Search,
  Plus,
  ChevronLeft,
  Filter,
  ShieldCheck,
  FolderGit2
} from 'lucide-react';

export const DirectivesView: React.FC = () => {
  const { currentUser } = useAuth();
  const { t, formatNumber, formatDate } = useI18n();

  const [directives, setDirectives] = useState<Directive[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDirective, setSelectedDirective] = useState<Directive | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New Directive Form
  const [newTitle, setNewTitle] = useState('');
  const [newInstruction, setNewInstruction] = useState('');
  const [newDept, setNewDept] = useState('قطاع العمليات والخدمات البريدية');
  const [newPerson, setNewPerson] = useState('رئيس قطاع العمليات');
  const [newDueDate, setNewDueDate] = useState('2026-10-25');
  const [newPriority, setNewPriority] = useState<'normal' | 'urgent' | 'top_urgent'>('urgent');
  const [newConfidentiality, setNewConfidentiality] = useState<'normal' | 'confidential' | 'top_secret'>('normal');
  const [newMatterId, setNewMatterId] = useState('');

  const loadData = async () => {
    const [dList, mList] = await Promise.all([
      directiveRepo.getAll(),
      matterRepo.getAll()
    ]);
    const masked = dList.map((d) => maskConfidentialDirective(d, currentUser));
    setDirectives(masked);
    setMatters(mList);
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const handleOpenDetail = (d: Directive) => {
    setSelectedDirective(d);
    setIsDetailModalOpen(true);
  };

  const handleCreateDirective = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextCode = await directiveRepo.getNextCode();

    const created = await directiveRepo.create({
      code: nextCode,
      title: newTitle,
      instruction: newInstruction,
      assigned_department: newDept,
      assigned_person: newPerson,
      source_type: 'direct_instruction',
      priority: newPriority,
      confidentiality: newConfidentiality,
      status: 'assigned',
      progress_percent: 0,
      issued_at: new Date().toISOString(),
      due_date: newDueDate,
      matter_id: newMatterId || null,
      created_by: currentUser.name
    });

    await auditRepo.log({
      user_id: currentUser.id,
      user_name: currentUser.name,
      user_role: currentUser.role,
      action_type: 'CREATE',
      entity_type: 'DIRECTIVE',
      entity_id: created.id,
      before_value: null,
      after_value: `إصدار تكليف رئاسي جديد: ${created.code} - ${created.title} (المكلف: ${created.assigned_person})`,
      ip_address: '10.120.4.x (LAN)'
    });

    await notificationRepo.create({
      recipient_role: 'SECRETARY',
      title: `تكليف رئاسي جديد (${created.code})`,
      body: `أصدر السيد رئيس مجلس الإدارة تكليفاً جديداً بشأن: ${created.title}`,
      confidentiality: created.confidentiality,
      is_read: false
    });

    setIsCreateModalOpen(false);
    setNewTitle('');
    setNewInstruction('');
    await loadData();
    alert(`تم إصدار التكليف الرئاسي بنجاح برقم ${created.code}.`);
  };

  const filteredDirectives = directives.filter((d) => {
    const analysis = analyzeOverdue(d.due_date, d.status);
    if (filterStatus === 'overdue' && !analysis.isOverdue && d.status !== 'overdue') return false;
    if (filterStatus === 'active' && (d.status === 'completed' || d.status === 'closed')) return false;
    if (filterStatus === 'completed' && d.status !== 'completed' && d.status !== 'closed') return false;
    if (filterStatus === 'direct' && d.source_type !== 'direct_instruction') return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        d.title.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q) ||
        d.assigned_department.toLowerCase().includes(q) ||
        d.assigned_person.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-emerald-700" />
            <span>{t('directives_module.title')}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">{t('directives_module.subtitle')}</p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t('directives_module.create_directive')}</span>
        </button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'all', label: 'كافة التكليفات' },
            { id: 'overdue', label: 'التكليفات المتأخرة ⚠️' },
            { id: 'active', label: 'قيد التنفيذ والمتابعة' },
            { id: 'completed', label: 'المكتملة' },
            { id: 'direct', label: 'توجيهات رئاسية مباشرة' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                filterStatus === tab.id
                  ? 'bg-emerald-800 text-white font-bold'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[260px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالكود، التكليف، أو الجهة المنفذة..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 pl-8 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
        </div>
      </div>

      {/* Directives Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredDirectives.length === 0 ? (
          <div className="col-span-2 bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
            {t('common.no_records')}
          </div>
        ) : (
          filteredDirectives.map((directive) => {
            const overdue = analyzeOverdue(directive.due_date, directive.status);
            const isCompleted = directive.status === 'completed' || directive.status === 'closed';

            return (
              <div
                key={directive.id}
                onClick={() => handleOpenDetail(directive)}
                className="bg-white rounded-2xl border border-slate-200 hover:border-emerald-500 p-5 shadow-sm hover:shadow-md transition cursor-pointer space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                      {directive.code}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {overdue.isOverdue && !isCompleted && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          <span>متأخر ({formatNumber(Math.abs(overdue.daysRemaining))} يوم)</span>
                        </span>
                      )}
                      {overdue.urgencyLevel === 'due_soon' && !isCompleted && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>مستحق خلال {formatNumber(overdue.daysRemaining)} يوم</span>
                        </span>
                      )}
                      {isCompleted && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>مكتمل</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                    {directive.title}
                  </h3>

                  <p className="text-xs text-slate-600 line-clamp-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    {directive.instruction}
                  </p>

                  <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-1">
                    <span className="flex items-center gap-1 text-slate-700 font-medium">
                      <Building className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate max-w-[200px]">{directive.assigned_department}</span>
                    </span>
                    <span>الاستحقاق: <strong className="text-slate-800">{formatDate(directive.due_date)}</strong></span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 text-xs">
                  <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        isCompleted ? 'bg-emerald-600' : overdue.isOverdue ? 'bg-rose-500' : 'bg-emerald-600'
                      }`}
                      style={{ width: `${directive.progress_percent}%` }}
                    />
                  </div>
                  <span className="font-bold text-xs text-slate-800 min-w-[36px]">
                    {formatNumber(directive.progress_percent)}%
                  </span>
                  <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                    <span>التفاصيل</span>
                    <ChevronLeft className="w-4 h-4" />
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Detail Modal */}
      {isDetailModalOpen && selectedDirective && (
        <DirectiveDetailModal
          directive={selectedDirective}
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          onUpdated={loadData}
        />
      )}

      {/* Create Directive Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 text-right">
            <h3 className="text-lg font-bold text-slate-900 mb-1">{t('directives_module.create_directive')}</h3>
            <p className="text-xs text-slate-500 mb-4">يتم توليد كود التكليف الرئاسي وتوثيقه في السجل العام</p>

            <form onSubmit={handleCreateDirective} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">موضوع التكليف الرئاسي:</label>
                <input
                  type="text"
                  required
                  placeholder="موضوع التكليف الرئيسي..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نص التعليمات والتوجيه:</label>
                <textarea
                  required
                  placeholder="التعليمات التفصيلية والإجراءات المطلوبة..."
                  rows={3}
                  value={newInstruction}
                  onChange={(e) => setNewInstruction(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">القطاع المكلف:</label>
                  <select
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs text-slate-800"
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">المسؤول عن التنفيذ:</label>
                  <input
                    type="text"
                    required
                    placeholder="اسم المسؤول أو لقبه..."
                    value={newPerson}
                    onChange={(e) => setNewPerson(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ الاستحقاق:</label>
                  <input
                    type="date"
                    required
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ربط بقضية استراتيجية:</label>
                  <select
                    value={newMatterId}
                    onChange={(e) => setNewMatterId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs text-slate-800"
                  >
                    <option value="">-- بدون ربط بقضية --</option>
                    {matters.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.code} - {m.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shadow-md transition cursor-pointer"
                >
                  إصدار التكليف الرئاسي
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="py-3 px-5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
