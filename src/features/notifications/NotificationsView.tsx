import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../../i18n/i18nContext';
import { notificationRepo } from '../../data/sqlite/repositories';
import { Notification } from '../../domain/types';
import { maskNotification } from '../../domain/rules/confidentiality';
import { Bell, CheckCheck, Clock, ShieldAlert } from 'lucide-react';

export const NotificationsView: React.FC = () => {
  const { currentUser } = useAuth();
  const { t, formatNumber, formatDate } = useI18n();

  const [notifications, setNotifications] = useState<Notification[]>([]);

  const loadNotifications = async () => {
    const list = await notificationRepo.getAllForRole(currentUser.role);
    const masked = list.map((n) => maskNotification(n, currentUser));
    setNotifications(masked);
  };

  useEffect(() => {
    loadNotifications();
  }, [currentUser]);

  const handleMarkAllRead = async () => {
    await notificationRepo.markAllAsRead(currentUser.role);
    await loadNotifications();
  };

  const handleMarkAsRead = async (id: string) => {
    await notificationRepo.markAsRead(id);
    await loadNotifications();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Title */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-emerald-700" />
            <span>التنبيهات والإشعارات الرئاسية</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            إشعارات داخلية فورية عن التأشيرات الجديدة، التكليفات العاجلة، والمواعيد المقتربة
          </p>
        </div>

        {notifications.some((n) => !n.is_read) && (
          <button
            onClick={handleMarkAllRead}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCheck className="w-4 h-4 text-emerald-600" />
            <span>تحديد الكل كمقروء</span>
          </button>
        )}
      </div>

      {/* List */}
      <div className="space-y-2.5">
        {notifications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
            لا توجد إشعارات حالياً.
          </div>
        ) : (
          notifications.map((item) => (
            <div
              key={item.id}
              onClick={() => handleMarkAsRead(item.id)}
              className={`p-4 rounded-2xl border transition cursor-pointer text-right flex items-start justify-between gap-4 ${
                !item.is_read
                  ? 'bg-emerald-50/50 border-emerald-300 shadow-sm'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {!item.is_read && (
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                  )}
                  <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{item.body}</p>
                <div className="text-[11px] text-slate-400 flex items-center gap-1 pt-1 font-mono">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>{formatDate(item.created_at, { showTime: true })}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
