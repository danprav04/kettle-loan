// src/app/rooms/[roomId]/entries/page.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSync } from '@/components/SyncProvider';
import { getRoomData, Entry, deleteLocalEntry, saveRoomData, removeOutboxEntryMutations } from '@/lib/offline-sync';
import { handleApi } from '@/lib/api';
import { useUser } from '@/components/UserProvider';
import { useCustomization } from '@/components/CustomizationProvider';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import EditEntryModal from '@/components/EditEntryModal';
import EntryEditsModal from '@/components/EntryEditsModal';
import { FiClock, FiTrash2, FiInfo, FiEdit3, FiShare2 } from 'react-icons/fi';
import { Permissions, DEFAULT_PERMISSIONS } from '@/components/PermissionContext';
import { getEntryDetails } from '@/lib/entry-formatting';
import ShareEntryModal from '@/components/ShareEntryModal';

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
    const { customizations } = useCustomization();

    const [entries, setEntries] = useState<Entry[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [currency, setCurrency] = useState('ILS');
    const [roomName, setRoomName] = useState<string | null>(null);
    const [currentUserPermissions, setCurrentUserPermissions] = useState<Permissions>(DEFAULT_PERMISSIONS);

    const [isLoading, setIsLoading] = useState(true);
    const [notification, setNotification] = useState<string | null>(null);
    const [entryToDelete, setEntryToDelete] = useState<Entry | null>(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);

    // Modals state
    const [entryToEdit, setEntryToEdit] = useState<Entry | null>(null);
    const [entryForHistory, setEntryForHistory] = useState<number | string | null>(null);
    const [entryToShare, setEntryToShare] = useState<ProcessedEntry | null>(null);

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
            if (localData.name) setRoomName(localData.name);
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
                    if (data.name) setRoomName(data.name);
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
                <button onClick={() => router.back()} className="mb-4 font-bold py-2 px-4 rounded-xl btn-primary border border-card-border shadow-md">
                    {t('backToRoom')}
                </button>

                {notification && (
                    <div className="mb-4 p-3 rounded-xl bg-blue-100 dark:bg-blue-950/70 text-blue-900 dark:text-blue-200 text-sm font-semibold border border-blue-300 dark:border-blue-700/50 flex items-center animate-fadeIn shadow-sm">
                        <FiInfo className="me-2 shrink-0 text-base"/>
                        <span>{notification}</span>
                    </div>
                )}
            </div>

            <div className="bg-card shadow-xl max-h-[80vh] rounded-2xl border border-card-border flex flex-col flex-grow overflow-hidden">
                <div className="p-4 border-b border-card-border shrink-0 flex items-center justify-between bg-card/90">
                    <h1 className="text-xl sm:text-2xl font-extrabold font-heading text-card-foreground uppercase tracking-wide">{t('allEntries')}</h1>
                    <span className="text-xs sm:text-sm text-foreground/80 font-bold font-mono px-2.5 py-1 rounded-lg bg-muted border border-card-border">{t('currencyLabel')}: {currency}</span>
                </div>
                <div className="overflow-y-auto flex-grow">
                    {isLoading ? (
                        <p className="p-6 text-center text-foreground/80 dark:text-zinc-300 font-bold">{t('loadingEntries')}</p>
                    ) : processedEntries.length === 0 ? (
                        <p className="p-6 text-center text-foreground/80 dark:text-zinc-300 font-bold">{t('noEntries')}</p>
                    ) : (
                        <ul className="divide-y divide-card-border">
                            {processedEntries.map((entry, index) => {
                                const showProxy = entry.created_by_user_id && entry.created_by_user_id !== entry.user_id;
                                const recorderName = memberMap.get(entry.created_by_user_id || 0);
                                const isPendingSync = Boolean(entry.pending_sync || entry.offline_timestamp || typeof entry.id === 'string');
                                const amountNum = parseFloat(entry.amount);
                                const canModifyEntry = canModify(entry);

                                const actionButtonsCount =
                                    (customizations.entryShareModal ? 1 : 0) +
                                    (customizations.entryEditsHistory ? 1 : 0) +
                                    (canModifyEntry && customizations.coreEntryEditing !== false ? 1 : 0) +
                                    (canModifyEntry && customizations.coreEntryDeletion !== false ? 1 : 0);

                                const stackAuthorDateOnMobile =
                                    actionButtonsCount >= 3 ||
                                    (entry.username?.length || 0) > 12 ||
                                    isPendingSync;

                                const actionButtons = actionButtonsCount > 0 ? (
                                    <div className="flex items-center gap-1 sm:gap-1.5 opacity-90 sm:opacity-85 group-hover:opacity-100 transition-opacity shrink-0">
                                        {customizations.entryShareModal && (
                                            <button
                                                onClick={() => setEntryToShare(entry)}
                                                className="text-foreground dark:text-zinc-200 hover:text-primary p-1.5 sm:p-2 rounded-lg hover:bg-primary/20 border border-transparent hover:border-primary/40 transition-colors"
                                                title={t('shareEntry')}
                                            >
                                                <FiShare2 className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                                            </button>
                                        )}
                                        {customizations.entryEditsHistory && (
                                            <button
                                                onClick={() => setEntryForHistory(entry.id)}
                                                className="text-foreground dark:text-zinc-200 hover:text-primary p-1.5 sm:p-2 rounded-lg hover:bg-primary/20 border border-transparent hover:border-primary/40 transition-colors"
                                                title={t('viewEditHistory')}
                                            >
                                                <FiClock className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                                            </button>
                                        )}
                                        {canModifyEntry && (
                                            <>
                                                {customizations.coreEntryEditing !== false && (
                                                    <button
                                                        onClick={() => setEntryToEdit(entry)}
                                                        className="text-foreground dark:text-zinc-200 hover:text-primary p-1.5 sm:p-2 rounded-lg hover:bg-primary/20 border border-transparent hover:border-primary/40 transition-colors"
                                                        title={t('editEntry')}
                                                    >
                                                        <FiEdit3 className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                                                    </button>
                                                )}
                                                {customizations.coreEntryDeletion !== false && (
                                                    <button
                                                        onClick={() => openConfirmDialog(entry)}
                                                        className="text-foreground dark:text-zinc-200 hover:text-danger p-1.5 sm:p-2 rounded-lg hover:bg-danger/20 border border-transparent hover:border-danger/40 transition-colors"
                                                        title={t('deleteEntry')}
                                                    >
                                                        <FiTrash2 className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                ) : null;

                                return (
                                    <li key={entry.id} className="p-3.5 sm:p-4 animate-fadeIn group hover:bg-muted/30 transition-colors" style={{ animationDelay: `${index * 50}ms`, opacity: 0 }}>
                                        {/* Top row: Description + Amount (and Desktop Balance/Actions) */}
                                        <div className="flex justify-between items-start sm:items-center gap-3">
                                            <div className="flex-grow min-w-0 sm:pr-2">
                                                <p className="font-extrabold text-[15px] sm:text-lg text-card-foreground tracking-tight break-words leading-snug">
                                                    {entry.description}
                                                </p>

                                                {/* Desktop inline details */}
                                                <div className="hidden sm:block">
                                                    <div className="text-sm text-foreground/80 dark:text-zinc-300 font-medium mt-1 leading-relaxed">
                                                        {getEntryDetails(entry, memberMap, members, user, t)}
                                                    </div>
                                                    {showProxy && (
                                                        <div className="text-xs text-purple-400 dark:text-purple-300 font-bold mt-1">
                                                            {t('loggedOnBehalfBy', { name: recorderName || `User #${entry.created_by_user_id}` })}
                                                        </div>
                                                    )}
                                                    <p className="text-xs text-muted-foreground dark:text-zinc-400 flex items-center mt-2 flex-wrap gap-y-1 font-semibold">
                                                        {isPendingSync && (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-black bg-amber-500/20 text-amber-500 dark:text-amber-300 border border-amber-500/50 rounded-full me-2 shrink-0">
                                                                <FiClock className="w-3.5 h-3.5" /> {t('unsynchronized')}
                                                            </span>
                                                        )}
                                                        <span>{t('byAuthor', { author: entry.username })} &bull; {new Date(entry.created_at).toLocaleString()}</span>
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center space-x-2 sm:space-x-3 rtl:space-x-reverse shrink-0">
                                                <div className="text-right">
                                                    <div className={`text-base sm:text-xl font-black font-mono whitespace-nowrap ${amountNum < 0 ? 'text-rose-500 dark:text-rose-400' : 'text-emerald-500 dark:text-emerald-400'}`}>
                                                        {amountNum.toFixed(0)} {currency}
                                                    </div>
                                                </div>
                                                <div className="text-right w-24 hidden sm:block">
                                                    <div className={`text-base font-black font-mono ${entry.runningBalance >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                                                        {entry.runningBalance.toFixed(0)} {currency}
                                                    </div>
                                                    <div className="text-[11px] text-foreground/80 dark:text-zinc-300 font-extrabold uppercase">{t('myBalance')}</div>
                                                </div>
                                                {actionButtons && (
                                                    <div className="hidden sm:block">
                                                        {actionButtons}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Mobile full-width details & footer */}
                                        <div className="sm:hidden mt-1.5 space-y-1">
                                            <div className="text-xs text-foreground/80 dark:text-zinc-300 font-medium leading-relaxed">
                                                {getEntryDetails(entry, memberMap, members, user, t)}
                                            </div>
                                            {showProxy && (
                                                <div className="text-xs text-purple-400 dark:text-purple-300 font-bold leading-snug">
                                                    {t('loggedOnBehalfBy', { name: recorderName || `User #${entry.created_by_user_id}` })}
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between gap-2 pt-1">
                                                <div className="text-[11px] text-muted-foreground dark:text-zinc-400 font-semibold min-w-0 flex-1 leading-snug">
                                                    {isPendingSync && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black bg-amber-500/20 text-amber-500 dark:text-amber-300 border border-amber-500/50 rounded-full me-1.5 mb-0.5 shrink-0">
                                                            <FiClock className="w-3 h-3" /> {t('unsynchronized')}
                                                        </span>
                                                    )}
                                                    {stackAuthorDateOnMobile ? (
                                                        <>
                                                            <span className="block truncate">{t('byAuthor', { author: entry.username })}</span>
                                                            <span className="block text-muted-foreground/80 dark:text-zinc-400/90 whitespace-nowrap">{new Date(entry.created_at).toLocaleString()}</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span>{t('byAuthor', { author: entry.username })}</span>
                                                            <span className="mx-1">&bull;</span>
                                                            <span className="whitespace-nowrap">{new Date(entry.created_at).toLocaleString()}</span>
                                                        </>
                                                    )}
                                                </div>
                                                {actionButtons}
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

            <ShareEntryModal
                isOpen={!!entryToShare}
                onClose={() => setEntryToShare(null)}
                entry={entryToShare}
                currency={currency}
                members={members}
                currentUserId={user?.userId}
                roomName={roomName}
                roomId={roomId}
                userRunningBalance={entryToShare?.runningBalance}
            />
        </div>
    );
}
