'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export default function RoomManager({ onRoomAction }: { onRoomAction: () => void }) {
    const [roomCode, setRoomCode] = useState('');
    const [error, setError] = useState('');
    const t = useTranslations('Room');

    const handleCreateRoom = async () => {
        setError('');
        const res = await fetch('/api/rooms/create', { method: 'POST' });
        if (res.ok) {
            onRoomAction();
        } else {
            const data = await res.json();
            setError(data.error);
        }
    };

    const handleJoinRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const res = await fetch('/api/rooms/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomCode }),
        });
        if (res.ok) {
            onRoomAction();
        } else {
            const data = await res.json();
            setError(data.error);
        }
    };

    return (
        <Card className="w-full max-w-md mx-auto">
            <CardHeader>
                 <CardTitle>{t('joinRoom')}</CardTitle>
            </CardHeader>
            <CardContent>
                {error && <p className="text-red-500 mb-4">{error}</p>}
                <form onSubmit={handleJoinRoom} className="flex gap-2">
                    <Input 
                        type="text"
                        placeholder={t('roomCode')}
                        value={roomCode}
                        onChange={(e) => setRoomCode(e.target.value)}
                        className="flex-grow"
                    />
                    <Button type="submit">{t('joinButton')}</Button>
                </form>

                <div className="my-4 text-center">{t('or')}</div>

                <Button onClick={handleCreateRoom} variant="secondary" className="w-full">{t('createRoom')}</Button>
            </CardContent>
        </Card>
    );
}