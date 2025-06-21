"use client";

import { useTranslations } from 'next-intl';

export default function RoomsPage() {
    const t = useTranslations('Rooms');

    return (
        <div className="w-full h-full flex items-center justify-center">
            <div className="text-center bg-card p-8 rounded-lg shadow-md border border-card-border max-w-md">
                <h1 className="text-2xl font-bold text-card-foreground">
                    {t('joinOrCreateRoom')}
                </h1>
                <p className="text-muted-foreground mt-2">
                    Select a room from the panel on the left or create a new one to get started.
                </p>
            </div>
        </div>
    );
}