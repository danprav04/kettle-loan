'use client';

import React, { createContext, useContext } from 'react';

export interface Permissions {
  canAdmin: boolean;
  canAddEntries: boolean;
  canParticipate: boolean;
  canView: boolean;
}

interface PermissionContextType extends Permissions {
  currency: string;
}

export const DEFAULT_PERMISSIONS: Permissions = {
  canAdmin: false,
  canAddEntries: true,
  canParticipate: true,
  canView: true,
};

const PermissionContext = createContext<PermissionContextType>({
  ...DEFAULT_PERMISSIONS,
  currency: 'ILS',
});

interface PermissionProviderProps {
  permissions?: Partial<Permissions>;
  currency?: string;
  children: React.ReactNode;
}

export function PermissionProvider({ permissions, currency = 'ILS', children }: PermissionProviderProps) {
  const resolved: PermissionContextType = {
    canAdmin: permissions?.canAdmin ?? DEFAULT_PERMISSIONS.canAdmin,
    canAddEntries: permissions?.canAddEntries ?? DEFAULT_PERMISSIONS.canAddEntries,
    canParticipate: permissions?.canParticipate ?? DEFAULT_PERMISSIONS.canParticipate,
    canView: permissions?.canView ?? DEFAULT_PERMISSIONS.canView,
    currency: currency || 'ILS',
  };

  return (
    <PermissionContext.Provider value={resolved}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionContext);
}
