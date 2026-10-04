import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../../i18n/i18nContext';
import {
  correspondenceRepo,
  auditRepo,
  matterRepo,
  notificationRepo
} from '../../data/sqlite/repositories';
import { CommandService } from '../../domain/services/commandService';
import { Correspondence, Matter } from '../../domain/types';
import { maskConfidentialCorrespondence } from '../../domain/rules/confidentiality';
import { CorrespondenceDetailModal } from './CorrespondenceDetailModal';
import {
  Inbox,
  Send,
  Plus,
  Search,
  Building2,
  Calendar,
  AlertCircle,
  FileText,
  Clock,
  CheckCircle2,
  Lock,
  ChevronLeft,
  Filter,
  FileCheck,
  FolderGit2,
  Tag,
  Layers,
  X,
  Sparkles
} from 'lucide-react';

const CATEGORIES = [
  { id: 'all', labelKey: 'correspondence_module.category_all' },
  { id: 'operations', labelKey: 'correspondence_module.category_operations' },
  { id: 'financial', labelKey: 'correspondence_module.category_financial' },
  { id: 'legal', labelKey: 'correspondence_module.category_legal' },
  { id: 'technology', labelKey: 'correspondence_module.category_technology' },
  { id: 'sovereign', labelKey: 'correspondence_module.category_sovereign' },
  { id: 'projects', labelKey: 'correspondence_module.category_projects' },
  { id: 'citizens', labelKey: 'correspondence_module.category_citizens' }
];

const PRESET_TAGS = [
  'عاجل جداً',
  'سري للغاية',
  'روتيني / عادي',
  'متابعة مجلس الوزراء',
  'جلسة مجلس الإدارة',
  'مهلة حرجة 48 ساعة',
  'جاهز للتأشيرة',
  'خطة استثمارية'
];

