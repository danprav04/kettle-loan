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
  const [editName, setEditName] = useState(roomName);
  const [editCurrency, setEditCurrency] = useState(currency);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  const handleSaveRoomSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await handleApi({
        url: `/api/rooms/${roomId}`,
        method: 'PUT',
        body: { name: editName, currency: editCurrency },
      });

      if (!res || !res.ok) {
        throw new Error('Failed to update room settings');
      }
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
      const res = await handleApi({
        url: `/api/rooms/${roomId}/members/${memberId}`,
        method: 'PUT',
        body: { role: newRole },
      });

      if (!res || !res.ok) {
        const data = res && res.json ? await res.json() : {};
        throw new Error(data.message || 'Failed to update role');
      }

      setSuccess('Role updated successfully!');
      onRefresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error updating role');
    }
  };

  const roleColors: Record<string, string> = {
    admin: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    active: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    passive: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    observer: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg overflow-hidden bg-card border border-border rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span>🛡️</span> Room Administration
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted hover:text-foreground hover:bg-muted transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-6">
          {error && (
            <div className="p-3 text-sm bg-danger/20 border border-danger/40 text-danger rounded-lg">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 text-sm bg-success/20 border border-success/40 text-success rounded-lg">
              {success}
            </div>
          )}

          {/* Room Settings */}
          <form onSubmit={handleSaveRoomSettings} className="space-y-4 p-4 rounded-lg bg-muted/20 border border-border/50">
            <h3 className="text-sm font-semibold text-muted tracking-wider uppercase">Room Settings</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-muted mb-1">Room Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full themed-input px-3 py-1.5 text-sm rounded-lg border border-input bg-background"
                  maxLength={50}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Currency</label>
                <input
                  type="text"
                  value={editCurrency}
                  onChange={(e) => setEditCurrency(e.target.value)}
                  className="w-full themed-input px-3 py-1.5 text-sm rounded-lg border border-input bg-background text-center font-bold"
                  maxLength={10}
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading || (editName === roomName && editCurrency === currency)}
              className="btn-primary text-xs px-3 py-1.5 rounded-lg"
            >
              {isLoading ? 'Saving...' : 'Save Settings'}
            </button>
          </form>

          {/* Members Roles */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted tracking-wider uppercase">Member Permissions ({members.length})</h3>
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-background border border-border/60"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{member.username}</span>
                    {member.id === currentUserId && (
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">You</span>
                    )}
                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${roleColors[member.role] || roleColors.active}`}>
                      {member.role}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.id, e.target.value)}
                      disabled={member.id === currentUserId}
                      className="text-xs px-2 py-1 rounded border border-input bg-card text-foreground disabled:opacity-50 cursor-pointer"
                    >
                      <option value="admin">Admin</option>
                      <option value="active">Active Member</option>
                      <option value="passive">Passive Member</option>
                      <option value="observer">Observer</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-muted/20 flex justify-end">
          <button onClick={onClose} className="btn-secondary text-xs px-4 py-1.5 rounded-lg">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
