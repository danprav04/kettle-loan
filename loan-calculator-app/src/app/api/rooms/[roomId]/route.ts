import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

interface DbEntry {
    id: number;
    room_id: number;
    user_id: number;
    amount: string;
    description: string;
    created_at: string;
    username: string;
    split_with_user_ids: number[] | null;
}

export async function GET(
    req: Request,
    { params }: { params: { roomId: string } }
) {
    try {
        const { roomId } = params;

        const token = req.headers.get('authorization')?.split(' ')[1];
        const user = verifyToken(token);
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const memberCheckResult = await db.query(
            'SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2',
            [roomId, user.userId]
        );

        if (memberCheckResult.rows.length === 0) {
            return NextResponse.json({ message: 'Room not found' }, { status: 404 });
        }
        
        const roomResult = await db.query('SELECT code, name FROM rooms WHERE id = $1', [roomId]);
        if (roomResult.rows.length === 0) {
            return NextResponse.json({ message: 'Room not found' }, { status: 404 });
        }
        const { code: roomCode, name: roomName } = roomResult.rows[0];

        const entriesResult = await db.query(
            'SELECT e.*, u.username FROM entries e JOIN users u ON e.user_id = u.id WHERE e.room_id = $1 ORDER BY e.created_at ASC',
            [roomId]
        );

        const membersResult = await db.query(
            'SELECT u.id, u.username FROM users u JOIN room_members rm ON u.id = rm.user_id WHERE rm.room_id = $1',
            [roomId]
        );
        
        const members: { id: number; username: string }[] = membersResult.rows;
        if (members.length === 0) {
           return NextResponse.json({ message: 'No members in room or room does not exist' }, { status: 404 });
        }
        
        const finalBalances: { [key: string]: number } = {};
        members.forEach(member => {
            finalBalances[member.id] = 0;
        });

        const entries: DbEntry[] = entriesResult.rows;

        entries.forEach(entry => {
            const amount = parseFloat(entry.amount);
            const payerId = entry.user_id;

            if (amount > 0) { // This is an Expense
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

                const lenders = members.filter(m => m.id !== borrowerId);
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
            name: roomName,
            code: roomCode,
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
    req: Request,
    { params }: { params: { roomId: string } }
) {
    try {
        const { roomId } = params;

        const token = req.headers.get('authorization')?.split(' ')[1];
        const user = verifyToken(token);
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }
        
        const { name } = await req.json();
        if (typeof name !== 'string' || name.trim().length === 0 || name.length > 50) {
            return NextResponse.json({ message: 'Invalid name provided' }, { status: 400 });
        }

        const memberCheckResult = await db.query(
            'SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2',
            [roomId, user.userId]
        );

        if (memberCheckResult.rows.length === 0) {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        await db.query(
            'UPDATE rooms SET name = $1 WHERE id = $2',
            [name.trim(), roomId]
        );
        
        return NextResponse.json({ message: 'Room updated successfully' });

    } catch (error) {
        console.error('Failed to update room name:', error);
        return NextResponse.json({ message: 'An error occurred.' }, { status: 500 });
    }
}