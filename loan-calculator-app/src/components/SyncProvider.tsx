// src/components/SyncProvider.tsx
"use client";

import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { syncOutbox, getOutboxCount } from '@/lib/offline-sync';

interface SyncContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingRequestCount: number;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export default function SyncProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);

  const updatePendingCount = useCallback(async () => {
    if (typeof window !== 'undefined' && window.indexedDB) {
        const count = await getOutboxCount();
        setPendingRequestCount(count);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
        setIsOnline(navigator.onLine);
    }

    const handleOnline = async () => {
      console.log('Application is online.');
      setIsOnline(true);
      setIsSyncing(true);
      try {
        const success = await syncOutbox();
        if (success) {
            console.log("Sync complete. Refreshing data.");
            window.dispatchEvent(new Event('syncdone'));
        }
      } catch (error) {
        console.error('Error during sync:', error);
      } finally {
        setIsSyncing(false);
        updatePendingCount(); // Refresh count after sync attempt
      }
    };

    const handleOffline = () => {
      console.log('Application is offline.');
      setIsOnline(false);
    };

    const handleOutboxChange = () => updatePendingCount();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('outboxchange', handleOutboxChange);
    
    // Initial checks on load
    updatePendingCount();
    if (navigator.onLine) {
        handleOnline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('outboxchange', handleOutboxChange);
    };
  }, [updatePendingCount]);

  return (
    <SyncContext.Provider value={{ isOnline, isSyncing, pendingRequestCount }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}