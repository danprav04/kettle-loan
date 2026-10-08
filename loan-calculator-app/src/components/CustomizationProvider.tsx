// src/components/CustomizationProvider.tsx
"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from 'react';
import { handleApi } from '../lib/api';
import { useUser } from './UserProvider';

export interface CustomizationSettings {
  // Feature Toggles
  customPresets: boolean;       // User-saved split presets (★ Presets bar)
  premadePresets: boolean;      // Premade quick buttons (Just me, Everyone, Select none, Split equally)
  autoBalance: boolean;         // Auto-balance remainder button
  syncTotal: boolean;           // Sync bill total button
  currencyConverter: boolean;   // Foreign currency dropdown & live rates
  detailedBalance: boolean;     // Link to detailed balance view
  roomStats: boolean;           // Room statistics button & access
  debtSettlementMap: boolean;   // Debt settlement graph in stats
  exportReports: boolean;       // Excel & PDF exports in stats
  entryEditsHistory: boolean;   // Edit history log button in entries list
  entryShareModal: boolean;     // Share receipt button in entries list

  // Custom List Labels (Raw text, no localization required)
  payerListLabel: string;       // Custom label for List 1 (empty = default "From")
  beneficiaryListLabel: string; // Custom label for List 2 (empty = default "To")
}

export const DEFAULT_CUSTOMIZATIONS: CustomizationSettings = {
  customPresets: true,
  premadePresets: true,
  autoBalance: true,
  syncTotal: true,
  currencyConverter: true,
  detailedBalance: true,
  roomStats: true,
  debtSettlementMap: true,
  exportReports: true,
  entryEditsHistory: true,
  entryShareModal: true,
  payerListLabel: '',
  beneficiaryListLabel: '',
};

interface CustomizationContextType {
  customizations: CustomizationSettings;
  updateCustomization: <K extends keyof CustomizationSettings>(key: K, value: CustomizationSettings[K]) => void;
  saveCustomizations: (partial: Partial<CustomizationSettings>) => void;
  applyProfile: (profile: 'all' | 'minimal') => void;
  resetDefaults: () => void;
  isLoaded: boolean;
}

const CustomizationContext = createContext<CustomizationContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_PREFIX = 'app_customizations';

export default function CustomizationProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const [customizations, setCustomizations] = useState<CustomizationSettings>(DEFAULT_CUSTOMIZATIONS);
  const [isLoaded, setIsLoaded] = useState(false);
  const isSyncingRef = useRef(false);

  const getStorageKey = useCallback((userId?: number | null) => {
    return userId ? `${LOCAL_STORAGE_KEY_PREFIX}_${userId}` : LOCAL_STORAGE_KEY_PREFIX;
  }, []);

  // 1. Initial client-side load from localStorage
  useEffect(() => {
    const key = getStorageKey(user?.userId);
    const stored = localStorage.getItem(key) || localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setCustomizations(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error('Failed to parse cached customizations:', e);
      }
    }
    setIsLoaded(true);
  }, [user?.userId, getStorageKey]);

  // 2. Fetch from DB when user is authenticated
  useEffect(() => {
    if (!user?.userId) return;

    let isMounted = true;
    const fetchDbCustomizations = async () => {
      try {
        const remote = await handleApi({ method: 'GET', url: '/api/user/customizations' });
        if (remote && typeof remote === 'object' && isMounted) {
          setCustomizations(prev => {
            const merged = { ...prev, ...remote };
            const key = getStorageKey(user.userId);
            localStorage.setItem(key, JSON.stringify(merged));
            return merged;
          });
        }
      } catch (err) {
        // Soft error: keep using cached version if offline or error
        console.warn('Could not sync customizations from server, using local cache.', err);
      }
    };

    fetchDbCustomizations();
    return () => {
      isMounted = false;
    };
  }, [user?.userId, getStorageKey]);

  // Persist helper to DB and localStorage
  const persistSettings = useCallback(async (newSettings: CustomizationSettings) => {
    const key = getStorageKey(user?.userId);
    localStorage.setItem(key, JSON.stringify(newSettings));
    // Also update generic fallback key
    localStorage.setItem(LOCAL_STORAGE_KEY_PREFIX, JSON.stringify(newSettings));

    if (user?.userId && !isSyncingRef.current) {
      isSyncingRef.current = true;
      try {
        await handleApi({
          method: 'PUT',
          url: '/api/user/customizations',
          body: newSettings as unknown as Record<string, unknown>,
        });
      } catch (err) {
        console.error('Failed to save customizations to database:', err);
      } finally {
        isSyncingRef.current = false;
      }
    }
  }, [user?.userId, getStorageKey]);

  const updateCustomization = useCallback(<K extends keyof CustomizationSettings>(key: K, value: CustomizationSettings[K]) => {
    setCustomizations(prev => {
      const next = { ...prev, [key]: value };
      persistSettings(next);
      return next;
    });
  }, [persistSettings]);

  const saveCustomizations = useCallback((partial: Partial<CustomizationSettings>) => {
    setCustomizations(prev => {
      const next = { ...prev, ...partial };
      persistSettings(next);
      return next;
    });
  }, [persistSettings]);

  const applyProfile = useCallback((profile: 'all' | 'minimal') => {
    setCustomizations(prev => {
      const isAll = profile === 'all';
      const next: CustomizationSettings = {
        ...prev,
        customPresets: isAll,
        premadePresets: isAll,
        autoBalance: isAll,
        syncTotal: isAll,
        currencyConverter: isAll,
        detailedBalance: isAll,
        roomStats: isAll,
        debtSettlementMap: isAll,
        exportReports: isAll,
        entryEditsHistory: isAll,
        entryShareModal: isAll,
      };
      persistSettings(next);
      return next;
    });
  }, [persistSettings]);

  const resetDefaults = useCallback(() => {
    setCustomizations(DEFAULT_CUSTOMIZATIONS);
    persistSettings(DEFAULT_CUSTOMIZATIONS);
  }, [persistSettings]);

  return (
    <CustomizationContext.Provider
      value={{
        customizations,
        updateCustomization,
        saveCustomizations,
        applyProfile,
        resetDefaults,
        isLoaded,
      }}
    >
      {children}
    </CustomizationContext.Provider>
  );
}

export function useCustomization() {
  const context = useContext(CustomizationContext);
  if (context === undefined) {
    throw new Error('useCustomization must be used within a CustomizationProvider');
  }
  return context;
}
