// src/components/BilateralCheckCoverage.tsx
"use client";

import React, {
    useState,
    useMemo,
    useEffect,
    useLayoutEffect,
    useRef,
    useCallback
} from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
    FiColumns,
    FiRepeat,
    FiCalendar,
    FiTrendingUp,
    FiCheckCircle,
    FiAlertCircle,
    FiUsers,
    FiMaximize2,
    FiMinimize2,
    FiZoomIn,
    FiZoomOut,
    FiExternalLink,
    FiEdit3
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
    roomId?: string;
    initialPersonAId?: number | null;
    initialPersonBId?: number | null;
    isDedicatedPage?: boolean;
}

interface CheckBlockItem {
    id: string | number;
    description: string;
    shareAmount: number;
    fullAmount: number;
    cumulativeAmount: number;
    createdAt: string;
    isSettlement: boolean;
    isLoan: boolean;
    percentageOfMax: number;
}

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 40;

function clampZoom(val: number): number {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(val * 1000) / 1000));
}

function findScrollContainer(el: HTMLElement | null): HTMLElement | null {
    let curr = el?.parentElement || null;
    while (curr) {
        const style = window.getComputedStyle(curr);
        if (
            (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
            curr.scrollHeight > curr.clientHeight
        ) {
            return curr;
        }
        curr = curr.parentElement;
    }
    return (document.scrollingElement as HTMLElement) || null;
}

export default function BilateralCheckCoverage({
    entries = [],
    members = [],
    currency,
    currentUserId,
    roomId,
    initialPersonAId = null,
    initialPersonBId = null,
    isDedicatedPage = false
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

    const [personAId, setPersonAId] = useState<number | null>(initialPersonAId);
    const [personBId, setPersonBId] = useState<number | null>(initialPersonBId);
    const [sortBy, setSortBy] = useState<'amount' | 'date'>('amount');
    const [scaleMode, setScaleMode] = useState<'exact' | 'compact'>('exact');
    const [zoomFactor, setZoomFactor] = useState<number>(1);
    const [hoveredBlockId, setHoveredBlockId] = useState<string | number | null>(null);

    const stacksRef = useRef<HTMLDivElement | null>(null);
    const zoomFactorRef = useRef<number>(zoomFactor);
    zoomFactorRef.current = zoomFactor;

    const pendingAnchorRef = useRef<{
        offsetFromTop: number;
        clientY: number;
        oldZoom: number;
        newZoom: number;
    } | null>(null);

    const applyZoomWithAnchor = useCallback(
        (computeNext: (prev: number) => number, anchorClientY?: number) => {
            const oldZoom = zoomFactorRef.current;
            const newZoom = clampZoom(computeNext(oldZoom));
            if (Math.abs(newZoom - oldZoom) < 0.0005) return;

            const stacksEl = stacksRef.current;
            if (stacksEl) {
                const rect = stacksEl.getBoundingClientRect();
                const clientY = anchorClientY ?? window.innerHeight / 2;
                const offsetFromTop = Math.max(0, clientY - rect.top);
                pendingAnchorRef.current = {
                    offsetFromTop,
                    clientY,
                    oldZoom,
                    newZoom
                };
            }
            zoomFactorRef.current = newZoom;
            setZoomFactor(newZoom);
        },
        []
    );

    // Preserve cursor-anchored vertical position when timeline zoom changes (like video editing timelines)
    useLayoutEffect(() => {
        if (!pendingAnchorRef.current) return;
        const { offsetFromTop, clientY, oldZoom, newZoom } = pendingAnchorRef.current;
        pendingAnchorRef.current = null;

        const stacksEl = stacksRef.current;
        const scrollContainer = findScrollContainer(stacksEl);
        if (stacksEl && scrollContainer && oldZoom > 0) {
            const newRect = stacksEl.getBoundingClientRect();
            const scaleRatio = newZoom / oldZoom;
            const newOffsetFromTop = offsetFromTop * scaleRatio;
            const deltaScroll = newRect.top + newOffsetFromTop - clientY;
            scrollContainer.scrollTop += deltaScroll;
        }
    }, [zoomFactor]);

    // Ctrl + Mouse Wheel & Ctrl + (+/-) / Ctrl + 0 timeline zoom shortcuts
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            if (!(e.ctrlKey || e.metaKey)) return;
            e.preventDefault();
            const factor = Math.exp(-e.deltaY * 0.0028);
            applyZoomWithAnchor(prev => prev * factor, e.clientY);
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (!(e.ctrlKey || e.metaKey)) return;
            if (
                e.key === '+' ||
                e.key === '=' ||
                e.code === 'Equal' ||
                e.code === 'NumpadAdd'
            ) {
                e.preventDefault();
                applyZoomWithAnchor(prev => prev * 1.28);
            } else if (
                e.key === '-' ||
                e.key === '_' ||
                e.code === 'Minus' ||
                e.code === 'NumpadSubtract'
            ) {
                e.preventDefault();
                applyZoomWithAnchor(prev => prev / 1.28);
            } else if (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0') {
                e.preventDefault();
                applyZoomWithAnchor(() => 1);
            }
        };

        window.addEventListener('wheel', handleWheel, { passive: false });
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('wheel', handleWheel);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [applyZoomWithAnchor]);

    // Sync initial query params if provided
    useEffect(() => {
        if (initialPersonAId && eligibleMembers.some(m => m.id === initialPersonAId)) {
            setPersonAId(initialPersonAId);
        }
        if (initialPersonBId && eligibleMembers.some(m => m.id === initialPersonBId)) {
            setPersonBId(initialPersonBId);
        }
    }, [initialPersonAId, initialPersonBId, eligibleMembers]);

    // Initialize default pair selection intelligently
    useEffect(() => {
        if (eligibleMembers.length < 2) {
            setPersonAId(eligibleMembers[0]?.id ?? null);
            setPersonBId(null);
            return;
        }

        const validIds = new Set(eligibleMembers.map(m => m.id));
        if (
            personAId !== null &&
            personBId !== null &&
            validIds.has(personAId) &&
            validIds.has(personBId) &&
            personAId !== personBId
        ) {
            return;
        }

        const preferredA =
            personAId && validIds.has(personAId)
                ? personAId
                : currentUserId && validIds.has(currentUserId)
                ? currentUserId
                : eligibleMembers[0].id;

        let bestA = preferredA;
        let bestB =
            personBId && validIds.has(personBId) && personBId !== preferredA
                ? personBId
                : eligibleMembers.find(m => m.id !== preferredA)?.id ?? eligibleMembers[1].id;
        let bestVolume = -1;

        if (entries.length > 0 && !(personBId && validIds.has(personBId) && personBId !== preferredA)) {
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
        minShareAmount,
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
                minShareAmount: 0,
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
                minShareAmount: 0,
                netDiff: 0,
                shorterSide: 'none' as 'left' | 'right' | 'none',
                coveragePercent: 100
            };
        }

        type RawItem = Omit<CheckBlockItem, 'percentageOfMax' | 'cumulativeAmount'>;
        const rawLeft: RawItem[] = [];
        const rawRight: RawItem[] = [];

        pairData.transactions.forEach((tx, idx) => {
            const contrib = tx.contribution;
            if (Math.abs(contrib) < 0.005) return;

            const rawAmt = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
            const shareAmount = Math.round(Math.abs(contrib) * 100) / 100;
            const fullAmount = Math.round(Math.abs(rawAmt || 0) * 100) / 100;
            const isSettlement = isSettlementEntry(tx as { description?: string | null });
            const isLoan = !isSettlement && rawAmt < 0;

            const item: RawItem = {
                id: tx.id ?? `tx-${idx}`,
                description: (tx.description as string) || '—',
                shareAmount,
                fullAmount,
                createdAt: tx.created_at || '',
                isSettlement,
                isLoan
            };

            if (contrib > 0) {
                rawLeft.push(item);
            } else {
                rawRight.push(item);
            }
        });

        const sortItems = (list: RawItem[]) => {
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

        const allShares = [...sortedLeft, ...sortedRight].map(i => i.shareAmount).filter(v => v > 0);
        const minShare = allShares.length > 0 ? Math.min(...allShares) : 0;

        let shorter: 'left' | 'right' | 'none' = 'none';
        if (diff >= 0.01) {
            shorter = lTotal < rTotal ? 'left' : 'right';
        }

        const minTotal = Math.min(lTotal, rTotal);
        const covPct = mTotal > 0 ? Math.round((minTotal / mTotal) * 100) : 100;

        const enrichList = (list: RawItem[]): CheckBlockItem[] => {
            let running = 0;
            return list.map(item => {
                running = Math.round((running + item.shareAmount) * 100) / 100;
                return {
                    ...item,
                    cumulativeAmount: running,
                    percentageOfMax: mTotal > 0 ? Math.round((item.shareAmount / mTotal) * 1000) / 10 : 0
                };
            });
        };

        return {
            leftChecks: enrichList(sortedLeft),
            rightChecks: enrichList(sortedRight),
            leftTotal: lTotal,
            rightTotal: rTotal,
            maxTotal: mTotal,
            minShareAmount: minShare,
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

    /**
     * Strict 1-to-1 monetary pixel scale:
     * Every 1 unit of currency has the exact same height in pixels (`pxPerUnit`).
     * Supports continuous timeline zoom (`0.15x` to `40x`) via Ctrl+Wheel, Ctrl+Plus/Minus, or slider.
     */
    const pxPerUnit = useMemo(() => {
        if (maxTotal <= 0) return 1;
        const refSmall = Math.max(minShareAmount, maxTotal * 0.003, 1);
        const exactBase = Math.max(700 / maxTotal, 36 / refSmall);
        if (scaleMode === 'exact') {
            return exactBase * zoomFactor;
        }
        const compactBase = Math.max(480 / maxTotal, 14 / refSmall);
        return compactBase * zoomFactor;
    }, [maxTotal, minShareAmount, scaleMode, zoomFactor]);

    const totalStackHeightPx = Math.max(240, Math.round(maxTotal * pxPerUnit));

    // Generate ruler tick marks dynamically based on current zoom level so ticks stay well-spaced
    const rulerTicks = useMemo(() => {
        if (maxTotal <= 0 || pxPerUnit <= 0) return [];
        // Aim for roughly 1 tick every ~160px of vertical height
        const targetTickCount = Math.max(4, Math.min(60, Math.floor(totalStackHeightPx / 160)));
        const rawStep = maxTotal / targetTickCount;
        const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep || 1)));
        const residual = rawStep / magnitude;
        let niceStep = magnitude;
        if (residual > 5) niceStep = 10 * magnitude;
        else if (residual > 2) niceStep = 5 * magnitude;
        else if (residual > 1) niceStep = 2 * magnitude;

        if (niceStep <= 0) return [];
        const ticks: number[] = [];
        for (let val = niceStep; val < maxTotal * 0.99; val += niceStep) {
            ticks.push(Math.round(val * 100) / 100);
        }
        return ticks;
    }, [maxTotal, pxPerUnit, totalStackHeightPx]);

    const formatShortDate = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    // Logarithmic slider conversion: slider value in [-100, 100] -> zoomFactor in [MIN_ZOOM, MAX_ZOOM]
    const sliderValue = useMemo(() => {
        if (zoomFactor >= 1) {
            return Math.round((Math.log(zoomFactor) / Math.log(MAX_ZOOM)) * 100);
        }
        return Math.round(-(Math.log(zoomFactor) / Math.log(MIN_ZOOM)) * 100);
    }, [zoomFactor]);

    const handleSliderChange = (val: number) => {
        let nextZoom = 1;
        if (val > 0) {
            nextZoom = Math.pow(MAX_ZOOM, val / 100);
        } else if (val < 0) {
            nextZoom = Math.pow(MIN_ZOOM, -val / 100);
        }
        applyZoomWithAnchor(() => nextZoom);
    };

    const renderCheckBlock = (item: CheckBlockItem, side: 'left' | 'right') => {
        const isHovered = hoveredBlockId === item.id;
        // Exact 1-to-1 pixel height for this check's money amount
        const exactHeightPx = Math.max(4, item.shareAmount * pxPerUnit);
        // When hovered, expand small checks just enough (42px) to be comfortably readable, then return to 1:1 on mouse leave
        const displayHeightPx = isHovered ? Math.max(exactHeightPx, 42) : exactHeightPx;

        const isTall = displayHeightPx >= 140;
        const isMedium = displayHeightPx >= 56 && displayHeightPx < 140;
        const isSingleLine = displayHeightPx >= 32 && displayHeightPx < 56;
        const isMicro = displayHeightPx < 32;

        const colorClasses = item.isSettlement
            ? 'bg-purple-500/15 hover:bg-purple-500/25 border-purple-500/40 text-purple-950 dark:text-purple-100'
            : side === 'left'
            ? 'bg-emerald-500/14 hover:bg-emerald-500/24 border-emerald-500/40 text-emerald-950 dark:text-emerald-100'
            : 'bg-sky-500/14 hover:bg-sky-500/24 border-sky-500/40 text-sky-950 dark:text-sky-100';

        const accentTextClass = item.isSettlement
            ? 'text-purple-600 dark:text-purple-400'
            : side === 'left'
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-sky-600 dark:text-sky-400';

        const dateLabel = formatShortDate(item.createdAt);
        const entryHref = roomId ? `/rooms/${roomId}/entries?entryId=${encodeURIComponent(String(item.id))}` : null;

        const goToEntryBtn = entryHref ? (
            <Link
                href={entryHref}
                onClick={e => e.stopPropagation()}
                title={t('bilateralGoToEntry')}
                className="p-1 rounded-lg bg-card/80 hover:bg-primary hover:text-primary-foreground text-muted-foreground border border-card-border/70 transition-colors shrink-0 shadow-2xs"
            >
                <FiEdit3 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </Link>
        ) : null;

        return (
            <div
                key={item.id}
                style={{ height: `${displayHeightPx}px` }}
                onMouseEnter={() => setHoveredBlockId(item.id)}
                onMouseLeave={() => setHoveredBlockId(null)}
                onClick={() => setHoveredBlockId(prev => (prev === item.id ? null : item.id))}
                className={`pb-[2px] last:pb-0 box-border w-full relative group ${
                    isHovered ? 'transition-[height] duration-150 ease-out' : ''
                }`}
                title={`${item.description} — ${formatCurrencyAmount(item.shareAmount)} ${currency} (${t('bilateralFullCheckTotal', { amount: formatCurrencyAmount(item.fullAmount), currency })}) • ${t('bilateralCumulative', { amount: formatCurrencyAmount(item.cumulativeAmount), currency })}${dateLabel ? ` • ${dateLabel}` : ''}`}
            >
                <div
                    className={`h-full w-full rounded-xl border transition-colors duration-150 overflow-clip relative shadow-2xs ${colorClasses} ${
                        isHovered ? 'ring-2 ring-primary/50 shadow-md z-20 bg-card/90' : ''
                    } ${
                        isMicro
                            ? 'px-2 py-0 flex items-center justify-between gap-1'
                            : isSingleLine
                            ? 'px-3 py-1 flex items-center justify-between gap-2'
                            : 'px-3.5 py-2 flex flex-col justify-between'
                    }`}
                >
                    {isMicro ? (
                        /* Micro layout (< 32px when unhovered): ultra-compact single line so height stays strictly 1:1 */
                        <>
                            <span className="font-bold text-[10px] leading-none text-foreground truncate">
                                {item.description}
                            </span>
                            <span className={`font-mono font-black text-[10px] leading-none shrink-0 ${accentTextClass}`}>
                                {formatCurrencyAmount(item.shareAmount)} {currency}
                            </span>
                        </>
                    ) : isSingleLine ? (
                        /* Single-line layout (32px – 56px, including hovered thin checks) */
                        <>
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
                            <div className="flex items-center gap-1.5 shrink-0">
                                <div className="flex items-baseline gap-1">
                                    <span className={`font-mono font-black text-xs sm:text-sm ${accentTextClass}`}>
                                        {formatCurrencyAmount(item.shareAmount)}
                                    </span>
                                    <span className="text-[10px] font-semibold text-muted-foreground">
                                        {currency}
                                    </span>
                                </div>
                                {goToEntryBtn}
                            </div>
                        </>
                    ) : (
                        /* Medium (56px – 140px) & Tall (>= 140px) layout */
                        <>
                            {/* Top header row */}
                            <div className="flex items-start justify-between gap-2 min-w-0">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-extrabold text-xs sm:text-sm text-foreground break-words line-clamp-2">
                                            {item.description}
                                        </span>
                                        {item.isSettlement && (
                                            <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-500/30 shrink-0">
                                                {t('exportTypeSettlement')}
                                            </span>
                                        )}
                                    </div>
                                    {item.fullAmount !== item.shareAmount && (
                                        <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                                            {t('bilateralFullCheckTotal', {
                                                amount: formatCurrencyAmount(item.fullAmount),
                                                currency
                                            })}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-start gap-1.5 shrink-0">
                                    <div className="text-end">
                                        <div className="flex items-baseline justify-end gap-1">
                                            <span className={`font-mono font-black text-sm sm:text-base ${accentTextClass}`}>
                                                {formatCurrencyAmount(item.shareAmount)}
                                            </span>
                                            <span className="text-[10px] font-semibold text-muted-foreground">
                                                {currency}
                                            </span>
                                        </div>
                                        {dateLabel && (
                                            <div className="text-[10px] font-medium text-muted-foreground">
                                                {dateLabel}
                                            </div>
                                        )}
                                    </div>
                                    {goToEntryBtn}
                                </div>
                            </div>

                            {/* Center sticky badge for very tall blocks (>= 180px) so scrolling alongside smaller blocks keeps context visible */}
                            {isTall && exactHeightPx >= 180 && (
                                <div className="sticky top-36 my-auto py-2 px-3 rounded-xl bg-card/85 backdrop-blur-xs border border-card-border/80 shadow-xs flex items-center justify-between gap-2 mx-auto w-full max-w-md">
                                    <span className="text-xs font-extrabold text-foreground truncate">
                                        {item.description}
                                    </span>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className={`font-mono font-black text-sm sm:text-base ${accentTextClass}`}>
                                            {formatCurrencyAmount(item.shareAmount)} {currency}
                                        </span>
                                        {goToEntryBtn}
                                    </div>
                                </div>
                            )}

                            {/* Bottom footer row with cumulative sum */}
                            {(isMedium || isTall) && (
                                <div className="flex items-center justify-between gap-2 pt-1 border-t border-card-border/30 text-[10px] font-mono text-muted-foreground">
                                    <span>
                                        {t('bilateralCumulative', {
                                            amount: formatCurrencyAmount(item.cumulativeAmount),
                                            currency
                                        })}
                                    </span>
                                    <span>{item.percentageOfMax}%</span>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        );
    };

    const renderUncoveredGapBlock = (debtorName: string, creditorName: string) => {
        if (netDiff < 0.01) return null;

        const exactGapHeightPx = Math.max(24, netDiff * pxPerUnit);
        const isCompactGap = exactGapHeightPx < 64;

        return (
            <div
                key="uncovered-gap"
                style={{ height: `${exactGapHeightPx}px` }}
                className="pb-0 box-border w-full"
            >
                <div
                    className={`h-full w-full rounded-xl border-2 border-dashed border-amber-500/65 bg-amber-500/8 dark:bg-amber-500/12 px-3 py-2 flex ${
                        isCompactGap
                            ? 'flex-row items-center justify-between gap-2'
                            : 'flex-col items-center justify-center text-center'
                    } overflow-clip relative`}
                >
                    <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                        <FiAlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{t('bilateralUncoveredGap')}</span>
                    </div>
                    <div className="font-mono font-black text-xs sm:text-base text-amber-600 dark:text-amber-400">
                        +{formatCurrencyAmount(netDiff)}{' '}
                        <span className="text-[10px] font-semibold opacity-80">{currency}</span>
                    </div>
                    {!isCompactGap && (
                        <div className="text-[11px] font-semibold text-muted-foreground truncate max-w-full mt-0.5">
                            {t('bilateralUncoveredSub', { debtor: debtorName, creditor: creditorName })}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const creditorName = leftTotal >= rightTotal ? personAName : personBName;
    const debtorName = leftTotal >= rightTotal ? personBName : personAName;

    const fullPageHref = roomId
        ? `/rooms/${roomId}/coverage${
              personAId && personBId ? `?a=${personAId}&b=${personBId}` : ''
          }`
        : null;

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

                {/* Controls: Full Page Link + Scale Mode + Sort */}
                <div className="flex items-center gap-2 flex-wrap">
                    {!isDedicatedPage && fullPageHref && (
                        <Link
                            href={fullPageHref}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-extrabold transition-all shadow-2xs active:scale-95"
                        >
                            <FiExternalLink className="w-3.5 h-3.5 shrink-0" />
                            <span>{t('bilateralOpenFullPage')}</span>
                        </Link>
                    )}

                    {/* 1:1 Exact vs Compact Toggle */}
                    <div className="flex items-center p-0.5 bg-background rounded-xl border border-card-border shadow-xs text-xs font-bold">
                        <button
                            type="button"
                            onClick={() => setScaleMode('exact')}
                            title={t('bilateralScaleExactTooltip')}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all text-xs font-semibold cursor-pointer ${
                                scaleMode === 'exact'
                                    ? 'bg-primary text-primary-foreground shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <FiMaximize2 className="w-3.5 h-3.5 shrink-0" />
                            <span>{t('bilateralScaleModeExact')}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setScaleMode('compact')}
                            title={t('bilateralScaleCompactTooltip')}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all text-xs font-semibold cursor-pointer ${
                                scaleMode === 'compact'
                                    ? 'bg-primary text-primary-foreground shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <FiMinimize2 className="w-3.5 h-3.5 shrink-0" />
                            <span>{t('bilateralScaleModeCompact')}</span>
                        </button>
                    </div>

                    {/* Sort Toggle */}
                    <div className="flex items-center p-0.5 bg-background rounded-xl border border-card-border shadow-xs text-xs font-bold">
                        <button
                            type="button"
                            onClick={() => setSortBy('amount')}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all text-xs font-semibold cursor-pointer ${
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
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all text-xs font-semibold cursor-pointer ${
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
                {/* Sticky Header Wrapper on Dedicated Page so scrolling tall 1:1 stacks keeps member headers + timeline zoom bar visible */}
                <div
                    className={
                        isDedicatedPage
                            ? 'sticky top-0 z-30 bg-card/95 backdrop-blur-md py-2.5 -mx-2 px-2 rounded-xl border-b border-card-border/60 space-y-2.5'
                            : 'space-y-3'
                    }
                >
                    {/* 1. Pair Selector Bar */}
                    <div className="grid grid-cols-1 sm:grid-cols-11 gap-2 sm:gap-3 items-center p-2.5 sm:p-3 rounded-xl bg-muted/40 border border-card-border">
                        {/* Person A Selector */}
                        <div className="sm:col-span-5 flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-xs shrink-0">
                                {personAName.charAt(0).toUpperCase()}
                            </div>
                            <select
                                aria-label={t('bilateralPersonA')}
                                value={personAId ?? ''}
                                onChange={e => handleSelectA(Number(e.target.value))}
                                className="w-full rounded-xl bg-background border border-card-border px-3 py-1.5 text-xs sm:text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all cursor-pointer"
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
                                className="w-full rounded-xl bg-background border border-card-border px-3 py-1.5 text-xs sm:text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all cursor-pointer"
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

                    {/* Timeline Zoom Bar (Video-Editor Style: Slider + +/- + Ctrl+Wheel hint) */}
                    <div className="flex items-center justify-between flex-wrap gap-2 px-3 py-1.5 rounded-xl bg-background/80 border border-card-border">
                        <span className="text-[11px] font-semibold text-muted-foreground">
                            {t('bilateralZoomHint')}
                        </span>

                        <div className="flex items-center gap-2 ms-auto">
                            <button
                                type="button"
                                onClick={() => applyZoomWithAnchor(prev => prev / 1.3)}
                                disabled={zoomFactor <= MIN_ZOOM}
                                title={`${t('bilateralZoomOut')} (Ctrl -)`}
                                className="p-1.5 rounded-lg bg-card hover:bg-muted border border-card-border text-muted-foreground hover:text-foreground disabled:opacity-35 transition-colors cursor-pointer"
                            >
                                <FiZoomOut className="w-3.5 h-3.5" />
                            </button>

                            <input
                                type="range"
                                min={-100}
                                max={100}
                                step={1}
                                value={sliderValue}
                                onChange={e => handleSliderChange(Number(e.target.value))}
                                aria-label="Scale zoom"
                                className="w-28 sm:w-40 accent-primary cursor-pointer h-1.5 bg-muted rounded-lg"
                            />

                            <button
                                type="button"
                                onClick={() => applyZoomWithAnchor(prev => prev * 1.3)}
                                disabled={zoomFactor >= MAX_ZOOM}
                                title={`${t('bilateralZoomIn')} (Ctrl +)`}
                                className="p-1.5 rounded-lg bg-card hover:bg-muted border border-card-border text-muted-foreground hover:text-foreground disabled:opacity-35 transition-colors cursor-pointer"
                            >
                                <FiZoomIn className="w-3.5 h-3.5" />
                            </button>

                            <button
                                type="button"
                                onClick={() => applyZoomWithAnchor(() => 1)}
                                title="Reset zoom (Ctrl + 0)"
                                className="px-2 py-1 rounded-lg bg-card hover:bg-muted border border-card-border font-mono text-[11px] font-extrabold text-foreground min-w-[54px] text-center cursor-pointer transition-colors"
                            >
                                {Math.round(zoomFactor * 100)}%
                            </button>
                        </div>
                    </div>

                    {/* Column Headers */}
                    {(leftChecks.length > 0 || rightChecks.length > 0) && (
                        <div className="grid grid-cols-2 gap-3 sm:gap-5">
                            {/* Left Column Header: Person A paid for Person B */}
                            <div className="p-2.5 sm:p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20 flex flex-col justify-between gap-1">
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
                            <div className="p-2.5 sm:p-3 rounded-xl bg-sky-500/8 border border-sky-500/20 flex flex-col justify-between gap-1">
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
                    )}
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
                        {/* Summary Banner */}
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

                        {/* 2, 3, 4. Strict 1:1 Proportional Parallel Columns with Monetary Ruler & Uncovered Gap Block */}
                        <div
                            ref={stacksRef}
                            className="relative rounded-2xl bg-background/50 border border-card-border p-3 sm:p-4"
                        >
                            {/* Monetary ruler tick lines across the stack */}
                            <div
                                className="pointer-events-none absolute inset-x-3 sm:inset-x-4 top-3 sm:top-4 z-0"
                                style={{ height: `${totalStackHeightPx}px` }}
                            >
                                {rulerTicks.map(tickVal => {
                                    const topPx = tickVal * pxPerUnit;
                                    return (
                                        <div
                                            key={tickVal}
                                            style={{ top: `${topPx}px` }}
                                            className="absolute inset-x-0 border-t border-dashed border-card-border/60 flex justify-center"
                                        >
                                            <span className="-top-2.5 relative px-1.5 py-0.2 rounded bg-card/90 text-[9px] font-mono font-bold text-muted-foreground border border-card-border/50">
                                                {formatCurrencyAmount(tickVal)} {currency}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="relative z-10 grid grid-cols-2 gap-3 sm:gap-5 items-start">
                                {/* Left Column Stack: Person A paid for Person B */}
                                <div className="flex flex-col w-full">
                                    {leftChecks.map(item => renderCheckBlock(item, 'left'))}
                                    {shorterSide === 'left' &&
                                        renderUncoveredGapBlock(personAName, personBName)}
                                </div>

                                {/* Right Column Stack: Person B paid for Person A */}
                                <div className="flex flex-col w-full">
                                    {rightChecks.map(item => renderCheckBlock(item, 'right'))}
                                    {shorterSide === 'right' &&
                                        renderUncoveredGapBlock(personBName, personAName)}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
