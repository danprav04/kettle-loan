import { NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import { sign } from 'jsonwebtoken';
import { db } from '@/lib/db';
import { JWT_SECRET } from '@/lib/constants';

export async function POST(req: Request) {
    try {
        const { username, password } = await req.json();

        const response = await db.query('SELECT * FROM users WHERE username = $1', [username]);
        if (response.rows.length === 0) {
            return NextResponse.json({ message: 'loginError' }, { status: 401 });
        }

        const user = response.rows[0];
        const passwordMatch = await compare(password, user.password);

        if (!passwordMatch) {
            return NextResponse.json({ message: 'loginError' }, { status: 401 });
        }

        const token = sign({ userId: user.id, username: user.username }, JWT_SECRET!, { expiresIn: '365d' });

        return NextResponse.json({ token });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ message: 'An error occurred.' }, { status: 500 });
    }
}