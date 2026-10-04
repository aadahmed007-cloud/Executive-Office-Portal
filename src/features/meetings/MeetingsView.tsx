import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../../i18n/i18nContext';
import { meetingRepo, auditRepo, matterRepo } from '../../data/sqlite/repositories';
import { Meeting, Matter } from '../../domain/types';
import { detectMeetingConflict } from '../../domain/rules/conflictDetector';
import { maskConfidentialMeeting } from '../../domain/rules/confidentiality';
import { MeetingDetailModal } from './MeetingDetailModal';
import {
  Calendar,
  Clock,
  MapPin,
  Plus,
  Users,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Search,
  Building,
  ChevronLeft,
  CalendarDays,
  Sparkles,
  Layers
} from 'lucide-react';

export const MeetingsView: React.FC = () => {
  const { currentUser } = useAuth();
  const { t, formatNumber, formatDate } = useI18n();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isNewMeetingModalOpen, setIsNewMeetingModalOpen] = useState(false);

  // New Meeting Form State
  const [newTitle, setNewTitle] = useState('');
  const [newLocation, setNewLocation] = useState('قاعة مجلس الإدارة الكبرى - القرية الذكية');
  const [newStartTime, setNewStartTime] = useState('2026-10-10T10:00');
  const [newEndTime, setNewEndTime] = useState('2026-10-10T12:00');
  const [newMeetingType, setNewMeetingType] = useState<'internal' | 'external_entity' | 'ministerial' | 'board'>('internal');
  const [newMatterId, setNewMatterId] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  const isSecretary = currentUser.role === 'SECRETARY';

  const loadMeetings = async () => {
    const userCtx = { can_view_confidential: currentUser.can_view_confidential, role: currentUser.role };
    const [list, mList] = await Promise.all([
      meetingRepo.getAll(undefined, userCtx),
      matterRepo.getAll(undefined, userCtx)
    ]);
    setMeetings(list);
    setMatters(mList);
  };

  useEffect(() => {
    loadMeetings();
  }, [currentUser]);

  // Real-time conflict detection on form change
  useEffect(() => {
    if (!newStartTime || !newEndTime) return;
    const conflictResult = detectMeetingConflict(
      {
        location: newLocation,
        start_time: newStartTime,
        end_time: newEndTime
      },
      meetings
    );

    if (conflictResult.hasConflict) {
      const conf = conflictResult.conflictingMeetings[0];
      setConflictWarning(
        `تنبيه تعارض مواعيد: يوجد اجتماع متداخل في نفس التوقيت («${conf?.title}» من ${formatDate(conf?.start_time, { showTime: true })}).`
      );
    } else {
      setConflictWarning(null);
    }
  }, [newStartTime, newEndTime, newLocation, meetings]);

  const handleOpenDetail = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setIsDetailModalOpen(true);
  };

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (conflictWarning) {
      if (!window.confirm('يوجد تعارض زمني مع مواعيد أخرى، هل ترغب في تثبيت الحجز بالرغم من التعارض؟')) {
        return;
      }
    }

    const created = await meetingRepo.create({
      title: newTitle,
      location: newLocation,
      start_time: newStartTime,
      end_time: newEndTime,
      meeting_type: newMeetingType,
      status: 'scheduled',
      confidentiality: 'normal',
      matter_id: newMatterId || null,
      notes: newNotes,
      created_by: currentUser.name
    });

    await auditRepo.log({
      user_id: currentUser.id,
      user_name: currentUser.name,
      user_role: currentUser.role,
      action_type: 'CREATE',
      entity_type: 'MEETING',
      entity_id: created.id,
      before_value: null,
      after_value: `جدولة اجتماع جديد: ${created.title} في ${created.location}`,
      ip_address: '10.120.4.x (LAN)'
    });

    setIsNewMeetingModalOpen(false);
    setNewTitle('');
    setNewNotes('');
    await loadMeetings();
  };

  const filteredMeetings = meetings.filter((m) => {
    const matchesFilter = filterType === 'all' || m.meeting_type === filterType;
    const matchesSearch =
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-emerald-700" />
            <span>{t('meetings.title')}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">{t('meetings.subtitle')}</p>
        </div>

        {isSecretary && (
          <button
            onClick={() => setIsNewMeetingModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('meetings.schedule_new')}</span>
          </button>
        )}
      </div>

      {/* Filters & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2">
          {['all', 'board', 'ministerial', 'external_entity', 'internal'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                filterType === type
                  ? 'bg-emerald-800 text-white font-bold'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {type === 'all'
                ? 'كافة المواعيد'
                : type === 'board'
                ? 'مجلس الإدارة'
                : type === 'ministerial'
                ? 'لقاءات وزارية وسيادية'
                : type === 'external_entity'
                ? 'جهات خارجية'
                : 'اجتماعات داخلية'}
            </button>
          ))}
        </div>

        <div className="relative min-w-[260px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بموضوع الاجتماع أو القاعة..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 pl-8 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
        </div>
      </div>

      {/* Meetings Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredMeetings.length === 0 ? (
          <div className="col-span-2 bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
            {t('common.no_records')}
          </div>
        ) : (
          filteredMeetings.map((meeting) => (
            <div
              key={meeting.id}
              onClick={() => handleOpenDetail(meeting)}
              className="bg-white rounded-2xl border border-slate-200 hover:border-emerald-500 p-5 shadow-sm hover:shadow-md transition cursor-pointer space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {meeting.meeting_type === 'board'
                      ? 'جلسة مجلس إدارة'
                      : meeting.meeting_type === 'ministerial'
                      ? 'لقاء وزاري'
                      : meeting.meeting_type === 'external_entity'
                      ? 'جهة خارجية'
                      : 'اجتماع داخلي'}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded text-[11px] font-semibold ${
                      meeting.status === 'confirmed'
                        ? 'bg-emerald-50 text-emerald-700'
                        : meeting.status === 'in_session'
                        ? 'bg-amber-100 text-amber-900 animate-pulse'
                        : meeting.status === 'minutes_approved'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {meeting.status === 'confirmed'
                      ? 'مؤكد وجاهز'
                      : meeting.status === 'in_session'
                      ? 'منعقد حالياً'
                      : meeting.status === 'minutes_approved'
                      ? 'المحضر معتمد'
                      : 'مجدول'}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 leading-snug">{meeting.title}</h3>

                <div className="space-y-1 text-xs text-slate-600 pt-1">
                  <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    <span>{formatDate(meeting.start_time, { showTime: true })}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span>{meeting.location}</span>
                  </div>
                </div>

                {meeting.notes && (
                  <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 line-clamp-2">
                    {meeting.notes}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <span>فتح الملف الكامل (الأجندة والمحضر والقرارات)</span>
                  <ChevronLeft className="w-4 h-4" />
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Meeting Detail Modal */}
      {isDetailModalOpen && selectedMeeting && (
        <MeetingDetailModal
          meeting={selectedMeeting}
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          onMeetingUpdated={loadMeetings}
        />
      )}

      {/* New Meeting Modal */}
      {isNewMeetingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 text-right">
            <h3 className="text-lg font-bold text-slate-900 mb-1">{t('meetings.schedule_new')}</h3>
            <p className="text-xs text-slate-500 mb-4">يتم فحص تعارض المواعيد آلياً لضمان عدم تداخل التوقيت أو القاعة</p>

            {conflictWarning && (
              <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>{conflictWarning}</span>
              </div>
            )}

            <form onSubmit={handleCreateMeeting} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">موضوع الاجتماع:</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="مثال: مراجعة خطة ميكنة المعاشات بالقرية الذكية"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t('meetings.location')}:</label>
                <select
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-600"
                >
                  <option value="قاعة مجلس الإدارة الكبرى - القرية الذكية">قاعة مجلس الإدارة الكبرى - القرية الذكية</option>
                  <option value="قاعة الاجتماعات الصغرى (ب) - القرية الذكية">قاعة الاجتماعات الصغرى (ب) - القرية الذكية</option>
                  <option value="مكتب رئيس مجلس الإدارة - القرية الذكية">مكتب رئيس مجلس الإدارة - القرية الذكية</option>
                  <option value="مبنى الهيئة بالعاصمة الإدارية الجديدة">مبنى الهيئة بالعاصمة الإدارية الجديدة</option>
                  <option value="مبنى بريد العتبة التاريخي">مبنى بريد العتبة التاريخي</option>
                  <option value="قاعة الفيديو كونفرانس">قاعة الفيديو كونفرانس</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{t('meetings.start_time')}:</label>
                  <input
                    type="datetime-local"
                    required
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{t('meetings.end_time')}:</label>
                  <input
                    type="datetime-local"
                    required
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{t('meetings.meeting_type')}:</label>
                  <select
                    value={newMeetingType}
                    onChange={(e) => setNewMeetingType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs text-slate-800"
                  >
                    <option value="internal">اجتماع داخلي</option>
                    <option value="board">جلسة مجلس إدارة</option>
                    <option value="ministerial">لقاء وزاري وسيادي</option>
                    <option value="external_entity">جهات خارجية</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{t('meetings.matter_link')}:</label>
                  <select
                    value={newMatterId}
                    onChange={(e) => setNewMatterId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs text-slate-800"
                  >
                    <option value="">-- بدون ربط بقضية --</option>
                    {matters.map((mat) => (
                      <option key={mat.id} value={mat.id}>
                        {mat.code} - {mat.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات تحضيرية:</label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="المستندات المطلوبة، أو قائمة الحضور المبدئية..."
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs text-slate-800"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shadow-md transition cursor-pointer"
                >
                  تأكيد وحفظ الاجتماع
                </button>
                <button
                  type="button"
                  onClick={() => setIsNewMeetingModalOpen(false)}
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
