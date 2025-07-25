// src/app/rooms/[roomId]/entries/page.tsx
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSync } from '@/components/SyncProvider';
import { getRoomData, Entry, deleteLocalEntry } from '@/lib/offline-sync';
import { handleApi } from '@/lib/api';
import { useUser } from '@/components/UserProvider';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { FiClock, FiTrash2, FiInfo } from 'react-icons/fi';

export default function EntriesPage() {
    const params = useParams<{ roomId: string }>();
    const { roomId } = params;
    const t = useTranslations('Room');
    const tNotif = useTranslations('Notifications');
    const { isOnline } = useSync();
    const { user } = useUser();
    
    const [entries, setEntries] = useState<Entry[]>([]);
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
        }

        if (isOnline) {
            try {
                const res = await fetch(`/api/rooms/${roomId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setEntries(data.entries);
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
                    ) : entries.length === 0 ? (
                        <p className="p-4 text-center text-muted-foreground">No entries have been added to this room yet.</p>
                    ) : (
                        <ul>
                            {entries.map((entry, index) => (
                                <li key={entry.id} className="p-4 border-b border-card-border flex justify-between items-center animate-fadeIn group" style={{ animationDelay: `${index * 50}ms`, opacity: 0 }}>
                                    <div>
                                        <p className="font-semibold text-card-foreground">{entry.description}</p>
                                        <p className="text-sm text-muted-foreground flex items-center">
                                            {entry.offline_timestamp && (
                                                <FiClock className="me-1.5 text-amber-500" title={`Created offline at ${new Date(entry.offline_timestamp).toLocaleTimeString()}`} />
                                            )}
                                            {entry.username} - {new Date(entry.created_at).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="flex items-center space-x-2 md:space-x-4">
                                        <div className={`text-lg font-bold ${parseFloat(entry.amount) < 0 ? 'text-danger' : 'text-success'}`}>
                                            {parseFloat(entry.amount).toFixed(2)} ILS
                                        </div>
                                        {user && user.userId === entry.user_id && typeof entry.id === 'number' && (
                                            <button
                                                onClick={() => openConfirmDialog(entry)}
                                                className="text-muted-foreground hover:text-danger p-2 rounded-full hover:bg-danger/10 transition-all opacity-0 group-hover:opacity-100"
                                                title={t('deleteEntry')}
                                            >
                                                <FiTrash2 size={18} />
                                            </button>
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