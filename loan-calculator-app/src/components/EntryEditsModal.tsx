'use client';

import React, { useState, useEffect } from 'react';
import { FiClock, FiUser, FiArrowRight, FiX } from 'react-icons/fi';
import { handleApi } from '@/lib/api';

interface EditRecord {
  id: number;
  entry_id: number;
  edited_by_user_id: number;
  edited_by_username: string;
  old_amount: string;
  new_amount: string;
  old_description: string;
  new_description: string;
  edited_at: string;
}

interface EntryEditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  entryId: number | string | null;
  currency: string;
}

export default function EntryEditsModal({ isOpen, onClose, entryId, currency }: EntryEditsModalProps) {
  const [edits, setEdits] = useState<EditRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !entryId || typeof entryId !== 'number') return;
    setIsLoading(true);
    setError('');

    handleApi({
      method: 'GET',
      url: `/api/entries/${entryId}/edits`,
    })
      .then((data: any) => {
        if (Array.isArray(data)) {
          setEdits(data);
        } else {
          setEdits([]);
        }
      })
      .catch(() => setError('Failed to load edit history'))
      .finally(() => setIsLoading(false));
  }, [isOpen, entryId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg overflow-hidden bg-card border border-border rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
          <h2 className="text-base font-bold flex items-center gap-2">
            <FiClock className="text-primary" /> Entry Audit Trail
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg text-muted hover:text-foreground">
            <FiX size={18} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {isLoading && <p className="text-center text-xs text-muted-foreground py-6">Loading audit history...</p>}
          {error && <p className="text-center text-xs text-danger py-4">{error}</p>}
          {!isLoading && edits.length === 0 && !error && (
            <p className="text-center text-xs text-muted-foreground py-8">No previous edits recorded for this entry.</p>
          )}

          {!isLoading &&
            edits.map((edit) => (
              <div key={edit.id} className="p-3 bg-background rounded-lg border border-border/70 space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-border/50 pb-1.5 text-muted-foreground">
                  <span className="flex items-center gap-1 font-semibold text-foreground">
                    <FiUser className="text-primary" /> {edit.edited_by_username || `User #${edit.edited_by_user_id}`}
                  </span>
                  <span>{new Date(edit.edited_at).toLocaleString()}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="text-[10px] text-muted block uppercase font-bold">Amount Change</span>
                    <div className="flex items-center gap-1.5 font-mono font-bold mt-0.5">
                      <span className="line-through text-muted-foreground">{parseFloat(edit.old_amount).toFixed(2)}</span>
                      <FiArrowRight className="text-muted text-[10px]" />
                      <span className="text-primary">{parseFloat(edit.new_amount).toFixed(2)} {currency}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-muted block uppercase font-bold">Description Change</span>
                    <div className="flex items-center gap-1.5 mt-0.5 truncate">
                      <span className="line-through text-muted-foreground truncate max-w-[80px]">{edit.old_description}</span>
                      <FiArrowRight className="text-muted text-[10px] shrink-0" />
                      <span className="font-semibold text-foreground truncate max-w-[100px]">{edit.new_description}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>

        <div className="p-3 border-t border-border bg-muted/20 flex justify-end">
          <button onClick={onClose} className="btn-secondary text-xs px-4 py-1.5 rounded-lg">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
