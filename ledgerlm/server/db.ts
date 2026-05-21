import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { neon } from '@neondatabase/serverless';
import { Pool } from 'pg';
import * as schema from '@shared/schema';

const dbUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error('NEON_DATABASE_URL environment variable is required');
}

const isLocalDb = dbUrl.includes('localhost') || 
                  dbUrl.includes('ledgerlm-db') ||
                  dbUrl.includes('172.17.') ||
                  dbUrl.includes('127.0.0.1');

let db: ReturnType<typeof drizzleNeon<typeof schema>> | ReturnType<typeof drizzlePg<typeof schema>>;

if (isLocalDb) {
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: false,
  });
  db = drizzlePg(pool, { schema });
  console.log('Using local PostgreSQL connection (SSL disabled)');
} else {
  const sql = neon(dbUrl);
  db = drizzleNeon(sql, { schema });
  console.log('Using Neon cloud connection (SSL enabled)');
}

export { db };
