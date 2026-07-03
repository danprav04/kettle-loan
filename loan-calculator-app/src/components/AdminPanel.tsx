'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { handleApi } from '@/lib/api';

interface MemberPermissions {
  canAdmin: boolean;
  canAddEntries: boolean;
  canParticipate: boolean;
  canView: boolean;
}

interface Member {
  id: number;
  username: string;
  permissions?: Partial<MemberPermissions>;
}

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomName: string;
  currency: string;
  members: Member[];
  currentUserId: number;
  onRefresh: () => void;
}

const PERMISSION_KEYS: (keyof MemberPermissions)[] = ['canAdmin', 'canAddEntries', 'canParticipate', 'canView'];

const PERMISSION_ICONS: Record<keyof MemberPermissions, string> = {
  canAdmin: '🛡️',
  canAddEntries: '✏️',
  canParticipate: '📊',
  canView: '👁️',
};

const PERMISSION_COLORS: Record<keyof MemberPermissions, { on: string; off: string }> = {
  canAdmin: { on: 'bg-purple-500', off: 'bg-zinc-600' },
  canAddEntries: { on: 'bg-blue-500', off: 'bg-zinc-600' },
  canParticipate: { on: 'bg-emerald-500', off: 'bg-zinc-600' },
  canView: { on: 'bg-amber-500', off: 'bg-zinc-600' },
};

const PRESETS: { key: string; permissions: MemberPermissions }[] = [
  { key: 'presetFullAccess', permissions: { canAdmin: true, canAddEntries: true, canParticipate: true, canView: true } },
  { key: 'presetMember', permissions: { canAdmin: false, canAddEntries: true, canParticipate: true, canView: true } },
  { key: 'presetViewOnly', permissions: { canAdmin: false, canAddEntries: false, canParticipate: false, canView: true } },
];

function getPermissions(member: Member): MemberPermissions {
  return {
    canAdmin: member.permissions?.canAdmin ?? false,
    canAddEntries: member.permissions?.canAddEntries ?? true,
    canParticipate: member.permissions?.canParticipate ?? true,
    canView: member.permissions?.canView ?? true,
  };
}

