// src/app/~offline/page.tsx
"use client";

import { FiWifiOff } from 'react-icons/fi';

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted p-4 text-center">
        <div className="max-w-md">
            <FiWifiOff className="mx-auto h-16 w-16 text-muted-foreground" />
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                You are offline
            </h1>
            <p className="mt-4 text-base text-muted-foreground">
                The page you are trying to access has not been saved for offline use.
            </p>
            <p className="mt-2 text-base text-muted-foreground">
                Please connect to the internet and try again. Previously visited pages may be available.
            </p>
            <div className="mt-8">
                <button
                    onClick={() => window.history.back()}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                    Go Back
                </button>
            </div>
        </div>
    </div>
  );
}