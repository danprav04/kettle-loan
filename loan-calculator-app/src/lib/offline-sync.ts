// src/lib/offline-sync.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb';

const DB_NAME = 'loan-calculator-db';
const DB_VERSION = 5;
const OUTBOX_STORE = 'outbox';
const ROOM_DATA_STORE = 'room-data';
const ROOMS_LIST_STORE = 'rooms-list';
const ENTRY_EDITS_STORE = 'entry-edits';

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
    permissions?: {
        canAdmin?: boolean;
        canAddEntries?: boolean;
        canParticipate?: boolean;
        canView?: boolean;
    };
}

interface Share {
    userId: number;
    percentage: number;
}

export interface Entry {
    id: number | string;
    amount: string;
    description: string;
    created_at: string;
    username: string;
    user_id: number;
    split_with_user_ids: number[] | null;
    payer_shares?: Share[] | null;
    beneficiary_shares?: Share[] | null;
    created_by_user_id?: number | null;
    offline_timestamp?: number;
    pending_sync?: boolean;
}

export interface LocalRoomData {
    id: string;
    name: string | null;
    code: string;
    currency?: string;
    currentUserPermissions?: {
        canAdmin: boolean;
        canAddEntries: boolean;
        canParticipate: boolean;
        canView: boolean;
    };
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
  [ENTRY_EDITS_STORE]: {
      key: string;
      value: unknown[];
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
                if (!db.objectStoreNames.contains(ENTRY_EDITS_STORE)) {
                    db.createObjectStore(ENTRY_EDITS_STORE);
                }
            },
        });
    }
    return dbPromise;
}

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
            if (response.status === 401 || response.status === 403) {
                window.dispatchEvent(new Event('auth_expired'));
                break;
            }
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

export const recalculateBalances = (entries: Entry[], members: Member[], currentUserId: number) => {
    const finalBalances: { [key: string]: number } = {};
    members.forEach(member => { finalBalances[member.id] = 0; });

    const calcMembers = members.filter(m => m.permissions?.canParticipate !== false);

    entries.forEach(entry => {
        const amount = parseFloat(entry.amount);

        if (entry.payer_shares && entry.beneficiary_shares && Array.isArray(entry.payer_shares) && Array.isArray(entry.beneficiary_shares)) {
            entry.payer_shares.forEach(p => {
                if (finalBalances[p.userId] !== undefined) {
                    finalBalances[p.userId] += amount * (p.percentage / 100);
                }
            });
            entry.beneficiary_shares.forEach(b => {
                if (finalBalances[b.userId] !== undefined) {
                    finalBalances[b.userId] -= amount * (b.percentage / 100);
                }
            });
            return;
        }

        const payerId = entry.user_id;

        if (amount > 0) { // Expense
            const participants = entry.split_with_user_ids;
            if (participants && participants.length > 0) {
                const numParticipants = participants.length;
                const share = amount / numParticipants;
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

            const participants = entry.split_with_user_ids;
            const lenders = participants && participants.length > 0 
                ? calcMembers.filter(m => participants.includes(m.id))
                : [];

            if (lenders.length > 0) {
                finalBalances[borrowerId] -= loanAmount;
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
        newEntry.pending_sync = true;
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
        if (entryExists) {
            roomData.entries = roomData.entries.filter(e => e.id !== entryId);

            if (roomData.members && roomData.currentUserId) {
                const { currentUserBalance, balances } = recalculateBalances(roomData.entries, roomData.members, roomData.currentUserId);
                roomData.currentUserBalance = currentUserBalance;
                roomData.balances = balances;
            }

            roomData.lastUpdated = Date.now();
            await tx.store.put(roomData);
        }
    }
    await tx.done;
}

export async function updateLocalEntry(roomId: string, entryId: number | string, updatedData: Partial<Entry>) {
    const db = await getDb();
    const tx = db.transaction(ROOM_DATA_STORE, 'readwrite');
    const roomData = await tx.store.get(roomId);

    if (roomData) {
        const index = roomData.entries.findIndex(e => e.id === entryId);
        if (index !== -1) {
            roomData.entries[index] = { ...roomData.entries[index], ...updatedData, pending_sync: true };

            if (roomData.members && roomData.currentUserId) {
                const { currentUserBalance, balances } = recalculateBalances(roomData.entries, roomData.members, roomData.currentUserId);
                roomData.currentUserBalance = currentUserBalance;
                roomData.balances = balances;
            }

            roomData.lastUpdated = Date.now();
            await tx.store.put(roomData);
        }
    }
    await tx.done;
}

export async function deleteRoomData(roomId: string) {
    const db = await getDb();
    await db.delete(ROOM_DATA_STORE, roomId);
}

export async function clearDatabaseForTesting() {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('clearDatabaseForTesting cannot be called in production');
    }
    const db = await getDb();
    await db.clear(OUTBOX_STORE);
    await db.clear(ROOM_DATA_STORE);
    await db.clear(ROOMS_LIST_STORE);
    await db.clear(ENTRY_EDITS_STORE);
}

export async function saveEntryEdits(entryId: string | number, edits: unknown[]) {
    const db = await getDb();
    await db.put(ENTRY_EDITS_STORE, edits, entryId.toString());
}

export async function getEntryEdits(entryId: string | number): Promise<unknown[] | undefined> {
    const db = await getDb();
    return db.get(ENTRY_EDITS_STORE, entryId.toString());
}

export async function removeOutboxEntryMutations(entryId: string | number) {
    const db = await getDb();
    const requests = await db.getAll(OUTBOX_STORE);
    const strId = entryId.toString();
    for (const req of requests) {
        const bodyObj = req.body as Record<string, unknown> | null;
        if (
            req.url === `/api/entries/${strId}` ||
            (bodyObj && bodyObj.clientTempId === strId)
        ) {
            await db.delete(OUTBOX_STORE, req.id);
        }
    }
    window.dispatchEvent(new Event('outboxchange'));
}

export async function updateOutboxCreateEntry(clientTempId: string | number, updatedPayload: Record<string, unknown>): Promise<boolean> {
    const db = await getDb();
    const requests = await db.getAll(OUTBOX_STORE);
    const strId = clientTempId.toString();
    for (const req of requests) {
        const bodyObj = req.body as Record<string, unknown> | null;
        if (req.method === 'POST' && req.url === '/api/entries' && bodyObj && bodyObj.clientTempId === strId) {
            req.body = { ...bodyObj, ...updatedPayload };
            await db.put(OUTBOX_STORE, req);
            window.dispatchEvent(new Event('outboxchange'));
            return true;
        }
    }
    return false;
}