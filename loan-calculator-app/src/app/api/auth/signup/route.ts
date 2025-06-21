import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { db } from '@/lib/db';

export async function POST(req: Request) {
    try {
        const { username, password } = await req.json();
        const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1';

        const existingUserByIp = await db.query('SELECT * FROM users WHERE last_ip = $1', [ip]);
        if (existingUserByIp.rows.length > 0) {
            return NextResponse.json({ message: 'signupIpError' }, { status: 403 });
        }

        const hashedPassword = await hash(password, 10);
        await db.query(
            'INSERT INTO users (username, password, last_ip) VALUES ($1, $2, $3)',
            [username, hashedPassword, ip]
        );

        return NextResponse.json({ message: 'User created successfully' }, { status: 201 });
    } catch (error: any) {
        if (error.code === '23505' && error.constraint === 'users_username_key') {
            return NextResponse.json({ message: 'signupUsernameError' }, { status: 409 });
        }
        console.error(error);
        return NextResponse.json({ message: 'An error occurred during signup.' }, { status: 500 });
    }
}