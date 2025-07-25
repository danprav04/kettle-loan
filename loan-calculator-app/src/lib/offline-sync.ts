// src/lib/offline-sync.ts

import { openDB, DBSchema, IDBPDatabase } from 'idb';

const DB_NAME = 'loan-calculator-db';
const DB_VERSION = 2; // **Bump version for schema change**
const OUTBOX_STORE = 'outbox';
const ROOM_DATA_STORE = 'room-data'; // **New store for room data**

// --- Type Definitions ---
type HttpMethod = 'POST' | 'DELETE' | 'PUT';

interface OutboxRequest {
    id: string;
    url: string;
    method: HttpMethod;
    body: unknown;
    timestamp: number;
    token: string | null;
}

// **New type for storing room data locally**
export interface LocalRoomData {
    id: string; // Use roomId as the key
    code: string;
    entries: any[];
    balances: { [key: string]: number };
    currentUserBalance: number;
    members: any[];
    currentUserId: number | null;
    lastUpdated: number;
}

interface OfflineDB extends DBSchema {
  [OUTBOX_STORE]: {
    key: string;
    value: OutboxRequest;
  };
  // **Define the new store in the schema**
  [ROOM_DATA_STORE]: {
    key: string;
    value: LocalRoomData;
  };
}

let dbPromise: Promise<IDBPDatabase<OfflineDB>> | null = null;

function getDb(): Promise<IDBPDatabase<OfflineDB>> {
    if (!dbPromise) {
        dbPromise = openDB<OfflineDB>(DB_NAME, DB_VERSION, {
            upgrade(db, oldVersion) {
                if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
                    db.createObjectStore(OUTBOX_STORE, { keyPath: 'id' });
                }
                // **Create the new object store**
                if (!db.objectStoreNames.contains(ROOM_DATA_STORE)) {
                    db.createObjectStore(ROOM_DATA_STORE, { keyPath: 'id' });
                }
            },
        });
    }
    return dbPromise;
}

// --- Outbox Functions (Unchanged but included for context) ---
export async function addToOutbox(request: Omit<OutboxRequest, 'id' | 'timestamp'>) {
    const db = await getDb();
    const outboxRequest: OutboxRequest = {
        ...request,
        id: crypto.randomUUID(),
        timestamp: Date.now()
    };
    await db.add(OUTBOX_STORE, outboxRequest);
    window.dispatchEvent(new Event('outboxchange'));
    return outboxRequest;
}

export async function getOutboxCount(): Promise<number> {
    const db = await getDb();
    return db.count(OUTBOX_STORE);
}

export async function syncOutbox(): Promise<boolean> {
    const db = await getDb();
    const requests = await db.getAll(OUTBOX_STORE);
    if (requests.length === 0) return false;

    requests.sort((a, b) => a.timestamp - b.timestamp);
    let didSync = false;

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
            if (response.ok || (response.status >= 400 && response.status < 500)) {
                await db.delete(OUTBOX_STORE, req.id);
                window.dispatchEvent(new Event('outboxchange'));
                didSync = true;
            } else {
                break; 
            }
        } catch (error) {
            console.error(`Network error syncing request ${req.id}. Will retry later.`, error);
            break; 
        }
    }
    return didSync;
}

// --- NEW Local Room Data Functions ---

/**
 * Saves fetched room data to IndexedDB.
 */
export async function saveRoomData(roomId: string, data: Omit<LocalRoomData, 'id' | 'lastUpdated'>) {
    const db = await getDb();
    const record: LocalRoomData = {
        ...data,
        id: roomId,
        lastUpdated: Date.now(),
    };
    await db.put(ROOM_DATA_STORE, record);
}

/**
 * Retrieves room data from IndexedDB for offline use.
 */
export async function getRoomData(roomId: string): Promise<LocalRoomData | undefined> {
    const db = await getDb();
    return db.get(ROOM_DATA_STORE, roomId);
}

/**
 * Adds a new entry to the local room data store for optimistic updates.
 */
export async function addLocalEntry(roomId: string, newEntry: any, newBalances: { currentUserBalance: number, otherBalances: { [key: string]: number } }) {
    const db = await getDb();
    const tx = db.transaction(ROOM_DATA_STORE, 'readwrite');
    const roomData = await tx.store.get(roomId);

    if (roomData) {
        // Add to the start of the array to match server's reverse order
        roomData.entries.unshift(newEntry);
        roomData.currentUserBalance = newBalances.currentUserBalance;
        roomData.balances = newBalances.otherBalances;
        roomData.lastUpdated = Date.now();
        await tx.store.put(roomData);
    }
    await tx.done;
}