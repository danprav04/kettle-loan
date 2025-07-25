// src/lib/api.ts
import { addToOutbox } from './offline-sync';

type HttpMethod = 'POST' | 'GET' | 'DELETE' | 'PUT';

interface ApiRequestOptions {
    method: HttpMethod;
    url: string;
    // **FIX: Replaced 'any' with a more specific object type**
    body?: Record<string, unknown>;
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

    if (!navigator.onLine && method !== 'GET') {
        await addToOutbox({ url, method, body, token });
        return { optimistic: true, ...(body || {}) };
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
        if (error instanceof TypeError && method !== 'GET') {
            await addToOutbox({ url, method, body, token });
            return { optimistic: true, ...(body || {}) };
        }
        
        throw error;
    }
}