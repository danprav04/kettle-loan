// src/lib/api.ts
import { addToOutbox } from './offline-sync';

type HttpMethod = 'POST' | 'GET' | 'DELETE' | 'PUT';

// This interface is updated to be more specific, as you suggested.
// This is the best fix as it enforces type safety at the call site.
interface ApiRequestOptions {
    method: HttpMethod;
    url: string;
    body?: Record<string, unknown>; // More specific than 'any'
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

    // We can't do anything if we are offline and don't have a token.
    if (!navigator.onLine && !token) {
        throw new Error('Offline and no token available. Please log in when online.');
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
            // Handle responses with no content
            if (response.status === 204 || response.headers.get("content-length") === "0") {
                return { success: true };
            }
            return response.json();
        }

        const errorData = await response.json().catch(() => ({ message: 'API Error' }));
        throw new ApiError(errorData.message, response.status);

    } catch (error: unknown) {
        // Check if the error is a network error
        const isNetworkError = error instanceof TypeError && error.message === 'Failed to fetch';
        
        // If we are offline (or a network error occurred) and it's a data-changing request
        if ((!navigator.onLine || isNetworkError) && method !== 'GET') {
            console.log('Offline or network error. Adding request to outbox.');
            await addToOutbox({ url, method, body, token });
            
            // Return an optimistic response, including the original body data
            // This now works perfectly because TypeScript knows 'body' is a spreadable object or undefined.
            return {
                ...(body || {}),
                optimistic: true,
            };
        }
        
        // Re-throw other errors (e.g., JSON parsing errors, actual API errors)
        throw error;
    }
}