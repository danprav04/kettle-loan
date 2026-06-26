'use client';

import React, { useState, useEffect } from 'react';

export interface ShareItem {
  userId: number;
  percentage: number;
}

export interface SelectorMember {
  id: number;
  username: string;
  role?: string;
}

interface PayerBeneficiarySelectorProps {
  members: SelectorMember[];
  shares: ShareItem[];
  onChange: (shares: ShareItem[]) => void;
  totalAmount: number;
  currency: string;
  label: string;
  currentUserId: number | null;
  allowQuickActions?: boolean;
}

export default function PayerBeneficiarySelector({
  members,
  shares,
  onChange,
  totalAmount,
  currency,
  label,
  currentUserId,
  allowQuickActions = true,
}: PayerBeneficiarySelectorProps) {
  const [search, setSearch] = useState('');

  // Filter out observers
  const eligibleMembers = members.filter((m) => m.role !== 'observer');

  const filteredMembers = eligibleMembers.filter((m) =>
    m.username.toLowerCase().includes(search.toLowerCase())
  );

  const selectedUserIds = new Set(shares.map((s) => s.userId));

  const toggleMember = (userId: number) => {
    if (selectedUserIds.has(userId)) {
      if (selectedUserIds.size === 1) return; // Must keep at least 1
      const nextShares = shares.filter((s) => s.userId !== userId);
      rebalanceEqual(nextShares.map((s) => s.userId));
    } else {
      rebalanceEqual([...shares.map((s) => s.userId), userId]);
    }
  };

  const rebalanceEqual = (userIds: number[]) => {
    if (userIds.length === 0) return;
    const count = userIds.length;
    const basePct = Math.floor((100 / count) * 100) / 100;
    const remainder = Math.round((100 - basePct * count) * 100) / 100;

    const nextShares: ShareItem[] = userIds.map((id, index) => ({
      userId: id,
      percentage: index === 0 ? Math.round((basePct + remainder) * 100) / 100 : basePct,
    }));
    onChange(nextShares);
  };

  const handlePercentageChange = (userId: number, newPctStr: string) => {
    const val = parseFloat(newPctStr);
    const safeVal = isNaN(val) ? 0 : Math.max(0, Math.min(100, val));

    const nextShares = shares.map((s) =>
      s.userId === userId ? { ...s, percentage: safeVal } : s
    );
    onChange(nextShares);
  };

  const sumPercentages = Math.round(shares.reduce((acc, curr) => acc + curr.percentage, 0) * 100) / 100;
  const isValid = Math.abs(sumPercentages - 100) <= 0.05;

  return (
    <div className="space-y-3 p-4 bg-muted/10 border border-border/80 rounded-xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <label className="text-xs font-bold text-foreground uppercase tracking-wider">{label}</label>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${isValid ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
          Sum: {sumPercentages}% {isValid ? '✓' : '(Must be 100%)'}
        </span>
      </div>

      {allowQuickActions && eligibleMembers.length > 1 && (
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="text-muted">Quick:</span>
          {currentUserId && eligibleMembers.some((m) => m.id === currentUserId) && (
            <button
              type="button"
              onClick={() => rebalanceEqual([currentUserId])}
              className="px-2 py-1 bg-muted/40 hover:bg-muted text-foreground rounded transition-colors"
            >
              Just Me
            </button>
          )}
          <button
            type="button"
            onClick={() => rebalanceEqual(eligibleMembers.map((m) => m.id))}
            className="px-2 py-1 bg-muted/40 hover:bg-muted text-foreground rounded transition-colors"
          >
            Everyone
          </button>
          <button
            type="button"
            onClick={() => rebalanceEqual(shares.map((s) => s.userId))}
            className="px-2 py-1 bg-muted/40 hover:bg-muted text-foreground rounded transition-colors"
          >
            Split Equally
          </button>
        </div>
      )}

      {eligibleMembers.length > 5 && (
        <input
          type="text"
          placeholder="Search member..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full themed-input px-3 py-1 text-xs rounded border border-input bg-background mb-2"
        />
      )}

      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {filteredMembers.map((member) => {
          const isSelected = selectedUserIds.has(member.id);
          const share = shares.find((s) => s.userId === member.id);
          const pct = share ? share.percentage : 0;
          const computedMonetary = totalAmount > 0 ? ((totalAmount * pct) / 100).toFixed(2) : '0.00';

          return (
            <div
              key={member.id}
              className={`flex items-center justify-between p-2 rounded-lg border text-xs transition-all ${
                isSelected ? 'bg-card border-primary/40 shadow-sm' : 'bg-background/50 border-border/40 opacity-75'
              }`}
            >
              <label className="flex items-center gap-2.5 cursor-pointer select-none flex-1">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleMember(member.id)}
                  className="rounded text-primary focus:ring-primary w-3.5 h-3.5"
                />
                <span className="font-medium text-foreground">{member.username}</span>
                {member.id === currentUserId && (
                  <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.2 rounded font-bold">YOU</span>
                )}
              </label>

              {isSelected && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground font-mono">
                    ({computedMonetary} {currency})
                  </span>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={pct}
                      onChange={(e) => handlePercentageChange(member.id, e.target.value)}
                      className="w-16 themed-input px-1.5 py-0.5 text-right font-bold text-xs rounded border border-input bg-background"
                    />
                    <span className="ml-1 text-muted font-bold">%</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