function getPermissionSummaryPills(perms: MemberPermissions) {
  const pills: { label: string; color: string }[] = [];
  if (perms.canAdmin) pills.push({ label: '🛡️', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' });
  if (perms.canAddEntries) pills.push({ label: '✏️', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' });
  if (perms.canParticipate) pills.push({ label: '📊', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' });
  if (perms.canView) pills.push({ label: '👁️', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' });
  return pills;
}

export default function AdminPanel({
  isOpen,
  onClose,
  roomId,
  roomName,
  currency,
  members,
  currentUserId,
  onRefresh,
}: AdminPanelProps) {
  const t = useTranslations('Room');
  const [editName, setEditName] = useState(roomName);
  const [editCurrency, setEditCurrency] = useState(currency || 'ILS');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedMemberId, setExpandedMemberId] = useState<number | null>(null);
  const [savingMemberId, setSavingMemberId] = useState<number | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setEditName(roomName || '');
      setEditCurrency(currency || 'ILS');
    }
  }, [isOpen, roomName, currency]);

  if (!isOpen) return null;

  const handleSaveRoomSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      await handleApi({
        url: `/api/rooms/${roomId}`,
        method: 'PUT',
        body: { name: editName, currency: editCurrency },
      });

      setSuccess('Room settings updated successfully!');
      onRefresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error updating room');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePermissionToggle = async (memberId: number, permKey: keyof MemberPermissions, newValue: boolean) => {
    setError('');
    setSuccess('');

    const member = members.find(m => m.id === memberId);
    if (!member) return;

    const currentPerms = getPermissions(member);
    const newPerms = { ...currentPerms, [permKey]: newValue };

    // Last admin safeguard
    if (permKey === 'canAdmin' && !newValue) {
      const adminCount = members.filter(m => getPermissions(m).canAdmin).length;
      if (adminCount <= 1) {
        setError(t('lastAdminWarning'));
        return;
      }
    }

    setSavingMemberId(memberId);
    try {
      await handleApi({
        url: `/api/rooms/${roomId}/members/${memberId}`,
        method: 'PUT',
        body: { permissions: newPerms },
      });

      setSuccess(t('permissionsSaved'));
      onRefresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error updating permissions');
    } finally {
      setSavingMemberId(null);
    }
  };

  const handleApplyPreset = async (memberId: number, preset: MemberPermissions) => {
    setError('');
    setSuccess('');

    // Last admin safeguard
    if (!preset.canAdmin) {
      const member = members.find(m => m.id === memberId);
      if (member && getPermissions(member).canAdmin) {
        const adminCount = members.filter(m => getPermissions(m).canAdmin).length;
        if (adminCount <= 1) {
          setError(t('lastAdminWarning'));
          return;
        }
      }
    }

    setSavingMemberId(memberId);
    try {
      await handleApi({
        url: `/api/rooms/${roomId}/members/${memberId}`,
        method: 'PUT',
        body: { permissions: preset },
      });

      setSuccess(t('permissionsSaved'));
      onRefresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error updating permissions');
    } finally {
      setSavingMemberId(null);
    }
  };

  const permI18nKey: Record<keyof MemberPermissions, string> = {
    canAdmin: 'permAdmin',
    canAddEntries: 'permAddEntries',
    canParticipate: 'permParticipate',
    canView: 'permView',
  };

  const permDescI18nKey: Record<keyof MemberPermissions, string> = {
    canAdmin: 'permAdminDesc',
    canAddEntries: 'permAddEntriesDesc',
    canParticipate: 'permParticipateDesc',
    canView: 'permViewDesc',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-lg overflow-hidden bg-card/95 border border-white/10 rounded-3xl shadow-[0_0_60px_rgba(168,85,247,0.15)] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-muted/20">
          <h2 className="text-base font-bold flex items-center gap-2.5 text-foreground">
            <span className="p-1.5 rounded-xl bg-primary/20 text-primary">🛡️</span> {t('adminTitle')}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
          >
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {error && (
            <div className="p-3.5 text-xs bg-danger/20 border border-danger/40 text-danger rounded-xl animate-fadeIn">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3.5 text-xs bg-success/20 border border-success/40 text-success rounded-xl animate-fadeIn">
              {success}
            </div>
          )}

          {/* Room Settings */}
          <form onSubmit={handleSaveRoomSettings} className="space-y-4 p-4 rounded-2xl bg-muted/20 border border-white/5">
            <h3 className="text-xs font-bold text-muted-foreground tracking-wider uppercase">{t('roomSettings')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">{t('roomName')}</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full themed-input px-3.5 py-2 text-xs rounded-xl border border-input bg-background font-medium text-foreground"
                  maxLength={50}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">{t('currencyLabel')}</label>
                <select
                  value={editCurrency}
                  onChange={(e) => setEditCurrency(e.target.value)}
                  className="w-full themed-input px-3 py-2 text-xs rounded-xl border border-input bg-background font-bold text-center cursor-pointer text-foreground"
                >
                  <option value="ILS">ILS (₪)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isLoading || (editName === roomName && editCurrency === currency)}
                className="btn-primary text-xs px-4 py-2 rounded-xl disabled:opacity-50 font-bold shadow-md"
              >
                {isLoading ? '...' : t('saveSettings')}
              </button>
            </div>
          </form>

          {/* Members Permissions */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-muted-foreground tracking-wider uppercase">{t('memberPermissions', { count: members.length })}</h3>
            <div className="space-y-2">
              {members.map((member) => {
                const perms = getPermissions(member);
                const isExpanded = expandedMemberId === member.id;
                const isSelf = member.id === currentUserId;
                const isSaving = savingMemberId === member.id;
                const summaryPills = getPermissionSummaryPills(perms);

                return (
                  <div
                    key={member.id}
                    className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                      isExpanded
                        ? 'bg-muted/30 border-white/10 shadow-lg'
                        : 'bg-background/50 border-white/5 hover:bg-muted/20'
                    }`}
                  >
                    {/* Member Header Row */}
                    <button
                      onClick={() => setExpandedMemberId(isExpanded ? null : member.id)}
                      className="w-full flex items-center justify-between p-3 text-left"
                      disabled={isSaving}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30 flex items-center justify-center font-bold text-primary text-xs shrink-0">
                          {member.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-xs text-foreground truncate">{member.username}</span>
                            {isSelf && (
                              <span className="text-[9px] font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded tracking-wider shrink-0">{t('youBadge')}</span>
                            )}
                          </div>
                          {/* Permission summary pills */}
                          <div className="flex items-center gap-1 mt-1">
                            {summaryPills.map((pill, idx) => (
                              <span key={idx} className={`text-[10px] px-1.5 py-0.5 rounded-md border ${pill.color}`}>
                                {pill.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className={`p-1 rounded-full transition-transform duration-300 text-muted-foreground ${isExpanded ? 'rotate-180' : ''}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </button>

                    {/* Expanded Permission Toggles */}
                    {isExpanded && (
                      <div className="px-3 pb-4 animate-fadeIn">
                        {/* Quick Presets */}
                        {!isSelf && (
                          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t('quick')}:</span>
                            {PRESETS.map((preset) => (
                              <button
                                key={preset.key}
                                onClick={() => handleApplyPreset(member.id, preset.permissions)}
                                disabled={isSaving}
                                className="text-[10px] px-2.5 py-1 rounded-lg border border-white/10 bg-card hover:bg-white/5 text-muted-foreground hover:text-foreground font-semibold transition-all disabled:opacity-40"
                              >
                                {t(preset.key)}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Individual Permission Toggles */}
                        <div className="space-y-1.5">
                          {PERMISSION_KEYS.map((key) => {
                            const isEnabled = perms[key];
                            const isDisabled = isSelf && key === 'canAdmin';
                            const colors = PERMISSION_COLORS[key];

                            return (
                              <div
                                key={key}
                                className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                                  isEnabled
                                    ? 'bg-white/[0.03] border-white/10'
                                    : 'bg-transparent border-white/5'
                                } ${isDisabled ? 'opacity-50' : ''}`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className="text-sm shrink-0">{PERMISSION_ICONS[key]}</span>
                                  <div className="min-w-0">
                                    <div className="text-xs font-semibold text-foreground">{t(permI18nKey[key])}</div>
                                    <div className="text-[10px] text-muted-foreground leading-tight truncate">{t(permDescI18nKey[key])}</div>
                                  </div>
                                </div>

                                {/* Toggle Switch */}
                                <button
                                  onClick={() => handlePermissionToggle(member.id, key, !isEnabled)}
                                  disabled={isDisabled || isSaving}
                                  className={`relative w-10 h-[22px] rounded-full transition-all duration-300 shrink-0 ${
                                    isEnabled ? colors.on : colors.off
                                  } ${isDisabled || isSaving ? 'cursor-not-allowed' : 'cursor-pointer hover:opacity-90'}`}
                                  title={isDisabled ? t('lastAdminWarning') : ''}
                                >
                                  <span
                                    className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-md transition-all duration-300 ${
                                      isEnabled ? 'left-[22px]' : 'left-[3px]'
                                    }`}
                                  />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 bg-muted/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-muted hover:bg-white/10 text-foreground text-xs font-semibold rounded-xl border border-white/10 transition-all"
          >
            {t('closeBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}