export const CorrespondenceView: React.FC = () => {
  const { currentUser } = useAuth();
  const { t, formatNumber, formatDate } = useI18n();

  const [letters, setLetters] = useState<Correspondence[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'incoming' | 'outgoing' | 'awaiting' | 'urgent' | 'confidential'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLetter, setSelectedLetter] = useState<Correspondence | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  // New Letter Registration Form
  const [newType, setNewType] = useState<'incoming' | 'outgoing'>('incoming');
  const [newEntity, setNewEntity] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newPriority, setNewPriority] = useState<'normal' | 'urgent' | 'top_urgent'>('normal');
  const [newConfidentiality, setNewConfidentiality] = useState<'normal' | 'confidential' | 'top_secret'>('normal');
  const [newCategory, setNewCategory] = useState<string>('operations');
  const [newTags, setNewTags] = useState<string[]>([]);
  const [tagInputText, setTagInputText] = useState('');
  const [newSummary, setNewSummary] = useState('');
  const [newMatterId, setNewMatterId] = useState<string>('');

  const isSecretary = currentUser.role === 'SECRETARY';

  const loadData = async () => {
    const userCtx = { can_view_confidential: currentUser.can_view_confidential, role: currentUser.role };
    const [cList, mList] = await Promise.all([
      correspondenceRepo.getAll(undefined, userCtx),
      matterRepo.getAll(undefined, userCtx)
    ]);
    setLetters(cList);
    setMatters(mList);
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const handleOpenDetail = (letter: Correspondence) => {
    setSelectedLetter(letter);
    setIsDetailModalOpen(true);
  };

  const handleAddTagToNew = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    if (!newTags.includes(trimmed)) {
      setNewTags([...newTags, trimmed]);
    }
    setTagInputText('');
  };

  const handleRemoveTagFromNew = (tagToRemove: string) => {
    setNewTags(newTags.filter((t) => t !== tagToRemove));
  };

  const handleRegisterLetter = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextSerial = await correspondenceRepo.getNextSerial(newType);

    const created = await CommandService.createCorrespondence({
      serial_number: nextSerial,
      type: newType,
      date: new Date().toISOString().split('T')[0],
      source_or_dest_entity: newEntity,
      subject: newSubject,
      priority: newPriority,
      confidentiality: newConfidentiality,
      category: newCategory,
      tags: newTags,
      summary: newSummary,
      status: newType === 'incoming' ? 'registered' : 'draft',
      matter_id: newMatterId || null,
      created_by: currentUser.name
    }, currentUser);

    // Notify Chairman if urgent
    if (newPriority === 'top_urgent' || newPriority === 'urgent') {
      await CommandService.createNotification({
        recipient_role: 'CHAIRMAN',
        title: `خطاب جديد عاجل: ${created.serial_number}`,
        body: `ورد خطاب عاجل من ${created.source_or_dest_entity} بشأن: ${created.subject}`,
        confidentiality: created.confidentiality,
        is_read: false
      }, currentUser);
    }

    setIsRegisterModalOpen(false);
    setNewEntity('');
    setNewSubject('');
    setNewSummary('');
    setNewTags([]);
    setTagInputText('');
    await loadData();
  };

  // Collect all unique tags across letters for quick filtering
  const allUniqueTags = Array.from(
    new Set(
      letters
        .flatMap((l) => l.tags || [])
        .concat(PRESET_TAGS)
    )
  ).filter(Boolean);

  const filteredLetters = letters.filter((item) => {
    if (filterType === 'incoming' && item.type !== 'incoming') return false;
    if (filterType === 'outgoing' && item.type !== 'outgoing') return false;
    if (filterType === 'awaiting' && (item.status !== 'presented_to_chairman' && item.status !== 'briefing_prepared')) return false;
    if (filterType === 'urgent' && item.priority === 'normal') return false;
    if (filterType === 'confidential' && item.confidentiality === 'normal') return false;

    if (categoryFilter !== 'all' && item.category !== categoryFilter) {
      return false;
    }

    if (selectedTagFilter !== 'all') {
      if (!item.tags || !item.tags.includes(selectedTagFilter)) {
        return false;
      }
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const tagsMatch = item.tags && item.tags.some((t) => t.toLowerCase().includes(q));
      return (
        item.subject.toLowerCase().includes(q) ||
        item.serial_number.toLowerCase().includes(q) ||
        item.source_or_dest_entity.toLowerCase().includes(q) ||
        tagsMatch
      );
    }
    return true;
  });

  const getCategoryBadge = (cat?: string) => {
    switch (cat) {
      case 'financial':
        return { label: t('correspondence_module.category_financial'), color: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'legal':
        return { label: t('correspondence_module.category_legal'), color: 'bg-purple-50 text-purple-800 border-purple-200' };
      case 'technology':
        return { label: t('correspondence_module.category_technology'), color: 'bg-blue-50 text-blue-800 border-blue-200' };
      case 'sovereign':
        return { label: t('correspondence_module.category_sovereign'), color: 'bg-amber-50 text-amber-900 border-amber-200' };
      case 'projects':
        return { label: t('correspondence_module.category_projects'), color: 'bg-teal-50 text-teal-800 border-teal-200' };
      case 'citizens':
        return { label: t('correspondence_module.category_citizens'), color: 'bg-rose-50 text-rose-800 border-rose-200' };
      case 'operations':
      default:
        return { label: t('correspondence_module.category_operations'), color: 'bg-slate-100 text-slate-800 border-slate-200' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Inbox className="w-5 h-5 text-emerald-700" />
            <span>{t('correspondence_module.title')}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">{t('correspondence_module.subtitle')}</p>
        </div>

        {isSecretary && (
          <button
            onClick={() => setIsRegisterModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('correspondence_module.register_incoming')}</span>
          </button>
        )}
      </div>

      {/* Filter Tabs & Search & Tag/Category Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3.5">
        {/* Row 1: Main Type Tabs + Search */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'all', label: 'كافة المعاملات' },
              { id: 'awaiting', label: 'بانتظار التأشيرة (معروض)' },
              { id: 'incoming', label: 'الوارد (IN)' },
              { id: 'outgoing', label: 'الصادر (OUT)' },
              { id: 'urgent', label: 'عاجل ⚡' },
              { id: 'confidential', label: 'سري 🔒' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                  filterType === tab.id
                    ? 'bg-emerald-800 text-white font-bold shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[260px] flex-1 sm:flex-initial">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالرقم، الموضوع، الجهة، أو الوسم..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 pl-8 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
          </div>
        </div>

        {/* Row 2: Category Selector & Summary Count */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-bold flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-emerald-700" />
              <span>{t('correspondence_module.category_label')}:</span>
            </span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg py-1 px-2.5 text-xs text-slate-800 font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {t(cat.labelKey)}
                </option>
              ))}
            </select>
          </div>

          <div className="text-[11px] text-slate-400 font-mono">
            عرض {formatNumber(filteredLetters.length)} من إجمالي {formatNumber(letters.length)} معاملة
          </div>
        </div>

        {/* Row 3: Interactive Quick Tags Cloud */}
        <div className="pt-2 border-t border-slate-100 flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-500 font-semibold flex items-center gap-1 flex-shrink-0">
            <Tag className="w-3.5 h-3.5 text-amber-600" />
            <span>{t('correspondence_module.filter_by_tag')}:</span>
          </span>

          <button
            onClick={() => setSelectedTagFilter('all')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition whitespace-nowrap cursor-pointer ${
              selectedTagFilter === 'all'
                ? 'bg-emerald-700 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t('correspondence_module.tag_all')}
          </button>

          {allUniqueTags.map((tag) => {
            const isSelected = selectedTagFilter === tag;
            return (
              <button
                key={tag}
                onClick={() => setSelectedTagFilter(isSelected ? 'all' : tag)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition whitespace-nowrap flex items-center gap-1 cursor-pointer border ${
                  isSelected
                    ? 'bg-amber-600 border-amber-600 text-white font-bold shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-amber-50 hover:border-amber-300'
                }`}
              >
                <span>#{tag}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Correspondence Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredLetters.length === 0 ? (
          <div className="col-span-2 bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
            {t('common.no_records')}
          </div>
        ) : (
          filteredLetters.map((item) => {
            const categoryBadge = getCategoryBadge(item.category);

            return (
              <div
                key={item.id}
                onClick={() => handleOpenDetail(item)}
                className="bg-white rounded-2xl border border-slate-200 hover:border-emerald-500 p-5 shadow-sm hover:shadow-md transition cursor-pointer space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-xs font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-800">
                        {item.serial_number}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-600">
                        {item.type === 'incoming' ? 'وارد' : 'صادر'}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${categoryBadge.color}`}>
                        {categoryBadge.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {item.priority === 'top_urgent' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                          عاجل جداً
                        </span>
                      )}
                      {item.confidentiality !== 'normal' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 flex items-center gap-0.5">
                          <Lock className="w-3 h-3" />
                          <span>{item.confidentiality === 'top_secret' ? 'سري للغاية' : 'سري'}</span>
                        </span>
                      )}
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          item.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'presented_to_chairman'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : item.status === 'briefing_prepared'
                            ? 'bg-blue-100 text-blue-800'
                            : item.status === 'referred'
                            ? 'bg-indigo-100 text-indigo-800'
                            : item.status === 'dispatched'
                            ? 'bg-teal-100 text-teal-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {item.status === 'approved'
                          ? 'معتمد / موافقة'
                          : item.status === 'presented_to_chairman'
                          ? 'معروض على الرئيس'
                          : item.status === 'briefing_prepared'
                          ? 'مذكرة العرض جاهزة'
                          : item.status === 'referred'
                          ? 'محال للتنفيذ'
                          : item.status === 'dispatched'
                          ? 'صادر رسمياً'
                          : 'مسجل جديد'}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                    {item.subject}
                  </h3>

                  <p className="text-xs text-slate-500 line-clamp-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    {item.summary}
                  </p>

                  {/* Tags Badges */}
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {item.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50/80 text-amber-900 border border-amber-200 flex items-center gap-1"
                        >
                          <Tag className="w-2.5 h-2.5 text-amber-600" />
                          <span>{tag}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-1">
                    <span className="flex items-center gap-1 text-slate-700 font-medium">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate max-w-[200px]">{item.source_or_dest_entity}</span>
                    </span>
                    <span>{formatDate(item.date)}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <span>فتح مذكرة العرض والتأشيرة</span>
                    <ChevronLeft className="w-4 h-4" />
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Detail & Endorsement Modal */}
      {isDetailModalOpen && selectedLetter && (
        <CorrespondenceDetailModal
          correspondence={selectedLetter}
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          onUpdated={loadData}
        />
      )}

      {/* Register New Correspondence Modal */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 text-right">
            <h3 className="text-lg font-bold text-slate-900 mb-1">{t('correspondence_module.register_incoming')}</h3>
            <p className="text-xs text-slate-500 mb-4">يتم توليد الرقم المتسلسل السنوي وتطبيق قواعد الحوكمة والوسوم آلياً</p>

            <form onSubmit={handleRegisterLetter} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">نوع المعاملة:</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-600"
                  >
                    <option value="incoming">وارد (IN-2026-XXXX)</option>
                    <option value="outgoing">صادر (OUT-2026-XXXX)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">درجة الأولوية:</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800"
                  >
                    <option value="normal">عادي</option>
                    <option value="urgent">عاجل</option>
                    <option value="top_urgent">عاجل جداً وخاص</option>
                  </select>
                </div>
              </div>

              {/* Category & Confidentiality */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{t('correspondence_module.category_label')}:</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800"
                  >
                    {CATEGORIES.filter((c) => c.id !== 'all').map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {t(cat.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">درجة السرية:</label>
                  <select
                    value={newConfidentiality}
                    onChange={(e) => setNewConfidentiality(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800"
                  >
                    <option value="normal">عادي (غير سري)</option>
                    <option value="confidential">سري</option>
                    <option value="top_secret">سري للغاية</option>
                  </select>
                </div>
              </div>

              {/* Tags Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  {t('correspondence_module.tags_label')}:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInputText}
                    onChange={(e) => setTagInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTagToNew(tagInputText);
                      }
                    }}
                    placeholder={t('correspondence_module.tags_placeholder')}
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddTagToNew(tagInputText)}
                    className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl cursor-pointer"
                  >
                    إضافة وسم
                  </button>
                </div>

                {/* Preset quick tags */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-400">وسوم سريعة:</span>
                  {PRESET_TAGS.map((pTag) => {
                    const isAdded = newTags.includes(pTag);
                    return (
                      <button
                        key={pTag}
                        type="button"
                        onClick={() => (isAdded ? handleRemoveTagFromNew(pTag) : handleAddTagToNew(pTag))}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition cursor-pointer border ${
                          isAdded
                            ? 'bg-amber-100 border-amber-400 text-amber-900 font-bold'
                            : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-amber-50'
                        }`}
                      >
                        {isAdded ? `✓ ${pTag}` : `+ ${pTag}`}
                      </button>
                    );
                  })}
                </div>

                {/* Selected tags preview */}
                {newTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                    {newTags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5"
                      >
                        <span>#{tag}</span>
                        <X
                          className="w-3 h-3 hover:text-rose-600 cursor-pointer"
                          onClick={() => handleRemoveTagFromNew(tag)}
                        />
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {newType === 'incoming' ? 'الجهة الوارد منها الخطاب:' : 'الجهة الصادر إليها:'}
                </label>
                <input
                  type="text"
                  required
                  value={newEntity}
                  onChange={(e) => setNewEntity(e.target.value)}
                  placeholder="مثال: وزارة الاتصالات وتكنولوجيا المعلومات - مكتب الوزير"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">موضوع الخطاب / المعاملة:</label>
                <input
                  type="text"
                  required
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="موضوع المعاملة الرسمي..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملخص المضمون:</label>
                <textarea
                  required
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  placeholder="ملخص وافٍ لمحتوى المعاملة والإجراء المطلوب..."
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ربط بملف / قضية استراتيجية:</label>
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

              <div className="flex gap-3 pt-3">
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shadow-md transition cursor-pointer"
                >
                  تأكيد وقيد المعاملة
                </button>
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
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
