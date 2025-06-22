import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { db } from '@/lib/db';

// Define a type for the potential Postgres error to make our catch block type-safe
interface PostgresError extends Error {
    code?: string;
    constraint?: string;
}

export async function POST(req: Request) {
    try {
        const { username, password } = await req.json();
        // Use x-forwarded-for header (set by Nginx/Caddy) or fall back to a default.
        const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1';

        // Check if an account has been created from this IP in the last hour.
        const recentUserByIp = await db.query(
            "SELECT id FROM users WHERE last_ip = $1 AND created_at > NOW() - INTERVAL '1 hour'",
            [ip]
        );

        // If any rows are returned, an account was created recently. Block the request.
        if (recentUserByIp.rows.length > 0) {
            return NextResponse.json({ message: 'signupIpError' }, { status: 429 }); // 429 Too Many Requests is more semantic
        }

        const hashedPassword = await hash(password, 10);
        await db.query(
            'INSERT INTO users (username, password, last_ip) VALUES ($1, $2, $3)',
            [username, hashedPassword, ip]
        );

        return NextResponse.json({ message: 'User created successfully' }, { status: 201 });
    } catch (e: unknown) {
        const error = e as PostgresError;
        // Check for the specific duplicate username error from Postgres
        if (error.code === '23505' && error.constraint === 'users_username_key') {
            return NextResponse.json({ message: 'signupUsernameError' }, { status: 409 });
        }
        console.error(error);
        return NextResponse.json({ message: 'An error occurred during signup.' }, { status: 500 });
    }
}