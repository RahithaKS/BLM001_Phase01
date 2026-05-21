import { db } from '../db';
import { sql } from 'drizzle-orm';

export async function createSchedulerConfig() {
  try {
    console.log('🔧 Creating scheduler_config table...');

    // Check if table exists
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'scheduler_config'
      );
    `);

    if (tableExists.rows[0]?.exists) {
      console.log('✅ scheduler_config table already exists');
      
      // Ensure default config row exists
      const configRows = await db.execute(sql`SELECT COUNT(*) FROM scheduler_config;`);
      const rowCount = parseInt(String(configRows.rows[0]?.count || '0'));
      
      if (rowCount === 0) {
        console.log('🌱 Seeding default scheduler config...');
        await db.execute(sql`
          INSERT INTO scheduler_config (enabled, hour, minute, timezone)
          VALUES (0, 6, 0, 'Asia/Kolkata');
        `);
        console.log('✅ Default scheduler config created');
      }
      
      return;
    }

    // Create the table
    await db.execute(sql`
      CREATE TABLE scheduler_config (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        enabled INTEGER NOT NULL DEFAULT 0,
        hour INTEGER NOT NULL DEFAULT 6,
        minute INTEGER NOT NULL DEFAULT 0,
        timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
        updated_by TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
      );
    `);

    console.log('✅ scheduler_config table created successfully');
    
    // Insert default config row
    console.log('🌱 Seeding default scheduler config...');
    await db.execute(sql`
      INSERT INTO scheduler_config (enabled, hour, minute, timezone)
      VALUES (0, 6, 0, 'Asia/Kolkata');
    `);
    console.log('✅ Default scheduler config created');
  } catch (error) {
    console.error('❌ Failed to create scheduler_config table:', error);
    console.error('⚠️  Server will continue, but scheduler configuration may not be available');
    // Don't throw - allow server to continue booting
  }
}
