"use client";

import { useState } from 'react';
import { useRouter } from 'next-intl/client'; // Corrected import path
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
        <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4">
            <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
                <h1 className="text-2xl font-bold mb-6 text-center">{t('joinOrCreateRoom')}</h1>
                <div className="mb-4">
                    <input
                        type="text"
                        placeholder={t('roomCode')}
                        value={roomCode}
                        onChange={(e) => setRoomCode(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg mb-2"
                    />
                    <button onClick={handleJoinRoom} className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600">
                        {t('joinRoom')}
                    </button>
                </div>
                <div className="text-center my-4">{t('or')}</div>
                <button onClick={handleCreateRoom} className="w-full bg-green-500 text-white py-2 rounded-lg hover:bg-green-600">
                    {t('createRoom')}
                </button>
            </div>
        </div>
    );
}