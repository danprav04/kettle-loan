"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation'; // <-- Changed from next-intl/navigation
import { useTranslations } from 'next-intl';

interface Entry {
    id: number;
    amount: string;
    description: string;
    created_at: string;
    username: string;
}

export default function EntriesPage({ params }: { params: { roomId: string } }) {
    const t = useTranslations('Room');
    const { roomId } = params;
    const [entries, setEntries] = useState<Entry[]>([]);
    const router = useRouter();

    const fetchEntries = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            router.push('/');
            return;
        }
        const res = await fetch(`/api/rooms/${roomId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const { entries } = await res.json();
            setEntries(entries);
        } else if (res.status === 401) {
            router.push('/');
        }
    }, [roomId, router]);

    useEffect(() => {
        fetchEntries();
    }, [fetchEntries]);

    return (
        <div className="min-h-screen bg-gray-100 p-4">
            <div className="max-w-4xl mx-auto">
                <button onClick={() => router.back()} className="mb-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                    {t('backToRoom')}
                </button>
                <div className="bg-white shadow-md rounded-lg">
                    <div className="p-4 border-b">
                        <h1 className="text-xl font-semibold">{t('allEntries')}</h1>
                    </div>
                    <ul>
                        {entries.map(entry => (
                            <li key={entry.id} className="p-4 border-b flex justify-between items-center">
                                <div>
                                    <p className="font-semibold">{entry.description}</p>
                                    <p className="text-sm text-gray-500">
                                        {entry.username} - {new Date(entry.created_at).toLocaleString()}
                                    </p>
                                </div>
                                <div className="text-lg font-bold">
                                    {entry.amount} ILS
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}