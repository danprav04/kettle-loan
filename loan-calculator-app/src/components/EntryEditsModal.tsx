'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { FiClock, FiUser, FiArrowRight, FiX } from 'react-icons/fi';
import { handleApi } from '@/lib/api';
import { saveEntryEdits, getEntryEdits } from '@/lib/offline-sync';

interface EditRecord {
  id: number;
  entry_id: number | string;
  edited_by_user_id: number;
  edited_by_username: string;
  old_amount: string;
  new_amount: string;
  old_description: string;
  new_description: string;
  edited_at: string;
  old_payer_shares?: unknown;
  new_payer_shares?: unknown;
  old_beneficiary_shares?: unknown;
  new_beneficiary_shares?: unknown;
}

interface EntryEditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  entryId: number | string | null;
  currency: string;
}

const formatAmount = (val: string | number | undefined | null) => {
  if (val === undefined || val === null || val === '') return '0';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '0';
  return Number.isInteger(num) ? num.toString() : num.toFixed(2);
};

export default function EntryEditsModal({ isOpen, onClose, entryId, currency }: EntryEditsModalProps) {
  const t = useTranslations('AuditTrail');
  const [edits, setEdits] = useState<EditRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !entryId) return;
    setIsLoading(true);
    setError('');

    getEntryEdits(entryId).then((cached) => {
      if (Array.isArray(cached) && cached.length > 0) {
        setEdits(cached as EditRecord[]);
        setIsLoading(false);
      }
    });

    if (navigator.onLine && typeof entryId === 'number') {
      handleApi({
        method: 'GET',
        url: `/api/entries/${entryId}/edits`,
      })
        .then(async (data: unknown) => {
          if (Array.isArray(data)) {
            await saveEntryEdits(entryId, data);
            setEdits(data as EditRecord[]);
          } else {
            setEdits([]);
          }
        })
        .catch(() => {
          getEntryEdits(entryId).then((cached) => {
            if (!cached || cached.length === 0) setError(t('error'));
          });
        })
        .finally(() => setIsLoading(false));
    } else {
      getEntryEdits(entryId).then((cached) => {
        if (Array.isArray(cached)) setEdits(cached as EditRecord[]);
        setIsLoading(false);
      });
    }
  }, [isOpen, entryId, t]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg sm:max-w-xl overflow-hidden bg-card border border-border rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
          <h2 className="text-base font-bold flex items-center gap-2 text-foreground">
            <FiClock className="text-primary text-lg shrink-0" /> {t('title')}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            aria-label={t('closeBtn')}
          >
            <FiX size={18} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {isLoading && <p className="text-center text-xs text-muted-foreground py-6">{t('loading')}</p>}
          {error && <p className="text-center text-xs text-danger py-4">{error}</p>}
          {!isLoading && edits.length === 0 && !error && (
            <p className="text-center text-xs text-muted-foreground py-8">{t('noEdits')}</p>
          )}

          {!isLoading &&
            edits.map((edit) => {
              const oldAmtNum = parseFloat(edit.old_amount);
              const newAmtNum = parseFloat(edit.new_amount);
              const isAmountChanged =
                !isNaN(oldAmtNum) && !isNaN(newAmtNum)
                  ? Math.abs(oldAmtNum - newAmtNum) > 0.0001
                  : (edit.old_amount ?? '') !== (edit.new_amount ?? '');

              const oldDesc = (edit.old_description || '').trim();
              const newDesc = (edit.new_description || '').trim();
              const isDescriptionChanged = oldDesc !== newDesc;

              const hasShares = Boolean(
                edit.old_payer_shares || edit.new_payer_shares || edit.old_beneficiary_shares || edit.new_beneficiary_shares
              );
              const isSharesChanged =
                hasShares &&
                (JSON.stringify(edit.old_payer_shares) !== JSON.stringify(edit.new_payer_shares) ||
                  JSON.stringify(edit.old_beneficiary_shares) !== JSON.stringify(edit.new_beneficiary_shares));

              const noChangesDetected = !isAmountChanged && !isDescriptionChanged && !isSharesChanged;

              return (
                <div key={edit.id} className="p-3.5 bg-background rounded-lg border border-border/70 space-y-3 text-xs shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2 text-muted-foreground">
                    <span className="flex items-center gap-1.5 font-semibold text-foreground">
                      <FiUser className="text-primary shrink-0" size={14} />
                      {edit.edited_by_username || t('userFallback', { id: edit.edited_by_user_id })}
                    </span>
                    <span className="text-[11px]">{new Date(edit.edited_at).toLocaleString()}</span>
                  </div>

                  {isAmountChanged && (
                    <div className="space-y-1">
                      <span className="text-[11px] text-muted-foreground block uppercase font-bold tracking-wider">
                        {t('amountChange')}
                      </span>
                      <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-card/60 border border-border/60 text-xs font-mono">
                        <span className="line-through text-muted-foreground/90 font-medium">
                          {formatAmount(edit.old_amount)} {currency}
                        </span>
                        <FiArrowRight className="text-muted-foreground text-xs shrink-0" />
                        <span className="font-bold text-primary">
                          {formatAmount(edit.new_amount)} {currency}
                        </span>
                      </div>
                    </div>
                  )}

                  {isDescriptionChanged && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] text-muted-foreground block uppercase font-bold tracking-wider">
                        {t('descriptionChange')}
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground/80 block mb-1">
                            {t('before')}
                          </span>
                          <p className="line-through text-muted-foreground break-words font-normal text-xs sm:text-sm leading-relaxed">
                            {edit.old_description || '—'}
                          </p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20">
                          <span className="text-[10px] uppercase font-bold text-primary block mb-1">
                            {t('after')}
                          </span>
                          <p className="font-semibold text-foreground break-words text-xs sm:text-sm leading-relaxed">
                            {edit.new_description || '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {isSharesChanged && (
                    <div className="pt-0.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/40 border border-border/50 text-xs text-muted-foreground">
                        <span>👥</span>
                        <span>{t('sharesChange')}</span>
                      </span>
                    </div>
                  )}

                  {noChangesDetected && (
                    <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs text-muted-foreground">
                      <span className="italic">{t('noChanges')}</span>
                      {edit.new_description && (
                        <span className="font-medium text-foreground">({edit.new_description})</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        <div className="p-3 border-t border-border bg-muted/20 flex justify-end">
          <button onClick={onClose} className="btn-secondary text-xs px-4 py-1.5 rounded-lg">
            {t('closeBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}
