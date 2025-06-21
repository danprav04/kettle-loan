"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next-intl/client'; // Corrected import path
import { useTranslations } from 'next-intl';
import { FiArrowDown } from 'react-icons/fi';

export default function RoomPage({ params }: { params: { roomId: string } }) {
    const t = useTranslations('Room');
    const { roomId } = params;
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [balance, setBalance] = useState(0);
    const [detailedBalance, setDetailedBalance] = useState<{ [key: string]: number }>({});
    const [showDetails, setShowDetails] = useState(false);
    const router = useRouter();

    const fetchData = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            router.push('/');
            return;
        }
        const res = await fetch(`/api/rooms/${roomId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const { currentUserBalance, balances } = await res.json();
            setBalance(currentUserBalance || 0);
            setDetailedBalance(balances || {});
        } else if (res.status === 401) {
            router.push('/');
        }
    }, [roomId, router]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleAddEntry = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        await fetch('/api/entries', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ roomId, amount: parseFloat(amount), description }),
        });
        setAmount('');
        setDescription('');
        fetchData(); // Refetch data
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4">
            <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden">
                <div className="p-8">
                    <div className="text-center mb-4">
                        <div className={`text-3xl font-bold ${balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {balance >= 0 ? `${t('oweYou')}: ${balance.toFixed(2)} ILS` : `${t('youOwe')}: ${Math.abs(balance).toFixed(2)} ILS`}
                        </div>
                        <button onClick={() => setShowDetails(!showDetails)} className="text-sm text-gray-500 flex items-center justify-center mx-auto mt-2">
                            {t('detailed')} <FiArrowDown className="ms-1 transition-transform rtl:me-1" style={{ transform: showDetails ? 'rotate(180deg)' : 'none' }} />
                        </button>
                        {showDetails && (
                            <div className="mt-2 text-left bg-gray-100 p-2 rounded">
                                {Object.entries(detailedBalance).map(([username, bal]) => (
                                    <div key={username} className="flex justify-between">
                                        <span>{username}:</span>
                                        <span className={bal > 0 ? 'text-green-600' : 'text-red-600'}>{bal.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <form onSubmit={handleAddEntry}>
                        <div className="mb-4">
                            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="amount">{t('amount')}</label>
                            <input
                                id="amount"
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                required
                            />
                        </div>
                        <div className="mb-6">
                            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="description">{t('description')}</label>
                            <input
                                id="description"
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
                                required
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <button type="submit" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
                                {t('addEntry')}
                            </button>
                            <button type="button" onClick={() => router.push(`/rooms/${roomId}/entries`)} className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
                                {t('allEntries')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}