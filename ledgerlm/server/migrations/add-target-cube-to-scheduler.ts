import { db } from '../db';
import { sql } from 'drizzle-orm';

export async function addTargetCubeToSchedulerConfig() {
  console.log('🔧 Adding target_cube_id column to domain_scheduler_config...');
  
  try {
    // Check if column exists
    const columnCheck = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'domain_scheduler_config' 
      AND column_name = 'target_cube_id'
    `);
    
    if (columnCheck.rows.length === 0) {
      await db.execute(sql`
        ALTER TABLE domain_scheduler_config 
        ADD COLUMN target_cube_id VARCHAR REFERENCES cubes(id) ON DELETE SET NULL
      `);
      console.log('✅ Added target_cube_id column');
    } else {
      console.log('✅ target_cube_id column already exists');
    }
    
    console.log('✨ Target cube migration completed!');
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}
