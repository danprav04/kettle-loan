// src/app/rooms/[roomId]/entries/page.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSync } from '@/components/SyncProvider';
import { getRoomData, Entry, deleteLocalEntry } from '@/lib/offline-sync';
import { handleApi } from '@/lib/api';
import { useUser } from '@/components/UserProvider';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { FiClock, FiTrash2, FiInfo } from 'react-icons/fi';

interface Member {
    id: number;
    username: string;
}

interface User {
  userId: number;
  username: string;
}

type ProcessedEntry = Entry & { runningBalance: number };

// Helper function to generate the detailed description for an entry
const getEntryDetails = (entry: Entry, memberMap: Map<number, string>, allMembers: Member[], currentUser: User | null, t: (key: string, values?: Record<string, string | number>) => string) => {
    const amount = parseFloat(entry.amount);
    const actorUsername = entry.username;
    
    if (amount >= 0) { // Expense (including event entries)
        let payersText: string;
        let isEventEntry = false;

        if (entry.paid_by_user_ids && entry.paid_by_user_ids.length > 0) {
            payersText = entry.paid_by_user_ids.map(id => {
                if (id === currentUser?.userId) return t('entryParticipantYou');
                return memberMap.get(id) || '...';
            }).join(', ');
            isEventEntry = !(entry.paid_by_user_ids.length === 1 && entry.paid_by_user_ids[0] === entry.user_id);
        } else {
            const effectivePayerId = (entry as any).paid_by_user_id ?? entry.user_id;
            payersText = effectivePayerId === currentUser?.userId ? t('entryParticipantYou') : (memberMap.get(effectivePayerId) || actorUsername);
            isEventEntry = (entry as any).paid_by_user_id != null && (entry as any).paid_by_user_id !== entry.user_id;
        }

        let participantsText: string;
        const participants = entry.split_with_user_ids;
        // Logic for "Everyone": if participants array is null, empty, or includes all members.
        const isForAll = !participants || participants.length === 0 || participants.length === allMembers.length;

        if (isForAll) {
            participantsText = t('entryParticipantEveryone');
        } else {
            participantsText = participants.map(id => {
                if (id === currentUser?.userId) return t('entryParticipantYou');
                return memberMap.get(id) || '...';
            }).join(', ');
        }

        // If this is an event entry, show who logged it
        const loggerText = entry.user_id === currentUser?.userId ? t('entryParticipantYou') : actorUsername;
        
        return (
            <>
                <span>{t('entryPaidBy', { payer: payersText })}</span>
                <span className="mx-1.5">&bull;</span>
                <span>{t('entryFor', { participants: participantsText })}</span>
                {isEventEntry && (
                    <>
                        <span className="mx-1.5">&bull;</span>
                        <span className="text-amber-500">{t('entryEventBy', { logger: loggerText })}</span>
                    </>
                )}
            </>
        );
    } else { // Loan (amount < 0)
        const borrowerText = entry.user_id === currentUser?.userId ? t('entryParticipantYou') : actorUsername;
        
        let lendersText: string;
        const lenders = entry.split_with_user_ids;
        if (lenders && lenders.length > 0) {
             lendersText = lenders.map(id => {
                 if (id === currentUser?.userId) return t('entryParticipantYou');
                 return memberMap.get(id) || '...';
             }).join(', ');
        } else {
             lendersText = t('entryFromGroup');
        }

        return (
            <>
                <span>{t('entryLoanTo', { borrower: borrowerText })}</span>
                <span className="mx-1.5">&bull;</span>
                <span>{t('entryPaidBy', { payer: lendersText })}</span>
            </>
        );
    }
    
    return null;
};


