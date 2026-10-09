// src/app/rooms/[roomId]/balance/page.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSync } from '@/components/SyncProvider';
import { getRoomData, Entry, addLocalEntry, saveRoomData, calculateAllMemberBalances, calculatePeerToPeerBalances, PeerBreakdown } from '@/lib/offline-sync';
import { handleApi } from '@/lib/api';
import { useUser } from '@/components/UserProvider';
import { FiChevronDown, FiSearch, FiRotateCcw, FiStar, FiClock, FiDollarSign, FiArrowDownLeft, FiArrowUpRight, FiCheckCircle, FiUsers, FiActivity, FiShare2, FiZap, FiLayers, FiInfo } from 'react-icons/fi';
import { getEntryDetails, getEntryPayerAndParticipantStrings } from '@/lib/entry-formatting';
import ShareEntryModal from '@/components/ShareEntryModal';

interface Member {
    id: number;
    username: string;
    permissions?: { canAdmin?: boolean; canAddEntries?: boolean; canParticipate?: boolean; canView?: boolean };
}

export default function BalanceDetailsPage() {
    const params = useParams<{ roomId: string }>();
    const { roomId } = params;
    const t = useTranslations('Room');
    const { isOnline } = useSync();
    const { user } = useUser();
    const router = useRouter();

    const [entries, setEntries] = useState<Entry[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [currency, setCurrency] = useState('ILS');
    const [roomName, setRoomName] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedMemberId, setExpandedMemberId] = useState<number | null>(null);
    const [perspectiveUserId, setPerspectiveUserId] = useState<number | null>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [shareModalState, setShareModalState] = useState<{
        isOpen: boolean;
        entry: Entry | null;
        peerMember?: Member | null;
        contribution?: number;
        runningP2PBalance?: number;
    }>({
        isOpen: false,
        entry: null,
    });

    // Dashboard features state
    const [viewMode, setViewMode] = useState<'balance' | 'history'>('balance');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'expense' | 'loan' | 'settlement'>('all');
    const [defaultViewSaved, setDefaultViewSaved] = useState(false);
    const [settlementMode, setSettlementMode] = useState<'simplified' | 'direct'>('simplified');

    useEffect(() => {
        const pref = localStorage.getItem(`defaultRoomDashboardView_${roomId}`);
        if (pref && (pref === 'balance' || pref === 'history')) {
            setViewMode(pref);
        }
        const modePref = localStorage.getItem(`roomSettlementMode_${roomId}`);
        if (modePref === 'simplified' || modePref === 'direct') {
            setSettlementMode(modePref);
        }
    }, [roomId]);

    const handleSettlementModeChange = (mode: 'simplified' | 'direct') => {
        setSettlementMode(mode);
        localStorage.setItem(`roomSettlementMode_${roomId}`, mode);
    };

    const handleSetDefaultView = () => {
        localStorage.setItem(`defaultRoomDashboardView_${roomId}`, viewMode);
        setDefaultViewSaved(true);
        setTimeout(() => setDefaultViewSaved(false), 3000);
    };

    const handleQuickReset = () => {
        setSearchQuery('');
        setFilterType('all');
    };

    const activePerspectiveUserId = useMemo(() => {
        if (perspectiveUserId !== null) return perspectiveUserId;
        if (!user?.userId) return 0;
        
        if (members.length > 0) {
            const currentUserMember = members.find(m => m.id === user.userId);
            if (currentUserMember && currentUserMember.permissions?.canParticipate === false) {
                const firstParticipant = members.find(m => m.permissions?.canParticipate !== false);
                return firstParticipant ? firstParticipant.id : user.userId;
            }
        }
        return user.userId;
    }, [perspectiveUserId, user?.userId, members]);

    const otherMembers = useMemo(() => members.filter(m => m.id !== activePerspectiveUserId && m.permissions?.canParticipate !== false), [members, activePerspectiveUserId]);
    const memberMap = useMemo(() => new Map(members.map(m => [m.id, m.username])), [members]);

    const allMemberBalances = useMemo(() => {
        return calculateAllMemberBalances(entries, members as any);
    }, [entries, members]);

    const totalPerspectiveBalance = allMemberBalances[activePerspectiveUserId] ?? 0;

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
            if (localData.currency) setCurrency(localData.currency);
            if (localData.name) setRoomName(localData.name);
        }

        if (isOnline) {
            try {
                const res = await fetch(`/api/rooms/${roomId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    await saveRoomData(roomId, data);
                    setEntries(data.entries);
                    setMembers(data.members);
                    if (data.currency) setCurrency(data.currency);
                    if (data.name) setRoomName(data.name);
                } else if (res.status === 401) {
                    router.push('/');
                }
            } catch (e) {
                console.error("Failed to refresh balance data. Using local data.", e);
            }
        }
        setIsLoading(false);
    }, [roomId, router, isOnline, user]);

    const handleSettleUp = async (payeeId: number, amountToSettle: number, payerId: number) => {
        if (!user || !user.userId) return;

        const finalAmount = amountToSettle;
        const description = t('settleUpDescription') || "Settle up";

        const payerMember = members.find(m => m.id === payerId);
        if (!payerMember) return;

        const optimisticEntry: Entry = {
            id: `temp-${Date.now()}`,
            amount: finalAmount.toFixed(2),
            description,
            created_at: new Date().toISOString(),
            username: payerMember.username,
            user_id: payerId,
            split_with_user_ids: [payeeId],
            payer_shares: [{ userId: payerId, percentage: 100 }],
            beneficiary_shares: [{ userId: payeeId, percentage: 100 }],
            offline_timestamp: Date.now()
        };

        await addLocalEntry(roomId, optimisticEntry);
        await fetchData();

        try {
            await handleApi({
                method: 'POST',
                url: '/api/entries',
                body: { 
                    roomId, 
                    amount: finalAmount, 
                    description, 
                    splitWithUserIds: [payeeId],
                    payerShares: [{ userId: payerId, percentage: 100 }],
                    beneficiaryShares: [{ userId: payeeId, percentage: 100 }],
                    createdAt: optimisticEntry.created_at,
                    clientTempId: optimisticEntry.id
                },
            });
            if (isOnline) {
                fetchData();
            }
        } catch (error) {
            console.error("Failed to add settlement entry:", error);
        }
    };

    useEffect(() => {
        fetchData();
        window.addEventListener('syncdone', fetchData);
        return () => {
            window.removeEventListener('syncdone', fetchData);
        };
    }, [fetchData]);

    const peerToPeerBalances = useMemo(() => {
        if (!user?.userId || !members.length || !entries.length) {
            return new Map<number, PeerBreakdown<Entry>>();
        }

        return calculatePeerToPeerBalances<Entry>(
            entries,
            members as any,
            activePerspectiveUserId,
            { simplifyDebts: settlementMode === 'simplified' }
        );
    }, [entries, members, user?.userId, activePerspectiveUserId, settlementMode]);


    // Filtered history list
    const filteredHistory = useMemo(() => {
        return entries.filter(entry => {
            const matchesSearch = entry.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                entry.username.toLowerCase().includes(searchQuery.toLowerCase());
            if (!matchesSearch) return false;

            const amt = parseFloat(entry.amount);
            if (filterType === 'expense' && amt <= 0) return false;
            if (filterType === 'loan' && amt >= 0) return false;
            if (filterType === 'settlement' && !entry.description.toLowerCase().includes('settle')) return false;
            return true;
        });
    }, [entries, searchQuery, filterType]);

    const activePerspectiveMember = members.find(m => m.id === activePerspectiveUserId);

    const getBalanceText = (balance: number, targetMemberName: string) => {
        const absBalance = Math.abs(balance);
        const isSelf = activePerspectiveUserId === user?.userId;
        const perspectiveName = activePerspectiveMember?.username || t('me');

        if (balance >= 0.5) {
            return {
                text: isSelf
                    ? t('owesYou', { amount: absBalance.toFixed(0), currency })
                    : t('memberOwes', { member: targetMemberName, amount: absBalance.toFixed(0), currency }),
                color: 'text-success bg-success/15 border-success/30'
            };
        }
        if (balance <= -0.5) {
            return {
                text: isSelf
                    ? t('youOwe', { amount: absBalance.toFixed(0), currency })
                    : t('memberOwes', { member: perspectiveName, amount: absBalance.toFixed(0), currency }),
                color: 'text-danger bg-danger/15 border-danger/30'
            };
        }
        return { text: t('settledUp'), color: 'text-muted-foreground bg-muted/50 border-card-border' };
    };

    const handleShareAsPdf = async () => {
        setIsGeneratingPdf(true);
        try {
            const html2pdf = (await import('html2pdf.js')).default;

            const perspectiveName = activePerspectiveMember ? activePerspectiveMember.username : t('me');
            const safeName = perspectiveName.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'perspective';
            const displayRoomName = roomName || t('roomTitle', { code: roomId }) || `Room #${roomId}`;
            const safeRoomIdentifier = (roomName || `room_${roomId}`).replace(/[/\\?%*:|"<>]/g, '_').trim();
            const filenameSafe = `${safeRoomIdentifier}_balance_${safeName}.pdf`;

            const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

            const balColor = (v: number) => v >= 0.5 ? '#16a34a' : v <= -0.5 ? '#dc2626' : '#64748b';
            const balBg = (v: number) => v >= 0.5 ? '#f0fdf4' : v <= -0.5 ? '#fef2f2' : '#f8fafc';
            const balBorder = (v: number) => v >= 0.5 ? '#bbf7d0' : v <= -0.5 ? '#fecaca' : '#e2e8f0';

            // Build summary rows
            const summaryRows = otherMembers.map((member) => {
                const p2pData = peerToPeerBalances.get(member.id);
                const netBalance = p2pData?.netBalance ?? 0;
                const balanceInfo = getBalanceText(netBalance, member.username);
                return `<tr>
                    <td style="padding:12px 16px;font-weight:700;color:#0f172a;font-size:14px;border-right:1px solid #f1f5f9">${esc(member.username)}</td>
                    <td style="padding:12px 16px;font-weight:700;font-size:14px;color:${balColor(netBalance)}">${esc(balanceInfo.text)}</td>
                </tr>`;
            }).join('');

            // Build detail sections
            const detailSections = otherMembers.map((member) => {
                const p2pData = peerToPeerBalances.get(member.id);
                const netBalance = p2pData?.netBalance ?? 0;
                const balanceInfo = getBalanceText(netBalance, member.username);
                const txs = [...(p2pData?.transactions ?? [])].reverse();

                let txRows = '';
                if (txs.length === 0) {
                    txRows = `<div style="padding:16px;text-align:center;color:#64748b;font-size:13px">${esc(t('noMutualTransactions'))}</div>`;
                } else {
                    const rows = txs.map((tx) => {
                        const { payersText, participantsText, isLoanWithoutShares, borrowerText } = getEntryPayerAndParticipantStrings(
                            tx,
                            memberMap,
                            members,
                            null,
                            t
                        );
                        const dt = new Date(tx.created_at || (tx as any).createdAt || Date.now());
                        const dateStr = dt.toLocaleDateString();
                        const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const dateContent = `<div style="font-weight:600;color:#475569">${esc(dateStr)}</div><div style="font-size:11px;color:#94a3b8;margin-top:2px">${esc(timeStr)}</div>`;
                        let paidByContent = '';
                        if (isLoanWithoutShares && borrowerText) {
                            paidByContent = `<div style="font-weight:600">${esc(t('entryLoanTo', { borrower: borrowerText }))}</div><div style="font-size:11px;color:#64748b;margin-top:2px">${esc(t('entryFromGroup'))}</div>`;
                        } else {
                            paidByContent = `<div style="font-weight:600">${esc(payersText)}</div><div style="font-size:11px;color:#64748b;margin-top:2px">${esc(t('entryFor', { participants: participantsText }))}</div>`;
                        }
                        return `<tr style="border-bottom:1px solid #f1f5f9;page-break-inside:avoid;break-inside:avoid">
                            <td style="padding:8px 12px;white-space:nowrap">${dateContent}</td>
                            <td style="padding:8px 12px;font-weight:600;color:#1e293b">${esc(tx.description)}</td>
                            <td style="padding:8px 12px;color:#1e293b">${paidByContent}</td>
                            <td style="padding:8px 12px;text-align:right;font-weight:700;font-family:monospace;color:${balColor(tx.contribution)}">${tx.contribution >= 0.5 ? '+' : ''}${tx.contribution.toFixed(0)} ${esc(currency)}</td>
                            <td style="padding:8px 12px;text-align:right;font-weight:700;font-family:monospace;color:#334155">${tx.runningP2PBalance.toFixed(0)} ${esc(currency)}</td>
                        </tr>`;
                    }).join('');
                    txRows = `<table style="width:100%;border-collapse:collapse;font-size:12px">
                        <thead><tr style="background:#f1f5f9;color:#475569;text-align:left;font-size:11px;text-transform:uppercase">
                            <th style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${esc(t('pdfDate'))}</th>
                            <th style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${esc(t('pdfDescription'))}</th>
                            <th style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${esc(t('pdfPaidBy'))}</th>
                            <th style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right">${esc(t('pdfImpact'))}</th>
                            <th style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right">${esc(t('pdfBalanceAfter'))}</th>
                        </tr></thead>
                        <tbody>${rows}</tbody>
                    </table>`;
                }

                const reallocHtml = (settlementMode === 'simplified' && Math.abs(p2pData?.reallocatedAmount ?? 0) >= 0.5)
                    ? `<div style="font-size:11px;color:#64748b;margin-top:2px;font-weight:600">${esc(t('directMutualBalanceLabel'))}: ${(p2pData?.directNetBalance ?? 0).toFixed(0)} ${esc(currency)} &bull; ${esc(t('reallocatedDebtLabel'))}: ${((p2pData?.reallocatedAmount ?? 0) >= 0 ? '+' : '')}${(p2pData?.reallocatedAmount ?? 0).toFixed(0)} ${esc(currency)}</div>`
                    : '';

                return `<div style="margin-bottom:24px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;page-break-inside:avoid;break-inside:avoid">
                    <div style="background:#f8fafc;padding:12px 16px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center">
                        <div>
                            <div style="font-size:15px;font-weight:700;color:#0f172a">${esc(member.username)}</div>
                            ${reallocHtml}
                        </div>
                        <div style="font-size:13px;font-weight:700;color:${balColor(netBalance)}">${esc(balanceInfo.text)}</div>
                    </div>
                    ${txRows}
                </div>`;
            }).join('');

            const totalBal = totalPerspectiveBalance;
            const nowDt = new Date();
            const genDateStr = nowDt.toLocaleDateString();
            const genTimeStr = nowDt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const generatedAtText = t('pdfGeneratedAt', { date: `${genDateStr}, ${genTimeStr}` });

            const htmlString = `
                <div style="font-family:system-ui,-apple-system,sans-serif;color:#111827;padding:0;box-sizing:border-box">
                    <div style="border-bottom:2px solid #e2e8f0;padding-bottom:18px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center">
                        <div>
                            <h1 style="font-size:22px;font-weight:800;margin:0;color:#0f172a">${esc(t('pdfReportTitle', { name: displayRoomName }))}</h1>
                            <p style="font-size:14px;color:#64748b;margin-top:4px;margin-bottom:0;font-weight:600">${esc(t('pdfPerspectiveHeader', { name: perspectiveName }))}</p>
                            <p style="font-size:12px;color:#94a3b8;margin-top:4px;margin-bottom:0;font-weight:500">${esc(generatedAtText)} &bull; ${esc(settlementMode === 'simplified' ? t('settlementModeSimplified') : t('settlementModeDirect'))}</p>
                        </div>
                        <div style="background:${balBg(totalBal)};border:1px solid ${balBorder(totalBal)};border-radius:12px;padding:10px 16px;text-align:right">
                            <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">${esc(t('perspectiveTotalBalance'))}</div>
                            <div style="font-size:18px;font-weight:900;font-family:monospace;color:${balColor(totalBal)}">${totalBal >= 0.5 ? '+' : ''}${totalBal.toFixed(0)} ${esc(currency)}</div>
                        </div>
                    </div>
                    <div style="margin-bottom:32px">
                        <h2 style="font-size:16px;font-weight:700;color:#1e293b;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.04em">${esc(t('pdfSummaryTitle'))}</h2>
                        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
                            <thead><tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;text-align:left;font-size:12px;color:#475569">
                                <th style="padding:10px 16px;border-right:1px solid #e2e8f0">${esc(t('memberHeader'))}</th>
                                <th style="padding:10px 16px">${esc(t('balanceTitle'))}</th>
                            </tr></thead>
                            <tbody>${summaryRows || `<tr><td colspan="2" style="padding:16px;text-align:center;color:#64748b;font-size:13px">${esc(t('noOtherMembers'))}</td></tr>`}</tbody>
                        </table>
                    </div>
                    <div>
                        <h2 style="font-size:16px;font-weight:700;color:#1e293b;margin-bottom:16px;text-transform:uppercase;letter-spacing:0.04em">${esc(t('pdfDetailsTitle'))}</h2>
                        ${detailSections}
                    </div>
                </div>`;

            const opt: any = {
                margin: [10, 10, 10, 10] as [number, number, number, number],
                filename: filenameSafe,
                image: { type: 'jpeg', quality: 0.95 },
                html2canvas: { scale: 2, useCORS: true, logging: false },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
                pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
            };

            await html2pdf().set(opt).from(htmlString, 'string').save();
        } catch (error: any) {
            if (error?.name !== 'AbortError') {
                console.error('Failed to generate PDF:', error);
            }
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto animate-scaleIn flex flex-col h-full space-y-4">
            <div className="shrink-0 flex items-center justify-between flex-wrap gap-2">
                <button onClick={() => router.back()} className="font-extrabold py-2.5 px-5 rounded-xl btn-primary text-xs sm:text-sm border-2 border-white/40 dark:border-white/60 shadow-md transition-all active:scale-95">
                    {t('backToRoom')}
                </button>

                {/* View Switcher & Default Saver */}
                <div className="flex items-center gap-2" style={{ display: 'none' }}>
                    <div className="bg-card p-1 rounded-xl border border-card-border shadow-sm flex items-center" style={{ display: 'none' }}>
                        <button
                            onClick={() => setViewMode('balance')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                viewMode === 'balance' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                            }`}
                            style={{ display: 'none' }}
                        >
                            <FiDollarSign /> {t('balanceBreakdown')}
                        </button>
                        <button
                            onClick={() => setViewMode('history')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                viewMode === 'history' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                            }`}
                            style={{ display: 'none' }}
                        >
                            <FiClock /> {t('activityHistoryTab')}
                        </button>
                    </div>

                    <button
                        onClick={handleSetDefaultView}
                        className="p-2 text-muted-foreground hover:text-amber-400 bg-card border border-card-border rounded-xl shadow-sm transition-colors"
                        style={{ display: 'none' }}
                        title={t('setDefaultViewTitle')}
                    >
                        <FiStar className={defaultViewSaved ? 'fill-amber-400 text-amber-400' : ''} />
                    </button>
                </div>
            </div>

            {defaultViewSaved && (
                <div className="p-3 text-xs font-extrabold bg-success/20 text-success border-2 border-success/40 rounded-xl text-center shadow-md animate-fadeIn">
                    {t('defaultViewSavedMsg')}
                </div>
            )}

            {/* Dynamic Filter Bar */}
            <div className="bg-card p-3 sm:p-3.5 rounded-2xl border-2 border-card-border/80 dark:border-white/30 shadow-md flex items-center justify-between gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <FiSearch className="absolute left-3.5 top-3 text-foreground/70 dark:text-zinc-300 text-sm" />
                    <input
                        type="text"
                        placeholder={t('searchFilterPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full themed-input pl-9 pr-3 py-2 text-xs sm:text-sm font-bold rounded-xl border-2 border-card-border/80 dark:border-white/30 bg-background transition-all focus:ring-2 focus:ring-primary"
                    />
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                    <div className="hidden items-center gap-1.5 flex-wrap">
                        {(['all', 'expense', 'loan', 'settlement'] as const).map(type => (
                            <button
                                key={type}
                                onClick={() => setFilterType(type)}
                                className={`text-[11px] px-3 py-1.5 rounded-xl uppercase font-extrabold tracking-wider transition-all border-2 ${
                                    filterType === type ? 'bg-primary/20 text-primary border-primary/50 shadow-sm' : 'bg-background hover:bg-muted text-muted-foreground border-card-border'
                                }`}
                            >
                                {type === 'all' ? t('filterAll') : (type === 'expense' ? t('filterExpense') : (type === 'loan' ? t('filterLoan') : t('filterSettlement')))}
                            </button>
                        ))}
                    </div>

                    {(searchQuery || filterType !== 'all') && (
                        <button
                            onClick={handleQuickReset}
                            className="p-2 px-3 text-xs text-foreground dark:text-zinc-200 hover:text-foreground bg-muted hover:bg-muted/80 rounded-xl flex items-center gap-1.5 ml-1 font-bold border border-card-border/80 dark:border-white/20 transition-colors shadow-sm"
                            title={t('quickResetFiltersTitle')}
                        >
                            <FiRotateCcw /> <span className="hidden sm:inline">{t('resetFilters')}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Content Container */}
            <div className="bg-card shadow-2xl rounded-2xl border-2 border-card-border dark:border-white shadow-[0_0_25px_rgba(255,255,255,0.06)] flex flex-col flex-grow overflow-hidden max-h-[75vh]">
                <div className="p-4 sm:p-5 border-b-2 border-card-border dark:border-white/20 bg-muted/40 shrink-0 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-primary/15 text-primary border-2 border-primary/30 shadow-sm shrink-0">
                            {viewMode === 'balance' ? <FiUsers className="w-5 h-5" /> : <FiActivity className="w-5 h-5" />}
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-extrabold font-heading text-card-foreground dark:text-white uppercase tracking-wide">
                                {viewMode === 'balance' ? t('peerBalancesTitle') : `${t('activityHistoryTab')} (${filteredHistory.length})`}
                            </h1>
                        </div>
                    </div>
                    {viewMode === 'balance' && (
                        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                            {members.length > 1 && (
                                <div className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-xl border-2 border-card-border/80 dark:border-white/30 shadow-sm">
                                    <span className="text-[11px] text-foreground dark:text-zinc-300 font-extrabold uppercase tracking-wider shrink-0">{t('perspectiveLabel')}:</span>
                                    <select
                                        value={activePerspectiveUserId.toString()}
                                        onChange={(e) => setPerspectiveUserId(parseInt(e.target.value))}
                                        className="text-xs sm:text-sm font-extrabold bg-transparent text-foreground cursor-pointer focus:outline-none border-none pr-1"
                                    >
                                        {members.filter(m => m.permissions?.canParticipate !== false).map(m => (
                                            <option key={m.id} value={m.id.toString()} className="bg-card text-foreground font-semibold">
                                                {m.username} {m.id === user?.userId ? `(${t('me')})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="flex items-center p-0.5 bg-background rounded-xl border border-card-border shadow-xs shrink-0 text-xs font-bold">
                                <button
                                    onClick={() => handleSettlementModeChange('simplified')}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all text-xs font-semibold ${
                                        settlementMode === 'simplified'
                                            ? 'bg-primary text-primary-foreground shadow-xs'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                    title={t('simplifiedModeTooltip')}
                                >
                                    <FiZap className="w-3.5 h-3.5 shrink-0" />
                                    <span>{t('settlementModeSimplified')}</span>
                                </button>
                                <button
                                    onClick={() => handleSettlementModeChange('direct')}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all text-xs font-semibold ${
                                        settlementMode === 'direct'
                                            ? 'bg-primary text-primary-foreground shadow-xs'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                    title={t('directModeTooltip')}
                                >
                                    <FiLayers className="w-3.5 h-3.5 shrink-0" />
                                    <span>{t('settlementModeDirect')}</span>
                                </button>
                            </div>
                            <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border-2 font-black text-xs sm:text-sm shadow-md transition-all ${
                                totalPerspectiveBalance >= 0.5
                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/60 dark:border-emerald-400'
                                    : totalPerspectiveBalance <= -0.5
                                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/60 dark:border-rose-400'
                                    : 'bg-muted text-foreground border-card-border/80 dark:border-white/30'
                            }`}>
                                <span className="text-[11px] uppercase tracking-wider font-extrabold">{t('perspectiveTotalBalance') || t('balanceTitle')}:</span>
                                <span className="text-xs sm:text-sm font-black font-mono">
                                    {totalPerspectiveBalance >= 0.5 ? '+' : ''}{totalPerspectiveBalance.toFixed(0)} {currency}
                                </span>
                            </div>
                            <button
                                onClick={handleShareAsPdf}
                                disabled={isGeneratingPdf}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary font-extrabold text-xs shadow-sm transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                                title={t('shareAsPdf')}
                            >
                                {isGeneratingPdf ? (
                                    <>
                                        <div className="w-3.5 h-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
                                        <span className="hidden sm:inline">{t('generatingPdf')}</span>
                                    </>
                                ) : (
                                    <>
                                        <FiShare2 className="w-3.5 h-3.5 shrink-0" />
                                        <span>{t('shareAsPdf')}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>

                <div className="overflow-y-auto flex-grow">
                    {isLoading ? (
                        <div className="p-16 text-center flex flex-col items-center justify-center gap-3">
                            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                            <p className="text-foreground/80 dark:text-zinc-300 text-sm font-bold">{t('loadingData')}</p>
                        </div>
                    ) : viewMode === 'balance' ? (
                        /* BALANCE TAB */
                        otherMembers.length === 0 ? (
                            <div className="p-16 text-center flex flex-col items-center justify-center gap-2">
                                <FiUsers className="w-8 h-8 text-muted-foreground/40" />
                                <p className="text-foreground/80 dark:text-zinc-300 text-sm font-bold">{t('noOtherMembers')}</p>
                            </div>
                        ) : (
                            <ul className="divide-y-2 divide-card-border/80 dark:divide-white/15">
                                {otherMembers.map((member) => {
                                    const p2pData = peerToPeerBalances.get(member.id);
                                    const netBalance = p2pData?.netBalance ?? 0;
                                    const balanceInfo = getBalanceText(netBalance, member.username);
                                    const isExpanded = expandedMemberId === member.id;

                                    return (
                                        <li key={member.id} className="transition-colors animate-fadeIn">
                                            <button 
                                                onClick={() => setExpandedMemberId(isExpanded ? null : member.id)}
                                                className={`w-full text-left p-4 sm:p-5 flex justify-between items-center transition-all ${
                                                    isExpanded ? 'bg-muted/50' : 'hover:bg-muted/30'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3.5 min-w-0 pr-2">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/25 to-primary/10 border-2 border-primary/40 flex items-center justify-center font-black text-primary text-base shadow-sm shrink-0">
                                                        {member.username.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <span className="font-extrabold text-card-foreground dark:text-white text-base sm:text-lg tracking-tight block truncate">
                                                            {member.username}
                                                        </span>
                                                        {member.permissions?.canAdmin && (
                                                            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Admin</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2.5 shrink-0">
                                                    <span className={`text-xs sm:text-sm font-black px-3.5 py-1 rounded-full border-2 shadow-md ${balanceInfo.color}`}>
                                                        {balanceInfo.text}
                                                    </span>
                                                    <div className={`p-1.5 rounded-full bg-muted text-foreground transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-primary/20 text-primary' : ''}`}>
                                                        <FiChevronDown className="w-4 h-4" />
                                                    </div>
                                                </div>
                                            </button>
                                            {isExpanded && (
                                                <div className="bg-background/95 px-4 sm:px-6 pt-3 pb-6 animate-fadeIn border-t-2 border-card-border/80 dark:border-white/20">
                                                    {netBalance <= -0.5 && members.find(m => m.id === user?.userId)?.permissions?.canAddEntries !== false && (
                                                        <div className="mt-2.5 mb-3 py-2.5 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b-2 border-card-border/60 dark:border-white/15">
                                                            <div className="flex items-center gap-2 min-w-0 text-xs sm:text-sm">
                                                                <span className="font-extrabold text-foreground dark:text-white shrink-0">{t('outstandingDebtTitle')}</span>
                                                                <span className="text-muted-foreground hidden sm:inline">&bull;</span>
                                                                <span className="text-foreground/80 dark:text-zinc-300 truncate font-semibold">{t('outstandingDebtSubtitle', { member: member.username })}</span>
                                                            </div>
                                                            <button 
                                                                onClick={() => handleSettleUp(member.id, Math.abs(netBalance), activePerspectiveUserId)}
                                                                className="self-start sm:self-center py-2 px-3.5 rounded-xl border-2 border-card-border/80 dark:border-white/30 bg-card hover:bg-muted text-foreground font-extrabold text-xs transition-all shadow-sm active:scale-95 flex items-center gap-1.5 shrink-0"
                                                            >
                                                                <FiCheckCircle className="w-4 h-4 text-success shrink-0" />
                                                                <span>{t('settleUpBtn', { amount: Math.abs(netBalance).toFixed(0), currency })}</span>
                                                            </button>
                                                        </div>
                                                    )}
                                                    {settlementMode === 'simplified' && Math.abs(p2pData?.reallocatedAmount ?? 0) >= 0.5 && (
                                                        <div className="mt-2.5 mb-3 p-3.5 rounded-xl bg-primary/10 border-2 border-primary/30 text-xs shadow-xs">
                                                            <div className="flex items-center justify-between font-extrabold text-foreground mb-1.5">
                                                                <span className="flex items-center gap-1.5 text-primary">
                                                                    <FiInfo className="w-4 h-4 shrink-0" />
                                                                    {t('settlementBreakdownTitle')}
                                                                </span>
                                                                <span className="font-mono text-primary font-black text-sm">
                                                                    {netBalance >= 0.5 ? '+' : netBalance <= -0.5 ? '-' : ''}{Math.abs(netBalance).toFixed(0)} {currency}
                                                                </span>
                                                            </div>
                                                            <div className="space-y-1.5 text-foreground/80 dark:text-zinc-300 text-xs font-semibold">
                                                                <div className="flex items-center justify-between">
                                                                    <span>{t('directMutualBalanceLabel')}:</span>
                                                                    <span className="font-mono font-bold text-foreground dark:text-white">
                                                                        {(p2pData?.directNetBalance ?? 0) >= 0.5 ? '+' : ''}{(p2pData?.directNetBalance ?? 0).toFixed(0)} {currency}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center justify-between">
                                                                    <span>{t('reallocatedDebtLabel')}:</span>
                                                                    <span className="font-mono font-bold text-foreground dark:text-white">
                                                                        {(p2pData?.reallocatedAmount ?? 0) >= 0.5 ? '+' : ''}{(p2pData?.reallocatedAmount ?? 0).toFixed(0)} {currency}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {settlementMode === 'simplified' && Math.abs(netBalance) < 0.5 && Math.abs(p2pData?.directNetBalance ?? 0) >= 0.5 && (
                                                        <div className="mt-2.5 mb-3 p-3.5 rounded-xl bg-muted/80 border-2 border-card-border/80 dark:border-white/20 text-xs text-foreground/80 dark:text-zinc-200 flex items-start gap-2.5 shadow-xs">
                                                            <FiInfo className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                                            <p className="text-xs leading-relaxed font-semibold">
                                                                {t('debtTransferredNotice', {
                                                                    amount: Math.abs(p2pData?.directNetBalance ?? 0).toFixed(0),
                                                                    currency,
                                                                    direction: (p2pData?.directNetBalance ?? 0) < 0 ? t('youOweDirection') : t('owesYouDirection')
                                                                })}
                                                            </p>
                                                        </div>
                                                    )}
                                                    {p2pData?.transactions && p2pData.transactions.length > 0 ? (
                                                        <div className="mt-3.5 space-y-2">
                                                            <div className="flex items-center justify-between text-xs font-extrabold text-foreground dark:text-zinc-300 uppercase tracking-wider px-1 pb-1">
                                                                <span className="flex items-center gap-1.5">
                                                                    <FiClock className="w-4 h-4" /> {t('mutualActivityLog')}
                                                                </span>
                                                                <span>{t('netImpactLabel')} / {t('totalAfterHeader')}</span>
                                                            </div>
                                                            <div className="divide-y-2 divide-card-border/80 dark:divide-white/15 bg-card rounded-2xl border-2 border-card-border/80 dark:border-white/20 overflow-hidden shadow-md">
                                                                {p2pData.transactions.map((tx, index) => {
                                                                    const isPositive = tx.contribution >= 0;
                                                                    return (
                                                                        <div key={`${tx.id}-${index}`} className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-muted/40 transition-colors">
                                                                            <div className="flex items-center gap-3 min-w-0">
                                                                                <div className={`p-2 rounded-xl shrink-0 ${
                                                                                    isPositive ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'
                                                                                }`}>
                                                                                    {isPositive ? <FiArrowDownLeft className="w-4 h-4" /> : <FiArrowUpRight className="w-4 h-4" />}
                                                                                </div>
                                                                                <div className="min-w-0">
                                                                                    <p className="font-extrabold text-foreground dark:text-white text-sm sm:text-base truncate">{tx.description}</p>
                                                                                    <div className="text-xs sm:text-sm text-foreground/80 dark:text-zinc-300 font-medium flex items-center flex-wrap gap-1 mt-0.5">
                                                                                        {getEntryDetails(tx, memberMap, members, user, t)}
                                                                                    </div>
                                                                                    <p className="text-xs text-muted-foreground dark:text-zinc-400 flex items-center flex-wrap gap-y-1 mt-1 font-semibold">
                                                                                        {(tx.pending_sync || tx.offline_timestamp || typeof tx.id === 'string') && (
                                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black bg-amber-500/20 text-amber-500 border border-amber-500/40 rounded-full me-1.5 shrink-0">
                                                                                                <FiClock className="w-3 h-3" /> {t('unsynchronized')}
                                                                                            </span>
                                                                                        )}
                                                                                        <span>{t('byAuthor', { author: tx.username })} &bull; {new Date(tx.created_at).toLocaleString()}</span>
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                                                                <div className="text-right flex flex-col items-end justify-center gap-1">
                                                                                    <span className={`text-xs sm:text-sm font-black font-mono px-2.5 py-1 rounded-lg border-2 ${
                                                                                        isPositive ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/40' : 'text-rose-400 bg-rose-500/15 border-rose-500/40'
                                                                                    }`}>
                                                                                        {isPositive ? '+' : ''}{tx.contribution.toFixed(0)} {currency}
                                                                                    </span>
                                                                                    <div className="text-xs font-semibold font-mono flex items-center justify-end gap-1 px-1">
                                                                                        <span className="text-muted-foreground dark:text-zinc-400 text-[11px] uppercase font-sans font-bold">{t('totalAfterLog')}</span>
                                                                                        <span className={`font-black ${
                                                                                            tx.runningP2PBalance >= 0.5 
                                                                                                ? 'text-emerald-400' 
                                                                                                : tx.runningP2PBalance <= -0.5 
                                                                                                    ? 'text-rose-400' 
                                                                                                    : 'text-muted-foreground'
                                                                                        }`}>
                                                                                            {tx.runningP2PBalance >= 0.5 ? '+' : ''}{tx.runningP2PBalance.toFixed(0)} {currency}
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                                <button
                                                                                    onClick={() => setShareModalState({
                                                                                        isOpen: true,
                                                                                        entry: tx,
                                                                                        peerMember: member,
                                                                                        contribution: tx.contribution,
                                                                                        runningP2PBalance: tx.runningP2PBalance,
                                                                                    })}
                                                                                    className="p-2 rounded-lg text-foreground dark:text-zinc-200 hover:text-primary hover:bg-primary/20 transition-colors shrink-0"
                                                                                    title={t('shareEntry')}
                                                                                >
                                                                                    <FiShare2 className="w-4 h-4" />
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="py-8 text-center bg-card rounded-2xl border-2 border-dashed border-card-border/80 dark:border-white/20 mt-3">
                                                            <p className="text-xs text-muted-foreground italic font-semibold">{t('noMutualTransactions')}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )
                    ) : (
                        /* HISTORY TAB */
                        filteredHistory.length === 0 ? (
                            <div className="p-16 text-center flex flex-col items-center justify-center gap-2">
                                <FiClock className="w-8 h-8 text-muted-foreground/40" />
                                <p className="text-muted-foreground text-xs font-medium">{t('noFilteredHistory')}</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-card-border/60">
                                {filteredHistory.map(entry => {
                                    const amt = parseFloat(entry.amount);
                                    const isNegative = amt < 0;
                                    return (
                                        <li key={entry.id} className="p-4 sm:p-5 flex justify-between items-center hover:bg-muted/30 transition-colors gap-3">
                                            <div className="flex items-center gap-3.5 min-w-0">
                                                <div className={`p-2.5 rounded-xl shrink-0 ${
                                                    isNegative ? 'bg-danger/15 text-danger' : 'bg-success/15 text-success'
                                                }`}>
                                                    {isNegative ? <FiArrowUpRight className="w-4 h-4" /> : <FiArrowDownLeft className="w-4 h-4" />}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-foreground text-xs sm:text-sm truncate">{entry.description}</p>
                                                    <div className="text-[11px] text-muted-foreground italic flex items-center flex-wrap gap-1 mt-0.5">
                                                        {getEntryDetails(entry, memberMap, members, user, t)}
                                                    </div>
                                                    <p className="text-muted-foreground text-[11px] mt-1 flex items-center flex-wrap gap-y-1">
                                                        {(entry.pending_sync || entry.offline_timestamp || typeof entry.id === 'string') && (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30 rounded-full me-1.5 shrink-0">
                                                                <FiClock className="w-2.5 h-2.5" /> {t('unsynchronized')}
                                                            </span>
                                                        )}
                                                        <span>{t('byAuthor', { author: entry.username })} &bull; {new Date(entry.created_at).toLocaleString()}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                                <div className={`text-xs sm:text-sm font-bold font-mono px-2.5 py-1 rounded-lg ${
                                                    isNegative ? 'text-danger bg-danger/10' : 'text-success bg-success/10'
                                                }`}>
                                                    {isNegative ? '' : '+'}{amt.toFixed(0)} {currency}
                                                </div>
                                                <button
                                                    onClick={() => setShareModalState({
                                                        isOpen: true,
                                                        entry: entry,
                                                    })}
                                                    className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
                                                    title={t('shareEntry')}
                                                >
                                                    <FiShare2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                                </button>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )
                    )}
                </div>
            </div>

            <ShareEntryModal
                isOpen={shareModalState.isOpen}
                onClose={() => setShareModalState({ isOpen: false, entry: null })}
                entry={shareModalState.entry}
                currency={currency}
                members={members}
                currentUserId={user?.userId}
                roomName={roomName}
                roomId={roomId}
                peerMember={shareModalState.peerMember}
                contribution={shareModalState.contribution}
                runningP2PBalance={shareModalState.runningP2PBalance}
                perspectiveMemberName={activePerspectiveMember?.username}
            />
        </div>
    );
}
