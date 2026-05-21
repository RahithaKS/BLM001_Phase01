import { db } from "../db";
import { sql } from "drizzle-orm";

export async function runConnectorPreferencesMigration() {
  console.log('🔧 Adding connector_preferences column to user_settings...');
  
  try {
    await db.execute(sql`
      ALTER TABLE user_settings 
      ADD COLUMN IF NOT EXISTS connector_preferences TEXT
    `);
    console.log('✅ Added connector_preferences column');
    console.log('✨ Connector preferences migration completed successfully!');
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      console.log('✅ connector_preferences column already exists');
    } else {
      console.error('❌ Failed to add connector_preferences column:', error);
      throw error;
    }
  }
}
