// src/app/rooms/[roomId]/balance/page.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSync } from '@/components/SyncProvider';
import { getRoomData, Entry, addLocalEntry } from '@/lib/offline-sync';
import { handleApi } from '@/lib/api';
import { useUser } from '@/components/UserProvider';
import { FiChevronDown, FiSearch, FiRotateCcw, FiStar, FiClock, FiDollarSign } from 'react-icons/fi';

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
        const perspMember = members.find(m => m.id === activePerspectiveUserId);
        const perspName = perspMember ? perspMember.username : '';

        if (balance > 0.005) {
            return {
                text: isSelf
                    ? t('owesYou', { amount: absBalance.toFixed(2), currency })
                    : t('owesMember', { member: targetMemberName, amount: absBalance.toFixed(2), currency }),
                color: 'text-success'
            };
        }
        if (balance < -0.005) {
            return {
                text: isSelf
                    ? t('youOwe', { amount: absBalance.toFixed(2), currency })
                    : t('memberOwes', { member: targetMemberName, amount: absBalance.toFixed(2), currency }),
                color: 'text-danger'
            };
        }
        return { text: t('settledUp'), color: 'text-muted-foreground' };
    };

    return (
        <div className="max-w-4xl mx-auto animate-scaleIn flex flex-col h-full space-y-4">
            <div className="shrink-0 flex items-center justify-between flex-wrap gap-2">
                <button onClick={() => router.back()} className="font-bold py-2 px-4 rounded-lg btn-primary text-xs sm:text-sm">
                    {t('backToRoom')}
                </button>

                {/* View Switcher & Default Saver */}
                <div className="flex items-center gap-2">
                    <div className="bg-muted p-1 rounded-lg flex items-center">
                        <button
                            onClick={() => setViewMode('balance')}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                                viewMode === 'balance' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <FiDollarSign /> {t('balanceBreakdown')}
                        </button>
                        <button
                            onClick={() => setViewMode('history')}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                                viewMode === 'history' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                            }`}
                            style={{ display: 'none' }}
                        >
                            <FiClock /> {t('activityHistoryTab')}
                        </button>
                    </div>

                    <button
                        onClick={handleSetDefaultView}
                        className="p-1.5 text-muted-foreground hover:text-amber-400 bg-card border border-border rounded-lg transition-colors"
                        title="Set current view as default"
                    >
                        <FiStar className={defaultViewSaved ? 'fill-amber-400 text-amber-400' : ''} />
                    </button>
                </div>
            </div>

            {defaultViewSaved && (
                <div className="p-2 text-xs bg-success/20 text-success border border-success/40 rounded-lg text-center">
                    ✓ Preferred view saved as default for this room!
                </div>
            )}

            {/* Dynamic Filter Bar */}
            <div className="bg-card p-3 rounded-xl border border-border shadow-sm flex items-center justify-between gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <FiSearch className="absolute left-3 top-2.5 text-muted-foreground text-sm" />
                    <input
                        type="text"
                        placeholder={t('searchFilterPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full themed-input pl-9 pr-3 py-1.5 text-xs rounded-lg border border-input bg-background"
                    />
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                    {(['all', 'expense', 'loan', 'settlement'] as const).map(type => (
                        <button
                            key={type}
                            onClick={() => setFilterType(type)}
                            className={`text-[11px] px-2.5 py-1 rounded-lg uppercase font-bold tracking-wider transition-colors border ${
                                filterType === type ? 'bg-primary/20 text-primary border-primary/30' : 'bg-background hover:bg-muted text-muted-foreground border-border'
                            }`}
                        >
                            {type === 'all' ? t('filterAll') : (type === 'expense' ? t('filterExpense') : (type === 'loan' ? t('filterLoan') : t('filterSettlement')))}
                        </button>
                    ))}

                    {(searchQuery || filterType !== 'all') && (
                        <button
                            onClick={handleQuickReset}
                            className="p-1.5 text-xs text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-lg flex items-center gap-1 ml-1"
                            title="Quick Reset Filters"
                        >
                            <FiRotateCcw /> <span className="hidden sm:inline">{t('resetFilters')}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Content Container */}
            <div className="bg-card shadow-md rounded-xl border border-card-border flex flex-col flex-grow overflow-hidden max-h-[70vh]">
                <div className="p-4 border-b border-card-border shrink-0 flex items-center justify-between flex-wrap gap-2">
                    <h1 className="text-lg font-bold text-card-foreground">
                        {viewMode === 'balance' ? t('peerBalancesTitle') : `${t('activityHistoryTab')} (${filteredHistory.length})`}
                    </h1>
                    {viewMode === 'balance' && members.length > 1 && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">{t('perspectiveLabel')}:</span>
                            <select
                                value={activePerspectiveUserId}
                                onChange={(e) => setPerspectiveUserId(parseInt(e.target.value))}
                                className="themed-input text-xs font-bold px-2.5 py-1 rounded-lg border border-primary/40 bg-card text-foreground cursor-pointer shadow-sm focus:ring-1 focus:ring-primary"
                            >
                                {members.filter(m => m.role !== 'observer').map(m => (
                                    <option key={m.id} value={m.id}>
                                        {m.username} {m.id === user?.userId ? `(${t('me')})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <div className="overflow-y-auto flex-grow">
                    {isLoading ? (
                        <p className="p-8 text-center text-muted-foreground text-xs">{t('loadingData')}</p>
                    ) : viewMode === 'balance' ? (
                        /* BALANCE TAB */
                        otherMembers.length === 0 ? (
                            <p className="p-8 text-center text-muted-foreground text-xs">{t('noOtherMembers')}</p>
                        ) : (
                            <ul>
                                {otherMembers.map((member) => {
                                    const p2pData = peerToPeerBalances.get(member.id);
                                    const netBalance = p2pData?.netBalance ?? 0;
                                    const balanceInfo = getBalanceText(netBalance, member.username);
                                    const isExpanded = expandedMemberId === member.id;

                                    return (
                                        <li key={member.id} className="border-b border-card-border last:border-b-0 animate-fadeIn">
                                            <button 
                                                onClick={() => setExpandedMemberId(isExpanded ? null : member.id)}
                                                className="w-full text-left p-4 flex justify-between items-center hover:bg-muted/50 transition-colors"
                                            >
                                                <span className="font-semibold text-card-foreground text-sm">{member.username}</span>
                                                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                                                    <span className={`text-xs font-bold ${balanceInfo.color}`}>{balanceInfo.text}</span>
                                                    <FiChevronDown className={`text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                </div>
                                            </button>
                                            {isExpanded && (
                                                <div className="bg-muted/30 px-4 py-3 animate-fadeIn border-t border-border/50">
                                                    {netBalance < -0.005 && activePerspectiveUserId === user?.userId && (
                                                        <div className="mb-4 flex justify-end">
                                                            <button 
                                                                onClick={() => handleSettleUp(member.id, Math.abs(netBalance))}
                                                                className="bg-success text-success-foreground hover:bg-success/90 py-1 px-3 rounded text-xs font-bold transition-colors shadow-sm"
                                                            >
                                                                {t('settleUpBtn', { amount: Math.abs(netBalance).toFixed(2), currency })}
                                                            </button>
                                                        </div>
                                                    )}
                                                    {p2pData?.transactions && p2pData.transactions.length > 0 ? (
                                                        <ul className="space-y-2">
                                                            {p2pData.transactions.map((tx, index) => (
                                                                <li key={`${tx.id}-${index}`} className="flex justify-between items-center text-xs p-2 bg-background rounded border border-border/40">
                                                                    <div>
                                                                        <p className="font-semibold text-foreground">{tx.description}</p>
                                                                        <p className="text-[10px] text-muted-foreground">
                                                                            {tx.username} &bull; {new Date(tx.created_at).toLocaleString()}
                                                                        </p>
                                                                    </div>
                                                                    <div className="flex items-center space-x-4 shrink-0">
                                                                        <div className="text-right">
                                                                            <div className={`font-bold ${tx.contribution >= 0 ? 'text-success' : 'text-danger'}`}>
                                                                                {tx.contribution >= 0 ? '+' : ''}{tx.contribution.toFixed(2)} {currency}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <p className="text-xs text-muted-foreground italic text-center py-2">No mutual transactions.</p>
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
                            <p className="p-8 text-center text-muted-foreground text-xs">No transactions match your search filters.</p>
                        ) : (
                            <ul className="divide-y divide-border/60">
                                {filteredHistory.map(entry => (
                                    <li key={entry.id} className="p-4 flex justify-between items-center hover:bg-muted/20 transition-colors text-xs">
                                        <div>
                                            <p className="font-bold text-foreground text-sm">{entry.description}</p>
                                            <p className="text-muted-foreground text-[11px] mt-0.5">
                                                By {entry.username} &bull; {new Date(entry.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                        <div className={`text-sm font-bold ${parseFloat(entry.amount) < 0 ? 'text-danger' : 'text-success'}`}>
                                            {parseFloat(entry.amount).toFixed(2)} {currency}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
