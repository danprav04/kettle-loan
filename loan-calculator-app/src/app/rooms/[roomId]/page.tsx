"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FiArrowDown } from 'react-icons/fi';

export default function RoomPage() {
    const params = useParams<{ roomId: string }>();
    const { roomId } = params;
    const t = useTranslations('Room');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [balance, setBalance] = useState(0);
    const [detailedBalance, setDetailedBalance] = useState<{ [key: string]: number }>({});
    const [showDetails, setShowDetails] = useState(false);
    const [roomCode, setRoomCode] = useState('');
    const router = useRouter();
    // Initialize state to null to prevent rendering on the server and before client-side hydration.
    const [entryType, setEntryType] = useState<'expense' | 'loan' | null>(null);

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
            const { currentUserBalance, balances, code } = await res.json();
            setBalance(currentUserBalance || 0);
            setDetailedBalance(balances || {});
            setRoomCode(code || '');
        } else if (res.status === 401) {
            router.push('/');
        }
    }, [roomId, router]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // This effect runs once on the client to hydrate the entryType state from localStorage.
    useEffect(() => {
        const savedEntryType = localStorage.getItem('entryType') as 'expense' | 'loan';
        // Set state from localStorage, or default to 'expense' if no value is saved.
        setEntryType(savedEntryType && ['expense', 'loan'].includes(savedEntryType) ? savedEntryType : 'expense');
    }, []);

    const handleSetEntryType = (type: 'expense' | 'loan') => {
        setEntryType(type);
        localStorage.setItem('entryType', type);
    };

    const handleAddEntry = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        const parsedAmount = Math.abs(parseFloat(amount));
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return; 
        }

        const finalAmount = entryType === 'loan' ? -parsedAmount : parsedAmount;

        await fetch('/api/entries', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ roomId, amount: finalAmount, description }),
        });
        setAmount('');
        setDescription('');
        fetchData(); // Refetch data
    };


    return (
        <div className="max-w-md mx-auto bg-card rounded-xl shadow-md overflow-hidden border border-card-border animate-scaleIn">
            <div className="p-8">
                <div className="text-center mb-6">
                    <h1 className="text-xl font-bold text-card-foreground">
                        Room #{roomCode}
                    </h1>
                </div>

                {/* Balance Section */}
                <div className="text-center mb-6">
                    <div className="text-lg font-medium text-muted-foreground">{t('balanceTitle')}</div>
                    <div className={`text-4xl font-bold mt-1 ${balance >= 0 ? 'text-success' : 'text-danger'}`}>
                        {balance.toFixed(2)} ILS
                    </div>
                     <button onClick={() => setShowDetails(!showDetails)} className="text-sm text-primary hover:underline flex items-center justify-center mx-auto mt-2">
                        {t('detailed')} <FiArrowDown className={`ms-1 transition-transform rtl:me-1 ${showDetails ? 'rotate-180' : ''}`} />
                    </button>
                    {showDetails && (
                        <div className="mt-2 text-left bg-muted p-3 rounded-lg animate-fadeIn">
                            {Object.entries(detailedBalance).map(([username, bal]) => (
                                <div key={username} className="flex justify-between text-card-foreground py-1">
                                    <span>{username}:</span>
                                    <span className={bal >= 0 ? 'text-success' : 'text-danger'}>{bal.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="border-t border-card-border my-6"></div>

                {/* New Entry Form Section */}
                <div>
                    <h2 className="text-xl font-semibold text-center text-card-foreground mb-4">{t('newEntryTitle')}</h2>
                    <form onSubmit={handleAddEntry}>
                        {/* High-Contrast Entry Type Toggle */}
                        <div className="mb-6">
                            {entryType !== null ? (
                                <div className="relative flex w-full rounded-full bg-muted p-1">
                                    <span
                                        className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full shadow-sm transition-all duration-300 ease-in-out border-2 border-black dark:border-white
                                            ${entryType === 'expense' ? 'bg-primary' : 'bg-success'}`
                                        }
                                        style={{ left: entryType === 'loan' ? '50%' : '4px' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleSetEntryType('expense')}
                                        className={`z-10 w-1/2 py-2 text-sm font-semibold transition-colors duration-300
                                            ${entryType === 'expense' ? 'text-primary-foreground' : 'text-foreground'}`
                                        }
                                    >
                                        {t('expense')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSetEntryType('loan')}
                                        className={`z-10 w-1/2 py-2 text-sm font-semibold transition-colors duration-300
                                            ${entryType === 'loan' ? 'text-secondary-foreground' : 'text-foreground'}`
                                        }
                                    >
                                        {t('loan')}
                                    </button>
                                </div>
                            ) : (
                                <div className="h-[44px] w-full rounded-full bg-muted" />
                            )}
                        </div>
                        <div className="mb-4">
                            <label className="block text-muted-foreground text-sm font-bold mb-2" htmlFor="amount">{t('amount')}</label>
                            <input
                                id="amount"
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full px-3 py-2 leading-tight rounded-lg themed-input"
                                required
                                min="0"
                                step="any"
                            />
                        </div>
                        <div className="mb-6">
                            <label className="block text-muted-foreground text-sm font-bold mb-2" htmlFor="description">{t('description')}</label>
                            <input
                                id="description"
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full px-3 py-2 mb-3 leading-tight rounded-lg themed-input"
                                required
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <button type="submit" className="font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline btn-primary">
                                {t('addEntry')}
                            </button>
                            <button type="button" onClick={() => router.push(`/rooms/${roomId}/entries`)} className="font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline btn-muted">
                                {t('allEntries')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}