import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../../i18n/i18nContext';
import {
  matterRepo,
  correspondenceRepo,
  meetingRepo,
  directiveRepo
} from '../../data/api/apiRepositories';
import {
  Matter,
  Correspondence,
  Meeting,
  Directive
} from '../../domain/types';
import {
  FolderGit2,
  Calendar,
  Inbox,
  CheckSquare,
  Clock,
  ArrowRight,
  ShieldCheck,
  Building,
  ChevronLeft,
  FileText
} from 'lucide-react';

export const MattersView: React.FC = () => {
  const { currentUser } = useAuth();
  const { t, formatNumber, formatDate } = useI18n();

  const [matters, setMatters] = useState<Matter[]>([]);
  const [selectedMatter, setSelectedMatter] = useState<Matter | null>(null);
  const [timelineItems, setTimelineItems] = useState<{
    id: string;
    type: 'correspondence' | 'meeting' | 'directive';
    date: string;
    title: string;
    subtitle: string;
    status: string;
  }[]>([]);

  useEffect(() => {
    const userCtx = { can_view_confidential: currentUser.can_view_confidential, role: currentUser.role, userId: currentUser.id };
    matterRepo.getAll(undefined, userCtx).then((list) => {
      setMatters(list);
      if (list.length > 0 && !selectedMatter) {
        handleSelectMatter(list[0]);
      }
    });
  }, [currentUser]);

  const handleSelectMatter = async (matter: Matter) => {
    setSelectedMatter(matter);
    const userCtx = { can_view_confidential: currentUser.can_view_confidential, role: currentUser.role, userId: currentUser.id };

    // Fetch all related items
    const [cList, mList, dList] = await Promise.all([
      correspondenceRepo.getAll({ matterId: matter.id }, userCtx),
      meetingRepo.getAll({ matterId: matter.id }, userCtx),
      directiveRepo.getAll({ matterId: matter.id }, userCtx)
    ]);

    const timeline: typeof timelineItems = [];

    cList.forEach((c) => {
      timeline.push({
        id: c.id,
        type: 'correspondence',
        date: c.date,
        title: `${c.serial_number}: ${c.subject}`,
        subtitle: `الجهة: ${c.source_or_dest_entity} — ${c.summary}`,
        status: c.status
      });
    });

    mList.forEach((m) => {
      timeline.push({
        id: m.id,
        type: 'meeting',
        date: m.start_time,
        title: `اجتماع: ${m.title}`,
        subtitle: `المكان: ${m.location}`,
        status: m.status
      });
    });

    dList.forEach((d) => {
      timeline.push({
        id: d.id,
        type: 'directive',
        date: d.issued_at,
        title: `${d.code}: ${d.title}`,
        subtitle: `المكلف: ${d.assigned_department} (${d.assigned_person}) — إنجاز: ${d.progress_percent}%`,
        status: d.status
      });
    });

    // Sort chronologically descending
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setTimelineItems(timeline);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FolderGit2 className="w-5 h-5 text-purple-700" />
            <span>{t('nav.matters')} (Executive Matters & Cases)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            ملفات القضايا والمشروعات الاستراتيجية الكبرى والخط الزمني الموحد لكافة المراسلات والاجتماعات والتكليفات
          </p>
        </div>
      </div>

      {/* Grid: Matters List (Left 4 cols) & Chronological Timeline (Right 8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Matters Selector */}
        <div className="lg:col-span-4 space-y-3">
          <div className="text-xs font-bold text-slate-600 px-1">الملفات الاستراتيجية النشطة:</div>
          <div className="space-y-2.5">
            {matters.map((matter) => {
              const isSelected = selectedMatter?.id === matter.id;
              return (
                <div
                  key={matter.id}
                  onClick={() => handleSelectMatter(matter)}
                  className={`p-4 rounded-2xl border transition cursor-pointer text-right ${
                    isSelected
                      ? 'bg-purple-50/80 border-purple-500 ring-2 ring-purple-500/20 shadow-md'
                      : 'bg-white border-slate-200 hover:border-purple-300 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-xs font-bold text-purple-900 bg-purple-100 px-2 py-0.5 rounded">
                      {matter.code}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                      {matter.status === 'active' ? 'نشط وقيد المعالجة' : 'قيد المراجعة'}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2 mb-1">
                    {matter.title}
                  </h3>
                  <div className="text-xs text-slate-500 line-clamp-2">{matter.description}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Timeline Studio */}
        <div className="lg:col-span-8">
          {selectedMatter ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
              {/* Matter Header */}
              <div className="border-b border-slate-100 pb-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-xs font-bold text-purple-900 bg-purple-100 px-2.5 py-1 rounded-lg">
                    {selectedMatter.code}
                  </span>
                  <span className="text-xs text-slate-500">
                    الجهة المسؤولة: <strong>{selectedMatter.lead_entity}</strong>
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 leading-snug">{selectedMatter.title}</h3>
                <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {selectedMatter.description}
                </p>
              </div>

              {/* Chronological Timeline */}
              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-700" />
                  <span>الخط الزمني الشامل لكافة الأنشطة والقرارات المرتبطة ({formatNumber(timelineItems.length)} إجراء):</span>
                </h4>

                {timelineItems.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400">
                    لم يتم تسجيل مراسلات أو اجتماعات مرتبطة بهذا الملف بعد.
                  </div>
                ) : (
                  <div className="relative border-r-2 border-purple-100 pr-6 space-y-6 mr-3">
                    {timelineItems.map((item) => (
                      <div key={item.id} className="relative">
                        {/* Dot indicator */}
                        <div className="absolute -right-[31px] top-1 w-4 h-4 rounded-full bg-white border-4 border-purple-600 shadow" />

                        <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 hover:border-purple-300 transition">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                            <span className="text-xs text-slate-500 font-semibold">{formatDate(item.date)}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.type === 'correspondence'
                                  ? 'bg-amber-100 text-amber-800'
                                  : item.type === 'meeting'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {item.type === 'correspondence'
                                ? 'مراسلة رسمية'
                                : item.type === 'meeting'
                                ? 'جلسة اجتماع'
                                : 'تكليف تنفيذي'}
                            </span>
                          </div>
                          <h5 className="text-sm font-bold text-slate-900 mb-1">{item.title}</h5>
                          <p className="text-xs text-slate-600">{item.subtitle}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-500">
              اختر ملفاً لعرض خطه الزمني الشامل.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
