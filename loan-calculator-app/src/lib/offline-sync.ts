// src/lib/offline-sync.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb';

const DB_NAME = 'loan-calculator-db';
const DB_VERSION = 1;
const OUTBOX_STORE = 'outbox';

type HttpMethod = 'POST' | 'DELETE' | 'PUT';

interface OutboxRequest {
    id: string;
    url: string;
    method: HttpMethod;
    body: unknown;
    timestamp: number;
    token: string | null;
}

interface OfflineDB extends DBSchema {
  [OUTBOX_STORE]: {
    key: string;
    value: OutboxRequest;
  };
}

let dbPromise: Promise<IDBPDatabase<OfflineDB>> | null = null;

function getDb(): Promise<IDBPDatabase<OfflineDB>> {
    if (!dbPromise) {
        dbPromise = openDB<OfflineDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
                    db.createObjectStore(OUTBOX_STORE, { keyPath: 'id' });
                }
            },
        });
    }
    return dbPromise;
}

export async function addToOutbox(request: Omit<OutboxRequest, 'id' | 'timestamp'> & { id?: string }) {
    const db = await getDb();
    const tx = db.transaction(OUTBOX_STORE, 'readwrite');
    const outboxRequest: OutboxRequest = {
        ...request,
        id: request.id || crypto.randomUUID(),
        timestamp: Date.now()
    };
    await tx.store.add(outboxRequest);
    await tx.done;
    console.log('Request added to outbox:', outboxRequest);
    
    // Dispatch a custom event so the UI can update its pending count
    window.dispatchEvent(new Event('outboxchange'));
    
    return outboxRequest;
}

export async function syncOutbox(): Promise<boolean> {
    const db = await getDb();
    const requests = await db.getAll(OUTBOX_STORE);
    if (requests.length === 0) {
        return false; // No requests were synced
    }

    console.log(`Syncing ${requests.length} requests from outbox...`);
    
    // Process requests in the order they were created
    requests.sort((a, b) => a.timestamp - b.timestamp);

    let allSucceeded = true;

    for (const req of requests) {
        try {
            const response = await fetch(req.url, {
                method: req.method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${req.token}`,
                },
                body: JSON.stringify(req.body),
            });

            // If request succeeded or was a client error (like 404, 409), remove it.
            // Server errors (5xx) will be retried later.
            if (response.ok || (response.status >= 400 && response.status < 500)) {
                await db.delete(OUTBOX_STORE, req.id);
                console.log(`Request ${req.id} synced and removed from outbox.`);
                // Notify UI that the outbox has changed
                window.dispatchEvent(new Event('outboxchange'));
            } else {
                 console.warn(`Request ${req.id} failed with status ${response.status}. Will retry later.`);
                 allSucceeded = false;
            }
        } catch (error) {
            console.error(`Network error syncing request ${req.id}. Will retry later.`, error);
            allSucceeded = false;
            break; // Stop syncing if a network error occurs, to preserve order
        }
    }

    return allSucceeded;
}

export async function getOutboxCount(): Promise<number> {
    const db = await getDb();
    return db.count(OUTBOX_STORE);
}