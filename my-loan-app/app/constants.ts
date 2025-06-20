export const JWT_SECRET = process.env.JWT_SECRET;
export const BASE_URL = process.env.NODE_ENV === 'production' 
    ? 'https://your-production-domain.com' 
    : 'http://localhost:3000';

if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in the environment variables");
}