"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface Entry {
    id: number;
    amount: string;
    description: string;
    created_at: string;
    username: string;
}

export default function EntriesPage() {
    const params = useParams<{ roomId: string }>();
    const { roomId } = params;
    const t = useTranslations('Room');
    const [entries, setEntries] = useState<Entry[]>([]);
    const router = useRouter();

    const fetchEntries = useCallback(async () => {
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
                const { entries } = await res.json();
                setEntries(entries);
            } else if (res.status === 401) {
                router.push('/');
            }
        } catch (e) {
            console.error("Failed to fetch entries. Possibly offline.", e);
        }
    }, [roomId, router]);

    useEffect(() => {
        fetchEntries();
        // Add event listener for when sync completes to refetch entries
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
                <ul>
                    {entries.map((entry, index) => (
                        <li key={entry.id} className="p-4 border-b border-card-border flex justify-between items-center animate-fadeIn" style={{ animationDelay: `${index * 50}ms`, opacity: 0 }}>
                            <div>
                                <p className="font-semibold text-card-foreground">{entry.description}</p>
                                <p className="text-sm text-muted-foreground">
                                    {entry.username} - {new Date(entry.created_at).toLocaleString()}
                                </p>
                            </div>
                            <div className="text-lg font-bold text-card-foreground">
                                {parseFloat(entry.amount).toFixed(2)} ILS
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}