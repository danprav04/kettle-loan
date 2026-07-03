import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { sendRoomNotification } from '@/lib/notifications';

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ entryId: string }> }
) {
    try {
        const { entryId } = await params;
        const numericEntryId = parseInt(entryId, 10);

        if (isNaN(numericEntryId)) {
            return NextResponse.json({ message: 'Invalid Entry ID' }, { status: 400 });
        }

        const token = req.headers.get('authorization')?.split(' ')[1];
        const user = verifyToken(token);
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const entryQuery = await db.query(
            'SELECT user_id, created_by_user_id, room_id, description FROM entries WHERE id = $1', 
            [numericEntryId]
        );

        if (entryQuery.rows.length === 0) {
            return new NextResponse(null, { status: 204 });
        }
        
        const entry = entryQuery.rows[0];

        const memberRes = await db.query(
            'SELECT can_admin, can_add_entries FROM room_members WHERE room_id = $1 AND user_id = $2',
            [entry.room_id, user.userId]
        );

        if (memberRes.rows.length === 0) {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        const { can_admin, can_add_entries } = memberRes.rows[0];
        const isOwner = entry.created_by_user_id === user.userId || entry.user_id === user.userId;

        if (!can_admin && !(can_add_entries && isOwner)) {
            return NextResponse.json({
                message: 'Forbidden: Only Admins or the entry recorder can delete this entry.'
            }, { status: 403 });
        }

        await db.query(
            'DELETE FROM entries WHERE id = $1',
            [numericEntryId]
        );

        sendRoomNotification(entry.room_id, user.userId, {
            type: 'deleteEntry',
            username: user.username,
            description: entry.description,
            url: `/rooms/${entry.room_id}`
        });

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        console.error('Failed to delete entry:', error);
        return NextResponse.json({ message: 'An error occurred.' }, { status: 500 });
    }
}

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ entryId: string }> }
) {
    try {
        const { entryId } = await params;
        const numericEntryId = parseInt(entryId, 10);

        if (isNaN(numericEntryId)) {
            return NextResponse.json({ message: 'Invalid Entry ID' }, { status: 400 });
        }

        const token = req.headers.get('authorization')?.split(' ')[1];
        const user = verifyToken(token);
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const entryQuery = await db.query(
            'SELECT * FROM entries WHERE id = $1',
            [numericEntryId]
        );

        if (entryQuery.rows.length === 0) {
            return NextResponse.json({ message: 'Entry not found' }, { status: 404 });
        }

        const oldEntry = entryQuery.rows[0];

        const memberRes = await db.query(
            'SELECT can_admin, can_add_entries FROM room_members WHERE room_id = $1 AND user_id = $2',
            [oldEntry.room_id, user.userId]
        );

        if (memberRes.rows.length === 0) {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        const { can_admin, can_add_entries } = memberRes.rows[0];
        const isOwner = oldEntry.created_by_user_id === user.userId || oldEntry.user_id === user.userId;

        if (!can_admin && !(can_add_entries && isOwner)) {
            return NextResponse.json({
                message: 'Forbidden: Only Admins or the entry recorder can edit this entry.'
            }, { status: 403 });
        }

        const body = await req.json();
        const { amount, description, payerShares, beneficiaryShares, splitWithUserIds } = body;

        const legacyUserId = (Array.isArray(payerShares) && payerShares.length > 0) ? payerShares[0].userId : oldEntry.user_id;
        const numAmount = parseFloat(amount);

        let resolvedSplitWith = splitWithUserIds;
        if ((!Array.isArray(resolvedSplitWith) || resolvedSplitWith.length === 0) && (!Array.isArray(payerShares) || payerShares.length === 0)) {
            const membersRes = await db.query(
                'SELECT user_id FROM room_members WHERE room_id = $1 AND can_participate = true',
                [oldEntry.room_id]
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

        // Record audit log
        await db.query(`
            INSERT INTO entry_edits (
                entry_id, edited_by_user_id,
                old_amount, new_amount,
                old_description, new_description,
                old_payer_shares, new_payer_shares,
                old_beneficiary_shares, new_beneficiary_shares
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
            numericEntryId, user.userId,
            oldEntry.amount, amount,
            oldEntry.description, description,
            oldEntry.payer_shares ? JSON.stringify(oldEntry.payer_shares) : null, finalPayerShares,
            oldEntry.beneficiary_shares ? JSON.stringify(oldEntry.beneficiary_shares) : null, finalBeneficiaryShares
        ]);

        // Update entry
        await db.query(`
            UPDATE entries SET
                amount = $1, description = $2,
                user_id = $3, split_with_user_ids = $4,
                payer_shares = $5, beneficiary_shares = $6
            WHERE id = $7
        `, [amount, description, legacyUserId, finalSplitWith, finalPayerShares, finalBeneficiaryShares, numericEntryId]);

        return NextResponse.json({ message: 'Entry updated successfully' });
    } catch (error) {
        console.error('Failed to edit entry:', error);
        return NextResponse.json({ message: 'An error occurred.' }, { status: 500 });
    }
}