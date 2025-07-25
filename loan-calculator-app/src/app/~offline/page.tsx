// src/app/~offline/page.tsx
"use client";

import { useTranslations } from 'next-intl';
import { FiWifiOff } from 'react-icons/fi';

export default function OfflinePage() {
  const t = useTranslations('Offline');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted p-4 text-center">
        <div className="max-w-md">
            <FiWifiOff className="mx-auto h-16 w-16 text-muted-foreground" />
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {t('title')}
            </h1>
            <p className="mt-4 text-base text-muted-foreground">
                {t('message1')}
            </p>
            <p className="mt-2 text-base text-muted-foreground">
                {t('message2')}
            </p>
            <div className="mt-8">
                <button
                    onClick={() => window.history.back()}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                    {t('goBackButton')}
                </button>
            </div>
        </div>
    </div>
  );
}