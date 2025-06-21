"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function RoomsPage() {
    const t = useTranslations('Rooms');
    const [roomCode, setRoomCode] = useState('');
    const router = useRouter();

    const handleJoinRoom = async () => {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/rooms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ roomCode }),
        });

        if (res.ok) {
            const { roomId } = await res.json();
            router.push(`/rooms/${roomId}`);
        } else {
            alert(t('joinFailed'));
        }
    };

    const handleCreateRoom = async () => {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/rooms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({}),
        });

        if (res.ok) {
            const { roomId, code } = await res.json();
            alert(t('roomCreated', { code }));
            router.push(`/rooms/${roomId}`);
        } else {
            alert(t('createFailed'));
        }
    };

    return (
        <div className="min-h-screen bg-muted flex flex-col justify-center items-center p-4">
            <div className="bg-card p-8 rounded-lg shadow-md w-full max-w-md border border-card-border">
                <h1 className="text-2xl font-bold mb-6 text-center text-card-foreground">{t('joinOrCreateRoom')}</h1>
                <div className="mb-4">
                    <input
                        type="text"
                        placeholder={t('roomCode')}
                        value={roomCode}
                        onChange={(e) => setRoomCode(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg mb-2 themed-input"
                    />
                    <button onClick={handleJoinRoom} className="w-full py-2 rounded-lg btn-primary">
                        {t('joinRoom')}
                    </button>
                </div>
                <div className="text-center my-4 text-muted-foreground">{t('or')}</div>
                <button onClick={handleCreateRoom} className="w-full py-2 rounded-lg btn-secondary">
                    {t('createRoom')}
                </button>
            </div>
        </div>
    );
}