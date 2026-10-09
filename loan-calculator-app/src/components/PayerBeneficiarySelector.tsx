'use client';

import React, { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';

import { SplitPreset } from '@/lib/hooks/useSplitPresets';
import { useCustomization } from '@/components/CustomizationProvider';

import { ShareItem, rebalanceSharesWithLocks } from '@/lib/split-calc';
export type { ShareItem };
export { rebalanceSharesWithLocks };

export interface SelectorMember {
  id: number;
  username: string;
  role?: string;
  can_participate?: boolean;
  permissions?: {
    canParticipate?: boolean;
    [key: string]: any;
  };
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
  presets?: SplitPreset[];
  onSavePreset?: (name: string, shares: ShareItem[]) => Promise<any>;
  onDeletePreset?: (presetId: number) => Promise<any>;
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
  presets = [],
  onSavePreset,
  onDeletePreset,
}: PayerBeneficiarySelectorProps) {
  const t = useTranslations('Room');
  const { customizations } = useCustomization();
  const [search, setSearch] = useState('');
  const [lockedUserIds, setLockedUserIds] = useState<Set<number>>(new Set());
  const [inputStrs, setInputStrs] = useState<Record<number, string>>({});
  const [isAddingPreset, setIsAddingPreset] = useState(false);
  const [presetNameInput, setPresetNameInput] = useState('');
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const initialSelectedUserIdsRef = useRef<Set<number>>(new Set(shares.map((s) => s.userId)));

  const isMemberActiveParticipant = (m: SelectorMember) => {
    if (m.role === 'observer') return false;
    if (m.can_participate !== undefined && m.can_participate === false) return false;
    if (m.permissions?.canParticipate !== undefined && m.permissions.canParticipate === false) return false;
    return true;
  };

  const selectedUserIds = new Set(shares.map((s) => s.userId));
  const eligibleMembers = members.filter((m) => isMemberActiveParticipant(m));
  const displayableMembers = members.filter((m) => isMemberActiveParticipant(m) || initialSelectedUserIdsRef.current.has(m.id) || selectedUserIds.has(m.id));

  const toggleMember = (userId: number) => {
    if (customizations.corePersonSelection === false) return;
    setInputStrs({});
    const nextUserIds = selectedUserIds.has(userId)
      ? shares.map((s) => s.userId).filter((id) => id !== userId)
      : [...shares.map((s) => s.userId), userId];

    const { nextShares, nextLocked } = rebalanceSharesWithLocks(nextUserIds, lockedUserIds, shares);
    setLockedUserIds(nextLocked);
    onChange(nextShares);
  };

  const rebalanceEqual = (userIds: number[]) => {
    setInputStrs({});
    const { nextShares, nextLocked } = rebalanceSharesWithLocks(userIds, new Set(), []);
    setLockedUserIds(nextLocked);
    onChange(nextShares);
  };

  const applyPreset = (preset: SplitPreset) => {
    setLockedUserIds(new Set());
    setInputStrs({});

    const eligibleSet = new Set(eligibleMembers.map((m) => m.id));
    const matchedShares = preset.shares.filter((s) => eligibleSet.has(s.userId));

    if (matchedShares.length === 0) return;

    const sumPct = matchedShares.reduce((acc, s) => acc + s.percentage, 0);
    if (sumPct <= 0) {
      rebalanceEqual(matchedShares.map((s) => s.userId));
      return;
    }

    const factor = 100 / sumPct;
    const nextShares: ShareItem[] = matchedShares.map((s) => ({
      userId: s.userId,
      percentage: Math.round(s.percentage * factor * 1e6) / 1e6,
    }));

    const totalPct = nextShares.reduce((acc, s) => acc + s.percentage, 0);
    const diffPct = Math.round((100 - totalPct) * 1e6) / 1e6;
    if (nextShares.length > 0 && Math.abs(diffPct) > 1e-8) {
      nextShares[0].percentage = Math.round((nextShares[0].percentage + diffPct) * 1e6) / 1e6;
    }

    onChange(nextShares);
  };

  const handleSavePreset = async (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!onSavePreset || !presetNameInput.trim() || shares.length === 0 || isSavingPreset) return;
    setIsSavingPreset(true);
    try {
      const activeShares = shares.filter((s) => s.percentage > 0);
      await onSavePreset(presetNameInput.trim(), activeShares.length > 0 ? activeShares : shares);
      setPresetNameInput('');
      setIsAddingPreset(false);
    } catch (err) {
      console.error('Failed to save preset:', err);
    } finally {
      setIsSavingPreset(false);
    }
  };

  const handleAmountChange = (userId: number, newAmountStr: string) => {
    const val = parseFloat(newAmountStr);
    const safeVal = isNaN(val) ? 0 : Math.max(0, val);

    // If master total is 0, auto-sync master total directly
    if (totalAmount <= 0 && safeVal > 0 && onUpdateTotal) {
      onUpdateTotal(safeVal);
      const nextShares = shares.map((s) => ({
        userId: s.userId,
        percentage: s.userId === userId ? 100 : 0,
      }));
      onChange(nextShares.length > 0 ? nextShares : [{ userId, percentage: 100 }]);
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
      return { ...s, percentage: Math.round(pct * 1e6) / 1e6 };
    });

    // Fix rounding discrepancies on first unlocked share (or index 0 if all locked, only if <= 0.05% floating point error)
    const currTotPct = nextShares.reduce((a, b) => a + b.percentage, 0);
    const diffPct = Math.round((100 - currTotPct) * 1e6) / 1e6;
    if (nextShares.length > 0 && Math.abs(diffPct) > 1e-8 && Math.abs(diffPct) <= 0.05) {
      const firstUnlocked = nextShares.find((s) => !nextLocked.has(s.userId));
      const targetShare = firstUnlocked || nextShares[0];
      if (targetShare) {
        targetShare.percentage = Math.round((targetShare.percentage + diffPct) * 1e6) / 1e6;
      }
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

  const sumPercentages = Math.round(shares.reduce((acc, curr) => acc + curr.percentage, 0) * 1e6) / 1e6;
  const isValid = Math.abs(sumPercentages - 100) <= 0.1;
  const currentSumMonetary = totalAmount > 0 ? ((totalAmount * sumPercentages) / 100).toFixed(0) : '0.00';
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
      return { ...s, percentage: Math.round(nextPct * 1e6) / 1e6 };
    });

    const currTotPct = nextShares.reduce((a, b) => a + b.percentage, 0);
    const diffPct = Math.round((100 - currTotPct) * 1e6) / 1e6;
    if (nextShares.length > 0 && Math.abs(diffPct) > 1e-8 && Math.abs(diffPct) <= 0.05) {
      nextShares[0].percentage = Math.round((nextShares[0].percentage + diffPct) * 1e6) / 1e6;
    }
    onChange(nextShares);
  };

  const filteredMembers = displayableMembers.filter((m) =>
    m.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-2.5 p-3.5 bg-card/90 backdrop-blur-md border-2 border-card-border/80 dark:border-white/40 shadow-xl rounded-2xl transition-all duration-300">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <label className="text-xs sm:text-sm font-extrabold text-foreground dark:text-zinc-100 uppercase tracking-wider">{label}</label>
        <div className="flex items-center gap-1.5 flex-wrap">
          {onUpdateTotal && totalAmount > 0 && !isValid && customizations.syncTotal && (
            <button
              type="button"
              onClick={() => {
                const newTot = parseFloat(currentSumMonetary) || 0;
                if (onUpdateTotal && newTot > 0) {
                  onUpdateTotal(newTot);
                  const updatedShares = shares.map((s) => {
                    const currentMon = (totalAmount * s.percentage) / 100;
                    const nextPct = (currentMon / newTot) * 100;
                    return { ...s, percentage: Math.round(nextPct * 1e6) / 1e6 };
                  });
                  const currTotPct = updatedShares.reduce((a, b) => a + b.percentage, 0);
                  const diffPct = Math.round((100 - currTotPct) * 1e6) / 1e6;
                  if (updatedShares.length > 0 && Math.abs(diffPct) > 1e-8 && Math.abs(diffPct) <= 0.05) {
                    updatedShares[0].percentage = Math.round((updatedShares[0].percentage + diffPct) * 1e6) / 1e6;
                  }
                  onChange(updatedShares);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-extrabold text-xs border-2 border-primary/50 transition-colors shadow-sm cursor-pointer"
              title="Click to update master bill total to match this sum"
            >
              <span className="font-black text-sm">↑</span>
              <span>
                {customizations.syncTotalButtonLabel?.trim()
                  ? `${customizations.syncTotalButtonLabel.trim()} ${currentSumMonetary} ${currency}`
                  : t('syncTotalBtn', { sum: currentSumMonetary, currency })}
              </span>
            </button>
          )}
          {hasLeftover && customizations.autoBalance && (
            <button
              type="button"
              onClick={distributeRemaining}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs border-2 border-emerald-500/50 transition-colors shadow-sm cursor-pointer"
              title="Click to auto-assign remaining amount"
            >
              <span className="font-black">{remainingMonetary > 0 ? `+${remainingMonetary.toFixed(0)}` : remainingMonetary.toFixed(0)} {currency}</span>
              <span className="text-[11px] uppercase font-black tracking-wider">
                {customizations.autoBalanceButtonLabel?.trim() || t('autoBalanceBadge')}
              </span>
            </button>
          )}
          {customizations.coreSumBadge !== false && (
            <span className={`text-xs sm:text-sm font-black px-3.5 py-1 rounded-full border-2 shadow-md transition-all ${
              isValid
                ? 'bg-emerald-500/20 text-emerald-500 dark:text-emerald-300 border-emerald-500/60 dark:border-emerald-400'
                : 'bg-rose-500/20 text-rose-500 dark:text-rose-300 border-rose-500/60 dark:border-rose-400 animate-pulse'
            }`}>
              {t('splitMonetarySum', { sum: currentSumMonetary, total: totalAmount.toFixed(0), currency })} {isValid ? '✓' : `⚠️ ${t('mustEqualTotal')}`}
            </span>
          )}
        </div>
      </div>

      {allowQuickActions && customizations.premadePresets && eligibleMembers.length > 1 && (
        <div className="flex items-center gap-1.5 text-xs flex-wrap pt-0.5">
          <span className="text-foreground dark:text-zinc-300 font-bold text-xs uppercase tracking-wide">
            {customizations.quickActionsLabel?.trim() || t('quick')}
          </span>
          {currentUserId && eligibleMembers.some((m) => m.id === currentUserId) && (
            <button
              type="button"
              onClick={() => rebalanceEqual([currentUserId])}
              className="px-2.5 py-1 bg-muted hover:bg-primary/20 hover:text-primary text-foreground font-bold rounded-lg transition-all border-2 border-card-border/80 dark:border-white/30 hover:border-white text-xs cursor-pointer shadow-sm"
            >
              {t('justMe')}
            </button>
          )}
          <button
            type="button"
            onClick={() => rebalanceEqual(eligibleMembers.map((m) => m.id))}
            className="px-2.5 py-1 bg-muted hover:bg-primary/20 hover:text-primary text-foreground font-bold rounded-lg transition-all border-2 border-card-border/80 dark:border-white/30 hover:border-white text-xs cursor-pointer shadow-sm"
          >
            {t('everyone')}
          </button>
          <button
            type="button"
            onClick={() => rebalanceEqual([])}
            className="px-2.5 py-1 bg-muted hover:bg-primary/20 hover:text-primary text-foreground font-bold rounded-lg transition-all border-2 border-card-border/80 dark:border-white/30 hover:border-white text-xs cursor-pointer shadow-sm"
          >
            {t('selectNone')}
          </button>
          <button
            type="button"
            onClick={() => rebalanceEqual(shares.map((s) => s.userId))}
            className="px-2.5 py-1 bg-muted hover:bg-primary/20 hover:text-primary text-foreground font-bold rounded-lg transition-all border-2 border-card-border/80 dark:border-white/30 hover:border-white text-xs cursor-pointer shadow-sm"
          >
            {t('splitEquallyShort')}
          </button>
          {lockedUserIds.size > 0 && (
            <button
              type="button"
              onClick={() => rebalanceEqual(shares.map((s) => s.userId))}
              className="px-2.5 py-1 bg-warning/20 hover:bg-warning/30 text-warning font-extrabold rounded-lg transition-all border-2 border-warning/50 text-xs ml-auto cursor-pointer shadow-sm"
              title="Click to unlock all custom amounts"
            >
              {t('unlockAllBtn')}
            </button>
          )}
        </div>
      )}

      {allowQuickActions && customizations.customPresets && (presets.length > 0 || onSavePreset) && (
        <div className="flex items-center gap-1.5 text-xs flex-wrap pt-1.5 border-t-2 border-card-border/60 dark:border-white/20">
          <span className="text-foreground dark:text-zinc-300 font-bold text-xs flex items-center gap-1 uppercase tracking-wide">
            <span className="text-primary font-black">★</span>
            {customizations.presetsBarLabel?.trim() || t('presets')}
          </span>

          {presets.map((preset) => {
            const tooltipText = preset.shares
              .map((s) => {
                const m = members.find((mem) => mem.id === s.userId);
                return `${m ? m.username : `ID:${s.userId}`}: ${s.percentage}%`;
              })
              .join(', ');

            return (
              <div
                key={preset.id}
                className="group inline-flex items-center bg-primary/15 hover:bg-primary/25 text-primary border-2 border-primary/40 rounded-lg text-xs font-bold transition-all shadow-sm"
                title={tooltipText}
              >
                <button
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="px-2.5 py-1 cursor-pointer font-extrabold hover:underline flex items-center gap-1"
                >
                  {preset.name}
                </button>
                {onDeletePreset && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(t('deletePresetConfirm', { name: preset.name }))) {
                        onDeletePreset(preset.id);
                      }
                    }}
                    className="pr-2 pl-0.5 py-1 text-muted-foreground hover:text-danger opacity-70 group-hover:opacity-100 transition-opacity cursor-pointer text-xs font-black"
                    title={t('deletePreset')}
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}

          {onSavePreset && (
            !isAddingPreset ? (
              <button
                type="button"
                onClick={() => setIsAddingPreset(true)}
                disabled={shares.length === 0 || !isValid}
                className="px-2.5 py-1 bg-muted/60 hover:bg-primary/20 hover:text-primary text-foreground font-bold rounded-lg transition-all border-2 border-dashed border-card-border/80 dark:border-white/30 text-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
                title={!isValid ? t('mustEqualTotal') : t('savePresetBtn')}
              >
                {t('savePresetBtn')}
              </button>
            ) : (
              <div className="inline-flex items-center gap-1">
                <input
                  type="text"
                  autoFocus
                  value={presetNameInput}
                  onChange={(e) => setPresetNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSavePreset();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsAddingPreset(false);
                      setPresetNameInput('');
                    }
                  }}
                  placeholder={t('presetPlaceholder')}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg themed-input border-2 border-primary/50 w-28 sm:w-36 bg-card shadow-inner"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSavePreset();
                  }}
                  disabled={isSavingPreset || !presetNameInput.trim()}
                  className="px-2.5 py-1 bg-primary text-primary-foreground font-black rounded-lg text-xs disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {isSavingPreset ? '...' : '✓'}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsAddingPreset(false);
                    setPresetNameInput('');
                  }}
                  className="px-2 py-1 text-muted-foreground hover:text-foreground text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )
          )}
        </div>
      )}

      {displayableMembers.length > 5 && (
        <input
          type="text"
          placeholder={t('searchMember')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl themed-input border-2 border-card-border/80 dark:border-white/20"
        />
      )}

      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {filteredMembers.map((member) => {
          const isSelected = selectedUserIds.has(member.id);
          const isLocked = lockedUserIds.has(member.id);
          const share = shares.find((s) => s.userId === member.id);
          const pct = share ? share.percentage : 0;
          const computedMonetary = totalAmount > 0 ? ((totalAmount * pct) / 100).toFixed(0) : '0.00';
          const displayStr = inputStrs[member.id] !== undefined ? inputStrs[member.id] : computedMonetary;

          return (
            <div
              key={member.id}
              onClick={() => toggleMember(member.id)}
              className={`flex flex-col justify-between p-3 rounded-xl border-2 text-xs sm:text-sm transition-all select-none gap-2.5 ${
                customizations.corePersonSelection === false ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'
              } ${
                isSelected
                  ? 'bg-primary/15 border-primary dark:border-white shadow-md text-foreground'
                  : 'bg-background/80 hover:bg-muted/50 border-card-border/80 dark:border-white/20 text-zinc-300'
              }`}
            >
              <div className="flex items-center justify-between w-full min-w-0">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className={`w-6 h-6 shrink-0 rounded-lg flex items-center justify-center text-sm font-black border-2 transition-all ${
                    isSelected
                      ? 'bg-primary border-primary dark:border-white text-white shadow-md'
                      : 'border-zinc-400 dark:border-zinc-500 bg-background/90 text-transparent hover:border-white'
                  }`}>
                    {isSelected ? '✓' : ''}
                  </div>
                  <span className={`text-sm sm:text-base font-extrabold truncate ${isSelected ? 'text-foreground dark:text-white' : 'text-zinc-700 dark:text-zinc-300'}`}>
                    {member.username}
                  </span>
                  {member.id === currentUserId && (
                    <span className="text-[10px] shrink-0 bg-primary/30 text-primary-foreground border border-primary/50 px-2 py-0.5 rounded-md font-black uppercase tracking-wider">{t('youBadge')}</span>
                  )}
                </div>
                {isSelected && isLocked && (
                  <span
                    className="text-[10px] bg-warning/20 hover:bg-warning/40 text-warning px-2 py-0.5 rounded-md font-mono font-bold tracking-tighter shrink-0 transition-colors cursor-pointer border border-warning/40"
                    title="Click to unlock this custom amount"
                    onClick={(e) => {
                      e.stopPropagation();
                      const next = new Set(lockedUserIds);
                      next.delete(member.id);
                      const { nextShares, nextLocked } = rebalanceSharesWithLocks(
                        shares.map((s) => s.userId),
                        next,
                        shares
                      );
                      setLockedUserIds(nextLocked);
                      onChange(nextShares);
                    }}
                  >
                    {t('lockedBadge')}
                  </span>
                )}
              </div>

              {isSelected && (
                <div className="flex items-center justify-between gap-2 w-full pt-2 border-t-2 border-card-border/60 dark:border-white/20" onClick={(e) => e.stopPropagation()}>
                  <span className="text-xs sm:text-sm text-foreground/80 dark:text-zinc-300 font-mono font-bold shrink-0">
                    ({pct.toFixed(1)}%)
                  </span>
                  {customizations.coreManualShareInputs !== false ? (
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={displayStr}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => handleTextChange(member.id, e.target.value)}
                        onBlur={() => handleBlur(member.id)}
                        className="w-28 themed-input px-2.5 py-1.5 text-right font-extrabold text-sm rounded-lg border-2 border-primary/60 dark:border-white/50 bg-card text-foreground shadow-inner focus:border-white focus:ring-2 focus:ring-primary"
                      />
                      <span className="ml-1.5 text-foreground dark:text-zinc-100 font-extrabold text-xs sm:text-sm shrink-0">{currency}</span>
                    </div>
                  ) : (
                    <span className="font-extrabold text-sm text-foreground dark:text-white">
                      {computedMonetary} {currency}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
