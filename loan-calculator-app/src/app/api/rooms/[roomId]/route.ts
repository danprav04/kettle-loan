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
        
        const members = membersResult.rows;
        const numMembers = members.length;
        const finalBalances: { [key: string]: number } = {};
        members.forEach(member => {
            finalBalances[member.id] = 0;
        });

        // 1. Process expenses (amount > 0)
        const expenses = entriesResult.rows.filter(e => parseFloat(e.amount) > 0);
        const totalExpense = expenses.reduce((acc, entry) => acc + parseFloat(entry.amount), 0);
        const averageExpenseShare = numMembers > 0 ? totalExpense / numMembers : 0;

        members.forEach(member => {
            const memberExpensesPaid = expenses
                .filter(e => e.user_id === member.id)
                .reduce((acc, entry) => acc + parseFloat(entry.amount), 0);
            finalBalances[member.id] += (memberExpensesPaid - averageExpenseShare);
        });

        // 2. Process loans (amount < 0)
        const loans = entriesResult.rows.filter(e => parseFloat(e.amount) < 0);
        if (numMembers > 1) {
            loans.forEach(loan => {
                const loanAmount = parseFloat(loan.amount); // This is negative
                const borrowerId = loan.user_id;
                
                // Borrower's balance decreases by the loan amount
                finalBalances[borrowerId] += loanAmount;

                // Other members' balances increase as they are the lenders
                const creditPerLender = Math.abs(loanAmount) / (numMembers - 1);
                members.forEach(member => {
                    if (member.id !== borrowerId) {
                        finalBalances[member.id] += creditPerLender;
                    }
                });
            });
        } else {
             // If only one member, loans are a direct deduction from their balance.
             loans.forEach(loan => {
                const loanAmount = parseFloat(loan.amount);
                const borrowerId = loan.user_id;
                finalBalances[borrowerId] += loanAmount;
            });
        }

        // Prepare response object
        const currentUserBalance = finalBalances[user.userId] || 0;
        const otherUserBalances: { [key: string]: number } = {};
        members.forEach(member => {
            if (member.id !== user.userId) {
                otherUserBalances[member.username] = finalBalances[member.id] || 0;
            }
        });

        return NextResponse.json({
            code: roomCode,
            entries: entriesResult.rows,
            balances: otherUserBalances,
            currentUserBalance
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ message: 'An error occurred.' }, { status: 500 });
    }
}