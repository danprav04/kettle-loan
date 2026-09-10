// src/app/rooms/[roomId]/stats/page.tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as XLSX from 'xlsx';
import { useSync } from '@/components/SyncProvider';
import { getRoomData, Entry, saveRoomData } from '@/lib/offline-sync';
import { useUser } from '@/components/UserProvider';
import {
    FiDownload,
    FiFileText,
    FiGrid,
    FiBarChart2,
    FiTrendingUp,
    FiDollarSign,
    FiCheckCircle,
    FiUsers,
    FiAward,
    FiRepeat
} from 'react-icons/fi';
import {
    calculateRoomStats,
    formatCurrencyAmount,
    isSettlementEntry,
    StatsMember,
    RoomStatsResult
} from '@/lib/stats-calc';
import { getEntryPayerAndParticipantStrings } from '@/lib/entry-formatting';

interface Member extends StatsMember {
    permissions?: {
        canAdmin?: boolean;
        canAddEntries?: boolean;
        canParticipate?: boolean;
        canView?: boolean;
    };
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
    const [roomName, setRoomName] = useState<string | null>(null);
    const [currency, setCurrency] = useState('ILS');
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
            setEntries(localData.entries || []);
            setMembers((localData.members || []) as Member[]);
            setRoomCode(localData.code || '');
            if (localData.name) setRoomName(localData.name);
            if (localData.currency) setCurrency(localData.currency);
        }

        if (isOnline) {
            try {
                const res = await fetch(`/api/rooms/${roomId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    await saveRoomData(roomId, data);
                    setEntries(data.entries || []);
                    setMembers((data.members || []) as Member[]);
                    setRoomCode(data.code || '');
                    if (data.name) setRoomName(data.name);
                    if (data.currency) setCurrency(data.currency);
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

    const stats: RoomStatsResult | null = useMemo(() => {
        return calculateRoomStats(entries, members);
    }, [entries, members]);

    const hasSettlements = useMemo(() => {
        return stats ? stats.totalSettlements > 0 : false;
    }, [stats]);

    const handleExport = (format: 'xlsx' | 'csv' | 'txt') => {
        if (!stats || entries.length === 0) return;
        setIsExporting(true);
        try {
            const memberMap = new Map(members.map(m => [m.id, m.username]));

            const dataToExport = entries.map(entry => {
                const amount = parseFloat(entry.amount);
                const isSettlement = isSettlementEntry(entry);
                const isLoan = amount < 0;

                let typeText = t('exportTypeExpense') || 'Expense';
                if (isSettlement) {
                    typeText = t('exportTypeSettlement') || 'Settlement';
                } else if (isLoan) {
                    typeText = t('exportTypeLoan') || 'Loan';
                }

                const { payersText, participantsText, isLoanWithoutShares, borrowerText } =
                    getEntryPayerAndParticipantStrings(
                        entry,
                        memberMap,
                        members as any,
                        null,
                        tRoom
                    );

                const finalPayer = isLoanWithoutShares && borrowerText
                    ? (tRoom('entryFromGroup') || 'The Group')
                    : payersText;
                const finalParticipants = isLoanWithoutShares && borrowerText
                    ? borrowerText
                    : participantsText;

                return {
                    [t('exportDate') || 'Date']: new Date(entry.created_at).toLocaleString(),
                    [t('exportDescription') || 'Description']: entry.description,
                    [t('exportType') || 'Type']: typeText,
                    [t('exportPayer') || 'Payer']: finalPayer,
                    [`${t('exportAmount') || 'Amount'} (${currency})`]: formatCurrencyAmount(Math.abs(amount)),
                    [t('exportParticipants') || 'Participants']: finalParticipants
                };
            }).reverse();

            const filename = `Kettle_Room_${roomCode || roomId}_Export`;

            if (format === 'xlsx') {
                const workbook = XLSX.utils.book_new();

                // 1. Summary Sheet
                const summaryOverview = [
                    { [t('roomOverview') || 'Metric']: tRoom('roomTitle', { code: roomCode }) || `Room #${roomCode}`, Value: '' },
                    { [t('roomOverview') || 'Metric']: t('totalExpenses') || 'Total Expenses', Value: `${formatCurrencyAmount(stats.totalExpenses)} ${currency}` },
                    { [t('roomOverview') || 'Metric']: t('totalLoans') || 'Total Loans', Value: `${formatCurrencyAmount(stats.totalLoans)} ${currency}` },
                    { [t('roomOverview') || 'Metric']: t('totalSettlements') || 'Total Settlements', Value: `${formatCurrencyAmount(stats.totalSettlements)} ${currency}` },
                    { [t('roomOverview') || 'Metric']: t('averageExpense') || 'Avg. per Member', Value: `${formatCurrencyAmount(stats.averageExpensePerMember)} ${currency}` },
                    { [t('roomOverview') || 'Metric']: t('totalEntries') || 'Total Entries', Value: stats.totalEntries },
                    { [t('roomOverview') || 'Metric']: t('biggestExpense') || 'Biggest Expense', Value: stats.biggestExpense ? `${formatCurrencyAmount(stats.biggestExpense.amount)} ${currency} - ${stats.biggestExpense.description}` : 'N/A' },
                ];

                const memberSummaryData = Array.from(stats.memberContributions.values()).map(m => ({
                    [t('memberHeader') || 'Member']: m.username + (!m.isEligible ? ` (${t('observerBadge') || 'Observer'})` : ''),
                    [`${t('paid') || 'Paid'} (${currency})`]: m.paid,
                    [`${t('owes') || 'Owes'} (${currency})`]: m.share,
                    [`${t('settlementsLabel') || 'Settled'} (${currency})`]: m.settled,
                    [`${t('net') || 'Net'} (${currency})`]: m.net,
                    [`${t('paid') || 'Paid'} %`]: `${m.paidPercentage}%`,
                    [`${t('owes') || 'Owes'} %`]: `${m.sharePercentage}%`,
                }));

                const summarySheet = XLSX.utils.json_to_sheet(summaryOverview);
                XLSX.utils.sheet_add_json(summarySheet, memberSummaryData, { origin: 'A10' });
                XLSX.utils.book_append_sheet(workbook, summarySheet, t('summarySheet') || 'Summary');

                // 2. Entries Sheet
                const entriesSheet = XLSX.utils.json_to_sheet(dataToExport);
                XLSX.utils.book_append_sheet(workbook, entriesSheet, t('entriesSheet') || 'Entries');

                try {
                    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
                    const blob = new Blob([excelBuffer], {
                        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8'
                    });
                    const link = document.createElement('a');
                    const url = URL.createObjectURL(blob);
                    link.setAttribute('href', url);
                    link.setAttribute('download', `${filename}.xlsx`);
                    link.style.visibility = 'hidden';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                } catch {
                    XLSX.writeFile(workbook, `${filename}.xlsx`);
                }
            } else {
                const worksheet = XLSX.utils.json_to_sheet(dataToExport);
                const csvData = XLSX.utils.sheet_to_csv(worksheet);
                const blob = new Blob(['\uFEFF' + csvData], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', `${filename}.${format === 'csv' ? 'csv' : 'txt'}`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } catch (error) {
            console.error("Export failed:", error);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto animate-scaleIn h-full overflow-y-auto pb-8 space-y-4">
            {/* Top Navigation & Export Actions */}
            <div className="flex justify-between items-center flex-wrap gap-2">
                <button
                    onClick={() => router.back()}
                    className="font-bold py-2 px-4 rounded-xl btn-primary text-xs sm:text-sm shadow-sm transition-all active:scale-95"
                >
                    {tRoom('backToRoom')}
                </button>

                <div className="relative group">
                    <button
                        disabled={isExporting || !stats}
                        className="font-bold py-2 px-4 rounded-xl btn-secondary flex items-center text-xs sm:text-sm shadow-sm disabled:opacity-50 transition-all active:scale-95"
                    >
                        <FiDownload className="me-2" /> {t('exportData')}
                    </button>
                    <div className="absolute right-0 rtl:left-0 rtl:right-auto mt-2 w-52 bg-card rounded-xl shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-20 border border-card-border overflow-hidden">
                        <div className="py-1 divide-y divide-card-border/50">
                            <button
                                onClick={() => handleExport('xlsx')}
                                className="w-full text-start flex items-center px-4 py-2.5 text-xs text-foreground hover:bg-muted font-medium transition-colors"
                            >
                                <FiGrid className="me-2.5 text-primary text-sm shrink-0" />
                                <div>
                                    <div className="font-bold">{t('exportXLSX')}</div>
                                    <div className="text-[10px] text-muted-foreground">{t('summarySheet')} + {t('entriesSheet')}</div>
                                </div>
                            </button>
                            <button
                                onClick={() => handleExport('csv')}
                                className="w-full text-start flex items-center px-4 py-2.5 text-xs text-foreground hover:bg-muted font-medium transition-colors"
                            >
                                <FiFileText className="me-2.5 text-primary text-sm shrink-0" /> {t('exportCSV')}
                            </button>
                            <button
                                onClick={() => handleExport('txt')}
                                className="w-full text-start flex items-center px-4 py-2.5 text-xs text-foreground hover:bg-muted font-medium transition-colors"
                            >
                                <FiFileText className="me-2.5 text-primary text-sm shrink-0" /> {t('exportTXT')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Statistics Content Card */}
            <div className="bg-card shadow-lg rounded-2xl border border-card-border p-5 sm:p-7 space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-card-border pb-4">
                    <h1 className="text-xl sm:text-2xl font-extrabold text-card-foreground flex items-center">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary me-3 border border-primary/20 shadow-sm">
                            <FiBarChart2 className="w-5 h-5" />
                        </div>
                        {t('title')}
                    </h1>
                    {roomName && (
                        <span className="text-xs font-bold text-muted-foreground bg-muted px-3 py-1 rounded-full border border-card-border">
                            {roomName}
                        </span>
                    )}
                </div>

                {isLoading ? (
                    <div className="p-16 text-center flex flex-col items-center justify-center gap-3">
                        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                        <p className="text-muted-foreground text-xs font-semibold">{t('loadingStats')}</p>
                    </div>
                ) : !stats ? (
                    <div className="p-16 text-center flex flex-col items-center justify-center gap-2">
                        <FiBarChart2 className="w-10 h-10 text-muted-foreground/40" />
                        <p className="text-muted-foreground text-sm font-medium">{t('noEntriesStats')}</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Metrics Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                            {/* Total Expenses */}
                            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 shadow-sm flex flex-col justify-between">
                                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-between mb-1">
                                    <span>{t('totalExpenses')}</span>
                                    <FiTrendingUp className="w-4 h-4 opacity-75" />
                                </div>
                                <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                                    {formatCurrencyAmount(stats.totalExpenses)}{' '}
                                    <span className="text-xs font-semibold opacity-75">{currency}</span>
                                </div>
                            </div>

                            {/* Total Loans */}
                            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 shadow-sm flex flex-col justify-between">
                                <div className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center justify-between mb-1">
                                    <span>{t('totalLoans')}</span>
                                    <FiDollarSign className="w-4 h-4 opacity-75" />
                                </div>
                                <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 font-mono mt-1">
                                    {formatCurrencyAmount(stats.totalLoans)}{' '}
                                    <span className="text-xs font-semibold opacity-75">{currency}</span>
                                </div>
                            </div>

                            {/* Total Settled */}
                            <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 shadow-sm flex flex-col justify-between">
                                <div className="text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center justify-between mb-1">
                                    <span>{t('totalSettlements')}</span>
                                    <FiRepeat className="w-4 h-4 opacity-75" />
                                </div>
                                <div className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400 font-mono mt-1">
                                    {formatCurrencyAmount(stats.totalSettlements)}{' '}
                                    <span className="text-xs font-semibold opacity-75">{currency}</span>
                                </div>
                            </div>

                            {/* Average per Member */}
                            <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/20 shadow-sm flex flex-col justify-between">
                                <div className="text-xs font-bold text-sky-600 dark:text-sky-400 flex items-center justify-between mb-1">
                                    <span>{t('averageExpense')}</span>
                                    <FiUsers className="w-4 h-4 opacity-75" />
                                </div>
                                <div className="text-xl sm:text-2xl font-black text-sky-600 dark:text-sky-400 font-mono mt-1">
                                    {formatCurrencyAmount(stats.averageExpensePerMember)}{' '}
                                    <span className="text-xs font-semibold opacity-75">{currency}</span>
                                </div>
                            </div>
                        </div>

                        {/* Secondary Highlights (Biggest Expense & Total Entries) */}
                        <div className="flex items-center justify-between flex-wrap gap-3 p-4 rounded-2xl bg-muted/40 border border-card-border">
                            {stats.biggestExpense ? (
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/30 shrink-0">
                                        <FiAward className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                            {t('biggestExpense')}
                                        </div>
                                        <div className="text-sm sm:text-base font-extrabold text-foreground truncate">
                                            <span className="font-mono text-primary">
                                                {formatCurrencyAmount(stats.biggestExpense.amount)} {currency}
                                            </span>
                                            <span className="text-muted-foreground font-normal mx-2">&bull;</span>
                                            <span className="font-semibold text-card-foreground">
                                                {stats.biggestExpense.description}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-xs text-muted-foreground font-medium">
                                    {t('noEntriesStats')}
                                </div>
                            )}

                            <div className="flex items-center gap-2 self-center shrink-0">
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                    {t('totalEntries')}:
                                </span>
                                <span className="px-2.5 py-1 rounded-lg bg-background border border-card-border font-mono font-black text-xs text-foreground shadow-2xs">
                                    {stats.totalEntries}
                                </span>
                            </div>
                        </div>

                        {/* Member Contributions Table */}
                        <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <h2 className="text-base sm:text-lg font-extrabold text-card-foreground flex items-center gap-2">
                                    <FiUsers className="text-primary w-4 h-4" />
                                    {t('memberContributions')}
                                </h2>
                                <span className="text-[11px] text-muted-foreground font-medium">
                                    {Array.from(stats.memberContributions.values()).filter(m => m.isEligible).length} active participants
                                </span>
                            </div>

                            <div className="overflow-x-auto rounded-2xl border border-card-border bg-card shadow-sm">
                                <table className="w-full text-start text-xs sm:text-sm">
                                    <thead>
                                        <tr className="border-b border-card-border bg-muted/50 text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">
                                            <th className="p-3 sm:p-4 text-start">{t('memberHeader')}</th>
                                            <th className="p-3 sm:p-4 text-end">{t('paid')} ({currency})</th>
                                            <th className="p-3 sm:p-4 text-end">{t('owes')} ({currency})</th>
                                            {hasSettlements && (
                                                <th className="p-3 sm:p-4 text-end">{t('settlementsLabel')} ({currency})</th>
                                            )}
                                            <th className="p-3 sm:p-4 text-end">{t('net')} ({currency})</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-card-border/60">
                                        {Array.from(stats.memberContributions.values()).map(data => {
                                            const isSettled = Math.abs(data.net) < 0.01;
                                            const isPositive = data.net >= 0.01;
                                            const isNegative = data.net <= -0.01;

                                            return (
                                                <tr
                                                    key={data.userId}
                                                    className="hover:bg-muted/30 transition-colors"
                                                >
                                                    {/* Member Info */}
                                                    <td className="p-3 sm:p-4">
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 text-primary font-bold flex items-center justify-center text-xs shrink-0">
                                                                {data.username.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="font-bold text-foreground truncate">
                                                                    {data.username}
                                                                </div>
                                                                {!data.isEligible && (
                                                                    <span className="text-[10px] font-semibold text-muted-foreground">
                                                                        {t('observerBadge')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Paid with Visual Bar */}
                                                    <td className="p-3 sm:p-4 text-end font-mono">
                                                        <div className="font-bold text-emerald-600 dark:text-emerald-400">
                                                            {formatCurrencyAmount(data.paid)}
                                                        </div>
                                                        {stats.totalExpenses > 0 && data.paidPercentage > 0 && (
                                                            <div className="flex items-center justify-end gap-1.5 mt-1">
                                                                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden shrink-0">
                                                                    <div
                                                                        className="h-full bg-emerald-500 rounded-full"
                                                                        style={{ width: `${Math.min(data.paidPercentage, 100)}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-[10px] text-muted-foreground font-sans">
                                                                    {data.paidPercentage}%
                                                                </span>
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Owes with Visual Bar */}
                                                    <td className="p-3 sm:p-4 text-end font-mono">
                                                        <div className="font-bold text-rose-600 dark:text-rose-400">
                                                            {formatCurrencyAmount(data.share)}
                                                        </div>
                                                        {stats.totalExpenses > 0 && data.sharePercentage > 0 && (
                                                            <div className="flex items-center justify-end gap-1.5 mt-1">
                                                                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden shrink-0">
                                                                    <div
                                                                        className="h-full bg-rose-500 rounded-full"
                                                                        style={{ width: `${Math.min(data.sharePercentage, 100)}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-[10px] text-muted-foreground font-sans">
                                                                    {data.sharePercentage}%
                                                                </span>
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Settled (if any) */}
                                                    {hasSettlements && (
                                                        <td className="p-3 sm:p-4 text-end font-mono text-muted-foreground">
                                                            {data.settled !== 0 ? (
                                                                <span className={data.settled > 0 ? 'text-purple-600 dark:text-purple-400 font-semibold' : 'text-muted-foreground'}>
                                                                    {data.settled > 0 ? '+' : ''}{formatCurrencyAmount(data.settled)}
                                                                </span>
                                                            ) : (
                                                                '0'
                                                            )}
                                                        </td>
                                                    )}

                                                    {/* Net Balance */}
                                                    <td className="p-3 sm:p-4 text-end">
                                                        {isSettled ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-muted/60 text-muted-foreground border border-card-border shadow-2xs">
                                                                <FiCheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />
                                                                {t('settledBadge')}
                                                            </span>
                                                        ) : (
                                                            <span className={`font-mono font-black text-sm px-2.5 py-1 rounded-xl border shadow-2xs inline-block ${
                                                                isPositive
                                                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                                                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                                            }`}>
                                                                {isPositive ? '+' : ''}{formatCurrencyAmount(data.net)}
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
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