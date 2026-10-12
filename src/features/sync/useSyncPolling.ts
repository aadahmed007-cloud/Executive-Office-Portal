import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext';

export interface SyncVersions {
  non_confidential_version: number;
  confidential_version?: number;
}

export function useSyncPolling(onDataChanged: (versions: SyncVersions) => void) {
  const { isAuthenticated, currentUser, isLocked, mustChangePasswordPrompt } = useAuth();
  const [lastVersions, setLastVersions] = useState<SyncVersions | null>(null);
  const [showUpdatedIndicator, setShowUpdatedIndicator] = useState(false);
  const [errorCount, setErrorCount] = useState(0);

  const checkVersion = useCallback(async () => {
    if (!isAuthenticated || !currentUser || isLocked || mustChangePasswordPrompt) {
      return;
    }
    if (document.visibilityState !== 'visible') {
      return;
    }

    try {
      const res = await fetch('/api/sync/version', {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      if (!res.ok) {
        if (res.status === 401) return;
        throw new Error(`Sync error: ${res.status}`);
      }

      const data: SyncVersions = await res.json();
      setErrorCount(0);

      if (lastVersions) {
        const changed =
          data.non_confidential_version > lastVersions.non_confidential_version ||
          (data.confidential_version !== undefined &&
            lastVersions.confidential_version !== undefined &&
            data.confidential_version > lastVersions.confidential_version);

        if (changed) {
          setLastVersions(data);
          onDataChanged(data);
          setShowUpdatedIndicator(true);
          setTimeout(() => setShowUpdatedIndicator(false), 4000);
        }
      } else {
        setLastVersions(data);
      }
    } catch (err) {
      setErrorCount((prev) => prev + 1);
    }
  }, [isAuthenticated, currentUser, isLocked, mustChangePasswordPrompt, lastVersions, onDataChanged]);

  useEffect(() => {
    if (!isAuthenticated || !currentUser || isLocked || mustChangePasswordPrompt) {
      return;
    }

    // Calculate backoff interval based on error count (20s base, up to 120s max)
    const baseInterval = 20000;
    const backoffInterval = Math.min(baseInterval * Math.pow(1.5, errorCount), 120000);

    const timer = setInterval(() => {
      checkVersion();
    }, backoffInterval);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, currentUser, isLocked, mustChangePasswordPrompt, errorCount, checkVersion]);

  return { showUpdatedIndicator };
}
