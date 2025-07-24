// src/components/SyncProvider.tsx
"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { syncOutbox } from '@/lib/offline-sync';

interface SyncContextType {
  isOnline: boolean;
  isSyncing: boolean;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export default function SyncProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Set initial online status on component mount
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
            // Dispatch a global event that components can listen to for refetching data.
            window.dispatchEvent(new Event('syncdone'));
        }
      } catch (error) {
        console.error('Error during sync:', error);
      } finally {
        setIsSyncing(false);
      }
    };

    const handleOffline = () => {
      console.log('Application is offline.');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Initial sync check on load if online
    if (navigator.onLine) {
        handleOnline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <SyncContext.Provider value={{ isOnline, isSyncing }}>
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