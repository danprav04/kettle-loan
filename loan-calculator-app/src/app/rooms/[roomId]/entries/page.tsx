// src/app/rooms/[roomId]/entries/page.tsx
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSync } from '@/components/SyncProvider';
import { getRoomData, Entry } from '@/lib/offline-sync';

export default function EntriesPage() {
    const params = useParams<{ roomId: string }>();
    const { roomId } = params;
    const t = useTranslations('Room');
    const { isOnline } = useSync();
    const [entries, setEntries] = useState<Entry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    const fetchEntries = useCallback(async () => {
        setIsLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            router.push('/');
            return;
        }

        // Offline-first: Always read from local DB first
        const localData = await getRoomData(roomId);
        if (localData) {
            setEntries(localData.entries);
        }

        // If online, try to refresh data. The main room page will handle saving it.
        if (isOnline) {
            try {
                // We're just fetching to get the latest data. The main RoomPage is the
                // single source of truth for saving this data to prevent race conditions.
                const res = await fetch(`/api/rooms/${roomId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const { entries: fetchedEntries } = await res.json();
                    setEntries(fetchedEntries);
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

    return (
        <div className="max-w-4xl mx-auto animate-scaleIn">
            <button onClick={() => router.back()} className="mb-4 font-bold py-2 px-4 rounded-lg btn-primary">
                {t('backToRoom')}
            </button>
            <div className="bg-card shadow-md rounded-lg border border-card-border">
                <div className="p-4 border-b border-card-border">
                    <h1 className="text-xl font-semibold text-card-foreground">{t('allEntries')}</h1>
                </div>
                {isLoading ? (
                    <p className="p-4 text-center text-muted-foreground">Loading entries...</p>
                ) : entries.length === 0 ? (
                    <p className="p-4 text-center text-muted-foreground">No entries have been added to this room yet.</p>
                ) : (
                    <ul>
                        {entries.map((entry, index) => (
                            <li key={entry.id} className="p-4 border-b border-card-border flex justify-between items-center animate-fadeIn" style={{ animationDelay: `${index * 50}ms`, opacity: 0 }}>
                                <div>
                                    <p className="font-semibold text-card-foreground">{entry.description}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {entry.username} - {new Date(entry.created_at).toLocaleString()}
                                    </p>
                                </div>
                                <div className={`text-lg font-bold ${parseFloat(entry.amount) < 0 ? 'text-danger' : 'text-success'}`}>
                                    {parseFloat(entry.amount).toFixed(2)} ILS
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}