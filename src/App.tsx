import React, { useState, useEffect } from 'react';
import { I18nProvider } from './i18n/i18nContext';
import { AuthProvider } from './features/auth/AuthContext';
import { MainLayout } from './ui/layouts/MainLayout';
import { ErrorBoundary } from './ui/components/ErrorBoundary';
import { sqliteEngine } from './data/database/sqliteEngine';
import { runConflictTests } from './tests/conflictDetector.test';
import { runSerialTests } from './tests/serialGenerator.test';
import { runOverdueTests } from './tests/overdueLogic.test';
import { HardDrive, ShieldCheck } from 'lucide-react';

export default function App() {
  const [isDbReady, setIsDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    // Run deterministic domain tests
    try {
      const conflictOk = runConflictTests();
      const serialOk = runSerialTests();
      const overdueOk = runOverdueTests();
      if (conflictOk && serialOk && overdueOk) {
        console.log('✅ All deterministic domain unit tests passed successfully.');
      }
    } catch (e) {
      console.warn('Unit tests verification warning:', e);
    }

    sqliteEngine
      .init()
      .then(() => {
        setIsDbReady(true);
      })
      .catch((err) => {
        console.error('Failed to initialize SQLite WASM engine:', err);
        setDbError('تعذر تهيئة محرك SQLite المحلي في المتصفح. يرجى إعادة تحميل الصفحة.');
      });
  }, []);

  if (!isDbReady) {
    return (
      <div dir="rtl" className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-white">
        <div className="max-w-md w-full bg-slate-900 border border-emerald-900/60 rounded-3xl p-8 text-center shadow-2xl space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center shadow-lg border border-emerald-500/30">
            <HardDrive className="w-8 h-8 text-emerald-200 animate-pulse" />
          </div>

          <div>
            <h1 className="text-xl font-bold text-slate-100">مساعد مكتب رئيس مجلس الإدارة</h1>
            <p className="text-xs text-emerald-400 font-medium mt-0.5">الهيئة القومية للبريد المصري</p>
          </div>

          {dbError ? (
            <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-xs text-rose-300">
              {dbError}
            </div>
          ) : (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>جاري تحميل محرك SQLite WASM وتهيئة السجلات المحلية...</span>
              </div>
              <div className="w-48 mx-auto bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-teal-400 w-3/4 animate-pulse rounded-full" />
              </div>
              <p className="text-[11px] text-slate-500 font-mono pt-1">
                نظام محلي سيادي 100% — لا اتصال بأي خوادم خارجية
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <I18nProvider>
        <AuthProvider>
          <MainLayout />
        </AuthProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}
