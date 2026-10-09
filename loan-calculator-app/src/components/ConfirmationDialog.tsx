// src/components/ConfirmationDialog.tsx
"use client";

import { ReactNode } from 'react';
import { useTranslations } from 'next-intl';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: ReactNode;
}

export default function ConfirmationDialog({ isOpen, onClose, onConfirm, title, children }: ConfirmationDialogProps) {
  const t = useTranslations('Dialog');
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm"
      aria-labelledby="confirmation-dialog-title"
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="rounded-2xl shadow-2xl border-2 border-card-border dark:border-white shadow-[0_0_25px_rgba(255,255,255,0.06)] bg-card w-full max-w-md m-4 p-6 animate-scaleIn" 
        role="document"
      >
        <h2 id="confirmation-dialog-title" className="text-xl sm:text-2xl font-extrabold font-heading text-card-foreground dark:text-white mb-4 uppercase tracking-wide">
          {title}
        </h2>
        <div className="text-foreground/90 dark:text-zinc-200 font-semibold mb-6 text-sm">
          {children}
        </div>
        <div className="flex justify-end space-x-3 rtl:space-x-reverse">
          <button onClick={onClose} className="py-2.5 px-4 rounded-xl font-extrabold btn-muted border-2 border-card-border/80 dark:border-white/30 cursor-pointer text-xs sm:text-sm">
            {t('cancel')}
          </button>
          <button onClick={onConfirm} className="py-2.5 px-4 rounded-xl font-extrabold btn-danger border-2 border-white/40 shadow-md cursor-pointer text-xs sm:text-sm">
            {t('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}