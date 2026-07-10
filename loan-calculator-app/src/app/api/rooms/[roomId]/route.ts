import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { resolveRoomId } from '@/lib/room-resolver';

interface Share {
    userId: number;
    percentage: number;
}

interface DbEntry {
    id: number;
    room_id: number;
    user_id: number;
    amount: string;
    description: string;
    created_at: string;
    username: string;
    split_with_user_ids: number[] | null;
    payer_shares: Share[] | null;
    beneficiary_shares: Share[] | null;
    created_by_user_id: number | null;
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ roomId: string }> }
) {
    try {
        const { roomId: rawRoomId } = await params;
        const resolvedId = await resolveRoomId(db, rawRoomId);
        if (!resolvedId) {
            return NextResponse.json({ message: 'Room not found' }, { status: 404 });
        }

        const token = req.headers.get('authorization')?.split(' ')[1];
        const user = verifyToken(token);
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const memberCheckResult = await db.query(
            'SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2',
            [resolvedId, user.userId]
        );

        if (memberCheckResult.rows.length === 0) {
            return NextResponse.json({ message: 'Room not found' }, { status: 404 });
        }
        
        const roomResult = await db.query('SELECT id, code, name, currency FROM rooms WHERE id = $1', [resolvedId]);
        if (roomResult.rows.length === 0) {
            return NextResponse.json({ message: 'Room not found' }, { status: 404 });
        }
        const { id: roomId, code: roomCode, name: roomName, currency } = roomResult.rows[0];

        const entriesResult = await db.query(
            'SELECT e.*, u.username FROM entries e JOIN users u ON e.user_id = u.id WHERE e.room_id = $1 ORDER BY e.created_at ASC',
            [resolvedId]
        );

        const membersResult = await db.query(
            'SELECT u.id, u.username, rm.can_admin, rm.can_add_entries, rm.can_participate, rm.can_view FROM users u JOIN room_members rm ON u.id = rm.user_id WHERE rm.room_id = $1',
            [resolvedId]
        );
        
        const members: { id: number; username: string; can_admin: boolean; can_add_entries: boolean; can_participate: boolean; can_view: boolean }[] = membersResult.rows;
        if (members.length === 0) {
           return NextResponse.json({ message: 'No members in room or room does not exist' }, { status: 404 });
        }

        const currentMember = members.find(m => m.id === user.userId);
        const currentUserPermissions = currentMember
            ? { canAdmin: currentMember.can_admin, canAddEntries: currentMember.can_add_entries, canParticipate: currentMember.can_participate, canView: currentMember.can_view }
            : { canAdmin: false, canAddEntries: true, canParticipate: true, canView: true };
        
        const finalBalances: { [key: string]: number } = {};
        members.forEach(member => {
            finalBalances[member.id] = 0;
        });

        const calcMembers = members.filter(m => m.can_participate);
        const entries: DbEntry[] = entriesResult.rows;

        entries.forEach(entry => {
            const amount = parseFloat(entry.amount);
            const payerId = entry.user_id;

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

            if (amount > 0) { // This is an Expense
                const participants = entry.split_with_user_ids;
                const activeParticipants = participants && participants.length > 0
                    ? calcMembers.filter(m => participants.includes(m.id))
                    : [];

                if (activeParticipants.length > 0) {
                    const numParticipants = activeParticipants.length;
                    const share = amount / numParticipants;

                    finalBalances[payerId] += amount;

                    activeParticipants.forEach(participant => {
                        if (finalBalances[participant.id] !== undefined) {
                            finalBalances[participant.id] -= share;
                        }
                    });
                }
            } else if (amount < 0) { // This is a Loan
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
                        finalBalances[lender.id] += creditPerLender;
                    });
                }
            }
        });

        const currentUserBalance = finalBalances[user.userId] || 0;
        const otherUserBalances: { [key: string]: number } = {};
        members.forEach(member => {
            if (member.id !== user.userId) {
                otherUserBalances[member.username] = finalBalances[member.id] || 0;
            }
        });

        const reversedEntries = entries.reverse();

        return NextResponse.json({
            id: roomId,
            name: roomName,
            code: roomCode,
            currency: currency || 'ILS',
            currentUserPermissions,
            entries: reversedEntries,
            balances: otherUserBalances,
            currentUserBalance,
            members: members.map(m => ({ id: m.id, username: m.username, permissions: { canAdmin: m.can_admin, canAddEntries: m.can_add_entries, canParticipate: m.can_participate, canView: m.can_view } })),
            currentUserId: user.userId
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ message: 'An error occurred.' }, { status: 500 });
    }
}

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ roomId: string }> }
) {
    try {
        const { roomId: rawRoomId } = await params;
        const resolvedId = await resolveRoomId(db, rawRoomId);
        if (!resolvedId) {
            return NextResponse.json({ message: 'Room not found' }, { status: 404 });
        }

        const token = req.headers.get('authorization')?.split(' ')[1];
        const user = verifyToken(token);
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }
        
        const body = await req.json();
        const name = body.name;
        const currency = typeof body.currency === 'string' && body.currency.trim() ? body.currency.trim() : undefined;

        if (typeof name !== 'string' || name.trim().length === 0 || name.length > 50) {
            return NextResponse.json({ message: 'Invalid name provided' }, { status: 400 });
        }

        const memberCheckResult = await db.query(
            'SELECT can_admin FROM room_members WHERE room_id = $1 AND user_id = $2',
            [resolvedId, user.userId]
        );

        if (memberCheckResult.rows.length === 0 || memberCheckResult.rows[0].can_admin !== true) {
            return NextResponse.json({ message: 'Forbidden: Admin access required' }, { status: 403 });
        }

        if (currency) {
            const currentRoom = await db.query('SELECT currency FROM rooms WHERE id = $1', [resolvedId]);
            const oldCurrency = currentRoom.rows[0]?.currency || 'ILS';

            if (oldCurrency !== currency) {
                const rates: Record<string, number> = { ILS: 1, USD: 3.65, EUR: 4.00 };
                const oldRate = rates[oldCurrency] || 1;
                const newRate = rates[currency] || 1;
                const conversionFactor = oldRate / newRate;

                await db.query(`
                    UPDATE entries 
                    SET amount = ROUND((amount * $1)::numeric, 2) 
                    WHERE room_id = $2
                `, [conversionFactor, resolvedId]);

                await db.query(`
                    UPDATE entry_edits ee
                    SET old_amount = ROUND((old_amount * $1)::numeric, 2),
                        new_amount = ROUND((new_amount * $1)::numeric, 2)
                    FROM entries e
                    WHERE ee.entry_id = e.id AND e.room_id = $2
                `, [conversionFactor, resolvedId]);
            }

            await db.query(
                'UPDATE rooms SET name = $1, currency = $2 WHERE id = $3',
                [name.trim(), currency, resolvedId]
            );
        } else {
            await db.query(
                'UPDATE rooms SET name = $1 WHERE id = $2',
                [name.trim(), resolvedId]
            );
        }
        
        return NextResponse.json({ message: 'Room updated successfully' });

    } catch (error) {
        console.error('Failed to update room name:', error);
        return NextResponse.json({ message: 'An error occurred.' }, { status: 500 });
    }
}