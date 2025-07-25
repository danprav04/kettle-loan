// src/lib/api.ts

import { addToOutbox } from './offline-sync';

type HttpMethod = 'POST' | 'GET' | 'DELETE' | 'PUT';

interface ApiRequestOptions {
    method: HttpMethod;
    url: string;
    // Use a more specific type than 'any'
    body?: Record<string, any>; 
}

class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

export async function handleApi(options: ApiRequestOptions) {
    const { method, url, body } = options;
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    // A more robust check for offline status.
    const isOffline = !navigator.onLine;

    // If offline and it's a data-changing request, queue it immediately.
    if (isOffline && method !== 'GET') {
        console.log('Offline. Adding request to outbox.');
        await addToOutbox({ url, method, body, token });
        return { optimistic: true, ...body };
    }

    try {
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` }),
            },
            ...(body && { body: JSON.stringify(body) }),
        });

        if (response.ok) {
            if (response.status === 204 || response.headers.get("content-length") === "0") {
                return { success: true };
            }
            return response.json();
        }

        const errorData = await response.json().catch(() => ({ message: 'API Error' }));
        throw new ApiError(errorData.message, response.status);

    } catch (error) {
        // If the fetch fails with a TypeError, it's a network error.
        // Queue it just like if we were offline from the start.
        if (error instanceof TypeError && method !== 'GET') {
            console.log('Network error. Adding request to outbox.');
            await addToOutbox({ url, method, body, token });
            return { optimistic: true, ...body };
        }
        
        // Re-throw other errors (like ApiError or JSON parsing errors)
        throw error;
    }
}