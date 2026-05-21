/**
 * Migration: Create Schema Configuration Tables
 * 
 * This creates tables for domain-specific column configuration and hierarchy metadata:
 * 1. cube_column_config - Column definitions with descriptions, types, and aliases
 * 2. domain_hierarchy_config - Organizational hierarchies per domain
 * 3. cube_schema_versions - Track schema changes between uploads
 */
import { db } from "../db";
import { sql } from "drizzle-orm";

export async function runSchemaConfigMigration() {
  console.log("🔧 Running schema configuration tables migration...");
  
  try {
    // 1. Create cube_column_config table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cube_column_config (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        cube_id VARCHAR(255) NOT NULL REFERENCES cubes(id) ON DELETE CASCADE,
        column_index INTEGER NOT NULL,
        original_name TEXT NOT NULL,
        display_name TEXT,
        column_type VARCHAR(20) NOT NULL DEFAULT 'dimension',
        data_type VARCHAR(20) NOT NULL DEFAULT 'text',
        description TEXT,
        aliases TEXT[],
        aggregation_rule VARCHAR(20) DEFAULT 'sum',
        hierarchy_ref VARCHAR(255),
        use_for_sql INTEGER NOT NULL DEFAULT 1,
        use_for_rag INTEGER NOT NULL DEFAULT 1,
        sample_values TEXT[],
        is_nullable INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(cube_id, column_index)
      )
    `);
    console.log("✅ Created cube_column_config table");

    // Create indexes for cube_column_config
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS cube_column_config_cube_id_idx 
      ON cube_column_config(cube_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS cube_column_config_column_type_idx 
      ON cube_column_config(column_type)
    `);
    console.log("✅ Created cube_column_config indexes");

    // 2. Create domain_hierarchy_config table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS domain_hierarchy_config (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        domain_id VARCHAR(255) NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
        hierarchy_name TEXT NOT NULL,
        description TEXT,
        levels TEXT[] NOT NULL,
        column_mappings JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✅ Created domain_hierarchy_config table");

    // Create indexes for domain_hierarchy_config
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS domain_hierarchy_config_domain_id_idx 
      ON domain_hierarchy_config(domain_id)
    `);
    console.log("✅ Created domain_hierarchy_config indexes");

    // 3. Create cube_schema_versions table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cube_schema_versions (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        cube_id VARCHAR(255) NOT NULL REFERENCES cubes(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        column_names TEXT[] NOT NULL,
        column_hash TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✅ Created cube_schema_versions table");

    // Create indexes for cube_schema_versions
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS cube_schema_versions_cube_id_idx 
      ON cube_schema_versions(cube_id)
    `);
    console.log("✅ Created cube_schema_versions indexes");

    console.log("✅ Schema configuration tables migration completed successfully");
    
  } catch (error: any) {
    // Handle "already exists" gracefully
    if (error.message?.includes('already exists') || error.code === '42P07') {
      console.log("ℹ️ Schema configuration tables already exist, skipping creation");
      return;
    }
    console.error("❌ Schema configuration tables migration failed:", error);
    throw error;
  }
}
