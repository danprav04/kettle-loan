import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function GET(req: Request, { params }: { params: { roomId: string } }) {
    try {
        const token = req.headers.get('authorization')?.split(' ')[1];
        const user = verifyToken(token);
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const { roomId } = params;

        // Get room entries with username
        const entriesResult = await db.query(
            'SELECT e.*, u.username FROM entries e JOIN users u ON e.user_id = u.id WHERE e.room_id = $1 ORDER BY e.created_at DESC', 
            [roomId]
        );

        // Get room members
        const membersResult = await db.query(
            'SELECT u.id, u.username FROM users u JOIN room_members rm ON u.id = rm.user_id WHERE rm.room_id = $1', 
            [roomId]
        );
        
        if (membersResult.rows.length === 0) {
           return NextResponse.json({ message: 'No members in room or room does not exist' }, { status: 404 });
        }

        // Calculate totals
        const userTotals: { [key: number]: number } = {};
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
            if (member.id !== user.userId) { // Don't show the current user in their own detailed balance
                balances[member.username] = userTotals[member.id] - averageShare;
            }
        });

        const currentUserTotalPaid = userTotals[user.userId];
        const currentUserBalance = currentUserTotalPaid - averageShare;

        return NextResponse.json({
            entries: entriesResult.rows,
            balances,
            currentUserBalance
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ message: 'An error occurred.' }, { status: 500 });
    }
}