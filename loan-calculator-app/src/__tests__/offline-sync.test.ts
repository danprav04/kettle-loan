import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';

let originalWindow: any;

beforeAll(() => {
    originalWindow = globalThis.window;
    globalThis.window = {
        indexedDB: globalThis.indexedDB,
        dispatchEvent: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    } as any;
});

afterAll(() => {
    globalThis.window = originalWindow;
});

import {
    addToOutbox,
    syncOutbox,
    getOutboxCount,
    saveRoomData,
    getRoomData,
    addLocalEntry,
    deleteLocalEntry,
    updateLocalEntry,
    deleteRoomData,
    clearDatabaseForTesting,
    removeOutboxEntryMutations,
    updateOutboxCreateEntry,
    recalculateBalances,
    Entry
} from '../lib/offline-sync';

describe('offline-sync unit tests', () => {
    beforeEach(async () => {
        await clearDatabaseForTesting();
        vi.resetAllMocks();
    });

    describe('Outbox Queue Management', () => {
        it('should add requests to outbox and increment count', async () => {
            expect(await getOutboxCount()).toBe(0);
            await addToOutbox({
                url: '/api/entries',
                method: 'POST',
                token: 'test-token',
                body: { amount: 100 }
            });
            expect(await getOutboxCount()).toBe(1);
        });

        it('should sync outbox requests successfully when network returns 200 OK', async () => {
            await addToOutbox({
                url: '/api/entries',
                method: 'POST',
                token: 'test-token',
                body: { amount: 100 }
            });
            expect(await getOutboxCount()).toBe(1);

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                status: 200
            });

            const synced = await syncOutbox();
            expect(synced).toBe(true);
            expect(await getOutboxCount()).toBe(0);
        });

        it('should preserve queued outbox request when network returns 401 Unauthorized', async () => {
            await addToOutbox({
                url: '/api/entries',
                method: 'POST',
                token: 'expired-token',
                body: { amount: 100 }
            });
            expect(await getOutboxCount()).toBe(1);

            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 401
            });

            const synced = await syncOutbox();
            expect(synced).toBe(false);
            expect(await getOutboxCount()).toBe(1);
        });

        it('should preserve outbox request when network fetch rejects', async () => {
            await addToOutbox({
                url: '/api/entries',
                method: 'POST',
                token: 'test-token',
                body: { amount: 100 }
            });
            global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
            const synced = await syncOutbox();
            expect(synced).toBe(false);
            expect(await getOutboxCount()).toBe(1);
        });

        it('should sync multiple queued items in chronological order', async () => {
            await addToOutbox({ url: '/api/1', method: 'POST', token: 't', body: { id: 1 } });
            await new Promise(resolve => setTimeout(resolve, 10));
            await addToOutbox({ url: '/api/2', method: 'POST', token: 't', body: { id: 2 } });
            expect(await getOutboxCount()).toBe(2);

            const fetchedUrls: string[] = [];
            global.fetch = vi.fn().mockImplementation(async (url) => {
                fetchedUrls.push(url);
                return { ok: true, status: 200 };
            });

            const synced = await syncOutbox();
            expect(synced).toBe(true);
            expect(await getOutboxCount()).toBe(0);
            expect(fetchedUrls).toEqual(['/api/1', '/api/2']);
        });
    });

    describe('Room Data Caching & Mutations', () => {
        const mockMembers = [
            { id: 1, username: 'Alice', role: 'admin' },
            { id: 2, username: 'Bob', role: 'active' }
        ];

        const sampleEntry: Entry = {
            id: 101,
            amount: '100',
            description: 'Dinner',
            created_at: new Date().toISOString(),
            username: 'Alice',
            user_id: 1,
            split_with_user_ids: [1, 2]
        };

        beforeEach(async () => {
            await saveRoomData('room-1', {
                name: 'Test Room',
                code: 'ABC',
                entries: [sampleEntry],
                balances: { 'Bob': -50 },
                currentUserBalance: 50,
                members: mockMembers,
                currentUserId: 1
            });
        });

        it('should add local entry and recalculate balance', async () => {
            const newEntry: Entry = {
                id: 'temp-1',
                amount: '40',
                description: 'Snacks',
                created_at: new Date().toISOString(),
                username: 'Bob',
                user_id: 2,
                split_with_user_ids: [1, 2]
            };

            await addLocalEntry('room-1', newEntry);
            const data = await getRoomData('room-1');
            expect(data?.entries.length).toBe(2);
            expect(data?.currentUserBalance).toBe(30);
            expect(data?.balances['Bob']).toBe(-30);
        });

        it('should update local entry and recalculate balance', async () => {
            await updateLocalEntry('room-1', 101, { amount: '200' });
            const data = await getRoomData('room-1');
            expect(data?.entries[0].amount).toBe('200');
            expect(data?.currentUserBalance).toBe(100);
            expect(data?.balances['Bob']).toBe(-100);
        });

        it('should gracefully handle updating a nonexistent entry ID', async () => {
            await updateLocalEntry('room-1', 9999, { amount: '500' });
            const data = await getRoomData('room-1');
            expect(data?.entries.length).toBe(1);
            expect(data?.entries[0].amount).toBe('100');
        });

        it('should delete local entry and recalculate balance', async () => {
            await deleteLocalEntry('room-1', 101);
            const data = await getRoomData('room-1');
            expect(data?.entries.length).toBe(0);
            expect(data?.currentUserBalance).toBe(0);
            expect(data?.balances['Bob']).toBe(0);
        });

        it('should delete room data when leaving room', async () => {
            expect(await getRoomData('room-1')).toBeDefined();
            await deleteRoomData('room-1');
            expect(await getRoomData('room-1')).toBeUndefined();
        });
    });

    describe('recalculateBalances Math Alignment', () => {
        const members = [
            { id: 1, username: 'Alice', role: 'admin' },
            { id: 2, username: 'Bob', role: 'active' },
            { id: 3, username: 'Charlie', role: 'active' }
        ];

        it('should calculate balance for expense split with empty array as split equally among all', () => {
            const entry: Entry = {
                id: 1,
                amount: '90',
                description: 'Groceries',
                created_at: new Date().toISOString(),
                username: 'Alice',
                user_id: 1,
                split_with_user_ids: []
            };

            const result = recalculateBalances([entry], members, 1);
            expect(result.currentUserBalance).toBe(60);
            expect(result.balances['Bob']).toBe(-30);
            expect(result.balances['Charlie']).toBe(-30);
        });

        it('should calculate balance correctly for custom payer and beneficiary shares', () => {
            const entry: Entry = {
                id: 2,
                amount: '100',
                description: 'Custom Split',
                created_at: new Date().toISOString(),
                username: 'Alice',
                user_id: 1,
                split_with_user_ids: null,
                payer_shares: [{ userId: 1, percentage: 100 }],
                beneficiary_shares: [
                    { userId: 1, percentage: 20 },
                    { userId: 2, percentage: 80 }
                ]
            };

            const result = recalculateBalances([entry], members, 1);
            expect(result.currentUserBalance).toBe(80);
            expect(result.balances['Bob']).toBe(-80);
            expect(result.balances['Charlie']).toBe(0);
        });

        it('should calculate balance correctly for loans (negative amount)', () => {
            const entry: Entry = {
                id: 3,
                amount: '-100',
                description: 'Loan to Bob',
                created_at: new Date().toISOString(),
                username: 'Alice',
                user_id: 1,
                split_with_user_ids: [2]
            };
            const result = recalculateBalances([entry], members, 1);
            expect(result.currentUserBalance).toBe(-100);
            expect(result.balances['Bob']).toBe(100);
        });

        it('should exclude observer members from balance calculation', () => {
            const membersWithObserver = [
                ...members,
                { id: 4, username: 'Dave', role: 'observer' }
            ];
            const entry: Entry = {
                id: 4,
                amount: '90',
                description: 'Lunch',
                created_at: new Date().toISOString(),
                username: 'Alice',
                user_id: 1,
                split_with_user_ids: null
            };
            const result = recalculateBalances([entry], membersWithObserver, 1);
            expect(result.currentUserBalance).toBe(60);
            expect(result.balances['Bob']).toBe(-30);
            expect(result.balances['Charlie']).toBe(-30);
        });
    });

    describe('Unsynchronized Offline Entry Mutations', () => {
        beforeEach(async () => {
            await clearDatabaseForTesting();
        });

        it('should update outbox create entry when editing unsynced offline entry', async () => {
            await addToOutbox({
                url: '/api/entries',
                method: 'POST',
                token: 't',
                body: { roomId: 'room1', amount: 10, description: 'Old', clientTempId: 'temp-123' }
            });
            expect(await getOutboxCount()).toBe(1);

            const updated = await updateOutboxCreateEntry('temp-123', { amount: 25, description: 'New' });
            expect(updated).toBe(true);
            expect(await getOutboxCount()).toBe(1);
        });

        it('should remove outbox entry mutations when deleting unsynced offline entry', async () => {
            await addToOutbox({
                url: '/api/entries',
                method: 'POST',
                token: 't',
                body: { roomId: 'room1', amount: 10, description: 'Old', clientTempId: 'temp-456' }
            });
            expect(await getOutboxCount()).toBe(1);

            await removeOutboxEntryMutations('temp-456');
            expect(await getOutboxCount()).toBe(0);
        });
    });
});
