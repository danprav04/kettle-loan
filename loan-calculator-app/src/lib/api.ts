// src/lib/api.ts
import { addToOutbox } from './offline-sync';

type HttpMethod = 'POST' | 'GET' | 'DELETE' | 'PUT';

// This interface is updated to be more specific, as you suggested.
// This is the best fix as it enforces type safety at the call site.
interface ApiRequestOptions {
    method: HttpMethod;
    url: string;
    body?: Record<string, unknown>; // More specific than 'unknown'
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

    } catch (error: unknown) {
        const isNetworkError = error instanceof TypeError && error.message === 'Failed to fetch';
        
        if (!navigator.onLine || isNetworkError) {
             if (method !== 'GET') {
                console.log('Offline or network error. Adding request to outbox.');
                await addToOutbox({ url, method, body, token });
                
                // This now works perfectly because TypeScript knows 'body' is a spreadable object or undefined.
                return {
                    ...(body || {}),
                    optimistic: true,
                };
            }
        }
        
        throw error;
    }
}