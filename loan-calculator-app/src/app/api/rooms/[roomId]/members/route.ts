import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { resolveRoomId } from '@/lib/room-resolver';
import { calculateAllMemberBalances } from '@/lib/balance-calc';

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ roomId: string }> }
) {
    const client = await db.connect();
    try {
        const token = req.headers.get('authorization')?.split(' ')[1];
        const user = verifyToken(token);
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const { roomId: rawRoomId } = await params;
        const resolvedId = await resolveRoomId(db, rawRoomId);
        if (!resolvedId) {
            return NextResponse.json({ message: 'Invalid Room ID' }, { status: 400 });
        }
        
        await client.query('BEGIN');

        // Check if user is in room
        const memberRes = await client.query(
            'SELECT can_admin, can_view FROM room_members WHERE room_id = $1 AND user_id = $2',
            [resolvedId, user.userId]
        );
        if (memberRes.rows.length === 0) {
            await client.query('COMMIT');
            return NextResponse.json({ message: 'User already not in room' });
        }

        // Balance Check
        const allMembersRes = await client.query(
            'SELECT u.id, u.username, rm.can_participate FROM users u JOIN room_members rm ON u.id = rm.user_id WHERE rm.room_id = $1',
            [resolvedId]
        );
        const entriesRes = await client.query('SELECT * FROM entries WHERE room_id = $1', [resolvedId]);
        
        const balances = calculateAllMemberBalances(entriesRes.rows, allMembersRes.rows);
        const memberBalance = balances[user.userId] || 0;
        
        if (Math.abs(memberBalance) > 0.01) {
            await client.query('ROLLBACK');
            return NextResponse.json({
                message: `Cannot leave room: you have an active balance (${memberBalance.toFixed(2)}). Settle debts first.`
            }, { status: 400 });
        }

        // Last Admin Check
        if (memberRes.rows[0].can_admin === true) {
            const adminCountRes = await client.query(
                'SELECT COUNT(*) as count FROM room_members WHERE room_id = $1 AND can_admin = true AND can_view = true',
                [resolvedId]
            );
            const adminCount = parseInt(adminCountRes.rows[0].count, 10);
            
            // Are there other active users who could be made admin?
            const activeUserCountRes = await client.query(
                'SELECT COUNT(*) as count FROM room_members WHERE room_id = $1 AND can_view = true',
                [resolvedId]
            );
            const activeUserCount = parseInt(activeUserCountRes.rows[0].count, 10);

            if (adminCount <= 1 && activeUserCount > 1) {
                await client.query('ROLLBACK');
                return NextResponse.json({
                    message: 'Cannot leave: you are the last admin. Promote another member to admin first.'
                }, { status: 400 });
            }
        }

        // Participation History Check
        const historyRes = await client.query(`
            SELECT 1 FROM entries 
            WHERE room_id = $1 AND (
                user_id = $2 OR 
                split_with_user_ids @> $2::text::jsonb
            ) LIMIT 1
        `, [resolvedId, user.userId]);

        const hasHistory = historyRes.rows.length > 0;

        if (hasHistory) {
            // Soft delete
            await client.query(
                'UPDATE room_members SET can_admin = false, can_add_entries = false, can_participate = false, can_view = false WHERE user_id = $1 AND room_id = $2',
                [user.userId, resolvedId]
            );
        } else {
            // Hard delete
            await client.query(
                'DELETE FROM room_members WHERE user_id = $1 AND room_id = $2',
                [user.userId, resolvedId]
            );
        }

        await client.query(
            'UPDATE rooms SET creator_id = NULL WHERE id = $1 AND creator_id = $2',
            [resolvedId, user.userId]
        );

        // Room Cleanup (if no active members remain)
        const activeMembersRes = await client.query(
            'SELECT 1 FROM room_members WHERE room_id = $1 AND can_view = true LIMIT 1',
            [resolvedId]
        );

        if (activeMembersRes.rows.length === 0) {
            await client.query('DELETE FROM rooms WHERE id = $1', [resolvedId]);
        }
        
        await client.query('COMMIT');
        
        return NextResponse.json({ message: 'Successfully left the room' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Failed to leave room:', error);
        return NextResponse.json({ message: 'An error occurred.' }, { status: 500 });
    } finally {
        client.release();
    }
}