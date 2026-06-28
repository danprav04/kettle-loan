'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { handleApi } from '@/lib/api';
import { Entry, updateLocalEntry } from '@/lib/offline-sync';
import PayerBeneficiarySelector, { ShareItem } from './PayerBeneficiarySelector';

interface Member {
  id: number;
  username: string;
  role?: string;
}

interface EditEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: Entry | null;
  currency: string;
  members?: Member[];
  currentUserId?: number | null;
  roomId?: string;
  onSuccess: () => void;
}

export default function EditEntryModal({
  isOpen,
  onClose,
  entry,
  currency,
  members = [],
  currentUserId = null,
  roomId,
  onSuccess,
}: EditEntryModalProps) {
  const t = useTranslations('Room');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isMultiParty, setIsMultiParty] = useState(true);
  const [payerShares, setPayerShares] = useState<ShareItem[]>([]);
  const [beneficiaryShares, setBeneficiaryShares] = useState<ShareItem[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<number>>(new Set());
  const [includeSelf, setIncludeSelf] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (entry) {
      setAmount(Math.abs(parseFloat(entry.amount) || 0).toString());
      setDescription(entry.description || '');

      setIsMultiParty(true);

      if (Array.isArray(entry.payer_shares) && entry.payer_shares.length > 0) {
        setPayerShares(entry.payer_shares.map((s) => ({
          userId: (s as unknown as Record<string, number>).user_id || s.userId,
          percentage: Number(s.percentage) || 0,
        })));
      } else {
        setPayerShares([{ userId: entry.user_id, percentage: 100 }]);
      }

      if (Array.isArray(entry.beneficiary_shares) && entry.beneficiary_shares.length > 0) {
        setBeneficiaryShares(entry.beneficiary_shares.map((s) => ({
          userId: (s as unknown as Record<string, number>).user_id || s.userId,
          percentage: Number(s.percentage) || 0,
        })));
      } else if (Array.isArray(entry.split_with_user_ids) && entry.split_with_user_ids.length > 0) {
        const ids = entry.split_with_user_ids;
        const payerId = entry.user_id;
        const isPos = parseFloat(entry.amount) >= 0;
        const hasSelf = isPos && ids.includes(payerId);
        const splitOnly = isPos ? ids.filter((id) => id !== payerId) : ids;
        const allPartIds = hasSelf ? [payerId, ...splitOnly] : splitOnly;
        const count = allPartIds.length || 1;
        const pct = Math.floor((100 / count) * 100) / 100;
        const rem = Math.round((100 - pct * count) * 100) / 100;
        const bShares: ShareItem[] = allPartIds.map((id, idx) => ({
          userId: id,
          percentage: idx === 0 ? Math.round((pct + rem) * 100) / 100 : pct,
        }));
        setBeneficiaryShares(bShares);
        setSelectedMemberIds(new Set(splitOnly));
        setIncludeSelf(hasSelf);
      } else {
        const eligible = members.filter((m) => m.role !== 'observer');
        const payerId = entry.user_id;
        const isPos = parseFloat(entry.amount) >= 0;
        const splitOnly = eligible.filter((m) => m.id !== payerId).map((m) => m.id);
        const allPartIds = isPos ? [payerId, ...splitOnly] : splitOnly;
        const count = allPartIds.length || 1;
        const pct = Math.floor((100 / count) * 100) / 100;
        const rem = Math.round((100 - pct * count) * 100) / 100;
        setBeneficiaryShares(allPartIds.map((id, idx) => ({
          userId: id,
          percentage: idx === 0 ? Math.round((pct + rem) * 100) / 100 : pct,
        })));
        setSelectedMemberIds(new Set(splitOnly));
        setIncludeSelf(isPos);
      }
    }
  }, [entry, members]);

  if (!isOpen || !entry) return null;

  const isPositive = parseFloat(entry.amount) >= 0;
  const numAmount = parseFloat(amount) || 0;
  const finalAmount = isMultiParty ? numAmount : (isPositive ? numAmount : -numAmount);

  const eligibleMembers = members.filter((m) => m.role !== 'observer');
  const otherMembers = eligibleMembers.filter((m) => m.id !== (currentUserId || entry.user_id));

  const toggleSimpleMember = (memberId: number) => {
    const next = new Set(selectedMemberIds);
    if (next.has(memberId)) next.delete(memberId);
    else next.add(memberId);
    setSelectedMemberIds(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      let payloadPayerShares: ShareItem[] | undefined = undefined;
      let payloadBeneficiaryShares: ShareItem[] | undefined = undefined;
      let payloadSplitWith: number[] | undefined = undefined;

      if (isMultiParty) {
        const sumP = payerShares.reduce((a, b) => a + b.percentage, 0);
        const sumB = beneficiaryShares.reduce((a, b) => a + b.percentage, 0);
        if (Math.abs(sumP - 100) > 0.1 || Math.abs(sumB - 100) > 0.1) {
          throw new Error('Split totals must equal 100% (Sum)');
        }
        payloadPayerShares = payerShares;
        payloadBeneficiaryShares = beneficiaryShares;
        payloadSplitWith = beneficiaryShares.map((b) => b.userId);
      } else {
        const splitIds = Array.from(selectedMemberIds);
        const payerId = entry.user_id;
        const allPartIds = isPositive && includeSelf ? [payerId, ...splitIds] : splitIds;
        if (allPartIds.length === 0) {
          throw new Error('Please select at least one participant');
        }
        payloadSplitWith = allPartIds;
        const count = allPartIds.length;
        const basePct = Math.floor((100 / count) * 100) / 100;
        const rem = Math.round((100 - basePct * count) * 100) / 100;
        payloadPayerShares = [{ userId: payerId, percentage: 100 }];
        payloadBeneficiaryShares = allPartIds.map((id, idx) => ({
          userId: id,
          percentage: idx === 0 ? Math.round((basePct + rem) * 100) / 100 : basePct,
        }));
      }

      if (roomId && entry) {
        await updateLocalEntry(roomId, entry.id, {
          amount: finalAmount.toString(),
          description: description.trim(),
          payer_shares: payloadPayerShares,
          beneficiary_shares: payloadBeneficiaryShares,
          split_with_user_ids: payloadSplitWith,
        });
      }

      await handleApi({
        url: `/api/entries/${entry.id}`,
        method: 'PUT',
        body: {
          amount: finalAmount,
          description: description.trim(),
          payerShares: payloadPayerShares,
          beneficiaryShares: payloadBeneficiaryShares,
          splitWithUserIds: payloadSplitWith,
        },
      });

      onSuccess();
      onClose();
    } catch (err: unknown) {
      if (roomId && entry) {
        await updateLocalEntry(roomId, entry.id, entry);
      }
      setError(err instanceof Error ? err.message : 'Failed to save edits');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-2xl overflow-hidden bg-card border border-white/10 rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-muted/20">
          <h2 className="text-base font-bold flex items-center gap-2 text-foreground">
            <span className="p-1 rounded-lg bg-primary/20 text-primary">✏️</span> {t('editEntryTitle')}
          </h2>
          <button onClick={onClose} className="p-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all">
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && <div className="p-3 text-xs bg-danger/20 text-danger border border-danger/40 rounded-xl">{error}</div>}

          <form id="edit-entry-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wider">{t('amount')} ({currency})</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => { if (/^\d*\.?\d*$/.test(e.target.value)) setAmount(e.target.value); }}
                  className="w-full themed-input px-3.5 py-2 text-sm font-bold rounded-xl border border-input bg-background text-foreground"
                  required
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wider">{t('description')}</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full themed-input px-3.5 py-2 text-sm font-medium rounded-xl border border-input bg-background text-foreground"
                  required
                />
              </div>
            </div>

            {members.length > 1 && (
              <div className="pt-2 space-y-3 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('editSplitDetails')}</label>
                  <div className="flex rounded-xl bg-muted/40 p-0.5 border border-white/5">
                    <button
                      type="button"
                      onClick={() => setIsMultiParty(false)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${!isMultiParty ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {t('simpleSplit')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsMultiParty(true)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${isMultiParty ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {t('advancedSplit')}
                    </button>
                  </div>
                </div>

                {isMultiParty ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1 items-start">
                    <PayerBeneficiarySelector
                      members={members}
                      shares={payerShares}
                      onChange={setPayerShares}
                      totalAmount={numAmount}
                      currency={currency}
                      label={t('list1WhoPaid')}
                      currentUserId={currentUserId || null}
                      onUpdateTotal={(newTotal) => setAmount(newTotal.toString())}
                    />
                    <PayerBeneficiarySelector
                      members={members}
                      shares={beneficiaryShares}
                      onChange={setBeneficiaryShares}
                      totalAmount={numAmount}
                      currency={currency}
                      label={t('list2SplitForWhom')}
                      currentUserId={currentUserId || null}
                      onUpdateTotal={(newTotal) => setAmount(newTotal.toString())}
                    />
                  </div>
                ) : (
                  <div className="bg-card/40 p-4 rounded-2xl border border-white/5 space-y-2">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">{isPositive ? t('splitWith') : t('paidForMeBy')}</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                      {isPositive && currentUserId && (
                        <div
                          onClick={() => setIncludeSelf(!includeSelf)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all select-none cursor-pointer ${
                            includeSelf ? 'bg-primary/15 border-primary/60 text-foreground font-semibold' : 'bg-background/40 hover:bg-muted/30 border-white/5 text-muted-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors ${
                              includeSelf ? 'bg-primary border-primary text-white shadow-sm' : 'border-muted-foreground/40 bg-card'
                            }`}>
                              {includeSelf ? '✓' : ''}
                            </div>
                            <span>{t('me')}</span>
                          </div>
                          <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-bold tracking-wider">{t('youBadge')}</span>
                        </div>
                      )}
                      {otherMembers.map((m) => {
                        const sel = selectedMemberIds.has(m.id);
                        return (
                          <div
                            key={m.id}
                            onClick={() => toggleSimpleMember(m.id)}
                            className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all select-none cursor-pointer ${
                              sel ? 'bg-primary/15 border-primary/60 text-foreground font-semibold' : 'bg-background/40 hover:bg-muted/30 border-white/5 text-muted-foreground'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors ${
                                sel ? 'bg-primary border-primary text-white shadow-sm' : 'border-muted-foreground/40 bg-card'
                              }`}>
                                {sel ? '✓' : ''}
                              </div>
                              <span>{m.username}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 bg-muted/10 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-muted hover:bg-white/10 text-foreground text-xs font-semibold rounded-xl border border-white/10 transition-all"
            disabled={isLoading}
          >
            {t('closeBtn')}
          </button>
          <button
            form="edit-entry-form"
            type="submit"
            className="btn-primary text-xs px-5 py-2 rounded-xl font-bold shadow-md flex items-center gap-2"
            disabled={isLoading}
          >
            <span>💾</span> {isLoading ? '...' : 'Save Edits'}
          </button>
        </div>
      </div>
    </div>
  );
}
