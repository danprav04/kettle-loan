import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { sendRoomNotification } from '@/lib/notifications';
import { resolveRoomId } from '@/lib/room-resolver';

export async function POST(req: Request) {
    try {
        const token = req.headers.get('authorization')?.split(' ')[1];
        const user = verifyToken(token);
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { roomId: rawRoomId, amount, description, splitWithUserIds, payerShares, beneficiaryShares, createdAt } = body;
        const resolvedId = await resolveRoomId(db, rawRoomId);
        if (!resolvedId) {
            return NextResponse.json({ message: 'Room not found' }, { status: 404 });
        }

        // Verify permissions
        const memberRes = await db.query(
            'SELECT can_add_entries, can_participate FROM room_members WHERE room_id = $1 AND user_id = $2',
            [resolvedId, user.userId]
        );

        if (memberRes.rows.length === 0) {
            return NextResponse.json({ message: 'Forbidden: Not in room' }, { status: 403 });
        }

        if (memberRes.rows[0].can_add_entries !== true) {
            return NextResponse.json({
                message: 'Forbidden: You do not have permission to log entries.'
            }, { status: 403 });
        }

        const createdByUserId = user.userId;
        const legacyUserId = (Array.isArray(payerShares) && payerShares.length > 0) ? payerShares[0].userId : user.userId;
        const numAmount = parseFloat(amount);

        let resolvedSplitWith = splitWithUserIds;
        if ((!Array.isArray(resolvedSplitWith) || resolvedSplitWith.length === 0) && (!Array.isArray(payerShares) || payerShares.length === 0)) {
            const membersRes = await db.query(
                'SELECT user_id FROM room_members WHERE room_id = $1 AND can_participate = true',
                [resolvedId]
            );
            const allEligibleIds = membersRes.rows.map(r => r.user_id);
            if (numAmount > 0) {
                resolvedSplitWith = allEligibleIds;
            } else if (numAmount < 0) {
                const otherIds = allEligibleIds.filter(id => id !== legacyUserId);
                resolvedSplitWith = otherIds.length > 0 ? otherIds : [legacyUserId];
            }
        }

        const finalSplitWith = (Array.isArray(resolvedSplitWith) && resolvedSplitWith.length > 0) ? JSON.stringify(resolvedSplitWith) : null;
        const finalPayerShares = Array.isArray(payerShares) ? JSON.stringify(payerShares) : null;
        const finalBeneficiaryShares = Array.isArray(beneficiaryShares) ? JSON.stringify(beneficiaryShares) : null;
        const finalCreatedAt = createdAt ? new Date(createdAt) : new Date();

        await db.query(
            'INSERT INTO entries (room_id, user_id, amount, description, split_with_user_ids, payer_shares, beneficiary_shares, created_by_user_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [resolvedId, legacyUserId, amount, description, finalSplitWith, finalPayerShares, finalBeneficiaryShares, createdByUserId, finalCreatedAt.toISOString()]
        );

        const isExpense = numAmount > 0;
        const formattedAmount = Math.abs(numAmount).toFixed(2);
        
        sendRoomNotification(String(resolvedId), user.userId, {
            type: 'newEntry',
            username: user.username,
            description,
            amount: formattedAmount,
            isExpense,
            url: `/rooms/${rawRoomId}`
        });

        return NextResponse.json({ message: 'Entry added successfully' });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ message: 'An error occurred.' }, { status: 500 });
    }
}