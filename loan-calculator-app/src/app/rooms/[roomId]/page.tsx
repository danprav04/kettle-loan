// src/app/rooms/[roomId]/page.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useSimplifiedLayout } from '@/components/SimplifiedLayoutProvider';
import { FiArrowDown, FiInfo, FiEdit, FiSave, FiX, FiLoader } from 'react-icons/fi';
import { handleApi } from '@/lib/api';
import { saveRoomData, getRoomData, addLocalEntry, updateLocalRoomName, LocalRoomData, Entry } from '@/lib/offline-sync';
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
    const [roomName, setRoomName] = useState<string | null>(null);
    const [isEditingName, setIsEditingName] = useState(false);
    const [newName, setNewName] = useState('');
    const [isSavingName, setIsSavingName] = useState(false);
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

    const updateStateFromData = (data: LocalRoomData) => {
        setBalance(data.currentUserBalance || 0);
        setDetailedBalance(data.balances || {});
        setRoomCode(data.code || '');
        setRoomName(data.name || null);
        setNewName(data.name || '');
        setMembers(data.members || []);
        setCurrentUserId(data.currentUserId || null);
        
        if (members.length === 0 && data.members.length > 0) {
            const initialSelected = (data.members || [])
                .filter((m: Member) => m.id !== data.currentUserId)
                .map((m: Member) => m.id);
            setSelectedMemberIds(new Set(initialSelected));
            setIncludeSelfInSplit(true);
        }
    };

    const fetchData = useCallback(async (options: { forceLocal?: boolean } = {}) => {
        setIsLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            router.push('/');
            return;
        }

        if (isOnline && !options.forceLocal) {
            try {
                const data = await handleApi({ method: 'GET', url: `/api/rooms/${roomId}` });
                if (data) {
                    await saveRoomData(roomId, data);
                    updateStateFromData(data);
                }
            } catch (e) {
                console.warn("Online fetch failed, falling back to local data.", e);
                const localData = await getRoomData(roomId);
                if (localData) updateStateFromData(localData);
            }
        } else {
            const localData = await getRoomData(roomId);
            if (localData) {
                updateStateFromData(localData);
            } else {
                setNotification(t('offlineRoomDataError'));
            }
        }
        setIsLoading(false);
    }, [roomId, router, isOnline, members.length, t]);

    const handleSyncDone = useCallback(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        fetchData();
        window.addEventListener('syncdone', handleSyncDone);
        return () => window.removeEventListener('syncdone', handleSyncDone);
    }, [fetchData, handleSyncDone]);
    
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

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

    const handleSaveName = async () => {
        if (!newName.trim() || newName.trim() === roomName) {
            setIsEditingName(false);
            return;
        }
        setIsSavingName(true);
        setNotification(null);
        
        const oldName = roomName;
        const trimmedNewName = newName.trim();

        setRoomName(trimmedNewName);
        await updateLocalRoomName(roomId, trimmedNewName);
        setIsEditingName(false);
        
        try {
            const result = await handleApi({
                method: 'PUT',
                url: `/api/rooms/${roomId}`,
                body: { name: trimmedNewName }
            });
            
            if (result?.optimistic) {
                setNotification(t('requestQueued'));
            } else if (isOnline) {
                fetchData();
            }
        } catch (error) {
            console.error("Failed to save room name:", error);
            setNotification('Failed to save name.');
            setRoomName(oldName);
            if (oldName) await updateLocalRoomName(roomId, oldName);
        } finally {
            setIsSavingName(false);
        }
    };

    const handleStartEditingName = () => {
        setNewName(roomName || '');
        setIsEditingName(true);
    };

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
            finalSplitWithIds = participants.size > 0 ? Array.from(participants) : members.map(m => m.id);
        }

        const finalAmount = entryType === 'loan' ? -parsedAmount : parsedAmount;

        const optimisticEntry: Entry = {
            id: `temp-${Date.now()}`,
            amount: finalAmount.toFixed(2),
            description,
            created_at: new Date().toISOString(),
            username: currentUser.username,
            split_with_user_ids: finalSplitWithIds,
            offline_timestamp: Date.now()
        };
        
        let newBalance = balance;
        const numParticipants = finalSplitWithIds?.length || members.length;
        const share = parsedAmount / (numParticipants > 0 ? numParticipants : 1);

        if (entryType === 'expense') {
            newBalance += parsedAmount;
            if (finalSplitWithIds?.includes(currentUserId)) {
                newBalance -= share;
            }
        } else {
            newBalance -= parsedAmount;
        }
        
        await addLocalEntry(roomId, optimisticEntry, { currentUserBalance: newBalance, otherBalances: detailedBalance });
        await fetchData({ forceLocal: true });
        
        setAmount('');
        setDescription('');

        try {
            const result = await handleApi({
                method: 'POST',
                url: '/api/entries',
                body: { 
                    roomId, 
                    amount: finalAmount, 
                    description, 
                    splitWithUserIds: finalSplitWithIds,
                    createdAt: optimisticEntry.created_at
                },
            });

            if (result?.optimistic) {
                setNotification(t('requestQueued'));
            } else if (isOnline) {
                fetchData();
            }
        } catch (error) {
            console.error("Failed to add entry:", error);
            setNotification('Failed to add entry. Please try again.');
            fetchData();
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
    
    const isSubmitDisabled = amount === '' || description === '';

    if (isLoading) {
        return <div className="max-w-md mx-auto p-8 text-center text-muted-foreground animate-fadeIn">Loading room...</div>;
    }

    return (
        <div className="max-w-md mx-auto bg-card rounded-xl shadow-md overflow-hidden border border-card-border animate-scaleIn">
            <div className="p-8">
                <div className="text-center mb-6">
                    {isEditingName ? (
                        <div className="flex items-center space-x-2 rtl:space-x-reverse animate-fadeIn">
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="w-full px-3 py-1 text-xl font-bold text-center rounded-lg themed-input"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                            />
                            <button onClick={handleSaveName} className="p-2 btn-primary rounded-lg" disabled={isSavingName} aria-label="Save name">
                                {isSavingName ? <FiLoader className="animate-spin" /> : <FiSave />}
                            </button>
                            <button onClick={() => setIsEditingName(false)} className="p-2 btn-muted rounded-lg" aria-label="Cancel editing name">
                                <FiX />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center space-x-2 rtl:space-x-reverse group">
                            <h1 className="text-xl font-bold text-card-foreground">
                                {roomName || t('roomTitle', { code: roomCode })}
                            </h1>
                            <button onClick={handleStartEditingName} className="p-1 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Edit room name">
                                <FiEdit />
                            </button>
                        </div>
                    )}
                    <p className="text-sm text-muted-foreground mt-1">Room Code: {roomCode}</p>
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
                                    <button type="button" onClick={() => handleSetEntryType('expense')} className={`z-10 w-1/2 py-2 text-sm font-semibold transition-colors duration-300 rounded-full ${entryType === 'expense' ? 'text-primary' : 'text-muted-foreground'}`}>
                                        {t('expense')}
                                    </button>
                                    <button type="button" onClick={() => handleSetEntryType('loan')} className={`z-10 w-1/2 py-2 text-sm font-semibold transition-colors duration-300 rounded-full ${entryType === 'loan' ? 'text-success' : 'text-muted-foreground'}`}>
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
                            <Link href={`/rooms/${roomId}/entries`} className="font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline btn-muted text-center">
                                {t('allEntries')}
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}