export default function EntriesPage() {
    const params = useParams<{ roomId: string }>();
    const { roomId } = params;
    const t = useTranslations('Room');
    const tNotif = useTranslations('Notifications');
    const { isOnline } = useSync();
    const { user } = useUser();
    
    const [entries, setEntries] = useState<Entry[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [notification, setNotification] = useState<string | null>(null);
    const [entryToDelete, setEntryToDelete] = useState<Entry | null>(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    
    const router = useRouter();

    const fetchEntries = useCallback(async () => {
        setIsLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
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
                console.error("Failed to refresh entries. Using local data.", e);
            }
        }
        setIsLoading(false);
    }, [roomId, router, isOnline]);

    useEffect(() => {
        fetchEntries();
        window.addEventListener('syncdone', fetchEntries);
        return () => {
            window.removeEventListener('syncdone', fetchEntries);
        };
    }, [fetchEntries]);
    
    const processedEntries: ProcessedEntry[] = useMemo(() => {
        if (!user || members.length === 0) {
            return [];
        }

        const chronologicalEntries = [...entries].reverse();
        const runningBalances: { [key: number]: number } = {};
        members.forEach(member => { runningBalances[member.id] = 0; });

        const entriesWithBalance = chronologicalEntries.map(entry => {
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
                    payers = [entry.user_id];
                }
                
                if (entry.split_with_user_ids && entry.split_with_user_ids.length > 0) {
                    borrowers = entry.split_with_user_ids;
                } else {
                    borrowers = members.map(m => m.id);
                }
            } else { // Loan (amount < 0)
                borrowers = [entry.user_id];
                if (entry.split_with_user_ids && entry.split_with_user_ids.length > 0) {
                    payers = entry.split_with_user_ids;
                } else {
                    // Legacy: if lenders aren't explicit, it's everyone else
                    payers = members.map(m => m.id).filter(id => id !== entry.user_id);
                }
            }

            if (payers.length > 0 && borrowers.length > 0) {
                const amountPerPayer = absAmount / payers.length;
                const amountPerBorrower = absAmount / borrowers.length;

                payers.forEach(p => { 
                    if (runningBalances[p] !== undefined) runningBalances[p] += amountPerPayer; 
                });
                borrowers.forEach(b => { 
                    if (runningBalances[b] !== undefined) runningBalances[b] -= amountPerBorrower; 
                });
            }

            return {
                ...entry,
                runningBalance: runningBalances[user.userId] || 0,
            };
        });

        return entriesWithBalance.reverse();
    }, [entries, members, user]);

    const memberMap = useMemo(() => {
        return new Map(members.map(m => [m.id, m.username]));
    }, [members]);

    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [notification]);
    
    const openConfirmDialog = (entry: Entry) => {
        if (typeof entry.id !== 'number') {
            setNotification(t('deleteEntrySyncing'));
            return;
        }
        if (user && user.userId === entry.user_id) {
            setEntryToDelete(entry);
            setIsConfirmOpen(true);
        }
    };

    const handleDeleteEntry = async () => {
        if (!entryToDelete || typeof entryToDelete.id !== 'number') return;
        
        const originalEntries = [...entries];
        setEntries(prev => prev.filter(e => e.id !== entryToDelete.id));
        setIsConfirmOpen(false);
        
        try {
            await deleteLocalEntry(roomId, entryToDelete.id);
            
            const result = await handleApi({
                method: 'DELETE',
                url: `/api/entries/${entryToDelete.id}`,
            });

            if (result?.optimistic) {
                setNotification(tNotif('requestQueued'));
            }
            
            setEntryToDelete(null);

        } catch (error) {
            console.error("Failed to delete entry:", error);
            setNotification(t('deleteEntryFailed'));
            setEntries(originalEntries);
        }
    };

    return (
        <div className="max-w-4xl mx-auto animate-scaleIn flex flex-col h-full">
            <div className="shrink-0">
                <button onClick={() => router.back()} className="mb-4 font-bold py-2 px-4 rounded-lg btn-primary">
                    {t('backToRoom')}
                </button>
                
                {notification && (
                    <div className="mb-4 p-3 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 text-sm border border-blue-200 dark:border-blue-800 flex items-center animate-fadeIn">
                        <FiInfo className="me-2 shrink-0"/>
                        <span>{notification}</span>
                    </div>
                )}
            </div>
            
            <div className="bg-card shadow-md max-h-[80vh] rounded-lg border border-card-border flex flex-col flex-grow overflow-hidden">
                <div className="p-4 border-b border-card-border shrink-0">
                    <h1 className="text-xl font-semibold text-card-foreground">{t('allEntries')}</h1>
                </div>
                <div className="overflow-y-auto flex-grow">
                    {isLoading ? (
                        <p className="p-4 text-center text-muted-foreground">Loading entries...</p>
                    ) : processedEntries.length === 0 ? (
                        <p className="p-4 text-center text-muted-foreground">No entries have been added to this room yet.</p>
                    ) : (
                        <ul>
                            {processedEntries.map((entry, index) => (
                                <li key={entry.id} className="p-4 border-b border-card-border flex justify-between items-center animate-fadeIn group" style={{ animationDelay: `${index * 50}ms`, opacity: 0 }}>
                                    <div className="flex-grow">
                                        <p className="font-semibold text-card-foreground">{entry.description}</p>
                                        <div className="text-xs text-muted-foreground italic flex items-center mt-0.5">
                                            {getEntryDetails(entry, memberMap, members, user, t)}
                                        </div>
                                        <p className="text-sm text-muted-foreground flex items-center mt-1.5">
                                            {entry.offline_timestamp && (
                                                <FiClock className="me-1.5 text-amber-500" title={`Created offline at ${new Date(entry.offline_timestamp).toLocaleTimeString()}`} />
                                            )}
                                            {entry.username} - {new Date(entry.created_at).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="flex items-center space-x-2 md:space-x-4 shrink-0">
                                        <div className="text-right w-24">
                                            <div className={`text-lg font-bold ${parseFloat(entry.amount) < 0 ? 'text-danger' : 'text-success'}`}>
                                                {parseFloat(entry.amount).toFixed(2)} ILS
                                            </div>
                                        </div>
                                        <div className="text-right w-24">
                                            <div className={`text-md font-semibold ${entry.runningBalance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                {entry.runningBalance.toFixed(2)} ILS
                                            </div>
                                            <div className="text-xs text-muted-foreground">Balance</div>
                                        </div>
                                        {user && user.userId === entry.user_id && typeof entry.id === 'number' ? (
                                            <button
                                                onClick={() => openConfirmDialog(entry)}
                                                className="text-muted-foreground hover:text-danger p-2 rounded-full hover:bg-danger/10 transition-all opacity-0 group-hover:opacity-100"
                                                title={t('deleteEntry')}
                                            >
                                                <FiTrash2 size={18} />
                                            </button>
                                        ) : (
                                            <div className="w-[34px]"></div> // Placeholder to maintain alignment
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
            
            <ConfirmationDialog
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={handleDeleteEntry}
                title={t('deleteEntry')}
            >
                <p>{t('deleteEntryConfirmation')}</p>
                {entryToDelete && (
                    <div className="mt-4 p-3 bg-muted rounded-lg border border-card-border">
                        <p className="font-semibold text-card-foreground">{entryToDelete.description}</p>
                        <p className="text-sm text-muted-foreground">{new Date(entryToDelete.created_at).toLocaleString()}</p>
                    </div>
                )}
            </ConfirmationDialog>
        </div>
    );
}