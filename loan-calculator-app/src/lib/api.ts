// src/lib/api.ts
import { addToOutbox } from './offline-sync';

type HttpMethod = 'POST' | 'GET' | 'DELETE' | 'PUT';

interface ApiRequestOptions {
    method: HttpMethod;
    url: string;
    body?: any;
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
        const error = new Error(errorData.message);
        (error as any).status = response.status;
        throw error;

    } catch (error: any) {
        const isOffline = !navigator.onLine || (error instanceof TypeError && error.message === 'Failed to fetch');

        if (isOffline && method !== 'GET') {
            console.log('Offline or network error. Adding request to outbox.');
            await addToOutbox({ url, method, body, token });
            // Return a special object for optimistic updates.
            return {
                ...body,
                optimistic: true,
            };
        }
        
        throw error;
    }
}