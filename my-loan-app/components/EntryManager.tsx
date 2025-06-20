'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ArrowDown, ArrowUp } from 'lucide-react';

// Define the type for an entry
interface Entry {
    id: string;
    amount: number;
    description: string;
    createdAt: string;
    user: {
        id: string;
        username: string;
    };
}

// Define the type for a room
interface Room {
    id: string;
    code: string;
    entries: Entry[];
    users: { user: { id: string; username: string; } }[];
}

export default function EntryManager({ room, userId, onEntryAdded }: { room: Room, userId: string, onEntryAdded: () => void }) {
    const [view, setView] = useState('add'); // 'add' or 'list'
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [error, setError] = useState('');
    const [detailsVisible, setDetailsVisible] = useState(false);

    const t = useTranslations('Entry');

    const handleAddEntry = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const res = await fetch('/api/entries/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, description, roomId: room.id }),
        });

        if (res.ok) {
            setAmount('');
            setDescription('');
            onEntryAdded();
        } else {
            const data = await res.json();
            setError(data.error || 'Failed to add entry');
        }
    };

    const { totalOwed, userBalances } = useMemo(() => {
        const totalPaidByUser = room.entries
            .filter(e => e.user.id === userId)
            .reduce((sum, e) => sum + e.amount, 0);

        const totalSpentInRoom = room.entries.reduce((sum, e) => sum + e.amount, 0);
        const numUsers = room.users.length;
        const userShare = numUsers > 0 ? totalSpentInRoom / numUsers : 0;

        const totalOwedToUser = totalPaidByUser - userShare;

        const otherUsers = room.users.filter(u => u.user.id !== userId);
        const balances: Record<string, number> = {};

        otherUsers.forEach(otherUser => {
            const paidByOther = room.entries
                .filter(e => e.user.id === otherUser.user.id)
                .reduce((sum, e) => sum + e.amount, 0);
            
            const debt = userShare - paidByOther;
            balances[otherUser.user.username] = debt;
        });


        return { totalOwed: totalOwedToUser, userBalances: balances };
    }, [room, userId]);

    if (view === 'list') {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>{t('allEntries')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <ul>
                        {room.entries.map(entry => (
                            <li key={entry.id} className="flex justify-between p-2 border-b">
                                <span>{entry.description} ({entry.user.username})</span>
                                <span>{entry.amount} ILS</span>
                            </li>
                        ))}
                    </ul>
                    <Button onClick={() => setView('add')} className="mt-4 w-full">{t('backToAddEntry')}</Button>
                </CardContent>
            </Card>
        );
    }
    
    return (
        <Card className="w-full max-w-md mx-auto">
             <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>{t('addEntry')}</CardTitle>
                    <div className={totalOwed >= 0 ? 'text-green-600' : 'text-red-600'}>
                        <span className="font-bold text-lg">{Math.abs(totalOwed).toFixed(2)} ILS</span>
                        <span className="text-sm ml-1">{totalOwed >= 0 ? t('oweYou') : t('youOwe')}</span>
                    </div>
                </div>
                
                 <div className="text-sm text-gray-500 flex items-center cursor-pointer" onClick={() => setDetailsVisible(!detailsVisible)}>
                     Details {detailsVisible ? <ArrowUp size={16} className="ml-1" /> : <ArrowDown size={16} className="ml-1" />}
                 </div>

                 {detailsVisible && (
                     <div className="text-xs space-y-1 mt-2 p-2 bg-gray-50 rounded">
                         {Object.entries(userBalances).map(([username, balance]) => (
                             <div key={username} className="flex justify-between">
                                 <span>{balance > 0 ? `${username} owes you` : `You owe ${username}`}</span>
                                 <span>{Math.abs(balance).toFixed(2)} ILS</span>
                             </div>
                         ))}
                     </div>
                 )}
            </CardHeader>
            <CardContent>
                <form onSubmit={handleAddEntry} className="space-y-4">
                     {error && <p className="text-red-500">{error}</p>}
                    <Input
                        type="number"
                        placeholder={t('amount')}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                        step="0.01"
                    />
                    <Input
                        type="text"
                        placeholder={t('description')}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required
                    />
                    <Button type="submit" className="w-full">{t('addButton')}</Button>
                </form>
                <Button variant="outline" onClick={() => setView('list')} className="mt-4 w-full">
                    {t('viewAllEntries')}
                </Button>
            </CardContent>
        </Card>
    );
}