// src/app/rooms/[roomId]/page.tsx

"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSimplifiedLayout } from '@/components/SimplifiedLayoutProvider';
import { FiArrowDown, FiInfo } from 'react-icons/fi';
import { handleApi } from '@/lib/api';
// ** Import new DB functions **
import { saveRoomData, getRoomData, addLocalEntry } from '@/lib/offline-sync';
import { useSync } from '@/components/SyncProvider';

interface Member {
    id: number;
    username: string;
}

export default function RoomPage() {
    const params = useParams<{ roomId: string }>();
    const { roomId } = params;
    const t = useTranslations('Room');
    const { isSimplified } = useSimplifiedLayout();
    const { isOnline } = useSync();

    const [balance, setBalance] = useState(0);
    const [detailedBalance, setDetailedBalance] = useState<{ [key: string]: number }>({});
    const [showDetails, setShowDetails] = useState(false);
    const [roomCode, setRoomCode] = useState('');
    const [members, setMembers] = useState<Member[]>([]);
    const [currentUserId, setCurrentUserId] = useState<number | null>(null);
    const [notification, setNotification] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [entryType, setEntryType] = useState<'expense' | 'loan'>('expense');
    const [selectedMemberIds, setSelectedMemberIds] = useState<Set<number>>(new Set());
    const [includeSelfInSplit, setIncludeSelfInSplit] = useState(true);
    
    const otherMembers = useMemo(() => members.filter(m => m.id !== currentUserId), [members, currentUserId]);

    const updateStateFromData = (data: any) => {
        setBalance(data.currentUserBalance || 0);
        setDetailedBalance(data.balances || {});
        setRoomCode(data.code || '');
        setMembers(data.members || []);
        setCurrentUserId(data.currentUserId || null);
        
        const initialSelected = (data.members || [])
            .filter((m: Member) => m.id !== data.currentUserId)
            .map((m: Member) => m.id);
        setSelectedMemberIds(new Set(initialSelected));
        setIncludeSelfInSplit(true);
    };

    const fetchData = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            router.push('/');
            return;
        }

        setIsLoading(true);

        if (isOnline) {
            try {
                const data = await handleApi({ method: 'GET', url: `/api/rooms/${roomId}` });
                if (data) {
                    await saveRoomData(roomId, data); // Save fresh data
                    updateStateFromData(data);
                }
            } catch (e) {
                console.warn("Online fetch failed, falling back to local data.", e);
                const localData = await getRoomData(roomId);
                if (localData) {
                    updateStateFromData(localData);
                }
            }
        } else { // Offline
            console.log("Offline. Fetching from local DB.");
            const localData = await getRoomData(roomId);
            if (localData) {
                updateStateFromData(localData);
            } else {
                setNotification("This room's data isn't saved for offline use.");
            }
        }
        setIsLoading(false);
    }, [roomId, router, isOnline]);

    const handleSyncDone = useCallback(() => {
        console.log('Sync complete event received. Refetching room data...');
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        fetchData();
        window.addEventListener('syncdone', handleSyncDone);
        return () => window.removeEventListener('syncdone', handleSyncDone);
    }, [fetchData, handleSyncDone]);
    
    const handleAddEntry = async (e: React.FormEvent) => {
        e.preventDefault();
        setNotification(null);
        const parsedAmount = Math.abs(parseFloat(amount));
        const currentUser = members.find(m => m.id === currentUserId);
        if (isNaN(parsedAmount) || parsedAmount <= 0 || !currentUserId || !currentUser) return;

        let finalSplitWithIds: number[] | null = null;
        if (entryType === 'expense') {
            const participants = new Set(selectedMemberIds);
            if (includeSelfInSplit) participants.add(currentUserId);
            if (participants.size > 0) finalSplitWithIds = Array.from(participants);
        }
        
        const finalAmount = entryType === 'loan' ? -parsedAmount : parsedAmount;

        // --- Optimistic Update & Local DB Write ---
        const optimisticEntry = {
            id: Date.now(), // Temporary ID for React key
            amount: finalAmount.toFixed(2),
            description,
            created_at: new Date().toISOString(),
            username: currentUser.username, // Add current user's name
            split_with_user_ids: finalSplitWithIds
        };
        
        // Calculate new balances optimistically
        const newBalance = balance + (entryType === 'expense' ? parsedAmount - (parsedAmount / (finalSplitWithIds?.length || members.length)) : -parsedAmount);
        
        // This is a simplified balance calculation for the optimistic update.
        // A full implementation would update detailed balances too.
        await addLocalEntry(roomId, optimisticEntry, { currentUserBalance: newBalance, otherBalances: detailedBalance });

        // Update UI from our new local state
        const updatedLocalData = await getRoomData(roomId);
        if (updatedLocalData) {
            updateStateFromData(updatedLocalData);
        }

        setAmount('');
        setDescription('');
        
        // --- API Call ---
        try {
            const result = await handleApi({
                method: 'POST',
                url: '/api/entries',
                body: { roomId, amount: finalAmount, description, splitWithUserIds: finalSplitWithIds },
            });

            if (result?.optimistic) {
                setNotification("Request queued. It will sync when you're back online.");
            } else {
                // If we were online and the request succeeded, refetch for consistency
                fetchData();
            }
        } catch (error) {
            console.error("Failed to add entry:", error);
            setNotification('Failed to add entry. Please try again.');
            fetchData(); // Revert optimistic update by fetching from server
        }
    };

    // ... (rest of your component remains the same)
    // You may want to add a loading indicator based on the `isLoading` state
    
    if (isLoading) {
        return <div className="max-w-md mx-auto p-8 text-center">Loading room...</div>;
    }


    // ... (the return part of your component with JSX)
    // ... no changes needed for the JSX return block ...
    const handleMemberSelection = (memberId: number) => {
        const newSelection = new Set(selectedMemberIds);
        if (newSelection.has(memberId)) {
            newSelection.delete(memberId);
        } else {
            newSelection.add(memberId);
        }
        setSelectedMemberIds(newSelection);
    };
    
    const isSubmitDisabled = amount === '' || description === '' || (entryType === 'expense' && !includeSelfInSplit && selectedMemberIds.size === 0);

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
                            {Object.entries(detailedBalance).length > 0 ? Object.entries(detailedBalance).map(([username, bal]) => (
                                <div key={username} className="flex justify-between text-card-foreground py-1">
                                    <span>{username}:</span>
                                    <span className={bal >= 0 ? 'text-success' : 'text-danger'}>{bal.toFixed(2)}</span>
                                </div>
                            )) : <p className="text-muted-foreground text-center text-sm">No other members in this room.</p>}
                        </div>
                    )}
                </div>

                <div className="border-t border-card-border my-6"></div>

                <div>
                    {notification && (
                        <div className="mb-4 p-3 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 text-sm border border-blue-200 dark:border-blue-800 flex items-center animate-fadeIn">
                            <FiInfo className="me-2 shrink-0"/>
                            <span>{notification}</span>
                        </div>
                    )}
                    <h2 className="text-xl font-semibold text-center text-card-foreground mb-4">
                        {isSimplified ? t('simplifiedNewEntryTitle') : t('newEntryTitle')}
                    </h2>
                    <form onSubmit={handleAddEntry}>
                        {!isSimplified && (
                            <div className="mb-6">
                                <div className="relative flex w-full rounded-full bg-muted p-1">
                                    <span
                                        className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full shadow-sm transition-all duration-300 ease-in-out bg-card border-2 ${entryType === 'expense' ? 'border-primary' : 'border-success'}`}
                                        style={{ transform: entryType === 'loan' ? 'translateX(calc(100% - 4px))' : 'translateX(0)' }}
                                    />
                                    <button type="button" onClick={() => {setEntryType('expense'); localStorage.setItem('entryType', 'expense');}} className={`z-10 w-1/2 py-2 text-sm font-semibold transition-colors duration-300 rounded-full ${entryType === 'expense' ? 'text-primary' : 'text-muted-foreground'}`}>
                                        {t('expense')}
                                    </button>
                                    <button type="button" onClick={() => {setEntryType('loan'); localStorage.setItem('entryType', 'loan');}} className={`z-10 w-1/2 py-2 text-sm font-semibold transition-colors duration-300 rounded-full ${entryType === 'loan' ? 'text-success' : 'text-muted-foreground'}`}>
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