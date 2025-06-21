// src/lib/db.ts
import { Pool } from 'pg';
import { POSTGRES_URL } from './constants';

export const db = new Pool({
    connectionString: POSTGRES_URL,
    ssl: {
      rejectUnauthorized: false
    }
});