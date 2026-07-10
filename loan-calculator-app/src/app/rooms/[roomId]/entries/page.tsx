// src/app/rooms/[roomId]/entries/page.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSync } from '@/components/SyncProvider';
import { getRoomData, Entry, deleteLocalEntry, saveRoomData, removeOutboxEntryMutations } from '@/lib/offline-sync';
import { handleApi } from '@/lib/api';
import { useUser } from '@/components/UserProvider';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import EditEntryModal from '@/components/EditEntryModal';
import EntryEditsModal from '@/components/EntryEditsModal';
import { FiClock, FiTrash2, FiInfo, FiEdit3 } from 'react-icons/fi';
import { Permissions, DEFAULT_PERMISSIONS } from '@/components/PermissionContext';
import { getEntryDetails } from '@/lib/entry-formatting';

interface Member {
    id: number;
    username: string;
    permissions?: { canAdmin?: boolean; canAddEntries?: boolean; canParticipate?: boolean; canView?: boolean };
}

interface User {
  userId: number;
  username: string;
}

type ProcessedEntry = Entry & { runningBalance: number };

export default function EntriesPage() {
    const params = useParams<{ roomId: string }>();
    const { roomId } = params;
    const t = useTranslations('Room');
    const tNotif = useTranslations('Notifications');
    const { isOnline } = useSync();
    const { user } = useUser();

    const [entries, setEntries] = useState<Entry[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [currency, setCurrency] = useState('ILS');
    const [currentUserPermissions, setCurrentUserPermissions] = useState<Permissions>(DEFAULT_PERMISSIONS);

    const [isLoading, setIsLoading] = useState(true);
    const [notification, setNotification] = useState<string | null>(null);
    const [entryToDelete, setEntryToDelete] = useState<Entry | null>(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);

    // Modals state
    const [entryToEdit, setEntryToEdit] = useState<Entry | null>(null);
    const [entryForHistory, setEntryForHistory] = useState<number | string | null>(null);

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
            if (localData.currency) setCurrency(localData.currency);
            if (localData.currentUserPermissions) setCurrentUserPermissions(localData.currentUserPermissions);
        }

        if (isOnline) {
            try {
                const res = await fetch(`/api/rooms/${roomId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    await saveRoomData(roomId, data);
                    setEntries(data.entries);
                    setMembers(data.members);
                    if (data.currency) setCurrency(data.currency);
                    if (data.currentUserPermissions) setCurrentUserPermissions(data.currentUserPermissions);
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

        const calcMembers = members.filter(m => m.permissions?.canParticipate !== false);
        const chronologicalEntries = [...entries].reverse();
        const runningBalances: { [key: number]: number } = {};
        members.forEach(member => { runningBalances[member.id] = 0; });

        const entriesWithBalance = chronologicalEntries.map(entry => {
            const amount = parseFloat(entry.amount);

            if (entry.payer_shares && entry.beneficiary_shares && Array.isArray(entry.payer_shares) && Array.isArray(entry.beneficiary_shares)) {
                entry.payer_shares.forEach(p => {
                    if (runningBalances[p.userId] !== undefined) {
                        runningBalances[p.userId] += amount * (p.percentage / 100);
                    }
                });
                entry.beneficiary_shares.forEach(b => {
                    if (runningBalances[b.userId] !== undefined) {
                        runningBalances[b.userId] -= amount * (b.percentage / 100);
                    }
                });
            } else {
                const payerId = entry.user_id;
                if (amount > 0) { // Expense
                    const participants = entry.split_with_user_ids;
                    if (participants && participants.length > 0) {
                        const share = amount / participants.length;
                        runningBalances[payerId] += amount;
                        participants.forEach(pId => {
                            if (runningBalances[pId] !== undefined) {
                                runningBalances[pId] -= share;
                            }
                        });
                    }
                } else if (amount < 0) { // Loan
                    const loanAmount = Math.abs(amount);
                    const borrowerId = payerId;

                    const participants = entry.split_with_user_ids;
                    const lenders = participants && participants.length > 0
                        ? calcMembers.filter(m => participants.includes(m.id))
                        : [];

                    if (lenders.length > 0) {
                        runningBalances[borrowerId] -= loanAmount;
                        const creditPerLender = loanAmount / lenders.length;
                        lenders.forEach(lender => {
                            if (runningBalances[lender.id] !== undefined) {
                                runningBalances[lender.id] += creditPerLender;
                            }
                        });
                    }
                }
            }

            return {
                ...entry,
                runningBalance: runningBalances[user.userId] || 0,
            };
        });

        return entriesWithBalance;
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
        setEntryToDelete(entry);
        setIsConfirmOpen(true);
    };

    const handleDeleteEntry = async () => {
        if (!entryToDelete) return;

        const originalEntries = [...entries];
        setEntries(prev => prev.filter(e => e.id !== entryToDelete.id));
        setIsConfirmOpen(false);

        try {
            await deleteLocalEntry(roomId, entryToDelete.id);
            await removeOutboxEntryMutations(entryToDelete.id);

            if (typeof entryToDelete.id === 'number') {
                const result = await handleApi({
                    method: 'DELETE',
                    url: `/api/entries/${entryToDelete.id}`,
                });

                if (result?.optimistic) {
                    setNotification(tNotif('requestQueued'));
                }
            }

            setEntryToDelete(null);

        } catch (error) {
            console.error("Failed to delete entry:", error);
            setNotification(t('deleteEntryFailed'));
            setEntries(originalEntries);
        }
    };

    const canModify = (entry: Entry) => {
        if (currentUserPermissions.canAdmin) return true;
        if (currentUserPermissions.canAddEntries) {
            return entry.user_id === user?.userId || entry.created_by_user_id === user?.userId;
        }
        return false;
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
                <div className="p-4 border-b border-card-border shrink-0 flex items-center justify-between">
                    <h1 className="text-xl font-semibold text-card-foreground">{t('allEntries')}</h1>
                    <span className="text-xs text-muted-foreground font-mono">{t('currencyLabel')}: {currency}</span>
                </div>
                <div className="overflow-y-auto flex-grow">
                    {isLoading ? (
                        <p className="p-4 text-center text-muted-foreground">{t('loadingEntries')}</p>
                    ) : processedEntries.length === 0 ? (
                        <p className="p-4 text-center text-muted-foreground">{t('noEntries')}</p>
                    ) : (
                        <ul>
                            {processedEntries.map((entry, index) => {
                                const showProxy = entry.created_by_user_id && entry.created_by_user_id !== entry.user_id;
                                const recorderName = memberMap.get(entry.created_by_user_id || 0);

                                return (
                                    <li key={entry.id} className="p-4 border-b border-card-border flex justify-between items-center animate-fadeIn group" style={{ animationDelay: `${index * 50}ms`, opacity: 0 }}>
                                        <div className="flex-grow pr-2">
                                            <p className="font-semibold text-card-foreground">{entry.description}</p>
                                            <div className="text-xs text-muted-foreground italic flex items-center mt-0.5">
                                                {getEntryDetails(entry, memberMap, members, user, t)}
                                            </div>
                                            {showProxy && (
                                                <div className="text-[11px] text-purple-400 font-medium mt-1">
                                                    {t('loggedOnBehalfBy', { name: recorderName || `User #${entry.created_by_user_id}` })}
                                                </div>
                                            )}
                                            <p className="text-xs text-muted-foreground flex items-center mt-1.5 flex-wrap gap-y-1">
                                                {(entry.pending_sync || entry.offline_timestamp || typeof entry.id === 'string') && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30 rounded-full me-2 shrink-0">
                                                        <FiClock className="w-3 h-3" /> {t('unsynchronized')}
                                                    </span>
                                                )}
                                                <span>{t('byAuthor', { author: entry.username })} &bull; {new Date(entry.created_at).toLocaleString()}</span>
                                            </p>
                                        </div>
                                        <div className="flex items-center space-x-3 rtl:space-x-reverse shrink-0">
                                            <div className="text-right w-24">
                                                <div className={`text-base font-bold ${parseFloat(entry.amount) < 0 ? 'text-danger' : 'text-success'}`}>
                                                    {parseFloat(entry.amount).toFixed(2)} {currency}
                                                </div>
                                            </div>
                                            <div className="text-right w-24 hidden sm:block">
                                                <div className={`text-sm font-semibold ${entry.runningBalance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                    {entry.runningBalance.toFixed(2)} {currency}
                                                </div>
                                                <div className="text-[10px] text-muted-foreground uppercase">{t('myBalance')}</div>
                                            </div>

                                            <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => setEntryForHistory(entry.id)}
                                                    className="text-muted-foreground hover:text-primary p-1.5 rounded hover:bg-primary/10 transition-colors"
                                                    title={t('viewEditHistory')}
                                                >
                                                    <FiClock size={16} />
                                                </button>
                                                {canModify(entry) && (
                                                    <>
                                                        <button
                                                            onClick={() => setEntryToEdit(entry)}
                                                            className="text-muted-foreground hover:text-primary p-1.5 rounded hover:bg-primary/10 transition-colors"
                                                            title={t('editEntry')}
                                                        >
                                                            <FiEdit3 size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => openConfirmDialog(entry)}
                                                            className="text-muted-foreground hover:text-danger p-1.5 rounded hover:bg-danger/10 transition-colors"
                                                            title={t('deleteEntry')}
                                                        >
                                                            <FiTrash2 size={16} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
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

            <EditEntryModal
                isOpen={!!entryToEdit}
                onClose={() => setEntryToEdit(null)}
                entry={entryToEdit}
                currency={currency}
                members={members}
                currentUserId={user?.userId || null}
                roomId={roomId}
                onSuccess={() => fetchEntries()}
            />

            <EntryEditsModal
                isOpen={!!entryForHistory}
                onClose={() => setEntryForHistory(null)}
                entryId={entryForHistory}
                currency={currency}
            />
        </div>
    );
}
