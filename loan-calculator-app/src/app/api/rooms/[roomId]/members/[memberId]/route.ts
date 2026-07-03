import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { resolveRoomId } from '@/lib/room-resolver';
import { calculateAllMemberBalances } from '@/lib/balance-calc';

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ roomId: string; memberId: string }> }
) {
    try {
        const { roomId: rawRoomId, memberId } = await params;
        const resolvedId = await resolveRoomId(db, rawRoomId);
        if (!resolvedId) {
            return NextResponse.json({ message: 'Room not found' }, { status: 404 });
        }

        const targetUserId = parseInt(memberId, 10);
        if (isNaN(targetUserId)) {
            return NextResponse.json({ message: 'Invalid member ID' }, { status: 400 });
        }

        const token = req.headers.get('authorization')?.split(' ')[1];
        const user = verifyToken(token);
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const permissions = body.permissions;

        if (!permissions || typeof permissions !== 'object') {
            return NextResponse.json({ message: 'Invalid permissions object' }, { status: 400 });
        }

        const { canAdmin, canAddEntries, canParticipate, canView } = permissions;

        if (typeof canAdmin !== 'boolean' || typeof canAddEntries !== 'boolean' || typeof canParticipate !== 'boolean' || typeof canView !== 'boolean') {
            return NextResponse.json({ message: 'All permission flags must be booleans' }, { status: 400 });
        }

        // Check acting user's admin status
        const actingMemberRes = await db.query(
            'SELECT can_admin FROM room_members WHERE room_id = $1 AND user_id = $2',
            [resolvedId, user.userId]
        );

        if (actingMemberRes.rows.length === 0 || actingMemberRes.rows[0].can_admin !== true) {
            return NextResponse.json({ message: 'Forbidden: Admin access required' }, { status: 403 });
        }

        // Check target user exists in the room
        const targetMemberRes = await db.query(
            'SELECT can_admin, can_add_entries, can_participate, can_view FROM room_members WHERE room_id = $1 AND user_id = $2',
            [resolvedId, targetUserId]
        );

        if (targetMemberRes.rows.length === 0) {
            return NextResponse.json({ message: 'Member not found in room' }, { status: 404 });
        }

        // Safeguard: Cannot remove can_view while can_admin or can_add_entries is true
        if (!canView && (canAdmin || canAddEntries)) {
            return NextResponse.json({
                message: 'Cannot revoke view access while Admin or Edit permissions are active.'
            }, { status: 400 });
        }

        // Safeguard: Cannot remove can_admin from the last remaining admin
        if (targetMemberRes.rows[0].can_admin === true && !canAdmin) {
            const adminCountRes = await db.query(
                'SELECT COUNT(*) as count FROM room_members WHERE room_id = $1 AND can_admin = true',
                [resolvedId]
            );
            const adminCount = parseInt(adminCountRes.rows[0].count, 10);

            if (adminCount <= 1) {
                return NextResponse.json({
                    message: 'Cannot remove admin from the last remaining admin in the room.'
                }, { status: 400 });
            }
        }

        // Safeguard: Cannot remove can_participate if member has an unsettled net balance
        if (targetMemberRes.rows[0].can_participate === true && !canParticipate) {
            const allMembersRes = await db.query(
                'SELECT u.id, u.username, rm.can_participate FROM users u JOIN room_members rm ON u.id = rm.user_id WHERE rm.room_id = $1',
                [resolvedId]
            );
            const entriesRes = await db.query(
                'SELECT * FROM entries WHERE room_id = $1',
                [resolvedId]
            );
            const balances = calculateAllMemberBalances(entriesRes.rows, allMembersRes.rows);
            const memberBalance = balances[targetUserId] || 0;
            if (Math.abs(memberBalance) > 0.01) {
                return NextResponse.json({
                    message: `Cannot revoke participation: member has an active balance (${memberBalance.toFixed(2)}). Settle debts first.`
                }, { status: 400 });
            }
        }

        await db.query(
            'UPDATE room_members SET can_admin = $1, can_add_entries = $2, can_participate = $3, can_view = $4 WHERE room_id = $5 AND user_id = $6',
            [canAdmin, canAddEntries, canParticipate, canView, resolvedId, targetUserId]
        );

        return NextResponse.json({ message: 'Permissions updated successfully' });

    } catch (error) {
        console.error('Failed to update member permissions:', error);
        return NextResponse.json({ message: 'An error occurred.' }, { status: 500 });
    }
}
