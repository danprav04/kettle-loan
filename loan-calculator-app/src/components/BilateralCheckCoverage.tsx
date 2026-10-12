// src/components/BilateralCheckCoverage.tsx
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
    FiColumns,
    FiRepeat,
    FiCalendar,
    FiTrendingUp,
    FiCheckCircle,
    FiAlertCircle,
    FiUsers
} from 'react-icons/fi';
import {
    calculatePeerToPeerBalances,
    BalanceCalcEntry,
    BalanceCalcMember
} from '@/lib/balance-calc';
import {
    formatCurrencyAmount,
    isSettlementEntry,
    StatsMember
} from '@/lib/stats-calc';
import { Entry } from '@/lib/offline-sync';
import InfoTooltip from '@/components/InfoTooltip';

interface BilateralCheckCoverageProps {
    entries: Entry[];
    members: StatsMember[];
    currency: string;
    currentUserId?: number;
}

interface CheckBlockItem {
    id: string | number;
    description: string;
    shareAmount: number;
    fullAmount: number;
    createdAt: string;
    isSettlement: boolean;
    isLoan: boolean;
    percentageOfMax: number;
}

export default function BilateralCheckCoverage({
    entries = [],
    members = [],
    currency,
    currentUserId
}: BilateralCheckCoverageProps) {
    const t = useTranslations('Stats');

    // Filter to eligible (participating) members
    const eligibleMembers = useMemo(() => {
        return members.filter(m => {
            if (m.role === 'observer') return false;
            if (m.can_participate !== undefined) return m.can_participate !== false;
            if (m.permissions?.canParticipate !== undefined) return m.permissions.canParticipate !== false;
            return true;
        });
    }, [members]);

    const [personAId, setPersonAId] = useState<number | null>(null);
    const [personBId, setPersonBId] = useState<number | null>(null);
    const [sortBy, setSortBy] = useState<'amount' | 'date'>('amount');
    const [hoveredBlockId, setHoveredBlockId] = useState<string | number | null>(null);

    // Initialize default pair selection intelligently
    useEffect(() => {
        if (eligibleMembers.length < 2) {
            setPersonAId(eligibleMembers[0]?.id ?? null);
            setPersonBId(null);
            return;
        }

        const validIds = new Set(eligibleMembers.map(m => m.id));
        if (personAId !== null && personBId !== null && validIds.has(personAId) && validIds.has(personBId) && personAId !== personBId) {
            return;
        }

        // Find a pair with active mutual transactions, preferring currentUserId as Person A
        const preferredA = (currentUserId && validIds.has(currentUserId))
            ? currentUserId
            : eligibleMembers[0].id;

        let bestA = preferredA;
        let bestB = eligibleMembers.find(m => m.id !== preferredA)?.id ?? eligibleMembers[1].id;
        let bestVolume = -1;

        // First check partners of preferredA
        if (entries.length > 0) {
            const p2pPreferred = calculatePeerToPeerBalances(
                entries as BalanceCalcEntry[],
                members as BalanceCalcMember[],
                preferredA,
                { simplifyDebts: false }
            );
            p2pPreferred.forEach((data, otherId) => {
                if (validIds.has(otherId) && otherId !== preferredA) {
                    const vol = data.transactions.reduce((sum, tx) => sum + Math.abs(tx.contribution), 0);
                    if (vol > bestVolume) {
                        bestVolume = vol;
                        bestA = preferredA;
                        bestB = otherId;
                    }
                }
            });

            // If preferredA has no mutual transactions with anyone, find any pair with mutual transactions
            if (bestVolume <= 0) {
                for (const mA of eligibleMembers) {
                    const p2p = calculatePeerToPeerBalances(
                        entries as BalanceCalcEntry[],
                        members as BalanceCalcMember[],
                        mA.id,
                        { simplifyDebts: false }
                    );
                    p2p.forEach((data, otherId) => {
                        if (validIds.has(otherId) && otherId !== mA.id) {
                            const vol = data.transactions.reduce((sum, tx) => sum + Math.abs(tx.contribution), 0);
                            if (vol > bestVolume) {
                                bestVolume = vol;
                                bestA = mA.id;
                                bestB = otherId;
                            }
                        }
                    });
                }
            }
        }

        setPersonAId(bestA);
        setPersonBId(bestB);
    }, [eligibleMembers, entries, members, currentUserId, personAId, personBId]);

    const handleSelectA = (newAId: number) => {
        if (newAId === personBId) {
            setPersonBId(personAId);
        }
        setPersonAId(newAId);
    };

    const handleSelectB = (newBId: number) => {
        if (newBId === personAId) {
            setPersonAId(personBId);
        }
        setPersonBId(newBId);
    };

    const handleSwapPair = () => {
        setPersonAId(personBId);
        setPersonBId(personAId);
    };

    const personA = useMemo(
        () => eligibleMembers.find(m => m.id === personAId) || null,
        [eligibleMembers, personAId]
    );
    const personB = useMemo(
        () => eligibleMembers.find(m => m.id === personBId) || null,
        [eligibleMembers, personBId]
    );

    // Derive bilateral check blocks and totals
    const {
        leftChecks,
        rightChecks,
        leftTotal,
        rightTotal,
        maxTotal,
        netDiff,
        shorterSide,
        coveragePercent
    } = useMemo(() => {
        if (!personAId || !personBId || personAId === personBId || entries.length === 0) {
            return {
                leftChecks: [] as CheckBlockItem[],
                rightChecks: [] as CheckBlockItem[],
                leftTotal: 0,
                rightTotal: 0,
                maxTotal: 0,
                netDiff: 0,
                shorterSide: 'none' as 'left' | 'right' | 'none',
                coveragePercent: 100
            };
        }

        const p2pMap = calculatePeerToPeerBalances(
            entries as BalanceCalcEntry[],
            members as BalanceCalcMember[],
            personAId,
            { simplifyDebts: false }
        );

        const pairData = p2pMap.get(personBId);
        if (!pairData || pairData.transactions.length === 0) {
            return {
                leftChecks: [] as CheckBlockItem[],
                rightChecks: [] as CheckBlockItem[],
                leftTotal: 0,
                rightTotal: 0,
                maxTotal: 0,
                netDiff: 0,
                shorterSide: 'none' as 'left' | 'right' | 'none',
                coveragePercent: 100
            };
        }

        const rawLeft: Omit<CheckBlockItem, 'percentageOfMax'>[] = [];
        const rawRight: Omit<CheckBlockItem, 'percentageOfMax'>[] = [];

        pairData.transactions.forEach((tx, idx) => {
            const contrib = tx.contribution;
            if (Math.abs(contrib) < 0.005) return;

            const rawAmt = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
            const shareAmount = Math.round(Math.abs(contrib) * 100) / 100;
            const fullAmount = Math.round(Math.abs(rawAmt || 0) * 100) / 100;
            const isSettlement = isSettlementEntry(tx as { description?: string | null });
            const isLoan = !isSettlement && (rawAmt < 0);

            const item: Omit<CheckBlockItem, 'percentageOfMax'> = {
                id: tx.id ?? `tx-${idx}`,
                description: (tx.description as string) || '—',
                shareAmount,
                fullAmount,
                createdAt: tx.created_at || '',
                isSettlement,
                isLoan
            };

            if (contrib > 0) {
                // Person A paid for Person B (B's share)
                rawLeft.push(item);
            } else {
                // Person B paid for Person A (A's share)
                rawRight.push(item);
            }
        });

        const sortItems = (list: Omit<CheckBlockItem, 'percentageOfMax'>[]) => {
            const copy = [...list];
            if (sortBy === 'amount') {
                copy.sort((a, b) => b.shareAmount - a.shareAmount);
            } else {
                copy.sort((a, b) => {
                    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                    return timeB - timeA;
                });
            }
            return copy;
        };

        const sortedLeft = sortItems(rawLeft);
        const sortedRight = sortItems(rawRight);

        const lTotal = Math.round(sortedLeft.reduce((sum, item) => sum + item.shareAmount, 0) * 100) / 100;
        const rTotal = Math.round(sortedRight.reduce((sum, item) => sum + item.shareAmount, 0) * 100) / 100;
        const mTotal = Math.max(lTotal, rTotal);
        const diff = Math.round(Math.abs(lTotal - rTotal) * 100) / 100;

        let shorter: 'left' | 'right' | 'none' = 'none';
        if (diff >= 0.01) {
            shorter = lTotal < rTotal ? 'left' : 'right';
        }

        const minTotal = Math.min(lTotal, rTotal);
        const covPct = mTotal > 0 ? Math.round((minTotal / mTotal) * 100) : 100;

        const withPct = (list: Omit<CheckBlockItem, 'percentageOfMax'>[]): CheckBlockItem[] =>
            list.map(item => ({
                ...item,
                percentageOfMax: mTotal > 0 ? Math.round((item.shareAmount / mTotal) * 1000) / 10 : 0
            }));

        return {
            leftChecks: withPct(sortedLeft),
            rightChecks: withPct(sortedRight),
            leftTotal: lTotal,
            rightTotal: rTotal,
            maxTotal: mTotal,
            netDiff: diff,
            shorterSide: shorter,
            coveragePercent: covPct
        };
    }, [personAId, personBId, entries, members, sortBy]);

    if (eligibleMembers.length < 2) {
        return (
            <div className="p-5 rounded-2xl bg-muted/30 border border-card-border text-center text-xs text-muted-foreground font-medium">
                {t('bilateralNeedMoreMembers')}
            </div>
        );
    }

    const personAName = personA?.username || `#${personAId}`;
    const personBName = personB?.username || `#${personBId}`;

    // Determine dynamic height of the two-column stack so blocks have comfortable breathing room
    const maxBlockCount = Math.max(
        leftChecks.length + (shorterSide === 'left' ? 1 : 0),
        rightChecks.length + (shorterSide === 'right' ? 1 : 0)
    );
    const stackContainerHeight = Math.min(680, Math.max(320, maxBlockCount * 54));

    const formatShortDate = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    const renderCheckBlock = (item: CheckBlockItem, side: 'left' | 'right') => {
        const isHovered = hoveredBlockId === item.id;
        // Approximate pixel height of this block to decide single-line vs multi-line internal layout
        const approxPx = maxTotal > 0 ? (item.shareAmount / maxTotal) * stackContainerHeight : 48;
        const isCompact = approxPx < 54;

        const colorClasses = item.isSettlement
            ? 'bg-purple-500/12 hover:bg-purple-500/20 border-purple-500/35 text-purple-950 dark:text-purple-100'
            : side === 'left'
            ? 'bg-emerald-500/12 hover:bg-emerald-500/20 border-emerald-500/35 text-emerald-950 dark:text-emerald-100'
            : 'bg-sky-500/12 hover:bg-sky-500/20 border-sky-500/35 text-sky-950 dark:text-sky-100';

        const accentTextClass = item.isSettlement
            ? 'text-purple-600 dark:text-purple-400'
            : side === 'left'
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-sky-600 dark:text-sky-400';

        const dateLabel = formatShortDate(item.createdAt);

        return (
            <div
                key={item.id}
                style={{
                    flexGrow: Math.max(item.shareAmount, 0.01),
                    flexBasis: 0,
                    minHeight: '32px'
                }}
                onMouseEnter={() => setHoveredBlockId(item.id)}
                onMouseLeave={() => setHoveredBlockId(null)}
                className="pb-1 last:pb-0 box-border w-full transition-all duration-300"
                title={`${item.description} — ${formatCurrencyAmount(item.shareAmount)} ${currency} (${t('bilateralFullCheckTotal', { amount: formatCurrencyAmount(item.fullAmount), currency })})${dateLabel ? ` • ${dateLabel}` : ''}`}
            >
                <div
                    className={`h-full w-full rounded-xl border px-3 py-1.5 flex ${
                        isCompact ? 'flex-row items-center justify-between gap-2' : 'flex-col justify-between'
                    } transition-all duration-200 overflow-hidden relative shadow-2xs ${colorClasses} ${
                        isHovered ? 'ring-2 ring-primary/40 shadow-md z-10' : ''
                    }`}
                >
                    {/* Top / Left: Description & Date */}
                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-bold text-xs text-foreground truncate">
                                {item.description}
                            </span>
                            {item.isSettlement && (
                                <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-500/30 shrink-0">
                                    {t('exportTypeSettlement')}
                                </span>
                            )}
                        </div>
                        {!isCompact && dateLabel && (
                            <span className="text-[10px] font-medium text-muted-foreground shrink-0">
                                {dateLabel}
                            </span>
                        )}
                    </div>

                    {/* Bottom / Right: Exact Share Amount & Percentage */}
                    <div className={`flex items-baseline ${isCompact ? 'justify-end shrink-0 gap-1.5' : 'justify-between w-full pt-0.5'}`}>
                        {!isCompact && (
                            <span className="text-[10px] font-mono text-muted-foreground truncate">
                                {item.fullAmount !== item.shareAmount
                                    ? t('bilateralFullCheckTotal', {
                                          amount: formatCurrencyAmount(item.fullAmount),
                                          currency
                                      })
                                    : dateLabel}
                            </span>
                        )}
                        <div className="flex items-baseline gap-1 shrink-0 ms-auto">
                            <span className={`font-mono font-black text-xs sm:text-sm ${accentTextClass}`}>
                                {formatCurrencyAmount(item.shareAmount)}
                            </span>
                            <span className="text-[10px] font-semibold text-muted-foreground">
                                {currency}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderUncoveredGapBlock = (debtorName: string, creditorName: string) => {
        if (netDiff < 0.01) return null;

        return (
            <div
                key="uncovered-gap"
                style={{
                    flexGrow: Math.max(netDiff, 0.01),
                    flexBasis: 0,
                    minHeight: '46px'
                }}
                className="pb-0 box-border w-full transition-all duration-300"
            >
                <div className="h-full w-full rounded-xl border-2 border-dashed border-amber-500/60 bg-amber-500/8 dark:bg-amber-500/10 px-3 py-2 flex flex-col items-center justify-center text-center overflow-hidden relative">
                    <div className="flex items-center gap-1 text-[11px] font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                        <FiAlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{t('bilateralUncoveredGap')}</span>
                    </div>
                    <div className="font-mono font-black text-xs sm:text-sm text-amber-600 dark:text-amber-400 mt-0.5">
                        +{formatCurrencyAmount(netDiff)}{' '}
                        <span className="text-[10px] font-semibold opacity-80">{currency}</span>
                    </div>
                    <div className="text-[10px] font-medium text-muted-foreground truncate max-w-full">
                        {t('bilateralUncoveredSub', { debtor: debtorName, creditor: creditorName })}
                    </div>
                </div>
            </div>
        );
    };

    const creditorName = leftTotal >= rightTotal ? personAName : personBName;
    const debtorName = leftTotal >= rightTotal ? personBName : personAName;

    return (
        <div className="space-y-3 pt-2">
            {/* Section Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-base sm:text-lg font-extrabold text-card-foreground flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 shadow-2xs">
                            <FiColumns className="w-4 h-4" />
                        </div>
                        <span>{t('bilateralTitle')}</span>
                        <InfoTooltip content={t('bilateralTooltip')} align="left" />
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {t('bilateralSubtitle')}
                    </p>
                </div>

                {/* Sorting Toggle */}
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground hidden sm:inline">
                        {t('bilateralSortLabel')}
                    </span>
                    <div className="flex items-center p-0.5 bg-background rounded-xl border border-card-border shadow-xs text-xs font-bold">
                        <button
                            type="button"
                            onClick={() => setSortBy('amount')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-xs font-semibold cursor-pointer ${
                                sortBy === 'amount'
                                    ? 'bg-primary text-primary-foreground shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <FiTrendingUp className="w-3.5 h-3.5 shrink-0" />
                            <span>{t('bilateralSortByAmount')}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setSortBy('date')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-xs font-semibold cursor-pointer ${
                                sortBy === 'date'
                                    ? 'bg-primary text-primary-foreground shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <FiCalendar className="w-3.5 h-3.5 shrink-0" />
                            <span>{t('bilateralSortByDate')}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-card border border-card-border shadow-sm space-y-4">
                {/* 1. Pair Selector Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-11 gap-2 sm:gap-3 items-center p-3 rounded-xl bg-muted/40 border border-card-border">
                    {/* Person A Selector */}
                    <div className="sm:col-span-5 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-xs shrink-0">
                            {personAName.charAt(0).toUpperCase()}
                        </div>
                        <select
                            aria-label={t('bilateralPersonA')}
                            value={personAId ?? ''}
                            onChange={e => handleSelectA(Number(e.target.value))}
                            className="w-full rounded-xl bg-background border border-card-border px-3 py-2 text-xs sm:text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all cursor-pointer"
                        >
                            {eligibleMembers.map(member => (
                                <option key={member.id} value={member.id}>
                                    {member.username}
                                    {member.id === currentUserId ? ` (${t('youTag')})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Swap Button */}
                    <div className="sm:col-span-1 flex justify-center">
                        <button
                            type="button"
                            onClick={handleSwapPair}
                            title={t('bilateralSwapPair')}
                            className="p-2 rounded-xl bg-background hover:bg-muted border border-card-border text-muted-foreground hover:text-primary transition-all active:scale-90 cursor-pointer shadow-2xs"
                        >
                            <FiRepeat className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Person B Selector */}
                    <div className="sm:col-span-5 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-600 dark:text-sky-400 font-bold flex items-center justify-center text-xs shrink-0">
                            {personBName.charAt(0).toUpperCase()}
                        </div>
                        <select
                            aria-label={t('bilateralPersonB')}
                            value={personBId ?? ''}
                            onChange={e => handleSelectB(Number(e.target.value))}
                            className="w-full rounded-xl bg-background border border-card-border px-3 py-2 text-xs sm:text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all cursor-pointer"
                        >
                            {eligibleMembers.map(member => (
                                <option key={member.id} value={member.id}>
                                    {member.username}
                                    {member.id === currentUserId ? ` (${t('youTag')})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Empty State if no mutual checks exist between this pair */}
                {leftChecks.length === 0 && rightChecks.length === 0 ? (
                    <div className="py-12 px-4 text-center rounded-xl bg-background/60 border border-dashed border-card-border space-y-2">
                        <FiUsers className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                        <p className="text-xs sm:text-sm font-semibold text-muted-foreground">
                            {t('bilateralNoTransactions', {
                                memberA: personAName,
                                memberB: personBName
                            })}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Column Headers */}
                        <div className="grid grid-cols-2 gap-3 sm:gap-5">
                            {/* Left Column Header: Person A paid for Person B */}
                            <div className="p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20 flex flex-col justify-between gap-1">
                                <div className="flex items-center justify-between gap-1 flex-wrap">
                                    <span className="text-xs sm:text-sm font-extrabold text-emerald-700 dark:text-emerald-300 truncate">
                                        {t('bilateralPaidForHeader', {
                                            payer: personAName,
                                            beneficiary: personBName
                                        })}
                                    </span>
                                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                                        {t('bilateralChecksCount', { count: leftChecks.length })}
                                    </span>
                                </div>
                                <div className="flex items-baseline justify-between gap-1 pt-1 border-t border-emerald-500/15">
                                    <span className="text-[10px] text-muted-foreground font-semibold">
                                        {t('bilateralShareSubheader', { beneficiary: personBName })}
                                    </span>
                                    <span className="font-mono font-black text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">
                                        {formatCurrencyAmount(leftTotal)} {currency}
                                    </span>
                                </div>
                            </div>

                            {/* Right Column Header: Person B paid for Person A */}
                            <div className="p-3 rounded-xl bg-sky-500/8 border border-sky-500/20 flex flex-col justify-between gap-1">
                                <div className="flex items-center justify-between gap-1 flex-wrap">
                                    <span className="text-xs sm:text-sm font-extrabold text-sky-700 dark:text-sky-300 truncate">
                                        {t('bilateralPaidForHeader', {
                                            payer: personBName,
                                            beneficiary: personAName
                                        })}
                                    </span>
                                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300">
                                        {t('bilateralChecksCount', { count: rightChecks.length })}
                                    </span>
                                </div>
                                <div className="flex items-baseline justify-between gap-1 pt-1 border-t border-sky-500/15">
                                    <span className="text-[10px] text-muted-foreground font-semibold">
                                        {t('bilateralShareSubheader', { beneficiary: personAName })}
                                    </span>
                                    <span className="font-mono font-black text-xs sm:text-sm text-sky-600 dark:text-sky-400">
                                        {formatCurrencyAmount(rightTotal)} {currency}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 2, 3, 4. Proportional Parallel Columns with Reference Grid & Uncovered Gap Block */}
                        <div className="relative rounded-2xl bg-background/50 border border-card-border p-3 sm:p-4">
                            {/* Subtle horizontal reference guide lines (25%, 50%, 75%) */}
                            <div className="pointer-events-none absolute inset-x-3 sm:inset-x-4 inset-y-3 sm:inset-y-4 flex flex-col justify-between z-0">
                                <div className="border-t border-dashed border-card-border/40 w-full" />
                                <div className="border-t border-dashed border-card-border/50 w-full" />
                                <div className="border-t border-dashed border-card-border/50 w-full" />
                                <div className="border-t border-dashed border-card-border/50 w-full" />
                                <div className="border-t border-dashed border-card-border/40 w-full" />
                            </div>

                            <div
                                className="relative z-10 grid grid-cols-2 gap-3 sm:gap-5 items-stretch"
                                style={{ minHeight: `${stackContainerHeight}px` }}
                            >
                                {/* Left Column Stack: Person A paid for Person B */}
                                <div className="flex flex-col h-full w-full">
                                    {leftChecks.map(item => renderCheckBlock(item, 'left'))}
                                    {shorterSide === 'left' &&
                                        renderUncoveredGapBlock(personAName, personBName)}
                                </div>

                                {/* Right Column Stack: Person B paid for Person A */}
                                <div className="flex flex-col h-full w-full">
                                    {rightChecks.map(item => renderCheckBlock(item, 'right'))}
                                    {shorterSide === 'right' &&
                                        renderUncoveredGapBlock(personBName, personAName)}
                                </div>
                            </div>
                        </div>

                        {/* Bottom Summary Banner */}
                        <div
                            className={`p-3 rounded-xl border text-xs flex items-center justify-between flex-wrap gap-2 ${
                                netDiff < 0.01
                                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-amber-500/10 border-amber-500/25 text-foreground'
                            }`}
                        >
                            <div className="flex items-center gap-2 font-bold">
                                {netDiff < 0.01 ? (
                                    <>
                                        <FiCheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                                        <span>
                                            {t('bilateralNetSummarySettled', {
                                                memberA: personAName,
                                                memberB: personBName,
                                                currency
                                            })}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <FiAlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                                        <span>
                                            {t('bilateralNetSummaryOwed', {
                                                debtor: debtorName,
                                                creditor: creditorName,
                                                amount: formatCurrencyAmount(netDiff),
                                                currency
                                            })}
                                        </span>
                                    </>
                                )}
                            </div>

                            <span className="font-mono text-[11px] font-extrabold px-2.5 py-0.5 rounded-lg bg-card border border-card-border text-muted-foreground">
                                {t('bilateralCoverageRatio', { percent: coveragePercent })}
                            </span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
