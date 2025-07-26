// src/lib/offline-sync.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb';

const DB_NAME = 'loan-calculator-db';
const DB_VERSION = 3;
const OUTBOX_STORE = 'outbox';
const ROOM_DATA_STORE = 'room-data';
const ROOMS_LIST_STORE = 'rooms-list';

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

interface Member {
    id: number;
    username: string;
}

export interface Entry {
    id: number | string;
    amount: string;
    description: string;
    created_at: string;
    username: string;
    user_id: number;
    split_with_user_ids: number[] | null;
    offline_timestamp?: number;
}

export interface LocalRoomData {
    id: string;
    name: string | null;
    code: string;
    entries: Entry[];
    balances: { [key: string]: number };
    currentUserBalance: number;
    members: Member[];
    currentUserId: number | null;
    lastUpdated: number;
}

export interface LocalRoomListItem {
    id: number;
    name: string | null;
    code: string;
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
  [ROOMS_LIST_STORE]: {
      key: 'user-rooms';
      value: { rooms: LocalRoomListItem[] };
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
                if (!db.objectStoreNames.contains(ROOM_DATA_STORE)) {
                    db.createObjectStore(ROOM_DATA_STORE, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(ROOMS_LIST_STORE)) {
                    db.createObjectStore(ROOMS_LIST_STORE);
                }
            },
        });
    }
    return dbPromise;
}

// --- Outbox & Sync Functions ---
export async function addToOutbox(request: Omit<OutboxRequest, 'id' | 'timestamp'> & { body?: Record<string, unknown> }) {
    const db = await getDb();
    const outboxRequest: OutboxRequest = {
        ...request,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        body: request.body || null,
    };
    await db.add(OUTBOX_STORE, outboxRequest);
    window.dispatchEvent(new Event('outboxchange'));
    return outboxRequest;
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
                body: req.method !== 'DELETE' ? JSON.stringify(req.body) : undefined,
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

export async function getOutboxCount(): Promise<number> {
    const db = await getDb();
    return db.count(OUTBOX_STORE);
}


// --- Local Data Management ---

const recalculateBalances = (entries: Entry[], members: Member[], currentUserId: number) => {
    const finalBalances: { [key: string]: number } = {};
    members.forEach(member => { finalBalances[member.id] = 0; });

    entries.forEach(entry => {
        const amount = parseFloat(entry.amount);
        const payerId = entry.user_id;

        if (amount > 0) { // Expense
            const participants = entry.split_with_user_ids;
            if (!participants || participants.length === 0) {
                const share = amount / members.length;
                members.forEach(member => {
                    if (member.id === payerId) {
                        finalBalances[member.id] += (amount - share);
                    } else {
                        finalBalances[member.id] -= share;
                    }
                });
            } else {
                if (participants.length === 0) return;
                const share = amount / participants.length;
                finalBalances[payerId] += amount;
                participants.forEach(pId => {
                    if (finalBalances[pId] !== undefined) {
                        finalBalances[pId] -= share;
                    }
                });
            }
        } else if (amount < 0) { // Loan
            const loanAmount = Math.abs(amount);
            const borrowerId = payerId;
            finalBalances[borrowerId] -= loanAmount;

            const lenders = members.filter(m => m.id !== borrowerId);
            if (lenders.length > 0) {
                const creditPerLender = loanAmount / lenders.length;
                lenders.forEach(lender => {
                    if(finalBalances[lender.id] !== undefined) {
                        finalBalances[lender.id] += creditPerLender;
                    }
                });
            }
        }
    });

    const currentUserBalance = finalBalances[currentUserId] || 0;
    const otherUserBalances: { [key: string]: number } = {};
    members.forEach(member => {
        if (member.id !== currentUserId) {
            otherUserBalances[member.username] = finalBalances[member.id] || 0;
        }
    });

    return { currentUserBalance, balances: otherUserBalances };
};


export async function saveRoomsList(rooms: LocalRoomListItem[]) {
    const db = await getDb();
    await db.put(ROOMS_LIST_STORE, { rooms }, 'user-rooms');
}

export async function getRoomsList(): Promise<LocalRoomListItem[]> {
    const db = await getDb();
    const result = await db.get(ROOMS_LIST_STORE, 'user-rooms');
    return result?.rooms || [];
}

export async function hasCachedRoomData(): Promise<boolean> {
    const db = await getDb();
    const count = await db.count(ROOM_DATA_STORE);
    return count > 0;
}

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

export async function updateLocalRoomName(roomId: string, newName: string) {
    const db = await getDb();
    const tx = db.transaction([ROOM_DATA_STORE, ROOMS_LIST_STORE], 'readwrite');
    const roomDataStore = tx.objectStore(ROOM_DATA_STORE);
    const roomsListStore = tx.objectStore(ROOMS_LIST_STORE);

    const roomData = await roomDataStore.get(roomId);
    if (roomData) {
        roomData.name = newName;
        await roomDataStore.put(roomData);
    }

    const roomsList = await roomsListStore.get('user-rooms');
    if (roomsList) {
        const roomIndex = roomsList.rooms.findIndex(r => r.id === parseInt(roomId, 10));
        if (roomIndex > -1) {
            roomsList.rooms[roomIndex].name = newName;
            await roomsListStore.put(roomsList, 'user-rooms');
        }
    }
    
    await tx.done;
}

export async function addLocalEntry(roomId: string, newEntry: Entry) {
    const db = await getDb();
    const tx = db.transaction(ROOM_DATA_STORE, 'readwrite');
    const roomData = await tx.store.get(roomId);

    if (roomData) {
        roomData.entries.unshift(newEntry);
        
        if (roomData.members && roomData.currentUserId) {
            const { currentUserBalance, balances } = recalculateBalances(roomData.entries, roomData.members, roomData.currentUserId);
            roomData.currentUserBalance = currentUserBalance;
            roomData.balances = balances;
        }

        roomData.lastUpdated = Date.now();
        await tx.store.put(roomData);
    }
    await tx.done;
}

export async function deleteLocalEntry(roomId: string, entryId: number | string) {
    const db = await getDb();
    const tx = db.transaction(ROOM_DATA_STORE, 'readwrite');
    const roomData = await tx.store.get(roomId);

    if (roomData) {
        const entryExists = roomData.entries.some(e => e.id === entryId);
        if (!entryExists) return;

        roomData.entries = roomData.entries.filter(e => e.id !== entryId);

        if (roomData.members && roomData.currentUserId) {
            const { currentUserBalance, balances } = recalculateBalances(roomData.entries, roomData.members, roomData.currentUserId);
            roomData.currentUserBalance = currentUserBalance;
            roomData.balances = balances;
        }

        roomData.lastUpdated = Date.now();
        await tx.store.put(roomData);
    }
    await tx.done;
}