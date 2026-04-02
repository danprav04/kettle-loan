// src/app/rooms/[roomId]/balance/page.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSync } from '@/components/SyncProvider';
import { getRoomData, Entry } from '@/lib/offline-sync';
import { useUser } from '@/components/UserProvider';
import { FiChevronDown } from 'react-icons/fi';

interface Member {
    id: number;
    username: string;
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
    const [isLoading, setIsLoading] = useState(true);
    const [expandedMemberId, setExpandedMemberId] = useState<number | null>(null);

    const otherMembers = useMemo(() => members.filter(m => m.id !== user?.userId), [members, user]);

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
                } else if (res.status === 401) {
                    router.push('/');
                }
            } catch (e) {
                console.error("Failed to refresh balance data. Using local data.", e);
            }
        }
        setIsLoading(false);
    }, [roomId, router, isOnline, user]);

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

        const breakdown = new Map<number, { netBalance: number; transactions: PeerToPeerTransaction[] }>();
        const currentUserId = user.userId;

        otherMembers.forEach(member => {
            breakdown.set(member.id, { netBalance: 0, transactions: [] });
        });
        
        const chronologicalEntries = [...entries].reverse();

        for (const entry of chronologicalEntries) {
            const payerId = entry.user_id;
            const amount = parseFloat(entry.amount);

            let payers: number[];
            let borrowers: number[];
            const absAmount = Math.abs(amount);

            if (amount >= 0) { // Expense / Event
                if (entry.paid_by_user_ids && entry.paid_by_user_ids.length > 0) {
                    payers = entry.paid_by_user_ids;
                } else if ((entry as any).paid_by_user_id) {
                    payers = [(entry as any).paid_by_user_id];
                } else {
                    payers = [payerId];
                }
                
                if (entry.split_with_user_ids && entry.split_with_user_ids.length > 0) {
                    borrowers = entry.split_with_user_ids;
                } else {
                    borrowers = members.map(m => m.id);
                }
            } else { // Loan (amount < 0)
                borrowers = [payerId];
                if (entry.split_with_user_ids && entry.split_with_user_ids.length > 0) {
                    payers = entry.split_with_user_ids;
                } else {
                    // Legacy: if lenders aren't explicit, it's everyone else
                    payers = members.map(m => m.id).filter(id => id !== payerId);
                }
            }

            if (payers.length === 0 || borrowers.length === 0) continue;

            // Distribute fractional debt identically 
            const debtUnit = absAmount / (borrowers.length * payers.length);
            
            payers.forEach(pId => {
                borrowers.forEach(bId => {
                    if (pId !== bId) {
                        // For a user viewing THEIR balances:
                        if (pId === currentUserId && breakdown.has(bId)) {
                            // Current user is the payer, so bId owes them.
                            const data = breakdown.get(bId)!;
                            data.netBalance += debtUnit;
                            data.transactions.push({ ...entry, contribution: debtUnit, runningP2PBalance: data.netBalance });
                        } else if (bId === currentUserId && breakdown.has(pId)) {
                            // Current user is the borrower, so they owe pId.
                            const data = breakdown.get(pId)!;
                            data.netBalance -= debtUnit;
                            data.transactions.push({ ...entry, contribution: -debtUnit, runningP2PBalance: data.netBalance });
                        }
                    }
                });
            });
        }
        
        // Reverse the transactions to show the most recent first
        breakdown.forEach(value => value.transactions.reverse());
        return breakdown;
    }, [entries, members, user, otherMembers]);
    
    const getBalanceText = (balance: number) => {
        const absBalance = Math.abs(balance);
        if (balance > 0.005) {
            return { text: `Owes you ${absBalance.toFixed(2)}`, color: 'text-success' };
        }
        if (balance < -0.005) {
            return { text: `You owe ${absBalance.toFixed(2)}`, color: 'text-danger' };
        }
        return { text: `Settled up`, color: 'text-muted-foreground' };
    };

    return (
        <div className="max-w-4xl mx-auto animate-scaleIn flex flex-col h-full">
            <div className="shrink-0">
                <button onClick={() => router.back()} className="mb-4 font-bold py-2 px-4 rounded-lg btn-primary">
                    {t('backToRoom')}
                </button>
            </div>
            
            <div className="bg-card shadow-md max-h-[80vh] rounded-lg border border-card-border flex flex-col flex-grow overflow-hidden">
                <div className="p-4 border-b border-card-border shrink-0">
                    <h1 className="text-xl font-semibold text-card-foreground">{t('balanceDetailsTitle')}</h1>
                </div>
                <div className="overflow-y-auto flex-grow">
                    {isLoading ? (
                        <p className="p-4 text-center text-muted-foreground">Loading balances...</p>
                    ) : otherMembers.length === 0 ? (
                        <p className="p-4 text-center text-muted-foreground">No other members in this room yet.</p>
                    ) : (
                        <ul>
                            {otherMembers.map((member) => {
                                const p2pData = peerToPeerBalances.get(member.id);
                                const netBalance = p2pData?.netBalance ?? 0;
                                const balanceInfo = getBalanceText(netBalance);
                                const isExpanded = expandedMemberId === member.id;

                                return (
                                    <li key={member.id} className="border-b border-card-border last:border-b-0 animate-fadeIn" style={{ animationDelay: `${otherMembers.indexOf(member) * 50}ms`, opacity: 0 }}>
                                        <button 
                                            onClick={() => setExpandedMemberId(isExpanded ? null : member.id)}
                                            className="w-full text-left p-4 flex justify-between items-center hover:bg-muted/50 transition-colors"
                                        >
                                            <span className="font-semibold text-card-foreground">{member.username}</span>
                                            <div className="flex items-center space-x-2 rtl:space-x-reverse">
                                                <span className={`text-sm font-medium ${balanceInfo.color}`}>{balanceInfo.text}</span>
                                                <FiChevronDown className={`text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                            </div>
                                        </button>
                                        {isExpanded && (
                                            <div className="bg-muted px-4 py-3 animate-fadeIn">
                                                {p2pData?.transactions && p2pData.transactions.length > 0 ? (
                                                    <ul className="space-y-3">
                                                        {p2pData.transactions.map((tx, index) => (
                                                            <li key={`${tx.id}-${index}`} className="flex justify-between items-center text-sm">
                                                                <div>
                                                                    <p className="font-medium text-foreground">{tx.description}</p>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {tx.username} &bull; {new Date(tx.created_at).toLocaleString()}
                                                                    </p>
                                                                </div>
                                                                <div className="flex items-center space-x-2 md:space-x-4 shrink-0">
                                                                    <div className="text-right w-20">
                                                                        <div className={`font-bold ${tx.contribution >= 0 ? 'text-success' : 'text-danger'}`}>
                                                                            {tx.contribution.toFixed(2)}
                                                                        </div>
                                                                        <div className="text-xs text-muted-foreground">Change</div>
                                                                    </div>
                                                                     <div className="text-right w-20">
                                                                        <div className={`font-semibold ${tx.runningP2PBalance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                                            {tx.runningP2PBalance.toFixed(2)}
                                                                        </div>
                                                                        <div className="text-xs text-muted-foreground">Balance</div>
                                                                    </div>
                                                                </div>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <p className="text-sm text-muted-foreground italic text-center py-2">No transactions to show.</p>
                                                )}
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}