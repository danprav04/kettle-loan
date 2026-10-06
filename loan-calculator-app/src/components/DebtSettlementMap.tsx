// src/components/DebtSettlementMap.tsx
"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
    FiZap,
    FiLayers,
    FiCheckCircle,
    FiArrowRight,
    FiCopy,
    FiCheck,
    FiUsers,
    FiX,
    FiRepeat
} from 'react-icons/fi';
import {
    calculateSimplifiedDebts,
    calculateDirectTransfers,
    SimplifiedTransfer,
    BalanceCalcEntry
} from '@/lib/balance-calc';
import { formatCurrencyAmount, MemberContribution, StatsMember } from '@/lib/stats-calc';
import InfoTooltip from '@/components/InfoTooltip';

interface DebtSettlementMapProps {
    entries?: BalanceCalcEntry[];
    memberContributions: Map<number, MemberContribution>;
    members: StatsMember[];
    currency: string;
    currentUserId?: number;
}

export default function DebtSettlementMap({
    entries = [],
    memberContributions,
    members,
    currency,
    currentUserId
}: DebtSettlementMapProps) {
    const t = useTranslations('Stats');

    // Default to 'simplified' settlement mode as requested
    const [settlementMode, setSettlementMode] = useState<'simplified' | 'direct'>('simplified');
    const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
    const [hoveredMemberId, setHoveredMemberId] = useState<number | null>(null);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    const memberMap = useMemo(() => {
        const map = new Map<number, string>();
        members.forEach(m => map.set(m.id, m.username));
        memberContributions.forEach((m, id) => {
            if (!map.has(id)) map.set(id, m.username);
        });
        return map;
    }, [members, memberContributions]);

    // 1. Calculate simplified transfers from member net balances
    const simplifiedTransfers: SimplifiedTransfer[] = useMemo(() => {
        const canonicalBalances: { [userId: number]: number } = {};
        const memberIds: number[] = [];

        memberContributions.forEach((contrib, uId) => {
            if (contrib.isEligible) {
                canonicalBalances[uId] = contrib.net;
                memberIds.push(uId);
            }
        });

        return calculateSimplifiedDebts(canonicalBalances, memberIds);
    }, [memberContributions]);

    // 2. Calculate direct pairwise transfers from entries
    const directTransfers: SimplifiedTransfer[] = useMemo(() => {
        if (!entries || entries.length === 0) return [];
        return calculateDirectTransfers(entries, members as any);
    }, [entries, members]);

    // Active transfers based on selected mode
    const activeTransfers = settlementMode === 'simplified' ? simplifiedTransfers : directTransfers;

    // Volume and comparison metrics
    const { simplifiedVolume, directVolume, savedCount, savedVolume } = useMemo(() => {
        const sVol = simplifiedTransfers.reduce((sum, t) => sum + t.amount, 0);
        const dVol = directTransfers.reduce((sum, t) => sum + t.amount, 0);
        const sCount = Math.max(0, directTransfers.length - simplifiedTransfers.length);
        const sDiff = Math.max(0, Math.round((dVol - sVol) * 100) / 100);

        return {
            simplifiedVolume: Math.round(sVol * 100) / 100,
            directVolume: Math.round(dVol * 100) / 100,
            savedCount: sCount,
            savedVolume: sDiff
        };
    }, [simplifiedTransfers, directTransfers]);

    const activeTotalVolume = settlementMode === 'simplified' ? simplifiedVolume : directVolume;

    // Partition members based on active transfers
    const { debtors, creditors } = useMemo(() => {
        const debtorMap = new Map<number, { id: number; username: string; totalAmount: number }>();
        const creditorMap = new Map<number, { id: number; username: string; totalAmount: number }>();

        activeTransfers.forEach(tr => {
            // From is debtor
            const currentDebtor = debtorMap.get(tr.fromUserId) || {
                id: tr.fromUserId,
                username: memberMap.get(tr.fromUserId) || `#${tr.fromUserId}`,
                totalAmount: 0
            };
            currentDebtor.totalAmount = Math.round((currentDebtor.totalAmount + tr.amount) * 100) / 100;
            debtorMap.set(tr.fromUserId, currentDebtor);

            // To is creditor
            const currentCreditor = creditorMap.get(tr.toUserId) || {
                id: tr.toUserId,
                username: memberMap.get(tr.toUserId) || `#${tr.toUserId}`,
                totalAmount: 0
            };
            currentCreditor.totalAmount = Math.round((currentCreditor.totalAmount + tr.amount) * 100) / 100;
            creditorMap.set(tr.toUserId, currentCreditor);
        });

        const dList = Array.from(debtorMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
        const cList = Array.from(creditorMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);

        return { debtors: dList, creditors: cList };
    }, [activeTransfers, memberMap]);

    // Focused member from hover or click selection
    const activeMemberId = selectedMemberId ?? hoveredMemberId;

    // Determine connected members and transfers when a node is focused
    const { connectedTransfers, connectedMemberIds } = useMemo(() => {
        if (!activeMemberId) {
            return {
                connectedTransfers: new Set<number>(),
                connectedMemberIds: new Set<number>()
            };
        }

        const activeT = new Set<number>();
        const activeM = new Set<number>([activeMemberId]);

        activeTransfers.forEach((t, idx) => {
            if (t.fromUserId === activeMemberId || t.toUserId === activeMemberId) {
                activeT.add(idx);
                activeM.add(t.fromUserId);
                activeM.add(t.toUserId);
            }
        });

        return {
            connectedTransfers: activeT,
            connectedMemberIds: activeM
        };
    }, [activeMemberId, activeTransfers]);

    const handleMemberClick = useCallback((memberId: number) => {
        setSelectedMemberId(prev => (prev === memberId ? null : memberId));
    }, []);

    const handleCopyTransfer = useCallback(async (tItem: SimplifiedTransfer, index: number) => {
        const fromName = memberMap.get(tItem.fromUserId) || `#${tItem.fromUserId}`;
        const toName = memberMap.get(tItem.toUserId) || `#${tItem.toUserId}`;
        const amountStr = `${formatCurrencyAmount(tItem.amount)} ${currency}`;
        const paysToText = t('paysTo') || 'pays to';
        const text = `${fromName} ${paysToText} ${amountStr} -> ${toName}`;

        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            }
            setCopiedIndex(index);
            setTimeout(() => setCopiedIndex(null), 2000);
        } catch {
            // Fallback ignore
        }
    }, [memberMap, currency, t]);

    // All balances settled state
    if (simplifiedTransfers.length === 0 && directTransfers.length === 0) {
        return (
            <div className="p-5 sm:p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 shadow-sm text-center">
                <div className="inline-flex p-3 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 mb-3">
                    <FiCheckCircle className="w-6 h-6" />
                </div>
                <h3 className="text-base sm:text-lg font-extrabold text-foreground">
                    {t('allSettledTitle')}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                    {t('allSettledDesc')}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3 pt-1">
            {/* Header with Title and Mode Switcher */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-base sm:text-lg font-extrabold text-card-foreground flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg border shadow-2xs ${
                            settlementMode === 'simplified'
                                ? 'bg-primary/10 text-primary border-primary/20'
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                        }`}>
                            {settlementMode === 'simplified' ? (
                                <FiZap className="w-4 h-4" />
                            ) : (
                                <FiLayers className="w-4 h-4" />
                            )}
                        </div>
                        <span>{t('settlementMapTitle')}</span>
                        <InfoTooltip content={t('settlementMapTooltip')} align="left" />
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {settlementMode === 'simplified'
                            ? t('settlementMapSubtitle')
                            : t('settlementMapSubtitleDirect')}
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Mode Toggle Pill */}
                    <div className="flex items-center p-0.5 bg-background rounded-xl border border-card-border shadow-xs shrink-0 text-xs font-bold">
                        <button
                            onClick={() => {
                                setSettlementMode('simplified');
                                setSelectedMemberId(null);
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-xs font-semibold cursor-pointer ${
                                settlementMode === 'simplified'
                                    ? 'bg-primary text-primary-foreground shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                            title={t('simplifiedModeTooltip')}
                        >
                            <FiZap className="w-3.5 h-3.5 shrink-0" />
                            <span>{t('settlementModeSimplified')}</span>
                            <span className="text-[10px] opacity-80 font-mono">({simplifiedTransfers.length})</span>
                        </button>
                        <button
                            onClick={() => {
                                setSettlementMode('direct');
                                setSelectedMemberId(null);
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-xs font-semibold cursor-pointer ${
                                settlementMode === 'direct'
                                    ? 'bg-primary text-primary-foreground shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                            title={t('directModeTooltip')}
                        >
                            <FiLayers className="w-3.5 h-3.5 shrink-0" />
                            <span>{t('settlementModeDirect')}</span>
                            <span className="text-[10px] opacity-80 font-mono">({directTransfers.length})</span>
                        </button>
                    </div>

                    {selectedMemberId && (
                        <button
                            onClick={() => setSelectedMemberId(null)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-muted hover:bg-muted/80 text-foreground border border-card-border transition-all active:scale-95 cursor-pointer"
                        >
                            <FiX className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>{t('clearMemberFilter')}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Comparison Callout Banner */}
            <div className={`p-3 rounded-xl border text-xs flex items-center justify-between flex-wrap gap-2 transition-all ${
                settlementMode === 'simplified'
                    ? 'bg-primary/5 border-primary/20 text-foreground'
                    : 'bg-amber-500/5 border-amber-500/20 text-foreground'
            }`}>
                <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg shrink-0 ${
                        settlementMode === 'simplified'
                            ? 'bg-primary/10 text-primary'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    }`}>
                        <FiRepeat className="w-3.5 h-3.5" />
                    </div>
                    <div className="font-medium text-xs">
                        {settlementMode === 'simplified' ? (
                            savedCount > 0 ? (
                                <span>
                                    {t('comparisonBadge', {
                                        simplifiedCount: simplifiedTransfers.length,
                                        directCount: directTransfers.length,
                                        savedCount,
                                        savedVolume: formatCurrencyAmount(savedVolume),
                                        currency
                                    })}
                                </span>
                            ) : (
                                <span>{t('comparisonBadgeEqual')}</span>
                            )
                        ) : (
                            <span>
                                {t('directTransfersNotice')}.{' '}
                                <button
                                    onClick={() => setSettlementMode('simplified')}
                                    className="text-primary font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                                >
                                    <span>{t('simplifiedVolumeLabel', { amount: formatCurrencyAmount(simplifiedVolume), currency })}</span>
                                    <FiArrowRight className="w-3 h-3 ltr:rotate-0 rtl:rotate-180" />
                                </button>
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 font-mono text-[11px] font-bold">
                    <span className="px-2.5 py-0.5 rounded-lg bg-card border border-card-border shadow-2xs">
                        {t('totalSettlementVolume')}: {formatCurrencyAmount(activeTotalVolume)} {currency}
                    </span>
                </div>
            </div>

            {/* Visual Flow Grid (Desktop / Tablet) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-card border border-card-border shadow-sm space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 items-stretch">
                    {/* Left Column: Debtors / Payers */}
                    <div className="lg:col-span-4 space-y-2">
                        <div className="text-[11px] font-extrabold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center justify-between pb-1 border-b border-card-border/60">
                            <span>{t('debtorsHeader')}</span>
                            <span className="font-mono text-xs">{debtors.length}</span>
                        </div>
                        <div className="space-y-2">
                            {debtors.map(debtor => {
                                const isFocused = activeMemberId !== null && connectedMemberIds.has(debtor.id);
                                const isDimmed = activeMemberId !== null && !isFocused;
                                const isSelected = selectedMemberId === debtor.id;
                                const isMe = debtor.id === currentUserId;

                                return (
                                    <div
                                        key={debtor.id}
                                        onClick={() => handleMemberClick(debtor.id)}
                                        onMouseEnter={() => setHoveredMemberId(debtor.id)}
                                        onMouseLeave={() => setHoveredMemberId(null)}
                                        className={`group relative p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                                            isSelected
                                                ? 'bg-rose-500/15 border-rose-500 shadow-md ring-2 ring-rose-500/20'
                                                : isFocused
                                                ? 'bg-rose-500/10 border-rose-500/40 shadow-sm'
                                                : isDimmed
                                                ? 'opacity-35 bg-card border-card-border/40'
                                                : 'bg-background hover:bg-muted/40 border-card-border'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-8 h-8 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-bold flex items-center justify-center text-xs shrink-0">
                                                    {debtor.username.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-bold text-xs sm:text-sm text-foreground truncate flex items-center gap-1.5">
                                                        <span>{debtor.username}</span>
                                                        {isMe && (
                                                            <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-primary/10 text-primary font-extrabold border border-primary/20">
                                                                {t('youTag')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="text-end font-mono shrink-0">
                                                <span className="text-xs sm:text-sm font-black text-rose-600 dark:text-rose-400">
                                                    -{formatCurrencyAmount(debtor.totalAmount)}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground ml-1">
                                                    {currency}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Middle Column: Visual Directional Conduits / Transfer Connectors */}
                    <div className="lg:col-span-4 space-y-2">
                        <div className="text-[11px] font-extrabold text-primary uppercase tracking-wider flex items-center justify-between pb-1 border-b border-card-border/60">
                            <span>{t('transfersHeader')}</span>
                            <span className="font-mono text-xs">{activeTransfers.length}</span>
                        </div>
                        <div className="space-y-2">
                            {activeTransfers.map((tr, idx) => {
                                const fromName = memberMap.get(tr.fromUserId) || `#${tr.fromUserId}`;
                                const toName = memberMap.get(tr.toUserId) || `#${tr.toUserId}`;
                                const isFocused = activeMemberId !== null && connectedTransfers.has(idx);
                                const isDimmed = activeMemberId !== null && !isFocused;
                                const isCopied = copiedIndex === idx;

                                return (
                                    <div
                                        key={idx}
                                        onMouseEnter={() => {
                                            if (!selectedMemberId) {
                                                setHoveredMemberId(tr.fromUserId);
                                            }
                                        }}
                                        onMouseLeave={() => {
                                            if (!selectedMemberId) {
                                                setHoveredMemberId(null);
                                            }
                                        }}
                                        className={`p-2.5 sm:p-3 rounded-xl border transition-all duration-200 flex flex-col justify-between gap-1.5 ${
                                            isFocused
                                                ? 'bg-primary/10 border-primary/50 shadow-md ring-1 ring-primary/30'
                                                : isDimmed
                                                ? 'opacity-35 bg-card border-card-border/40'
                                                : 'bg-background hover:bg-muted/40 border-card-border'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between text-xs gap-1">
                                            <span className="font-semibold text-rose-600 dark:text-rose-400 truncate max-w-[42%]">
                                                {fromName}
                                            </span>
                                            <div className="flex items-center gap-1 shrink-0 text-primary ltr:flex-row rtl:flex-row-reverse">
                                                <span className="h-0.5 w-3 bg-primary/40 rounded-full" />
                                                <FiArrowRight className="w-3.5 h-3.5 shrink-0 transform ltr:rotate-0 rtl:rotate-180" />
                                            </div>
                                            <span className="font-semibold text-emerald-600 dark:text-emerald-400 truncate max-w-[42%] text-end">
                                                {toName}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between pt-1 border-t border-card-border/40">
                                            <span className="font-mono font-black text-xs sm:text-sm text-foreground">
                                                {formatCurrencyAmount(tr.amount)}{' '}
                                                <span className="text-[10px] text-muted-foreground font-sans font-normal">
                                                    {currency}
                                                </span>
                                            </span>
                                            <button
                                                onClick={() => handleCopyTransfer(tr, idx)}
                                                className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors active:scale-90 cursor-pointer"
                                                title={t('copyPayment')}
                                            >
                                                {isCopied ? (
                                                    <>
                                                        <FiCheck className="w-3 h-3 text-emerald-500" />
                                                        <span className="text-[10px] text-emerald-500">{t('copiedPayment')}</span>
                                                    </>
                                                ) : (
                                                    <FiCopy className="w-3 h-3" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Column: Creditors / Receivers */}
                    <div className="lg:col-span-4 space-y-2">
                        <div className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center justify-between pb-1 border-b border-card-border/60">
                            <span>{t('creditorsHeader')}</span>
                            <span className="font-mono text-xs">{creditors.length}</span>
                        </div>
                        <div className="space-y-2">
                            {creditors.map(creditor => {
                                const isFocused = activeMemberId !== null && connectedMemberIds.has(creditor.id);
                                const isDimmed = activeMemberId !== null && !isFocused;
                                const isSelected = selectedMemberId === creditor.id;
                                const isMe = creditor.id === currentUserId;

                                return (
                                    <div
                                        key={creditor.id}
                                        onClick={() => handleMemberClick(creditor.id)}
                                        onMouseEnter={() => setHoveredMemberId(creditor.id)}
                                        onMouseLeave={() => setHoveredMemberId(null)}
                                        className={`group relative p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                                            isSelected
                                                ? 'bg-emerald-500/15 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                                                : isFocused
                                                ? 'bg-emerald-500/10 border-emerald-500/40 shadow-sm'
                                                : isDimmed
                                                ? 'opacity-35 bg-card border-card-border/40'
                                                : 'bg-background hover:bg-muted/40 border-card-border'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-xs shrink-0">
                                                    {creditor.username.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-bold text-xs sm:text-sm text-foreground truncate flex items-center gap-1.5">
                                                        <span>{creditor.username}</span>
                                                        {isMe && (
                                                            <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-primary/10 text-primary font-extrabold border border-primary/20">
                                                                {t('youTag')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="text-end font-mono shrink-0">
                                                <span className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400">
                                                    +{formatCurrencyAmount(creditor.totalAmount)}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground ml-1">
                                                    {currency}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
