// src/app/rooms/[roomId]/stats/page.tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as XLSX from 'xlsx';
import { useSync } from '@/components/SyncProvider';
import { getRoomData, Entry } from '@/lib/offline-sync';
import { useUser } from '@/components/UserProvider';
import { FiDownload, FiFileText, FiGrid, FiBarChart2 } from 'react-icons/fi';

interface Member {
    id: number;
    username: string;
}

interface RoomStats {
    totalExpenses: number;
    totalLoans: number;
    totalEntries: number;
    biggestExpense: { description: string; amount: number } | null;
    memberContributions: Map<number, { username: string; paid: number; share: number; net: number }>;
}

export default function StatsPage() {
    const params = useParams<{ roomId: string }>();
    const { roomId } = params;
    const t = useTranslations('Stats');
    const tRoom = useTranslations('Room');
    const { isOnline } = useSync();
    const { user } = useUser();
    const router = useRouter();

    const [entries, setEntries] = useState<Entry[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [roomCode, setRoomCode] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        const token = localStorage.getItem('token');
        if (!token || !user) {
            router.push('/');
            return;
        }

        const localData = await getRoomData(roomId);
        if (localData) {
            setEntries(localData.entries);
            setMembers(localData.members);
            setRoomCode(localData.code);
        }

        if (isOnline) {
            try {
                const res = await fetch(`/api/rooms/${roomId}`, { headers: { 'Authorization': `Bearer ${token}` } });
                if (res.ok) {
                    const data = await res.json();
                    setEntries(data.entries);
                    setMembers(data.members);
                    setRoomCode(data.code);
                } else if (res.status === 401) {
                    router.push('/');
                }
            } catch (e) {
                console.error("Failed to refresh stats data.", e);
            }
        }
        setIsLoading(false);
    }, [roomId, router, isOnline, user]);

    useEffect(() => {
        fetchData();
        window.addEventListener('syncdone', fetchData);
        return () => window.removeEventListener('syncdone', fetchData);
    }, [fetchData]);

    const stats: RoomStats | null = useMemo(() => {
        if (entries.length === 0 || members.length === 0) return null;

        let totalExpenses = 0;
        let totalLoans = 0;
        let biggestExpense: { description: string; amount: number } | null = null;
        const memberContributions = new Map<number, { username: string; paid: number; share: number; net: number }>();
        members.forEach(m => memberContributions.set(m.id, { username: m.username, paid: 0, share: 0, net: 0 }));

        for (const entry of entries) {
            const amount = parseFloat(entry.amount);
            const payerId = entry.user_id;
            const payerData = memberContributions.get(payerId);

            if (amount > 0) { // Expense
                totalExpenses += amount;
                if (!biggestExpense || amount > biggestExpense.amount) {
                    biggestExpense = { description: entry.description, amount };
                }
                if (payerData) payerData.paid += amount;

                const participants = entry.split_with_user_ids ?? members.map(m => m.id);
                if (participants.length > 0) {
                    const share = amount / participants.length;
                    participants.forEach(pId => {
                        const pData = memberContributions.get(pId);
                        if (pData) pData.share += share;
                    });
                }
            } else { // Loan
                const loanAmount = Math.abs(amount);
                totalLoans += loanAmount;
                if (payerData) payerData.share += loanAmount;
            }
        }
        
        memberContributions.forEach(data => { data.net = data.paid - data.share; });

        return {
            totalExpenses,
            totalLoans,
            totalEntries: entries.length,
            biggestExpense,
            memberContributions
        };
    }, [entries, members]);

    const handleExport = (format: 'xlsx' | 'csv' | 'txt') => {
        setIsExporting(true);
        const memberMap = new Map(members.map(m => [m.id, m.username]));
        
        const dataToExport = entries.map(entry => {
            const amount = parseFloat(entry.amount);
            const type = amount > 0 ? 'Expense' : 'Loan';
            let participantsText = '';
            
            const pIds = entry.split_with_user_ids;
            const isForAll = !pIds || pIds.length === 0 || pIds.length === members.length;
            if(isForAll) {
                 participantsText = tRoom('entryParticipantEveryone');
            } else {
                 participantsText = pIds.map(id => memberMap.get(id) || `ID:${id}`).join(', ');
            }

            return {
                Date: new Date(entry.created_at).toLocaleString(),
                Description: entry.description,
                Type: type,
                Payer: entry.username,
                Amount: Math.abs(amount),
                Participants: type === 'Expense' ? participantsText : ''
            };
        }).reverse(); // chronological order

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const filename = `Kettle_Room_${roomCode}_Export`;

        if (format === 'xlsx') {
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Entries");
            XLSX.writeFile(workbook, `${filename}.xlsx`);
        } else {
            const csvData = XLSX.utils.sheet_to_csv(worksheet);
            const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", `${filename}.${format === 'csv' ? 'csv' : 'txt'}`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        }
        setIsExporting(false);
    };


    return (
        <div className="max-w-4xl mx-auto animate-scaleIn h-full overflow-y-auto pb-8">
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => router.back()} className="font-bold py-2 px-4 rounded-lg btn-primary">
                    {tRoom('backToRoom')}
                </button>
                 <div className="relative group">
                    <button disabled={isExporting || !stats} className="font-bold py-2 px-4 rounded-lg btn-secondary flex items-center disabled:opacity-50">
                        <FiDownload className="me-2"/> {t('exportData')}
                    </button>
                    <div className="absolute right-0 mt-2 w-48 bg-card rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                        <div className="py-1">
                            <button onClick={() => handleExport('xlsx')} className="w-full text-left flex items-center px-4 py-2 text-sm text-foreground hover:bg-muted"><FiGrid className="me-2"/> {t('exportXLSX')}</button>
                            <button onClick={() => handleExport('csv')} className="w-full text-left flex items-center px-4 py-2 text-sm text-foreground hover:bg-muted"><FiFileText className="me-2"/> {t('exportCSV')}</button>
                            <button onClick={() => handleExport('txt')} className="w-full text-left flex items-center px-4 py-2 text-sm text-foreground hover:bg-muted"><FiFileText className="me-2"/> {t('exportTXT')}</button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-card shadow-md rounded-lg border border-card-border p-6">
                <h1 className="text-2xl font-bold text-card-foreground mb-6 flex items-center"><FiBarChart2 className="me-3 text-primary"/>{t('title')}</h1>
                {isLoading ? (
                    <p className="text-center text-muted-foreground">Loading statistics...</p>
                ) : !stats ? (
                    <p className="text-center text-muted-foreground">No entries found to generate statistics.</p>
                ) : (
                    <div className="space-y-6">
                        {/* General Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-4 bg-muted rounded-lg"><div className="text-sm text-muted-foreground">{t('totalExpenses')}</div><div className="text-2xl font-bold text-success">{stats.totalExpenses.toFixed(2)}</div></div>
                            <div className="p-4 bg-muted rounded-lg"><div className="text-sm text-muted-foreground">{t('totalLoans')}</div><div className="text-2xl font-bold text-danger">{stats.totalLoans.toFixed(2)}</div></div>
                            <div className="p-4 bg-muted rounded-lg"><div className="text-sm text-muted-foreground">{t('totalEntries')}</div><div className="text-2xl font-bold">{stats.totalEntries}</div></div>
                        </div>
                        {stats.biggestExpense && (
                             <div className="p-4 bg-muted rounded-lg"><div className="text-sm text-muted-foreground">{t('biggestExpense')}</div><div className="text-xl font-bold">{stats.biggestExpense.amount.toFixed(2)} <span className="text-base font-normal text-muted-foreground">- {stats.biggestExpense.description}</span></div></div>
                        )}

                        {/* Member Contributions */}
                        <div>
                            <h2 className="text-lg font-semibold text-card-foreground mb-3">{t('memberContributions')}</h2>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="border-b border-card-border">
                                        <tr>
                                            <th className="p-2 text-sm font-semibold text-muted-foreground">Member</th>
                                            <th className="p-2 text-sm font-semibold text-muted-foreground text-right">{t('paid')}</th>
                                            <th className="p-2 text-sm font-semibold text-muted-foreground text-right">{t('owes')}</th>
                                            <th className="p-2 text-sm font-semibold text-muted-foreground text-right">{t('net')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Array.from(stats.memberContributions.values()).map(data => (
                                            <tr key={data.username} className="border-b border-card-border last:border-0">
                                                <td className="p-2 font-medium">{data.username}</td>
                                                <td className="p-2 text-right text-success">{data.paid.toFixed(2)}</td>
                                                <td className="p-2 text-right text-danger">{data.share.toFixed(2)}</td>
                                                <td className={`p-2 text-right font-bold ${data.net >= 0 ? 'text-green-500' : 'text-red-500'}`}>{data.net.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}