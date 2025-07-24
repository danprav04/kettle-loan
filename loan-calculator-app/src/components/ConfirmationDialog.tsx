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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      aria-labelledby="confirmation-dialog-title"
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="rounded-xl shadow-lg border border-card-border bg-background w-full max-w-md m-4 p-6 animate-scaleIn" 
        role="document"
      >
        <h2 id="confirmation-dialog-title" className="text-xl font-bold text-card-foreground mb-4">
          {title}
        </h2>
        <div className="text-muted-foreground mb-6">
          {children}
        </div>
        <div className="flex justify-end space-x-4 rtl:space-x-reverse">
          <button onClick={onClose} className="py-2 px-4 rounded-lg font-semibold btn-muted">
            {t('cancel')}
          </button>
          <button onClick={onConfirm} className="py-2 px-4 rounded-lg font-semibold btn-danger">
            {t('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}