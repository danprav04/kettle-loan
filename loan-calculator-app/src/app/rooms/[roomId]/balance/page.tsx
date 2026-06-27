// src/app/rooms/[roomId]/balance/page.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSync } from '@/components/SyncProvider';
import { getRoomData, Entry, addLocalEntry } from '@/lib/offline-sync';
import { handleApi } from '@/lib/api';
import { useUser } from '@/components/UserProvider';
import { FiChevronDown, FiSearch, FiRotateCcw, FiStar, FiClock, FiDollarSign, FiArrowDownLeft, FiArrowUpRight, FiCheckCircle, FiUsers, FiActivity } from 'react-icons/fi';

interface Member {
    id: number;
    username: string;
    role?: string;
}

type PeerToPeerTransaction = Entry & { contribution: number; runningP2PBalance: number };

export default function BalanceDetailsPage() {
    const params = useParams<{ roomId: string }>();
    const { roomId } = params;
    const t = useTranslations('Room');
    const { isOnline } = useSync();
    const { user } = useUser();
    const router = useRouter();

    const [entries, setEntries] = useState<Entry[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [currency, setCurrency] = useState('ILS');
    const [isLoading, setIsLoading] = useState(true);
    const [expandedMemberId, setExpandedMemberId] = useState<number | null>(null);
    const [perspectiveUserId, setPerspectiveUserId] = useState<number | null>(null);

    // Dashboard features state
    const [viewMode, setViewMode] = useState<'balance' | 'history'>('balance');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'expense' | 'loan' | 'settlement'>('all');
    const [defaultViewSaved, setDefaultViewSaved] = useState(false);

    useEffect(() => {
        const pref = localStorage.getItem(`defaultRoomDashboardView_${roomId}`);
        if (pref && (pref === 'balance' || pref === 'history')) {
            setViewMode(pref);
        }
    }, [roomId]);

    const handleSetDefaultView = () => {
        localStorage.setItem(`defaultRoomDashboardView_${roomId}`, viewMode);
        setDefaultViewSaved(true);
        setTimeout(() => setDefaultViewSaved(false), 3000);
    };

    const handleQuickReset = () => {
        setSearchQuery('');
        setFilterType('all');
    };

    const activePerspectiveUserId = perspectiveUserId ?? user?.userId ?? 0;
    const otherMembers = useMemo(() => members.filter(m => m.id !== activePerspectiveUserId && m.role !== 'observer'), [members, activePerspectiveUserId]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        const token = localStorage.getItem('token');
        if (!token || !user) {
            router.push('/');
            return;
        }

        const localData = await getRoomData(roomId);
        if (localData) {
            setEntries(localData.entries);
            setMembers(localData.members);
            if (localData.currency) setCurrency(localData.currency);
        }

        if (isOnline) {
            try {
                const res = await fetch(`/api/rooms/${roomId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setEntries(data.entries);
                    setMembers(data.members);
                    if (data.currency) setCurrency(data.currency);
                } else if (res.status === 401) {
                    router.push('/');
                }
            } catch (e) {
                console.error("Failed to refresh balance data. Using local data.", e);
            }
        }
        setIsLoading(false);
    }, [roomId, router, isOnline, user]);

    const handleSettleUp = async (memberId: number, amountToSettle: number) => {
        if (!user || !user.userId) return;

        const finalAmount = amountToSettle;
        const description = t('settleUpDescription') || "Settle up";

        const currentUser = members.find(m => m.id === user.userId);
        if (!currentUser) return;

        const optimisticEntry: Entry = {
            id: `temp-${Date.now()}`,
            amount: finalAmount.toFixed(2),
            description,
            created_at: new Date().toISOString(),
            username: currentUser.username,
            user_id: user.userId,
            split_with_user_ids: [memberId],
            offline_timestamp: Date.now()
        };

        await addLocalEntry(roomId, optimisticEntry);
        await fetchData();

        try {
            await handleApi({
                method: 'POST',
                url: '/api/entries',
                body: { 
                    roomId, 
                    amount: finalAmount, 
                    description, 
                    splitWithUserIds: [memberId],
                    createdAt: optimisticEntry.created_at
                },
            });
            if (isOnline) {
                fetchData();
            }
        } catch (error) {
            console.error("Failed to add settlement entry:", error);
        }
    };

    useEffect(() => {
        fetchData();
        window.addEventListener('syncdone', fetchData);
        return () => {
            window.removeEventListener('syncdone', fetchData);
        };
    }, [fetchData]);

    const peerToPeerBalances = useMemo(() => {
        if (!user?.userId || !members.length || !entries.length) {
            return new Map<number, { netBalance: number; transactions: PeerToPeerTransaction[] }>();
        }

        const calcMembers = members.filter(m => m.role !== 'observer');
        const breakdown = new Map<number, { netBalance: number; transactions: PeerToPeerTransaction[] }>();
        const currentUserId = activePerspectiveUserId;

        otherMembers.forEach(member => {
            breakdown.set(member.id, { netBalance: 0, transactions: [] });
        });

        const chronologicalEntries = [...entries].reverse();

        for (const entry of chronologicalEntries) {
            const amount = parseFloat(entry.amount);

            if (entry.payer_shares && entry.beneficiary_shares && Array.isArray(entry.payer_shares) && Array.isArray(entry.beneficiary_shares)) {
                const myPayer = entry.payer_shares.find(p => p.userId === currentUserId);
                const myBen = entry.beneficiary_shares.find(b => b.userId === currentUserId);
                const myPaid = myPayer ? amount * (myPayer.percentage / 100) : 0;
                const myOwed = myBen ? amount * (myBen.percentage / 100) : 0;
                const netMe = myPaid - myOwed;

                otherMembers.forEach(other => {
                    if (breakdown.has(other.id)) {
                        const oPayer = entry.payer_shares!.find(p => p.userId === other.id);
                        const oBen = entry.beneficiary_shares!.find(b => b.userId === other.id);
                        const oPaid = oPayer ? amount * (oPayer.percentage / 100) : 0;
                        const oOwed = oBen ? amount * (oBen.percentage / 100) : 0;
                        const netOther = oPaid - oOwed;

                        if (Math.abs(netOther) > 0.001 || Math.abs(netMe) > 0.001) {
                            const data = breakdown.get(other.id)!;
                            const contrib = netMe > 0 && netOther < 0 ? Math.min(netMe, Math.abs(netOther)) : (netMe < 0 && netOther > 0 ? -Math.min(Math.abs(netMe), netOther) : 0);
                            if (Math.abs(contrib) > 0.001) {
                                data.netBalance += contrib;
                                data.transactions.push({ ...entry, contribution: contrib, runningP2PBalance: data.netBalance });
                            }
                        }
                    }
                });
                continue;
            }

            const payerId = entry.user_id;

            if (amount > 0) { // Expense
                const participants = entry.split_with_user_ids ?? calcMembers.map(m => m.id);
                if (participants.length === 0) continue;
                const share = amount / participants.length;

                if (payerId === currentUserId) {
                    participants.forEach(pId => {
                        if (pId !== currentUserId && breakdown.has(pId)) {
                            const data = breakdown.get(pId)!;
                            const contribution = share;
                            data.netBalance += contribution;
                            data.transactions.push({ ...entry, contribution, runningP2PBalance: data.netBalance });
                        }
                    });
                } else if (participants.includes(currentUserId) && breakdown.has(payerId)) {
                    const data = breakdown.get(payerId)!;
                    const contribution = -share;
                    data.netBalance += contribution;
                    data.transactions.push({ ...entry, contribution, runningP2PBalance: data.netBalance });
                }
            } else if (amount < 0) { // Loan
                const loanAmount = Math.abs(amount);
                const borrowerId = payerId;
                const participants = entry.split_with_user_ids;
                const lenders = participants && participants.length > 0
                    ? calcMembers.filter(m => participants.includes(m.id))
                    : calcMembers.filter(m => m.id !== borrowerId);

                if (lenders.length === 0) continue;
                const creditPerLender = loanAmount / lenders.length;

                if (borrowerId === currentUserId) {
                    lenders.forEach(lender => {
                        if (breakdown.has(lender.id)) {
                            const data = breakdown.get(lender.id)!;
                            const contribution = -creditPerLender;
                            data.netBalance += contribution;
                            data.transactions.push({ ...entry, contribution, runningP2PBalance: data.netBalance });
                        }
                    });
                } else if (lenders.some(l => l.id === currentUserId) && breakdown.has(borrowerId)) {
                    const data = breakdown.get(borrowerId)!;
                    const contribution = creditPerLender;
                    data.netBalance += contribution;
                    data.transactions.push({ ...entry, contribution, runningP2PBalance: data.netBalance });
                }
            }
        }

        breakdown.forEach(value => value.transactions.reverse());
        return breakdown;
    }, [entries, members, user, otherMembers]);

    // Filtered history list
    const filteredHistory = useMemo(() => {
        return entries.filter(entry => {
            const matchesSearch = entry.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                entry.username.toLowerCase().includes(searchQuery.toLowerCase());
            if (!matchesSearch) return false;

            const amt = parseFloat(entry.amount);
            if (filterType === 'expense' && amt <= 0) return false;
            if (filterType === 'loan' && amt >= 0) return false;
            if (filterType === 'settlement' && !entry.description.toLowerCase().includes('settle')) return false;
            return true;
        });
    }, [entries, searchQuery, filterType]);

    const getBalanceText = (balance: number, targetMemberName: string) => {
        const absBalance = Math.abs(balance);
        const isSelf = activePerspectiveUserId === user?.userId;

        if (balance > 0.005) {
            return {
                text: isSelf
                    ? t('owesYou', { amount: absBalance.toFixed(2), currency })
                    : t('owesMember', { member: targetMemberName, amount: absBalance.toFixed(2), currency }),
                color: 'text-success bg-success/15 border-success/30'
            };
        }
        if (balance < -0.005) {
            return {
                text: isSelf
                    ? t('youOwe', { amount: absBalance.toFixed(2), currency })
                    : t('memberOwes', { member: targetMemberName, amount: absBalance.toFixed(2), currency }),
                color: 'text-danger bg-danger/15 border-danger/30'
            };
        }
        return { text: t('settledUp'), color: 'text-muted-foreground bg-muted/50 border-card-border' };
    };

    return (
        <div className="max-w-4xl mx-auto animate-scaleIn flex flex-col h-full space-y-4">
            <div className="shrink-0 flex items-center justify-between flex-wrap gap-2">
                <button onClick={() => router.back()} className="font-bold py-2 px-4 rounded-lg btn-primary text-xs sm:text-sm shadow-sm transition-all active:scale-95">
                    {t('backToRoom')}
                </button>

                {/* View Switcher & Default Saver */}
                <div className="flex items-center gap-2">
                    <div className="bg-card p-1 rounded-xl border border-card-border shadow-sm flex items-center">
                        <button
                            onClick={() => setViewMode('balance')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                viewMode === 'balance' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <FiDollarSign /> {t('balanceBreakdown')}
                        </button>
                        <button
                            onClick={() => setViewMode('history')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                viewMode === 'history' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                            }`}
                            style={{ display: 'none' }}
                        >
                            <FiClock /> {t('activityHistoryTab')}
                        </button>
                    </div>

                    <button
                        onClick={handleSetDefaultView}
                        className="p-2 text-muted-foreground hover:text-amber-400 bg-card border border-card-border rounded-xl shadow-sm transition-colors"
                        style={{ display: 'none' }}
                        title={t('setDefaultViewTitle')}
                    >
                        <FiStar className={defaultViewSaved ? 'fill-amber-400 text-amber-400' : ''} />
                    </button>
                </div>
            </div>

            {defaultViewSaved && (
                <div className="p-2.5 text-xs font-bold bg-success/15 text-success border border-success/30 rounded-xl text-center shadow-sm animate-fadeIn">
                    {t('defaultViewSavedMsg')}
                </div>
            )}

            {/* Dynamic Filter Bar */}
            <div className="bg-card p-3 sm:p-3.5 rounded-2xl border border-card-border shadow-md flex items-center justify-between gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <FiSearch className="absolute left-3.5 top-2.5 text-muted-foreground text-sm" />
                    <input
                        type="text"
                        placeholder={t('searchFilterPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full themed-input pl-9 pr-3 py-1.5 text-xs rounded-xl border border-input bg-background transition-all focus:ring-1 focus:ring-primary"
                    />
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                    {(['all', 'expense', 'loan', 'settlement'] as const).map(type => (
                        <button
                            key={type}
                            onClick={() => setFilterType(type)}
                            className={`text-[11px] px-3 py-1.5 rounded-xl uppercase font-extrabold tracking-wider transition-all border ${
                                filterType === type ? 'bg-primary/15 text-primary border-primary/40 shadow-sm' : 'bg-background hover:bg-muted text-muted-foreground border-card-border'
                            }`}
                        >
                            {type === 'all' ? t('filterAll') : (type === 'expense' ? t('filterExpense') : (type === 'loan' ? t('filterLoan') : t('filterSettlement')))}
                        </button>
                    ))}

                    {(searchQuery || filterType !== 'all') && (
                        <button
                            onClick={handleQuickReset}
                            className="p-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-xl flex items-center gap-1.5 ml-1 font-semibold transition-colors"
                            title={t('quickResetFiltersTitle')}
                        >
                            <FiRotateCcw /> <span className="hidden sm:inline">{t('resetFilters')}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Content Container */}
            <div className="bg-card shadow-xl rounded-2xl border border-card-border flex flex-col flex-grow overflow-hidden max-h-[75vh]">
                <div className="p-4 sm:p-5 border-b border-card-border bg-muted/40 shrink-0 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-sm shrink-0">
                            {viewMode === 'balance' ? <FiUsers className="w-5 h-5" /> : <FiActivity className="w-5 h-5" />}
                        </div>
                        <div>
                            <h1 className="text-base sm:text-lg font-extrabold text-card-foreground tracking-tight">
                                {viewMode === 'balance' ? t('peerBalancesTitle') : `${t('activityHistoryTab')} (${filteredHistory.length})`}
                            </h1>
                        </div>
                    </div>
                    {viewMode === 'balance' && members.length > 1 && (
                        <div className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-xl border border-card-border shadow-sm">
                            <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider shrink-0">{t('perspectiveLabel')}:</span>
                            <select
                                value={activePerspectiveUserId}
                                onChange={(e) => setPerspectiveUserId(parseInt(e.target.value))}
                                className="text-xs font-bold bg-transparent text-foreground cursor-pointer focus:outline-none border-none pr-1"
                            >
                                {members.filter(m => m.role !== 'observer').map(m => (
                                    <option key={m.id} value={m.id} className="bg-card text-foreground font-semibold">
                                        {m.username} {m.id === user?.userId ? `(${t('me')})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <div className="overflow-y-auto flex-grow">
                    {isLoading ? (
                        <div className="p-16 text-center flex flex-col items-center justify-center gap-3">
                            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                            <p className="text-muted-foreground text-xs font-semibold">{t('loadingData')}</p>
                        </div>
                    ) : viewMode === 'balance' ? (
                        /* BALANCE TAB */
                        otherMembers.length === 0 ? (
                            <div className="p-16 text-center flex flex-col items-center justify-center gap-2">
                                <FiUsers className="w-8 h-8 text-muted-foreground/40" />
                                <p className="text-muted-foreground text-xs font-medium">{t('noOtherMembers')}</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-card-border/60">
                                {otherMembers.map((member) => {
                                    const p2pData = peerToPeerBalances.get(member.id);
                                    const netBalance = p2pData?.netBalance ?? 0;
                                    const balanceInfo = getBalanceText(netBalance, member.username);
                                    const isExpanded = expandedMemberId === member.id;

                                    return (
                                        <li key={member.id} className="transition-colors animate-fadeIn">
                                            <button 
                                                onClick={() => setExpandedMemberId(isExpanded ? null : member.id)}
                                                className={`w-full text-left p-4 sm:p-5 flex justify-between items-center transition-all ${
                                                    isExpanded ? 'bg-muted/40' : 'hover:bg-muted/30'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3.5 min-w-0 pr-2">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center font-bold text-primary text-sm shadow-sm shrink-0">
                                                        {member.username.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <span className="font-bold text-card-foreground text-sm sm:text-base tracking-tight block truncate">
                                                            {member.username}
                                                        </span>
                                                        {member.role && (
                                                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                                                {member.role}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2.5 shrink-0">
                                                    <span className={`text-xs font-bold px-3 py-1 rounded-full border shadow-sm ${balanceInfo.color}`}>
                                                        {balanceInfo.text}
                                                    </span>
                                                    <div className={`p-1.5 rounded-full bg-muted text-muted-foreground transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-primary/20 text-primary' : ''}`}>
                                                        <FiChevronDown className="w-4 h-4" />
                                                    </div>
                                                </div>
                                            </button>
                                            {isExpanded && (
                                                <div className="bg-background/80 px-4 sm:px-6 pt-2 pb-5 animate-fadeIn border-t border-card-border/60">
                                                    {netBalance < -0.005 && activePerspectiveUserId === user?.userId && (
                                                        <div className="my-4 p-4 rounded-xl bg-gradient-to-r from-success/20 via-success/10 to-transparent border border-success/40 flex items-center justify-between flex-wrap gap-3 shadow-sm">
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className="p-2.5 rounded-xl bg-success text-success-foreground shrink-0 shadow-sm">
                                                                    <FiCheckCircle className="w-5 h-5" />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-xs sm:text-sm font-extrabold text-foreground tracking-tight truncate">{t('outstandingDebtTitle')}</p>
                                                                    <p className="text-[11px] text-muted-foreground truncate">{t('outstandingDebtSubtitle', { member: member.username })}</p>
                                                                </div>
                                                            </div>
                                                            <button 
                                                                onClick={() => handleSettleUp(member.id, Math.abs(netBalance))}
                                                                className="bg-success text-success-foreground hover:opacity-90 py-2 px-4 rounded-xl text-xs font-extrabold tracking-wide transition-all shadow-md active:scale-95 flex items-center gap-1.5 shrink-0"
                                                            >
                                                                <FiDollarSign className="w-3.5 h-3.5" />
                                                                <span>{t('settleUpBtn', { amount: Math.abs(netBalance).toFixed(2), currency })}</span>
                                                            </button>
                                                        </div>
                                                    )}
                                                    {p2pData?.transactions && p2pData.transactions.length > 0 ? (
                                                        <div className="mt-3 space-y-2">
                                                            <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-1 pb-1">
                                                                <span className="flex items-center gap-1.5">
                                                                    <FiClock className="w-3.5 h-3.5" /> {t('mutualActivityLog')}
                                                                </span>
                                                                <span>{t('netImpactLabel')}</span>
                                                            </div>
                                                            <div className="divide-y divide-card-border/60 bg-card rounded-xl border border-card-border overflow-hidden shadow-sm">
                                                                {p2pData.transactions.map((tx, index) => {
                                                                    const isPositive = tx.contribution >= 0;
                                                                    return (
                                                                        <div key={`${tx.id}-${index}`} className="p-3 sm:p-3.5 flex items-center justify-between gap-3 hover:bg-muted/40 transition-colors">
                                                                            <div className="flex items-center gap-3 min-w-0">
                                                                                <div className={`p-2 rounded-lg shrink-0 ${
                                                                                    isPositive ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
                                                                                }`}>
                                                                                    {isPositive ? <FiArrowDownLeft className="w-4 h-4" /> : <FiArrowUpRight className="w-4 h-4" />}
                                                                                </div>
                                                                                <div className="min-w-0">
                                                                                    <p className="font-semibold text-foreground text-xs sm:text-sm truncate">{tx.description}</p>
                                                                                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                                                                        {tx.username} &bull; {new Date(tx.created_at).toLocaleString()}
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                            <div className="text-right shrink-0">
                                                                                <span className={`text-xs sm:text-sm font-bold font-mono px-2 py-1 rounded ${
                                                                                    isPositive ? 'text-success bg-success/10' : 'text-danger bg-danger/10'
                                                                                }`}>
                                                                                    {isPositive ? '+' : ''}{tx.contribution.toFixed(2)} {currency}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="py-8 text-center bg-card rounded-xl border border-dashed border-card-border mt-3">
                                                            <p className="text-xs text-muted-foreground italic">{t('noMutualTransactions')}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )
                    ) : (
                        /* HISTORY TAB */
                        filteredHistory.length === 0 ? (
                            <div className="p-16 text-center flex flex-col items-center justify-center gap-2">
                                <FiClock className="w-8 h-8 text-muted-foreground/40" />
                                <p className="text-muted-foreground text-xs font-medium">{t('noFilteredHistory')}</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-card-border/60">
                                {filteredHistory.map(entry => {
                                    const amt = parseFloat(entry.amount);
                                    const isNegative = amt < 0;
                                    return (
                                        <li key={entry.id} className="p-4 sm:p-5 flex justify-between items-center hover:bg-muted/30 transition-colors gap-3">
                                            <div className="flex items-center gap-3.5 min-w-0">
                                                <div className={`p-2.5 rounded-xl shrink-0 ${
                                                    isNegative ? 'bg-danger/15 text-danger' : 'bg-success/15 text-success'
                                                }`}>
                                                    {isNegative ? <FiArrowUpRight className="w-4 h-4" /> : <FiArrowDownLeft className="w-4 h-4" />}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-foreground text-xs sm:text-sm truncate">{entry.description}</p>
                                                    <p className="text-muted-foreground text-[11px] mt-0.5 truncate">
                                                        {t('byAuthor', { author: entry.username })} &bull; {new Date(entry.created_at).toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className={`text-xs sm:text-sm font-bold font-mono shrink-0 px-2.5 py-1 rounded-lg ${
                                                isNegative ? 'text-danger bg-danger/10' : 'text-success bg-success/10'
                                            }`}>
                                                {isNegative ? '' : '+'}{amt.toFixed(2)} {currency}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
