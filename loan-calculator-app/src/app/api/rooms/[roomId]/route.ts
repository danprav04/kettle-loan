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
            'SELECT u.id, u.username, rm.role FROM users u JOIN room_members rm ON u.id = rm.user_id WHERE rm.room_id = $1',
            [resolvedId]
        );
        
        const members: { id: number; username: string; role: 'admin' | 'active' | 'passive' | 'observer' }[] = membersResult.rows;
        if (members.length === 0) {
           return NextResponse.json({ message: 'No members in room or room does not exist' }, { status: 404 });
        }

        const currentMember = members.find(m => m.id === user.userId);
        const currentUserRole = currentMember ? currentMember.role : 'active';
        
        const finalBalances: { [key: string]: number } = {};
        members.forEach(member => {
            finalBalances[member.id] = 0;
        });

        const calcMembers = members.filter(m => m.role !== 'observer');
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

                if (!participants || participants.length === 0) {
                    const share = amount / (calcMembers.length || 1);
                    calcMembers.forEach(member => {
                        if (member.id === payerId) {
                            finalBalances[member.id] += (amount - share);
                        } else {
                            finalBalances[member.id] -= share;
                        }
                    });
                } else {
                    const numParticipants = participants.length;
                    const share = amount / numParticipants;

                    finalBalances[payerId] += amount;

                    participants.forEach(participantId => {
                        if (finalBalances[participantId] !== undefined) {
                            finalBalances[participantId] -= share;
                        }
                    });
                }
            } else if (amount < 0) { // This is a Loan
                const loanAmount = Math.abs(amount);
                const borrowerId = payerId;
                
                finalBalances[borrowerId] -= loanAmount;

                const participants = entry.split_with_user_ids;
                const lenders = participants && participants.length > 0
                    ? calcMembers.filter(m => participants.includes(m.id))
                    : calcMembers.filter(m => m.id !== borrowerId);

                if (lenders.length > 0) {
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
            currentUserRole,
            entries: reversedEntries,
            balances: otherUserBalances,
            currentUserBalance,
            members,
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
            'SELECT role FROM room_members WHERE room_id = $1 AND user_id = $2',
            [resolvedId, user.userId]
        );

        if (memberCheckResult.rows.length === 0 || memberCheckResult.rows[0].role !== 'admin') {
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