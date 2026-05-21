import { db } from "../db";
import { sql } from "drizzle-orm";

export async function createIngestionJobsTable() {
  console.log("🔧 Creating cube_ingestion_jobs table...");
  
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cube_ingestion_jobs (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        cube_id VARCHAR(255) NOT NULL REFERENCES cubes(id) ON DELETE CASCADE,
        document_id VARCHAR(255) REFERENCES enterprise_documents(id) ON DELETE SET NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
        total_rows INTEGER DEFAULT 0,
        processed_rows INTEGER DEFAULT 0,
        error_message TEXT,
        file_name VARCHAR(500),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE
      )
    `);
    console.log("✅ Created cube_ingestion_jobs table");
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_cube_id ON cube_ingestion_jobs(cube_id)
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_status ON cube_ingestion_jobs(status)
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_created_at ON cube_ingestion_jobs(created_at DESC)
    `);
    console.log("✅ Created cube_ingestion_jobs indexes");
    
    console.log("✨ Ingestion jobs migration completed!");
  } catch (error: any) {
    if (error.code === '42P07' || error.message?.includes('already exists')) {
      console.log("✅ cube_ingestion_jobs table already exists");
    } else {
      console.error("Error creating cube_ingestion_jobs table:", error);
      throw error;
    }
  }
}
