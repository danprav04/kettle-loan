'use client';

import React, { useState, useEffect } from 'react';
import { FiEdit3, FiSave, FiX } from 'react-icons/fi';
import { handleApi } from '@/lib/api';
import { Entry } from '@/lib/offline-sync';

interface EditEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: Entry | null;
  currency: string;
  onSuccess: () => void;
}

export default function EditEntryModal({ isOpen, onClose, entry, currency, onSuccess }: EditEntryModalProps) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (entry) {
      setAmount(Math.abs(parseFloat(entry.amount)).toFixed(2));
      setDescription(entry.description);
    }
  }, [entry]);

  if (!isOpen || !entry || typeof entry.id !== 'number') return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid positive amount.');
      setIsLoading(false);
      return;
    }

    const wasLoan = parseFloat(entry.amount) < 0;
    const finalAmount = wasLoan ? -parsedAmount : parsedAmount;

    try {
      const res = await handleApi({
        method: 'PUT',
        url: `/api/entries/${entry.id}`,
        body: {
          amount: finalAmount,
          description: description.trim(),
        },
      });

      if (!res || !res.ok) {
        throw new Error('Failed to update entry');
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save edits');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md overflow-hidden bg-card border border-border rounded-xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
          <h2 className="text-base font-bold flex items-center gap-2">
            <FiEdit3 className="text-primary" /> Edit Entry Details
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg text-muted hover:text-foreground">
            <FiX size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && <div className="p-2.5 text-xs bg-danger/20 text-danger border border-danger/40 rounded-lg">{error}</div>}

          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1">Amount ({currency})</label>
            <input
              type="number"
              step="any"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full themed-input px-3 py-2 text-sm font-bold rounded-lg border border-input bg-background"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full themed-input px-3 py-2 text-sm rounded-lg border border-input bg-background"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="btn-secondary text-xs px-3 py-1.5 rounded-lg" disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary text-xs px-4 py-1.5 rounded-lg flex items-center gap-1.5" disabled={isLoading}>
              <FiSave /> {isLoading ? 'Saving...' : 'Save Edits'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
