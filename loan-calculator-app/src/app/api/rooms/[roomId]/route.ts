import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function GET(req: Request) {
    try {
        // Workaround for the Next.js 15.3.4 params issue:
        // Manually parse the roomId from the request URL.
        const url = new URL(req.url);
        const pathnameParts = url.pathname.split('/');
        const roomId = pathnameParts[pathnameParts.length - 1];

        const token = req.headers.get('authorization')?.split(' ')[1];
        const user = verifyToken(token);
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        // Check if the user is a member of the room
        const memberCheckResult = await db.query(
            'SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2',
            [roomId, user.userId]
        );

        if (memberCheckResult.rows.length === 0) {
            // If user is not a member, deny access.
            // Returning 404 to not leak information about room existence.
            return NextResponse.json({ message: 'Room not found' }, { status: 404 });
        }
        
        const roomResult = await db.query('SELECT code FROM rooms WHERE id = $1', [roomId]);
        if (roomResult.rows.length === 0) {
            return NextResponse.json({ message: 'Room not found' }, { status: 404 });
        }
        const roomCode = roomResult.rows[0].code;

        const entriesResult = await db.query(
            'SELECT e.*, u.username FROM entries e JOIN users u ON e.user_id = u.id WHERE e.room_id = $1 ORDER BY e.created_at DESC',
            [roomId]
        );

        const membersResult = await db.query(
            'SELECT u.id, u.username FROM users u JOIN room_members rm ON u.id = rm.user_id WHERE rm.room_id = $1',
            [roomId]
        );

        if (membersResult.rows.length === 0) {
           return NextResponse.json({ message: 'No members in room or room does not exist' }, { status: 404 });
        }

        const userTotals: { [key: string]: number } = {};
        membersResult.rows.forEach(member => {
            userTotals[member.id] = 0;
        });

        entriesResult.rows.forEach(entry => {
            userTotals[entry.user_id] += parseFloat(entry.amount);
        });

        const totalAmount = entriesResult.rows.reduce((acc, entry) => acc + parseFloat(entry.amount), 0);
        const averageShare = totalAmount / membersResult.rows.length;

        const balances: { [key: string]: number } = {};
        membersResult.rows.forEach(member => {
            if (member.id !== user.userId) {
                balances[member.username] = (userTotals[member.id] || 0) - averageShare;
            }
        });

        const currentUserTotalPaid = userTotals[user.userId] || 0;
        const currentUserBalance = currentUserTotalPaid - averageShare;

        return NextResponse.json({
            code: roomCode,
            entries: entriesResult.rows,
            balances,
            currentUserBalance
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ message: 'An error occurred.' }, { status: 500 });
    }
}