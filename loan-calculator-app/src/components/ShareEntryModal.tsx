// src/components/ShareEntryModal.tsx
'use client';

import React, { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FiX, FiShare2, FiCopy, FiCheck, FiDownload } from 'react-icons/fi';
import { Entry } from '@/lib/offline-sync';

interface Member {
    id: number;
    username: string;
    permissions?: { canAdmin?: boolean; canAddEntries?: boolean; canParticipate?: boolean; canView?: boolean };
}

interface ShareEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    entry: Entry | null;
    currency: string;
    members: Member[];
    currentUserId?: number | null;
    roomName?: string | null;
    roomId?: string | null;
    // Optional mutual settlement / peer-to-peer context
    peerMember?: Member | null;
    contribution?: number;
    runningP2PBalance?: number;
    perspectiveMemberName?: string;
    // Optional user running room balance
    userRunningBalance?: number;
}

export default function ShareEntryModal({
    isOpen,
    onClose,
    entry,
    currency,
    members,
    currentUserId,
    roomName,
    roomId,
    peerMember,
    contribution,
    runningP2PBalance,
    perspectiveMemberName,
    userRunningBalance,
}: ShareEntryModalProps) {
    const t = useTranslations('Room');
    const cardRef = useRef<HTMLDivElement>(null);

    const [isGenerating, setIsGenerating] = useState(false);
    const [copied, setCopied] = useState(false);

    if (!isOpen || !entry) return null;

    const memberMap = new Map(members.map(m => [m.id, m.username]));
    const calcMembers = members.filter(m => m.permissions?.canParticipate !== false);
    const amount = parseFloat(entry.amount);
    const absAmount = Math.abs(amount);

    // Determine entry type
    const isLoanWithoutShares = amount < 0 && (!entry.payer_shares || entry.payer_shares.length === 0) && (!entry.beneficiary_shares || entry.beneficiary_shares.length === 0);
    const isSettlement = entry.description.toLowerCase().includes('settle') || entry.description.toLowerCase().includes('расчет');
    const isLoan = amount < 0;

    let typeBadgeLabel = t('entryTypeExpense');
    let typeBadgeBg = '#065f46'; // dark emerald
    let typeBadgeColor = '#34d399';
    let typeBadgeBorder = '#059669';

    if (isSettlement) {
        typeBadgeLabel = t('entryTypeSettlement');
        typeBadgeBg = '#581c87'; // dark purple
        typeBadgeColor = '#c084fc';
        typeBadgeBorder = '#7e22ce';
    } else if (isLoan) {
        typeBadgeLabel = t('entryTypeLoan');
        typeBadgeBg = '#78350f'; // dark amber
        typeBadgeColor = '#fbbf24';
        typeBadgeBorder = '#d97706';
    }

    // Format date & time
    const dt = new Date(entry.created_at || (entry as any).createdAt || Date.now());
    const dateStr = dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Format percentages helper
    const formatPct = (pct: number) => (Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`);

    // Payers Breakdown
    interface SharePerson {
        name: string;
        percentage?: string;
        amount: number;
        isYou?: boolean;
    }

    const payers: SharePerson[] = [];
    if (entry.payer_shares && Array.isArray(entry.payer_shares) && entry.payer_shares.length > 0) {
        entry.payer_shares.forEach(p => {
            const isYou = p.userId === currentUserId;
            const name = memberMap.get(p.userId) || `ID:${p.userId}`;
            payers.push({
                name: isYou ? `${name} (${t('me')})` : name,
                percentage: formatPct(Number(p.percentage)),
                amount: absAmount * (Number(p.percentage) / 100),
                isYou,
            });
        });
    } else {
        const isYou = entry.user_id === currentUserId;
        const name = memberMap.get(entry.user_id) || entry.username;
        payers.push({
            name: isYou ? `${name} (${t('me')})` : name,
            percentage: '100%',
            amount: absAmount,
            isYou,
        });
    }

    // Beneficiaries Breakdown
    const beneficiaries: SharePerson[] = [];
    if (entry.beneficiary_shares && Array.isArray(entry.beneficiary_shares) && entry.beneficiary_shares.length > 0) {
        entry.beneficiary_shares.forEach(b => {
            const isYou = b.userId === currentUserId;
            const name = memberMap.get(b.userId) || `ID:${b.userId}`;
            beneficiaries.push({
                name: isYou ? `${name} (${t('me')})` : name,
                percentage: formatPct(Number(b.percentage)),
                amount: absAmount * (Number(b.percentage) / 100),
                isYou,
            });
        });
    } else if (isLoanWithoutShares) {
        // Loan without explicit shares
        const borrowerName = memberMap.get(entry.user_id) || entry.username;
        const isYou = entry.user_id === currentUserId;
        beneficiaries.push({
            name: isYou ? `${borrowerName} (${t('me')})` : borrowerName,
            percentage: '100%',
            amount: absAmount,
            isYou,
        });
    } else {
        const participants = entry.split_with_user_ids && entry.split_with_user_ids.length > 0
            ? entry.split_with_user_ids
            : calcMembers.map(m => m.id);
        const count = participants.length || 1;
        const pct = 100 / count;
        const shareAmount = absAmount / count;

        participants.forEach(pId => {
            const isYou = pId === currentUserId;
            const name = memberMap.get(pId) || `ID:${pId}`;
            beneficiaries.push({
                name: isYou ? `${name} (${t('me')})` : name,
                percentage: formatPct(pct),
                amount: shareAmount,
                isYou,
            });
        });
    }

    // Author details
    const authorName = entry.username || memberMap.get(entry.user_id) || 'Unknown';
    const showProxy = entry.created_by_user_id && entry.created_by_user_id !== entry.user_id;
    const recorderName = entry.created_by_user_id ? (memberMap.get(entry.created_by_user_id) || `User #${entry.created_by_user_id}`) : null;

    // Room display title
    const displayRoom = roomName || (roomId ? `${t('roomCodeLabel', { code: roomId })}` : 'Room');

    // Filename safe
    const safeDesc = (entry.description || 'entry').replace(/[/\\?%*:|"<>]/g, '_').substring(0, 30).trim();
    const filename = `${safeDesc}_receipt`;

    // Canvas capture function
    const captureCanvas = async (): Promise<Blob | null> => {
        if (!cardRef.current) return null;
        const html2canvas = (await import('html2canvas')).default;
        const el = cardRef.current;

        const canvas = await html2canvas(el, {
            scale: 2, // High DPI / Retina
            useCORS: true,
            backgroundColor: '#0f172a',
            logging: false,
            onclone: (clonedDoc: Document) => {
                // Ensure no active CSS animations or transforms skew bounds in cloned iframe
                const allElements = clonedDoc.querySelectorAll('*');
                allElements.forEach((node: any) => {
                    if (node.style) {
                        node.style.animation = 'none';
                        node.style.transition = 'none';
                    }
                });
            },
        } as any);

        return new Promise(resolve => {
            canvas.toBlob(blob => resolve(blob), 'image/png');
        });
    };

    const downloadBlob = (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleNativeShare = async () => {
        setIsGenerating(true);
        try {
            const blob = await captureCanvas();
            if (!blob) return;

            const file = new File([blob], `${filename}.png`, { type: 'image/png' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: entry.description,
                    text: `${entry.description} • ${absAmount.toFixed(0)} ${currency}`,
                });
            } else {
                downloadBlob(blob);
            }
        } catch (err: any) {
            if (err?.name !== 'AbortError') {
                console.error('Share failed:', err);
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopyImage = async () => {
        setIsGenerating(true);
        try {
            const blob = await captureCanvas();
            if (!blob) return;

            if (navigator.clipboard && typeof window.ClipboardItem !== 'undefined') {
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
            } else {
                downloadBlob(blob);
            }
        } catch (err) {
            console.error('Failed to copy image to clipboard:', err);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = async () => {
        setIsGenerating(true);
        try {
            const blob = await captureCanvas();
            if (!blob) return;
            downloadBlob(blob);
        } catch (err) {
            console.error('Download failed:', err);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
            role="dialog"
            aria-modal="true"
        >
            <div className="bg-card border border-card-border rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden max-h-[92vh]">
                {/* Modal Header */}
                <div className="p-4 sm:px-6 border-b border-card-border flex items-center justify-between shrink-0 bg-card">
                    <div className="flex items-center gap-2">
                        <FiShare2 className="w-5 h-5 text-primary" />
                        <h2 className="text-base sm:text-lg font-bold text-card-foreground">
                            {t('shareModalTitle')}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-card-foreground hover:bg-muted/60 transition-colors"
                        aria-label="Close"
                    >
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                {/* Preview Container - items-start prevents card height stretching */}
                <div className="overflow-y-auto p-4 sm:p-6 flex justify-center items-start bg-background/50">
                    {/* The Card Element to be converted to PNG */}
                    <div
                        ref={cardRef}
                        style={{
                            width: '520px',
                            maxWidth: '100%',
                            backgroundColor: '#0f172a',
                            color: '#f8fafc',
                            borderRadius: '16px',
                            border: '1px solid #334155',
                            padding: '24px',
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                            boxSizing: 'border-box',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
                        }}
                    >
                        {/* Card Header: Room & Operation Badge */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '16px', marginBottom: '16px' }}>
                            <div>
                                <div style={{ fontSize: '15px', fontWeight: 800, color: '#38bdf8', letterSpacing: '-0.01em', lineHeight: '1.4' }}>
                                    {displayRoom}
                                </div>
                                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', fontWeight: 500, lineHeight: '1.4' }}>
                                    {dateStr} • {timeStr}
                                </div>
                            </div>
                            <span
                                style={{
                                    display: 'inline-block',
                                    fontSize: '11px',
                                    fontWeight: 800,
                                    letterSpacing: '0.06em',
                                    textTransform: 'uppercase',
                                    padding: '5px 12px',
                                    borderRadius: '9999px',
                                    backgroundColor: typeBadgeBg,
                                    color: typeBadgeColor,
                                    border: `1px solid ${typeBadgeBorder}`,
                                    lineHeight: '14px',
                                    verticalAlign: 'middle',
                                }}
                            >
                                {typeBadgeLabel}
                            </span>
                        </div>

                        {/* Hero Section: Description & Main Amount */}
                        <div style={{ paddingBottom: '16px', marginBottom: '16px', borderBottom: '1px solid #1e293b' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1, minWidth: 0, paddingRight: '16px' }}>
                                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', lineHeight: '1.4', wordBreak: 'break-word' }}>
                                        {entry.description}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px', lineHeight: '1.4' }}>
                                        {t('recordedByLabel')}: <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{authorName}</span>
                                        {showProxy && recorderName && (
                                            <span style={{ color: '#c084fc', marginLeft: '6px' }}>
                                                ({t('loggedOnBehalfBy', { name: recorderName })})
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <div style={{ fontSize: '22px', fontWeight: 800, color: isLoan ? '#f87171' : '#4ade80', lineHeight: '1.4', whiteSpace: 'nowrap' }}>
                                        {absAmount.toFixed(0)} {currency}
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginTop: '3px', letterSpacing: '0.04em', lineHeight: '1.4' }}>
                                        {t('totalAmountLabel')}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Payers & Beneficiaries Breakdown */}
                        <div style={{ marginBottom: '16px' }}>
                            {/* Who Paid */}
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                                    {t('whoPaidLabel')}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    {payers.map((p, idx) => (
                                        <div
                                            key={idx}
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                backgroundColor: '#1e293b',
                                                padding: '10px 12px',
                                                borderRadius: '8px',
                                                border: '1px solid #334155',
                                                marginBottom: idx === payers.length - 1 ? '0' : '6px',
                                                boxSizing: 'border-box',
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'baseline', minWidth: 0 }}>
                                                <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '13px', lineHeight: '1.6' }}>{p.name}</span>
                                                {p.percentage && (
                                                    <span style={{
                                                        display: 'inline-block',
                                                        fontSize: '10px',
                                                        lineHeight: '14px',
                                                        color: '#94a3b8',
                                                        backgroundColor: '#0f172a',
                                                        padding: '2px 6px',
                                                        borderRadius: '4px',
                                                        border: '1px solid #334155',
                                                        marginLeft: '8px',
                                                        verticalAlign: 'middle',
                                                    }}>
                                                        {p.percentage}
                                                    </span>
                                                )}
                                            </div>
                                            <span style={{ fontWeight: 700, color: '#4ade80', fontSize: '13px', lineHeight: '1.6', marginLeft: '8px', flexShrink: 0 }}>
                                                {p.amount.toFixed(0)} {currency}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Split Between */}
                            <div>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                                    {t('splitBetweenLabel')}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                                    {beneficiaries.map((b, idx) => (
                                        <div
                                            key={idx}
                                            style={{
                                                width: beneficiaries.length > 2 ? '48.5%' : '100%',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                backgroundColor: '#1e293b',
                                                padding: '10px 12px',
                                                borderRadius: '8px',
                                                border: '1px solid #334155',
                                                marginBottom: '8px',
                                                boxSizing: 'border-box',
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'baseline', minWidth: 0 }}>
                                                <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '12px', lineHeight: '1.6' }}>
                                                    {b.name}
                                                </span>
                                                {b.percentage && (
                                                    <span style={{
                                                        display: 'inline-block',
                                                        fontSize: '10px',
                                                        lineHeight: '14px',
                                                        color: '#94a3b8',
                                                        backgroundColor: '#0f172a',
                                                        padding: '2px 6px',
                                                        borderRadius: '4px',
                                                        border: '1px solid #334155',
                                                        marginLeft: '8px',
                                                        verticalAlign: 'middle',
                                                        flexShrink: 0,
                                                    }}>
                                                        {b.percentage}
                                                    </span>
                                                )}
                                            </div>
                                            <span style={{ fontWeight: 700, color: '#cbd5e1', fontSize: '13px', lineHeight: '1.6', marginLeft: '8px', flexShrink: 0 }}>
                                                {b.amount.toFixed(0)} {currency}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Context Section: Mutual P2P Impact or User Room Balance */}
                        {peerMember && contribution !== undefined && (
                            <div
                                style={{
                                    marginBottom: '16px',
                                    padding: '12px 14px',
                                    borderRadius: '10px',
                                    backgroundColor: '#1e293b',
                                    border: '1px solid #334155',
                                    boxSizing: 'border-box',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', lineHeight: '1.2' }}>
                                        {t('mutualImpactLabel')} ({perspectiveMemberName || t('me')} &bull; {peerMember.username})
                                    </span>
                                    <span
                                        style={{
                                            fontSize: '13px',
                                            fontWeight: 800,
                                            color: contribution >= 0 ? '#4ade80' : '#f87171',
                                            lineHeight: '1.2',
                                            marginLeft: '8px',
                                        }}
                                    >
                                        {contribution >= 0 ? '+' : ''}{contribution.toFixed(0)} {currency}
                                    </span>
                                </div>
                                {runningP2PBalance !== undefined && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #334155', paddingTop: '6px', marginTop: '6px' }}>
                                        <span style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.2' }}>
                                            {t('runningBalanceAfter')}:
                                        </span>
                                        <span style={{ fontSize: '13px', fontWeight: 800, color: runningP2PBalance >= 0.5 ? '#4ade80' : runningP2PBalance <= -0.5 ? '#f87171' : '#94a3b8', lineHeight: '1.2' }}>
                                            {runningP2PBalance >= 0.5 ? '+' : ''}{runningP2PBalance.toFixed(0)} {currency}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* If in All Entries view and user has running room balance */}
                        {!peerMember && userRunningBalance !== undefined && (
                            <div
                                style={{
                                    marginBottom: '16px',
                                    padding: '10px 14px',
                                    borderRadius: '10px',
                                    backgroundColor: '#1e293b',
                                    border: '1px solid #334155',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    boxSizing: 'border-box',
                                }}
                            >
                                <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', lineHeight: '1.2' }}>
                                    {t('roomBalanceAfter')}
                                </span>
                                <span style={{ fontSize: '13px', fontWeight: 800, color: userRunningBalance >= 0.5 ? '#4ade80' : userRunningBalance <= -0.5 ? '#f87171' : '#94a3b8', lineHeight: '1.2', marginLeft: '8px' }}>
                                    {userRunningBalance >= 0.5 ? '+' : ''}{userRunningBalance.toFixed(0)} {currency}
                                </span>
                            </div>
                        )}

                        {/* Card Footer Brand */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #1e293b', fontSize: '10px', color: '#475569', lineHeight: '1.2' }}>
                            <span>Kettle Split</span>
                            <span>{new Date().toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>

                {/* Modal Actions Footer */}
                <div className="p-4 sm:px-6 border-t border-card-border bg-card flex flex-wrap items-center justify-end gap-2.5 shrink-0">
                    <button
                        onClick={onClose}
                        className="py-2 px-3.5 rounded-xl border border-card-border bg-card hover:bg-muted text-card-foreground text-xs sm:text-sm font-semibold transition-all shadow-2xs"
                    >
                        {t('resetFilters') || 'Close'}
                    </button>

                    <button
                        onClick={handleCopyImage}
                        disabled={isGenerating}
                        className="py-2 px-3.5 rounded-xl border border-card-border bg-card hover:bg-muted text-card-foreground text-xs sm:text-sm font-semibold transition-all shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
                    >
                        {copied ? (
                            <>
                                <FiCheck className="w-4 h-4 text-success" />
                                <span className="text-success">{t('copiedImage')}</span>
                            </>
                        ) : (
                            <>
                                <FiCopy className="w-4 h-4 text-muted-foreground" />
                                <span>{t('copyImage')}</span>
                            </>
                        )}
                    </button>

                    <button
                        onClick={handleDownload}
                        disabled={isGenerating}
                        className="py-2 px-3.5 rounded-xl border border-card-border bg-card hover:bg-muted text-card-foreground text-xs sm:text-sm font-semibold transition-all shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
                    >
                        <FiDownload className="w-4 h-4 text-muted-foreground" />
                        <span>{t('downloadImage')}</span>
                    </button>

                    <button
                        onClick={handleNativeShare}
                        disabled={isGenerating}
                        className="py-2 px-4 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs sm:text-sm font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer active:scale-95"
                    >
                        {isGenerating ? (
                            <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                        ) : (
                            <FiShare2 className="w-4 h-4" />
                        )}
                        <span>{t('nativeShare')}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
