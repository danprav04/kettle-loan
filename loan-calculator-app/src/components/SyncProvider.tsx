// src/components/SyncProvider.tsx
"use client";

import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { syncOutbox, getOutboxCount, getRoomsList } from '@/lib/offline-sync';

interface SyncContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingRequestCount: number;
  isReadyForOffline: boolean;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export default function SyncProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [isReadyForOffline, setIsReadyForOffline] = useState(false);

  const updatePendingCount = useCallback(async () => {
    if (typeof window !== 'undefined' && window.indexedDB) {
        const count = await getOutboxCount();
        setPendingRequestCount(count);
    }
  }, []);

  const checkOfflineReadiness = useCallback(async () => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && window.indexedDB) {
        const hasControllingSW = navigator.serviceWorker.controller !== null;
        const hasCachedRooms = (await getRoomsList()).length > 0;
        
        if (hasControllingSW && hasCachedRooms) {
            setIsReadyForOffline(true);
        }
    }
  }, []);

  useEffect(() => {
    // Initial check on mount, and re-check after a sync in case rooms were just loaded.
    checkOfflineReadiness();
    window.addEventListener('syncdone', checkOfflineReadiness);
    
    return () => {
        window.removeEventListener('syncdone', checkOfflineReadiness);
    };
  }, [checkOfflineReadiness]);


  useEffect(() => {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
        setIsOnline(navigator.onLine);
    }

    const handleOnline = async () => {
      setIsOnline(true);
      setIsSyncing(true);
      try {
        const didSync = await syncOutbox();
        if (didSync) {
            window.dispatchEvent(new Event('syncdone'));
        }
      } catch (error) {
        console.error('Error during sync:', error);
      } finally {
        setIsSyncing(false);
        updatePendingCount();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleOutboxChange = () => updatePendingCount();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('outboxchange', handleOutboxChange);
    
    updatePendingCount();
    if (navigator.onLine) {
        handleOnline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline',handleOffline);
      window.removeEventListener('outboxchange', handleOutboxChange);
    };
  }, [updatePendingCount]);

  return (
    <SyncContext.Provider value={{ isOnline, isSyncing, pendingRequestCount, isReadyForOffline }}>
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