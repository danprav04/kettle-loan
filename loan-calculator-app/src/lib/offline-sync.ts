// src/lib/offline-sync.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb';

const DB_NAME = 'loan-calculator-db';
const DB_VERSION = 2;
const OUTBOX_STORE = 'outbox';
const ROOM_DATA_STORE = 'room-data';

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

// **Define specific types for Room data to avoid 'any'**
interface Member {
    id: number;
    username: string;
}

export interface Entry {
    id: number;
    amount: string;
    description: string;
    created_at: string;
    username: string;
    split_with_user_ids: number[] | null;
}

export interface LocalRoomData {
    id: string;
    code: string;
    entries: Entry[];
    balances: { [key: string]: number };
    currentUserBalance: number;
    members: Member[];
    currentUserId: number | null;
    lastUpdated: number;
}

interface OfflineDB extends DBSchema {
  [OUTBOX_STORE]: {
    key: string;
    value: OutboxRequest;
  };
  [ROOM_DATA_STORE]: {
    key: string;
    value: LocalRoomData;
  };
}

let dbPromise: Promise<IDBPDatabase<OfflineDB>> | null = null;

function getDb(): Promise<IDBPDatabase<OfflineDB>> {
    if (!dbPromise) {
        dbPromise = openDB<OfflineDB>(DB_NAME, DB_VERSION, {
            // **FIX: Remove the unused 'oldVersion' parameter**
            upgrade(db) {
                if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
                    db.createObjectStore(OUTBOX_STORE, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(ROOM_DATA_STORE)) {
                    db.createObjectStore(ROOM_DATA_STORE, { keyPath: 'id' });
                }
            },
        });
    }
    return dbPromise;
}

// **FIX: Specify a more concrete type for the request body**
export async function addToOutbox(request: Omit<OutboxRequest, 'id' | 'timestamp'> & { body?: Record<string, unknown> }) {
    const db = await getDb();
    const outboxRequest: OutboxRequest = {
        ...request,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        body: request.body || null
    };
    await db.add(OUTBOX_STORE, outboxRequest);
    window.dispatchEvent(new Event('outboxchange'));
    return outboxRequest;
}

// --- (getOutboxCount and syncOutbox are fine) ---
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


// --- Local Room Data Functions ---
export async function saveRoomData(roomId: string, data: Omit<LocalRoomData, 'id' | 'lastUpdated'>) {
    const db = await getDb();
    const record: LocalRoomData = {
        ...data,
        id: roomId,
        lastUpdated: Date.now(),
    };
    await db.put(ROOM_DATA_STORE, record);
}

export async function getRoomData(roomId: string): Promise<LocalRoomData | undefined> {
    const db = await getDb();
    return db.get(ROOM_DATA_STORE, roomId);
}

// **FIX: Use the specific 'Entry' type for the new entry**
export async function addLocalEntry(roomId: string, newEntry: Entry, newBalances: { currentUserBalance: number, otherBalances: { [key: string]: number } }) {
    const db = await getDb();
    const tx = db.transaction(ROOM_DATA_STORE, 'readwrite');
    const roomData = await tx.store.get(roomId);

    if (roomData) {
        roomData.entries.unshift(newEntry);
        roomData.currentUserBalance = newBalances.currentUserBalance;
        roomData.balances = newBalances.otherBalances;
        roomData.lastUpdated = Date.now();
        await tx.store.put(roomData);
    }
    await tx.done;
}