'use client';

import React, { createContext, useContext } from 'react';

export type RoomRole = 'admin' | 'active' | 'passive' | 'observer';

interface RoomRoleContextType {
  role: RoomRole;
  canCreateEntries: boolean;
  canEditOwnEntries: boolean;
  canEditAnyEntry: boolean;
  canDeleteOwnEntries: boolean;
  canDeleteAnyEntry: boolean;
  participatesInCalc: boolean;
  canAccessAdminPanel: boolean;
  currency: string;
}

const RoomRoleContext = createContext<RoomRoleContextType>({
  role: 'active',
  canCreateEntries: true,
  canEditOwnEntries: true,
  canEditAnyEntry: false,
  canDeleteOwnEntries: true,
  canDeleteAnyEntry: false,
  participatesInCalc: true,
  canAccessAdminPanel: false,
  currency: 'ILS',
});

interface RoomRoleProviderProps {
  role?: string;
  currency?: string;
  children: React.ReactNode;
}

export function RoomRoleProvider({ role = 'active', currency = 'ILS', children }: RoomRoleProviderProps) {
  const typedRole = (['admin', 'active', 'passive', 'observer'].includes(role) ? role : 'active') as RoomRole;

  const value: RoomRoleContextType = {
    role: typedRole,
    canCreateEntries: typedRole === 'admin' || typedRole === 'active',
    canEditOwnEntries: typedRole === 'admin' || typedRole === 'active',
    canEditAnyEntry: typedRole === 'admin',
    canDeleteOwnEntries: typedRole === 'admin' || typedRole === 'active',
    canDeleteAnyEntry: typedRole === 'admin',
    participatesInCalc: typedRole !== 'observer',
    canAccessAdminPanel: typedRole === 'admin',
    currency: currency || 'ILS',
  };

  return (
    <RoomRoleContext.Provider value={value}>
      {children}
    </RoomRoleContext.Provider>
  );
}

export function useRoomRole() {
  return useContext(RoomRoleContext);
}
