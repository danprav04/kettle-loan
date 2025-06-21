"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

interface Room {
    id: number;
    code: string;
}

export default function RoomsSidebar() {
    const t = useTranslations('Rooms');
    const router = useRouter();
    const pathname = usePathname();
    const [rooms, setRooms] = useState<Room[]>([]);
    const [roomCode, setRoomCode] = useState('');
    const [error, setError] = useState('');

    const fetchRooms = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            router.push('/');
            return;
        }
        const res = await fetch('/api/user/rooms', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const data = await res.json();
            setRooms(data);
        } else if (res.status === 401) {
            router.push('/');
        }
    }, [router]);

    useEffect(() => {
        fetchRooms();
    }, [fetchRooms, pathname]);

    const handleJoinRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
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
            setRoomCode('');
            router.push(`/rooms/${roomId}`);
        } else {
            const { message } = await res.json();
            console.error("Join failed:", message);
            setError(t('joinFailed'));
        }
    };

    const handleCreateRoom = async () => {
        setError('');
        const token = localStorage.getItem('token');
        const res = await fetch('/api/rooms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({}), // Empty body for creation
        });

        if (res.ok) {
            const { roomId } = await res.json();
            router.push(`/rooms/${roomId}`);
        } else {
            const { message } = await res.json();
            console.error("Create failed:", message);
            setError(t('createFailed'));
        }
    };

    return (
        <div className="w-80 bg-card border-r border-card-border h-screen p-4 flex flex-col flex-shrink-0">
            <h2 className="text-xl font-bold mb-4 text-card-foreground">My Rooms</h2>
            <nav className="flex-grow overflow-y-auto mb-4">
                <ul>
                    {rooms.map(room => {
                        const isActive = pathname === `/rooms/${room.id}` || pathname.startsWith(`/rooms/${room.id}/`);
                        return (
                            <li key={room.id} className="mb-2">
                                <Link href={`/rooms/${room.id}`} className={`block p-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'text-card-foreground hover:bg-muted'}`}>
                                    Room #{room.code}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>
            <div className="mt-auto pt-4 border-t border-card-border">
                {error && <p className="text-danger text-sm text-center mb-2">{error}</p>}
                <form onSubmit={handleJoinRoom} className="mb-4">
                    <input
                        type="text"
                        placeholder={t('roomCode')}
                        value={roomCode}
                        onChange={(e) => setRoomCode(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg mb-2 themed-input"
                    />
                    <button type="submit" className="w-full py-2 rounded-lg btn-primary">
                        {t('joinRoom')}
                    </button>
                </form>
                <div className="text-center my-2 text-muted-foreground">{t('or')}</div>
                <button onClick={handleCreateRoom} className="w-full py-2 rounded-lg btn-secondary">
                    {t('createRoom')}
                </button>
            </div>
        </div>
    );
}