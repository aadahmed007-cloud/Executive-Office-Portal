import React, { useState } from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import { useI18n } from '../../i18n/i18nContext';
import { QuickRoleSwitcher } from '../components/QuickRoleSwitcher';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { SettingsModal } from '../components/SettingsModal';
import { LockScreen } from '../../features/auth/LockScreen';
import { LoginView } from '../../features/auth/LoginView';
import { PasswordChangeModal } from '../../features/auth/PasswordChangeModal';

// Feature Views
import { SecretaryDashboard } from '../../features/dashboard-secretary/SecretaryDashboard';
import { ChairmanDashboard } from '../../features/dashboard-chairman/ChairmanDashboard';
import { MeetingsView } from '../../features/meetings/MeetingsView';
import { CorrespondenceView } from '../../features/correspondence/CorrespondenceView';
import { DirectivesView } from '../../features/directives/DirectivesView';
import { MattersView } from '../../features/matters/MattersView';
import { ContactsView } from '../../features/contacts/ContactsView';
import { AuditLogView } from '../../features/audit/AuditLogView';
import { NotificationsView } from '../../features/notifications/NotificationsView';
import { WeeklySummaryView } from '../../features/reports/WeeklySummaryView';

export const MainLayout: React.FC = () => {
  const { currentUser, isAuthenticated, isLocked, mustChangePasswordPrompt } = useAuth();
  const { dir } = useI18n();

  // Active view tab state (default changes based on role)
  const [activeTab, setActiveTab] = useState<string>(() =>
    currentUser.role === 'CHAIRMAN' ? 'dashboard_chairman' : 'dashboard_secretary'
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // If user is not authenticated, render official LoginView
  if (!isAuthenticated) {
    return <LoginView />;
  }

  // If role switches, switch default dashboard if on a dashboard
  React.useEffect(() => {
    if (currentUser.role === 'CHAIRMAN' && activeTab === 'dashboard_secretary') {
      setActiveTab('dashboard_chairman');
    } else if (currentUser.role === 'SECRETARY' && activeTab === 'dashboard_chairman') {
      setActiveTab('dashboard_secretary');
    }
  }, [currentUser.role]);

  const handleDataReset = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div dir={dir} className="min-h-screen bg-slate-100 flex flex-col text-slate-900 font-sans selection:bg-emerald-200">
      {/* 1. Quick Role Switcher & Inactivity Lock Bar */}
      <QuickRoleSwitcher />

      {/* 2. Official Header */}
      <Header
        onOpenSettings={() => setIsSettingsOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* 3. Main Workspace Shell */}
      <div className="flex-1 flex flex-col md:flex-row max-w-7xl w-full mx-auto p-3 sm:p-4 lg:p-6 gap-4 lg:gap-6">
        {/* Navigation Sidebar */}
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Dynamic Content Panel */}
        <main className="flex-1 min-w-0" key={refreshKey}>
          {activeTab === 'dashboard_secretary' && <SecretaryDashboard onNavigate={setActiveTab} />}
          {activeTab === 'dashboard_chairman' && <ChairmanDashboard onNavigate={setActiveTab} />}
          {activeTab === 'meetings' && <MeetingsView />}
          {activeTab === 'correspondence' && <CorrespondenceView />}
          {activeTab === 'directives' && <DirectivesView />}
          {activeTab === 'matters' && <MattersView />}
          {activeTab === 'contacts' && <ContactsView />}
          {activeTab === 'audit_log' && <AuditLogView />}
          {activeTab === 'notifications' && <NotificationsView />}
          {activeTab === 'reports' && <WeeklySummaryView />}
          {activeTab === 'settings' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200">
              <h2 className="text-lg font-bold mb-4">إعدادات النظام وإدارة قاعدة البيانات</h2>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="px-4 py-2 bg-emerald-700 text-white rounded-xl text-xs font-bold"
              >
                فتح نافذة إدارة SQLite والنسخ الاحتياطي
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Settings / SQLite Management Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onDataReset={handleDataReset}
      />

      {/* Lock Screen when auto-logout activates */}
      {isLocked && <LockScreen />}

      {/* Forced Password Change Modal */}
      {mustChangePasswordPrompt && <PasswordChangeModal />}
    </div>
  );
};
