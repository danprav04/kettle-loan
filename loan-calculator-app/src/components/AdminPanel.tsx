'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { handleApi } from '@/lib/api';

interface Member {
  id: number;
  username: string;
  role: string;
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

  const handleRoleChange = async (memberId: number, newRole: string) => {
    setError('');
    setSuccess('');
    try {
      await handleApi({
        url: `/api/rooms/${roomId}/members/${memberId}`,
        method: 'PUT',
        body: { role: newRole },
      });

      setSuccess('Role updated successfully!');
      onRefresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error updating role');
    }
  };

  const roleColors: Record<string, string> = {
    admin: 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-[0_0_10px_rgba(168,85,247,0.15)]',
    active: 'bg-blue-500/20 text-cyan-300 border-cyan-500/40',
    passive: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    observer: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/40',
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
            <div className="p-3.5 text-xs bg-danger/20 border border-danger/40 text-danger rounded-xl">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3.5 text-xs bg-success/20 border border-success/40 text-success rounded-xl">
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

          {/* Members Roles */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-muted-foreground tracking-wider uppercase">{t('memberPermissions', { count: members.length })}</h3>
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-background/50 border border-white/5 hover:bg-muted/20 transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-semibold text-xs text-foreground">{member.username}</span>
                    {member.id === currentUserId && (
                      <span className="text-[9px] font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded tracking-wider">{t('youBadge')}</span>
                    )}
                    <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-md border ${roleColors[member.role] || roleColors.active}`}>
                      {member.role}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.id, e.target.value)}
                      disabled={member.id === currentUserId}
                      className="text-xs px-2.5 py-1.5 rounded-xl border border-input bg-card text-foreground disabled:opacity-40 font-medium cursor-pointer"
                    >
                      <option value="admin">{t('roleAdmin')}</option>
                      <option value="active">{t('roleActive')}</option>
                      <option value="passive">{t('rolePassive')}</option>
                      <option value="observer">{t('roleObserver')}</option>
                    </select>
                  </div>
                </div>
              ))}
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
