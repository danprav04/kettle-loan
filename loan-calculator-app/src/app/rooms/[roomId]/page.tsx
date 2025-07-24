"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSimplifiedLayout } from '@/components/SimplifiedLayoutProvider';
import { FiArrowDown } from 'react-icons/fi';
import { handleApi } from '@/lib/api';

interface Member {
    id: number;
    username: string;
}

export default function RoomPage() {
    const params = useParams<{ roomId: string }>();
    const { roomId } = params;
    const t = useTranslations('Room');
    const { isSimplified } = useSimplifiedLayout();

    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [balance, setBalance] = useState(0);
    const [detailedBalance, setDetailedBalance] = useState<{ [key: string]: number }>({});
    const [showDetails, setShowDetails] = useState(false);
    const [roomCode, setRoomCode] = useState('');
    const [members, setMembers] = useState<Member[]>([]);
    const [currentUserId, setCurrentUserId] = useState<number | null>(null);
    const [selectedMemberIds, setSelectedMemberIds] = useState<Set<number>>(new Set());
    const [includeSelfInSplit, setIncludeSelfInSplit] = useState(true);
    const router = useRouter();
    
    const [entryType, setEntryType] = useState<'expense' | 'loan'>('expense');

    const otherMembers = useMemo(() => members.filter(m => m.id !== currentUserId), [members, currentUserId]);

    const fetchData = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            router.push('/');
            return;
        }
        try {
            const res = await fetch(`/api/rooms/${roomId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const { currentUserBalance, balances, code, members, currentUserId } = await res.json();
                setBalance(currentUserBalance || 0);
                setDetailedBalance(balances || {});
                setRoomCode(code || '');
                setMembers(members || []);
                setCurrentUserId(currentUserId || null);
                setSelectedMemberIds(new Set(members.filter((m: Member) => m.id !== currentUserId).map((m: Member) => m.id)));
                setIncludeSelfInSplit(true);
            } else if (res.status === 401) {
                router.push('/');
            }
        } catch (e) {
            console.error("Failed to fetch room data. Possibly offline.", e);
        }
    }, [roomId, router]);

    useEffect(() => {
        fetchData();
        window.addEventListener('syncdone', fetchData);
        return () => window.removeEventListener('syncdone', fetchData);
    }, [fetchData]);

    useEffect(() => {
        if (isSimplified) {
            setEntryType('loan');
        } else {
            const savedEntryType = localStorage.getItem('entryType') as 'expense' | 'loan';
            setEntryType(savedEntryType && ['expense', 'loan'].includes(savedEntryType) ? savedEntryType : 'expense');
        }
    }, [isSimplified]);

    const handleSetEntryType = (type: 'expense' | 'loan') => {
        if (isSimplified) return;
        setEntryType(type);
        localStorage.setItem('entryType', type);
    };

    const handleAddEntry = async (e: React.FormEvent) => {
        e.preventDefault();
        const parsedAmount = Math.abs(parseFloat(amount));
        if (isNaN(parsedAmount) || parsedAmount <= 0) return;

        let finalSplitWithIds: number[] | null = null;
        if (entryType === 'expense') {
            const participants = new Set(selectedMemberIds);
            if (includeSelfInSplit && currentUserId) {
                participants.add(currentUserId);
            }
            if (participants.size > 0) {
                finalSplitWithIds = Array.from(participants);
            }
        }
        
        const finalAmount = entryType === 'loan' ? -parsedAmount : parsedAmount;
        
        try {
            await handleApi({
                method: 'POST',
                url: '/api/entries',
                body: { roomId, amount: finalAmount, description, splitWithUserIds: finalSplitWithIds },
            });
            setAmount('');
            setDescription('');
            fetchData();
        } catch (error) {
            console.error("Failed to add entry:", error);
        }
    };

    const handleMemberSelection = (memberId: number) => {
        const newSelection = new Set(selectedMemberIds);
        if (newSelection.has(memberId)) {
            newSelection.delete(memberId);
        } else {
            newSelection.add(memberId);
        }
        setSelectedMemberIds(newSelection);
    };
    
    const isSubmitDisabled = entryType === 'expense' && !includeSelfInSplit && selectedMemberIds.size === 0;

    return (
        <div className="max-w-md mx-auto bg-card rounded-xl shadow-md overflow-hidden border border-card-border animate-scaleIn">
            <div className="p-8">
                <div className="text-center mb-6">
                    <h1 className="text-xl font-bold text-card-foreground">
                        {t('roomTitle', { code: roomCode })}
                    </h1>
                </div>

                <div className="text-center mb-6">
                    <div className="text-lg font-medium text-muted-foreground">{t('balanceTitle')}</div>
                    <div className={`text-4xl font-bold mt-1 ${balance >= 0 ? 'text-success' : 'text-danger'}`}>
                        {balance.toFixed(2)} ILS
                    </div>
                     <button onClick={() => setShowDetails(!showDetails)} className="text-sm text-primary hover:underline flex items-center justify-center mx-auto mt-2">
                        {t('detailed')} <FiArrowDown className={`ms-1 transition-transform rtl:me-1 ${showDetails ? 'rotate-180' : ''}`} />
                    </button>
                    {showDetails && (
                        <div className="mt-2 text-left bg-muted p-3 rounded-lg animate-fadeIn">
                            {Object.entries(detailedBalance).map(([username, bal]) => (
                                <div key={username} className="flex justify-between text-card-foreground py-1">
                                    <span>{username}:</span>
                                    <span className={bal >= 0 ? 'text-success' : 'text-danger'}>{bal.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="border-t border-card-border my-6"></div>

                <div>
                    <h2 className="text-xl font-semibold text-center text-card-foreground mb-4">
                        {isSimplified ? t('simplifiedNewEntryTitle') : t('newEntryTitle')}
                    </h2>
                    <form onSubmit={handleAddEntry}>
                        {!isSimplified && (
                            <div className="mb-6">
                                <div className="relative flex w-full rounded-full bg-muted p-1">
                                    <span
                                        className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full shadow-sm transition-all duration-300 ease-in-out border-2 border-black dark:border-white ${entryType === 'expense' ? 'bg-primary' : 'bg-success'}`}
                                        style={{ left: entryType === 'loan' ? '50%' : '4px' }}
                                    />
                                    <button type="button" onClick={() => handleSetEntryType('expense')} className={`z-10 w-1/2 py-2 text-sm font-semibold transition-colors duration-300 ${entryType === 'expense' ? 'text-primary-foreground' : 'text-foreground'}`}>
                                        {t('expense')}
                                    </button>
                                    <button type="button" onClick={() => handleSetEntryType('loan')} className={`z-10 w-1/2 py-2 text-sm font-semibold transition-colors duration-300 ${entryType === 'loan' ? 'text-secondary-foreground' : 'text-foreground'}`}>
                                        {t('loan')}
                                    </button>
                                </div>
                            </div>
                        )}
                        <div className="mb-4">
                            <label className="block text-muted-foreground text-sm font-bold mb-2" htmlFor="amount">{t('amount')}</label>
                            <input id="amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-3 py-2 leading-tight rounded-lg themed-input" required min="0" step="any" />
                        </div>
                        <div className="mb-4">
                            <label className="block text-muted-foreground text-sm font-bold mb-2" htmlFor="description">{t('description')}</label>
                            <input id="description" type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 leading-tight rounded-lg themed-input" required />
                        </div>

                        {entryType === 'expense' && !isSimplified && otherMembers.length > 0 && (
                            <div className="mb-6 bg-muted/50 p-3 rounded-lg animate-fadeIn">
                                <div className="flex justify-between items-center pb-2 border-b border-card-border mb-2">
                                     <label className="block text-muted-foreground text-sm font-bold">{t('splitWith')}</label>
                                     <div className="flex items-center">
                                         <input id="share-with-me" type="checkbox" checked={includeSelfInSplit} onChange={(e) => setIncludeSelfInSplit(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                                         <label htmlFor="share-with-me" className="ms-2 block text-sm font-medium text-foreground">{t('shareWithMe')}</label>
                                     </div>
                                </div>
                                <div className="space-y-2 max-h-32 overflow-y-auto px-1">
                                    {otherMembers.map(member => (
                                        <div key={member.id} className="flex items-center">
                                            <input id={`member-${member.id}`} name="members" type="checkbox" checked={selectedMemberIds.has(member.id)} onChange={() => handleMemberSelection(member.id)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                                            <label htmlFor={`member-${member.id}`} className="ms-2 block text-sm text-foreground">{member.username}</label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between mt-6">
                            <button type="submit" className="font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline btn-primary disabled:opacity-50 disabled:transform-none disabled:shadow-none" disabled={isSubmitDisabled}>
                                {t('addEntry')}
                            </button>
                            <button type="button" onClick={() => router.push(`/rooms/${roomId}/entries`)} className="font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline btn-muted">
                                {t('allEntries')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}