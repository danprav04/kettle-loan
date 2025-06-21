import { verify } from 'jsonwebtoken';
import { JWT_SECRET } from './constants';

interface UserPayload {
    userId: number;
    username: string;
}

export function verifyToken(token: string | undefined): UserPayload | null {
    if (!token) {
        return null;
    }
    try {
        const decoded = verify(token, JWT_SECRET!) as UserPayload;
        return decoded;
    } catch (error) {
        return null;
    }
}