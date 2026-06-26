'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';

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
  onUpdateTotal?: (newTotal: number) => void;
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
  onUpdateTotal,
}: PayerBeneficiarySelectorProps) {
  const t = useTranslations('Room');
  const [search, setSearch] = useState('');
  const [lockedUserIds, setLockedUserIds] = useState<Set<number>>(new Set());
  const [inputStrs, setInputStrs] = useState<Record<number, string>>({});

  const eligibleMembers = members.filter((m) => m.role !== 'observer');
  const selectedUserIds = new Set(shares.map((s) => s.userId));

  const toggleMember = (userId: number) => {
    setLockedUserIds(new Set());
    if (selectedUserIds.has(userId)) {
      if (selectedUserIds.size === 1) return;
      onChange(shares.filter((s) => s.userId !== userId));
    } else {
      const nextShares = [...shares, { userId, percentage: 0 }];
      rebalanceEqual(nextShares.map((s) => s.userId));
    }
  };

  const rebalanceEqual = (userIds: number[]) => {
    setLockedUserIds(new Set());
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

  const handleAmountChange = (userId: number, newAmountStr: string) => {
    const val = parseFloat(newAmountStr);
    const safeVal = isNaN(val) ? 0 : Math.max(0, val);

    // If master total is 0, auto-sync master total directly
    if (totalAmount <= 0 && safeVal > 0 && onUpdateTotal) {
      onUpdateTotal(safeVal);
      onChange([{ userId, percentage: 100 }]);
      setLockedUserIds(new Set([userId]));
      return;
    }

    const effectiveTotal = totalAmount > 0 ? totalAmount : safeVal;
    if (effectiveTotal <= 0) return;

    const nextLocked = new Set(lockedUserIds).add(userId);
    setLockedUserIds(nextLocked);

    // Calculate monetary sum of other locked members
    const otherLockedMonetary = shares
      .filter((s) => nextLocked.has(s.userId) && s.userId !== userId)
      .reduce((acc, s) => acc + (effectiveTotal * s.percentage) / 100, 0);

    const unlockedShares = shares.filter((s) => !nextLocked.has(s.userId));
    const leftoverMonetary = Math.max(0, effectiveTotal - (otherLockedMonetary + safeVal));
    const unlockedCount = unlockedShares.length;
    const monetaryPerUnlocked = unlockedCount > 0 ? leftoverMonetary / unlockedCount : 0;

    const nextShares = shares.map((s) => {
      let mon = 0;
      if (s.userId === userId) {
        mon = safeVal;
      } else if (nextLocked.has(s.userId)) {
        mon = (effectiveTotal * s.percentage) / 100;
      } else {
        mon = monetaryPerUnlocked;
      }
      const pct = (mon / effectiveTotal) * 100;
      return { ...s, percentage: Math.round(pct * 100) / 100 };
    });

    // Fix rounding discrepancies on index 0
    const currTotPct = nextShares.reduce((a, b) => a + b.percentage, 0);
    const diffPct = Math.round((100 - currTotPct) * 100) / 100;
    if (nextShares.length > 0 && Math.abs(diffPct) > 0.001) {
      nextShares[0].percentage = Math.round((nextShares[0].percentage + diffPct) * 100) / 100;
    }

    onChange(nextShares);
  };

  const handleTextChange = (userId: number, text: string) => {
    if (!/^\d*\.?\d*$/.test(text)) return;
    setInputStrs((prev) => ({ ...prev, [userId]: text }));
    if (text !== '' && text !== '.') {
      handleAmountChange(userId, text);
    }
  };

  const handleBlur = (userId: number) => {
    setInputStrs((prev) => {
      const copy = { ...prev };
      delete copy[userId];
      return copy;
    });
  };

  const sumPercentages = Math.round(shares.reduce((acc, curr) => acc + curr.percentage, 0) * 100) / 100;
  const isValid = Math.abs(sumPercentages - 100) <= 0.1;
  const currentSumMonetary = totalAmount > 0 ? ((totalAmount * sumPercentages) / 100).toFixed(2) : '0.00';
  const remainingMonetary = totalAmount - parseFloat(currentSumMonetary);
  const hasLeftover = Math.abs(remainingMonetary) > 0.01 && totalAmount > 0;

  const distributeRemaining = () => {
    if (shares.length === 0 || !hasLeftover) return;
    const count = shares.length;
    const extraPerPerson = remainingMonetary / count;

    const nextShares = shares.map((s) => {
      const currentMon = (totalAmount * s.percentage) / 100;
      const nextMon = Math.max(0, currentMon + extraPerPerson);
      const nextPct = totalAmount > 0 ? (nextMon / totalAmount) * 100 : 0;
      return { ...s, percentage: Math.round(nextPct * 100) / 100 };
    });

    const currTotPct = nextShares.reduce((a, b) => a + b.percentage, 0);
    const diffPct = Math.round((100 - currTotPct) * 100) / 100;
    if (nextShares.length > 0 && Math.abs(diffPct) > 0.001) {
      nextShares[0].percentage = Math.round((nextShares[0].percentage + diffPct) * 100) / 100;
    }
    onChange(nextShares);
  };

  const filteredMembers = eligibleMembers.filter((m) =>
    m.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-2.5 p-3.5 bg-card/80 backdrop-blur-md border border-white/10 shadow-lg rounded-2xl transition-all duration-300 hover:border-primary/30">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <label className="text-xs font-bold text-foreground uppercase tracking-wider">{label}</label>
        <div className="flex items-center gap-1.5 flex-wrap">
          {onUpdateTotal && totalAmount > 0 && !isValid && (
            <button
              type="button"
              onClick={() => onUpdateTotal(parseFloat(currentSumMonetary) || 0)}
              className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary hover:bg-primary/90 text-white font-bold text-[11px] shadow-md transition-all animate-bounce cursor-pointer"
              title="Click to update master bill total to match this sum"
            >
              <span>Sync Master Total ({currentSumMonetary} {currency})</span>
            </button>
          )}
          {hasLeftover && (
            <button
              type="button"
              onClick={distributeRemaining}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/20 hover:bg-primary/30 text-primary font-bold text-[10px] border border-primary/40 transition-all shadow-sm animate-pulse cursor-pointer"
              title="Click to auto-assign remaining amount"
            >
              <span>{remainingMonetary > 0 ? `+${remainingMonetary.toFixed(2)}` : remainingMonetary.toFixed(2)} {currency}</span>
              <span className="bg-primary text-white text-[8px] px-1 py-0.2 rounded font-black tracking-tighter">AUTO-BALANCE</span>
            </button>
          )}
          <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${isValid ? 'bg-success/20 text-success border border-success/30' : 'bg-danger/20 text-danger border border-danger/30'}`}>
            {t('splitMonetarySum', { sum: currentSumMonetary, total: totalAmount.toFixed(2), currency })} {isValid ? '✓' : t('mustEqualTotal')}
          </span>
        </div>
      </div>

      {allowQuickActions && eligibleMembers.length > 1 && (
        <div className="flex items-center gap-1.5 text-xs flex-wrap pt-0.5">
          <span className="text-muted-foreground font-medium text-[11px]">{t('quick')}</span>
          {currentUserId && eligibleMembers.some((m) => m.id === currentUserId) && (
            <button
              type="button"
              onClick={() => rebalanceEqual([currentUserId])}
              className="px-2 py-1 bg-muted/60 hover:bg-primary/20 hover:text-primary text-foreground font-medium rounded-lg transition-all border border-white/5 text-[11px]"
            >
              {t('justMe')}
            </button>
          )}
          <button
            type="button"
            onClick={() => rebalanceEqual(eligibleMembers.map((m) => m.id))}
            className="px-2 py-1 bg-muted/60 hover:bg-primary/20 hover:text-primary text-foreground font-medium rounded-lg transition-all border border-white/5 text-[11px]"
          >
            {t('everyone')}
          </button>
          <button
            type="button"
            onClick={() => rebalanceEqual(shares.map((s) => s.userId))}
            className="px-2 py-1 bg-muted/60 hover:bg-primary/20 hover:text-primary text-foreground font-medium rounded-lg transition-all border border-white/5 text-[11px]"
          >
            {t('splitEquallyShort')}
          </button>
        </div>
      )}

      {eligibleMembers.length > 5 && (
        <input
          type="text"
          placeholder={t('searchMember')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full themed-input px-3 py-1 text-xs rounded-xl border border-input bg-background mb-1"
        />
      )}

      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
        {filteredMembers.map((member) => {
          const isSelected = selectedUserIds.has(member.id);
          const share = shares.find((s) => s.userId === member.id);
          const pct = share ? share.percentage : 0;
          const computedMonetary = totalAmount > 0 ? ((totalAmount * pct) / 100).toFixed(2) : '0.00';
          const displayStr = inputStrs[member.id] !== undefined ? inputStrs[member.id] : computedMonetary;
          const isLocked = lockedUserIds.has(member.id);

          return (
            <div
              key={member.id}
              onClick={() => toggleMember(member.id)}
              className={`flex flex-col justify-between p-2.5 rounded-xl border text-xs transition-all select-none cursor-pointer gap-2 ${
                isSelected ? 'bg-primary/10 border-primary/60 shadow-sm text-foreground' : 'bg-background/40 hover:bg-muted/30 border-white/5 text-muted-foreground'
              }`}
            >
              <div className="flex items-center justify-between w-full min-w-0">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className={`w-4 h-4 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors ${
                    isSelected ? 'bg-primary border-primary text-white shadow-sm' : 'border-muted-foreground/40 bg-card'
                  }`}>
                    {isSelected ? '✓' : ''}
                  </div>
                  <span className={`font-semibold truncate ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>{member.username}</span>
                  {member.id === currentUserId && (
                    <span className="text-[9px] shrink-0 bg-primary/20 text-primary px-1.5 py-0.5 rounded font-bold tracking-wider">{t('youBadge')}</span>
                  )}
                </div>
                {isSelected && isLocked && (
                  <span className="text-[9px] bg-warning/20 text-warning px-1.5 py-0.2 rounded font-mono font-bold tracking-tighter shrink-0" title="Manual amount locked">🔒 LOCKED</span>
                )}
              </div>

              {isSelected && (
                <div className="flex items-center justify-between gap-1.5 w-full pt-1 border-t border-border/40" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[11px] text-muted-foreground font-mono font-medium shrink-0">
                    ({pct.toFixed(1)}%)
                  </span>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={displayStr}
                      onChange={(e) => handleTextChange(member.id, e.target.value)}
                      onBlur={() => handleBlur(member.id)}
                      className="w-24 themed-input px-2 py-1 text-right font-bold text-xs rounded-lg border border-primary/40 bg-card text-foreground shadow-inner focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                    <span className="ml-1 text-muted-foreground font-bold text-xs shrink-0">{currency}</span>
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
