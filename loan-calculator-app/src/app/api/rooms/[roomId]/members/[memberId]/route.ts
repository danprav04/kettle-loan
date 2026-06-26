import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ roomId: string; memberId: string }> }
) {
    try {
        const { roomId, memberId } = await params;
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
        const newRole = body.role;
        const validRoles = ['admin', 'active', 'passive', 'observer'];

        if (!validRoles.includes(newRole)) {
            return NextResponse.json({ message: 'Invalid role' }, { status: 400 });
        }

        // Check acting user's admin status
        const actingMemberRes = await db.query(
            'SELECT role FROM room_members WHERE room_id = $1 AND user_id = $2',
            [roomId, user.userId]
        );

        if (actingMemberRes.rows.length === 0 || actingMemberRes.rows[0].role !== 'admin') {
            return NextResponse.json({ message: 'Forbidden: Admin access required' }, { status: 403 });
        }

        // Check target user's current role
        const targetMemberRes = await db.query(
            'SELECT role FROM room_members WHERE room_id = $1 AND user_id = $2',
            [roomId, targetUserId]
        );

        if (targetMemberRes.rows.length === 0) {
            return NextResponse.json({ message: 'Member not found in room' }, { status: 404 });
        }

        const currentTargetRole = targetMemberRes.rows[0].role;

        // Safeguard: Cannot demote the last remaining admin
        if (currentTargetRole === 'admin' && newRole !== 'admin') {
            const adminCountRes = await db.query(
                'SELECT COUNT(*) as count FROM room_members WHERE room_id = $1 AND role = $2',
                [roomId, 'admin']
            );
            const adminCount = parseInt(adminCountRes.rows[0].count, 10);

            if (adminCount <= 1) {
                return NextResponse.json({
                    message: 'Cannot demote the last remaining admin in the room.'
                }, { status: 400 });
            }
        }

        await db.query(
            'UPDATE room_members SET role = $1 WHERE room_id = $2 AND user_id = $3',
            [newRole, roomId, targetUserId]
        );

        return NextResponse.json({ message: 'Role updated successfully' });

    } catch (error) {
        console.error('Failed to update member role:', error);
        return NextResponse.json({ message: 'An error occurred.' }, { status: 500 });
    }
}
