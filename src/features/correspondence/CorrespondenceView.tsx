import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../../i18n/i18nContext';
import {
  correspondenceRepo,
  auditRepo,
  matterRepo,
  notificationRepo
} from '../../data/sqlite/repositories';
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
  FolderGit2
} from 'lucide-react';

export const CorrespondenceView: React.FC = () => {
  const { currentUser } = useAuth();
  const { t, formatNumber, formatDate } = useI18n();

  const [letters, setLetters] = useState<Correspondence[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'incoming' | 'outgoing' | 'awaiting' | 'urgent' | 'confidential'>('all');
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
  const [newSummary, setNewSummary] = useState('');
  const [newMatterId, setNewMatterId] = useState<string>('');

  const isSecretary = currentUser.role === 'SECRETARY';

  const loadData = async () => {
    const [cList, mList] = await Promise.all([
      correspondenceRepo.getAll(),
      matterRepo.getAll()
    ]);
    const masked = cList.map((c) => maskConfidentialCorrespondence(c, currentUser));
    setLetters(masked);
    setMatters(mList);
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const handleOpenDetail = (letter: Correspondence) => {
    setSelectedLetter(letter);
    setIsDetailModalOpen(true);
  };

  const handleRegisterLetter = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextSerial = await correspondenceRepo.getNextSerial(newType);

    const created = await correspondenceRepo.create({
      serial_number: nextSerial,
      type: newType,
      date: new Date().toISOString().split('T')[0],
      source_or_dest_entity: newEntity,
      subject: newSubject,
      priority: newPriority,
      confidentiality: newConfidentiality,
      summary: newSummary,
      status: newType === 'incoming' ? 'registered' : 'draft',
      matter_id: newMatterId || null,
      created_by: currentUser.name
    });

    await auditRepo.log({
      user_id: currentUser.id,
      user_name: currentUser.name,
      user_role: currentUser.role,
      action_type: 'CREATE',
      entity_type: 'CORRESPONDENCE',
      entity_id: created.id,
      before_value: null,
      after_value: `تسجيل خطاب ${newType === 'incoming' ? 'وارد' : 'صادر'} رقم ${created.serial_number} من/إلى ${created.source_or_dest_entity}`,
      ip_address: '10.120.4.x (LAN)'
    });

    // Notify Chairman if urgent
    if (newPriority === 'top_urgent' || newPriority === 'urgent') {
      await notificationRepo.create({
        recipient_role: 'CHAIRMAN',
        title: `خطاب جديد عاجل: ${created.serial_number}`,
        body: `ورد خطاب عاجل من ${created.source_or_dest_entity} بشأن: ${created.subject}`,
        confidentiality: created.confidentiality,
        is_read: false
      });
    }

    setIsRegisterModalOpen(false);
    setNewEntity('');
    setNewSubject('');
    setNewSummary('');
    await loadData();
  };

  const filteredLetters = letters.filter((item) => {
    if (filterType === 'incoming' && item.type !== 'incoming') return false;
    if (filterType === 'outgoing' && item.type !== 'outgoing') return false;
    if (filterType === 'awaiting' && (item.status !== 'presented_to_chairman' && item.status !== 'briefing_prepared')) return false;
    if (filterType === 'urgent' && item.priority === 'normal') return false;
    if (filterType === 'confidential' && item.confidentiality === 'normal') return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        item.subject.toLowerCase().includes(q) ||
        item.serial_number.toLowerCase().includes(q) ||
        item.source_or_dest_entity.toLowerCase().includes(q)
      );
    }
    return true;
  });

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

      {/* Filter Tabs & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'all', label: 'كافة المعاملات' },
            { id: 'awaiting', label: 'بانتظار التأشيرة (معروض)' },
            { id: 'incoming', label: 'الوارد (IN)' },
            { id: 'outgoing', label: 'الصادر (OUT)' },
            { id: 'urgent', label: 'عاجل' },
            { id: 'confidential', label: 'سري' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                filterType === tab.id
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
            placeholder="بحث بالرقم المسلسل، الموضوع، أو الجهة..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 pl-8 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
        </div>
      </div>

      {/* Correspondence Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredLetters.length === 0 ? (
          <div className="col-span-2 bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
            {t('common.no_records')}
          </div>
        ) : (
          filteredLetters.map((item) => (
            <div
              key={item.id}
              onClick={() => handleOpenDetail(item)}
              className="bg-white rounded-2xl border border-slate-200 hover:border-emerald-500 p-5 shadow-sm hover:shadow-md transition cursor-pointer space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-800">
                      {item.serial_number}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-600">
                      {item.type === 'incoming' ? 'وارد' : 'صادر'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
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
          ))
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
            <p className="text-xs text-slate-500 mb-4">يتم توليد الرقم المتسلسل السنوي آلياً وفق الأصول الحكومية المصرية</p>

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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">درجة السرية:</label>
                  <select
                    value={newConfidentiality}
                    onChange={(e) => setNewConfidentiality(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs text-slate-800"
                  >
                    <option value="normal">عادي (غير سري)</option>
                    <option value="confidential">سري</option>
                    <option value="top_secret">سري للغاية</option>
                  </select>
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
