import React from 'react';
import { I18nProvider } from './i18n/i18nContext';
import { AuthProvider } from './features/auth/AuthContext';
import { MainLayout } from './ui/layouts/MainLayout';
import { ErrorBoundary } from './ui/components/ErrorBoundary';

export default function App() {
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
