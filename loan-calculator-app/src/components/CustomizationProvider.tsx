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

  // Custom Labels (Raw text, empty = default localized string)
  payerListLabel: string;               // Custom label for List 1 (empty = default "From")
  beneficiaryListLabel: string;         // Custom label for List 2 (empty = default "To")
  balanceTitleLabel: string;            // Custom label for Balance header (empty = default "Balance")
  detailedBalanceLabel: string;         // Custom label for Detailed balance link (empty = default "Detailed")
  newEntryTitleLabel: string;           // Custom label for New Entry card header (empty = default "New entry")
  amountInputLabel: string;             // Custom label for Amount input (empty = default "Amount")
  descriptionInputLabel: string;        // Custom label for Description input (empty = default "Description")
  descriptionPlaceholderLabel: string;  // Custom placeholder for Description input
  addEntryButtonLabel: string;          // Custom label for Add Entry submit button (empty = default "Add entry")
  allEntriesButtonLabel: string;        // Custom label for All Entries button (empty = default "All entries")
  roomStatsButtonLabel: string;         // Custom label for Room Statistics button (empty = default "Room statistics")
  quickActionsLabel: string;            // Custom label for Quick actions row (empty = default "Quick:")
  presetsBarLabel: string;              // Custom label for Presets row (empty = default "Presets:")
  autoBalanceButtonLabel: string;       // Custom label for Auto-balance button (empty = default "Auto-balance")
  syncTotalButtonLabel: string;         // Custom label for Sync total button (empty = default "Sync total")

  // Core Features for Developers & Testers (All true by default)
  coreSumBadge: boolean;                // Green/red sum validation badge
  coreEntryEditing: boolean;            // Editing existing entries
  corePersonSelection: boolean;         // Selecting / deselecting people in split lists
  coreManualShareInputs: boolean;       // Custom monetary amount inputs per member
  coreEnforceSumValidation: boolean;    // Strict 100% / total bill sum validation enforcement
  coreBalanceDisplay: boolean;          // Room balance summary display card
  coreEntryDeletion: boolean;           // Deleting entries
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
  balanceTitleLabel: '',
  detailedBalanceLabel: '',
  newEntryTitleLabel: '',
  amountInputLabel: '',
  descriptionInputLabel: '',
  descriptionPlaceholderLabel: '',
  addEntryButtonLabel: '',
  allEntriesButtonLabel: '',
  roomStatsButtonLabel: '',
  quickActionsLabel: '',
  presetsBarLabel: '',
  autoBalanceButtonLabel: '',
  syncTotalButtonLabel: '',
  coreSumBadge: true,
  coreEntryEditing: true,
  corePersonSelection: true,
  coreManualShareInputs: true,
  coreEnforceSumValidation: true,
  coreBalanceDisplay: true,
  coreEntryDeletion: true,
};

interface CustomizationContextType {
  customizations: CustomizationSettings;
  updateCustomization: <K extends keyof CustomizationSettings>(key: K, value: CustomizationSettings[K]) => void;
  saveCustomizations: (partial: Partial<CustomizationSettings>) => void;
  applyProfile: (profile: 'all' | 'minimal') => void;
  resetDefaults: () => void;
  resetLabels: () => void;
  resetDevFeatures: () => void;
  isLoaded: boolean;
}

const CustomizationContext = createContext<CustomizationContextType | undefined>(undefined);

export const LOCAL_STORAGE_KEY_PREFIX = 'app_customizations';

export function getUserCustomizationStorageKey(userId?: number | null): string | null {
  return typeof userId === 'number' && userId > 0 ? `${LOCAL_STORAGE_KEY_PREFIX}_${userId}` : null;
}

