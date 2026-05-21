import { db } from "../db";
import { sql } from "drizzle-orm";

export async function createDomainApiConnectorsTable() {
  console.log("🔧 Creating domain_api_connectors table...");
  
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS domain_api_connectors (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        domain_id VARCHAR NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
        connector_type VARCHAR(50) NOT NULL,
        name VARCHAR(100) NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        config JSONB NOT NULL DEFAULT '{}',
        tags TEXT[] DEFAULT '{}',
        status VARCHAR(20) DEFAULT 'pending',
        last_sync_at TIMESTAMP,
        last_sync_result TEXT,
        document_count INTEGER DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_by VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE(domain_id, connector_type)
      );
    `);
    console.log("✅ Created domain_api_connectors table");
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS domain_api_connectors_domain_id_idx ON domain_api_connectors(domain_id);
    `);
    console.log("✅ Created index on domain_api_connectors.domain_id");
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS domain_api_connectors_type_idx ON domain_api_connectors(connector_type);
    `);
    console.log("✅ Created index on domain_api_connectors.connector_type");
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS domain_api_connectors_enabled_idx ON domain_api_connectors(enabled);
    `);
    console.log("✅ Created index on domain_api_connectors.enabled");
    
    console.log("✨ domain_api_connectors table created successfully!");
    
    // Add scheduling columns if they don't exist
    await addSchedulingColumns();
    
    // Add blob_prefix column if it doesn't exist
    await addBlobPrefixColumn();
    
    return true;
  } catch (error) {
    console.error("❌ domain_api_connectors migration failed:", error);
    return false;
  }
}

async function addSchedulingColumns() {
  console.log("🔧 Adding scheduling columns to domain_api_connectors...");
  
  try {
    // Check if columns already exist
    const result = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'domain_api_connectors' AND column_name = 'schedule_enabled'
    `);
    
    if (result.rows.length > 0) {
      console.log("✅ Scheduling columns already exist");
      return;
    }
    
    // Add scheduling columns
    await db.execute(sql`
      ALTER TABLE domain_api_connectors 
      ADD COLUMN IF NOT EXISTS schedule_enabled INTEGER NOT NULL DEFAULT 0
    `);
    console.log("✅ Added schedule_enabled column");
    
    await db.execute(sql`
      ALTER TABLE domain_api_connectors 
      ADD COLUMN IF NOT EXISTS schedule_hour INTEGER DEFAULT 6
    `);
    console.log("✅ Added schedule_hour column");
    
    await db.execute(sql`
      ALTER TABLE domain_api_connectors 
      ADD COLUMN IF NOT EXISTS schedule_minute INTEGER DEFAULT 0
    `);
    console.log("✅ Added schedule_minute column");
    
    await db.execute(sql`
      ALTER TABLE domain_api_connectors 
      ADD COLUMN IF NOT EXISTS schedule_timezone VARCHAR(50) DEFAULT 'Asia/Kolkata'
    `);
    console.log("✅ Added schedule_timezone column");
    
    console.log("✨ Scheduling columns added successfully!");
  } catch (error) {
    console.error("❌ Failed to add scheduling columns:", error);
  }
}

async function addBlobPrefixColumn() {
  try {
    await db.execute(sql`
      ALTER TABLE domain_api_connectors 
      ADD COLUMN IF NOT EXISTS blob_prefix VARCHAR
    `);
    console.log("✅ blob_prefix column ensured on domain_api_connectors");
  } catch (error) {
    console.error("❌ Failed to add blob_prefix column:", error);
  }
}
