import { db } from "../db";
import { sql } from "drizzle-orm";

export async function createCubeMetadataTable() {
  console.log("🔧 Running cube_metadata migration...");
  
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cube_metadata (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        cube_id VARCHAR NOT NULL UNIQUE REFERENCES cubes(id) ON DELETE CASCADE,
        entities JSONB,
        metrics JSONB,
        periods JSONB,
        custom_fields JSONB,
        updated_by VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✅ Created cube_metadata table");

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS cube_metadata_cube_id_idx ON cube_metadata(cube_id)
    `);
    console.log("✅ Created cube_metadata indexes");
    
  } catch (error) {
    console.error("❌ Error creating cube_metadata table:", error);
    throw error;
  }
}