export default function CustomizationProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const [customizations, setCustomizations] = useState<CustomizationSettings>(DEFAULT_CUSTOMIZATIONS);
  const [isLoaded, setIsLoaded] = useState(false);
  const isSyncingRef = useRef(false);

  // Synchronize customizations whenever the authenticated user changes (or logs out)
  useEffect(() => {
    // Clean up any stale un-scoped generic key from previous versions
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY_PREFIX);
    } catch {
      // Ignore if localStorage is unavailable
    }

    const currentUserId = user?.userId;

    // 1. If not authenticated or logged out, always reset to default customizations
    if (!currentUserId) {
      setCustomizations(DEFAULT_CUSTOMIZATIONS);
      setIsLoaded(true);
      return;
    }

    // 2. Load cached settings strictly for THIS user
    const storageKey = getUserCustomizationStorageKey(currentUserId);
    let initialUserSettings: CustomizationSettings = { ...DEFAULT_CUSTOMIZATIONS };

    if (storageKey) {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'object') {
            initialUserSettings = { ...DEFAULT_CUSTOMIZATIONS, ...parsed };
          }
        }
      } catch (e) {
        console.error('Failed to parse cached customizations:', e);
      }
    }

    // Always reset state cleanly starting from DEFAULT_CUSTOMIZATIONS, never inheriting from previous user
    setCustomizations(initialUserSettings);
    setIsLoaded(true);

    // 3. Fetch from DB for THIS authenticated user
    let isMounted = true;
    const fetchDbCustomizations = async () => {
      try {
        const remote = await handleApi({ method: 'GET', url: '/api/user/customizations' });
        if (!isMounted) return;

        if (remote && typeof remote === 'object') {
          // Merge remote over defaults to guarantee no residue from previous user leaks in
          const merged: CustomizationSettings = {
            ...DEFAULT_CUSTOMIZATIONS,
            ...remote,
          };

          setCustomizations(merged);
          if (storageKey) {
            try {
              localStorage.setItem(storageKey, JSON.stringify(merged));
            } catch (e) {
              console.error('Failed to update local storage cache:', e);
            }
          }
        }
      } catch (err) {
        // Soft error: keep using cached version if offline or network error
        console.warn('Could not sync customizations from server, using local cache.', err);
      }
    };

    fetchDbCustomizations();

    return () => {
      isMounted = false;
    };
  }, [user?.userId]);

  // Persist helper strictly scoped to current authenticated user
  const persistSettings = useCallback(async (newSettings: CustomizationSettings) => {
    const currentUserId = user?.userId;
    if (!currentUserId) return; // Do not persist for unauthenticated / guest

    const storageKey = getUserCustomizationStorageKey(currentUserId);
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(newSettings));
      } catch (e) {
        console.error('Failed to save customizations to localStorage:', e);
      }
    }

    if (!isSyncingRef.current) {
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
  }, [user?.userId]);

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

  const resetLabels = useCallback(() => {
    saveCustomizations({
      payerListLabel: '',
      beneficiaryListLabel: '',
      balanceTitleLabel: '',
      detailedBalanceLabel: '',
      newEntryTitleLabel: '',
      amountInputLabel: '',
      descriptionInputLabel: '',
      descriptionPlaceholderLabel: '',
      addEntryButtonLabel: '',
      allEntriesButtonLabel: '',
      roomStatsButtonLabel: '',
      quickActionsLabel: '',
      presetsBarLabel: '',
      autoBalanceButtonLabel: '',
      syncTotalButtonLabel: '',
    });
  }, [saveCustomizations]);

  const resetDevFeatures = useCallback(() => {
    saveCustomizations({
      coreSumBadge: true,
      coreEntryEditing: true,
      corePersonSelection: true,
      coreManualShareInputs: true,
      coreEnforceSumValidation: true,
      coreBalanceDisplay: true,
      coreEntryDeletion: true,
    });
  }, [saveCustomizations]);

  return (
    <CustomizationContext.Provider
      value={{
        customizations,
        updateCustomization,
        saveCustomizations,
        applyProfile,
        resetDefaults,
        resetLabels,
        resetDevFeatures,
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
