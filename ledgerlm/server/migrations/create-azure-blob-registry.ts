import { db } from "../db";
import { sql } from "drizzle-orm";

export async function createAzureBlobRegistryTable(): Promise<void> {
  console.log("🔧 Creating azure_blob_file_registry table...");

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS azure_blob_file_registry (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        connector_id VARCHAR NOT NULL REFERENCES domain_api_connectors(id) ON DELETE CASCADE,
        blob_name TEXT NOT NULL,
        etag VARCHAR(256),
        last_modified TIMESTAMP,
        ingested_at TIMESTAMP NOT NULL DEFAULT NOW(),
        document_id VARCHAR,
        job_id VARCHAR,
        status VARCHAR(20) NOT NULL DEFAULT 'success',
        CONSTRAINT azure_blob_registry_connector_blob_uniq UNIQUE (connector_id, blob_name)
      )
    `);
    console.log("✅ Created azure_blob_file_registry table");

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS azure_blob_registry_connector_idx
        ON azure_blob_file_registry(connector_id)
    `);
    console.log("✅ Created index on azure_blob_file_registry.connector_id");

    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS azure_blob_registry_connector_blob_idx
        ON azure_blob_file_registry(connector_id, blob_name)
    `);
    console.log("✅ Created unique index on (connector_id, blob_name)");

    console.log("✨ azure_blob_file_registry migration completed!");
  } catch (error) {
    console.error("❌ azure_blob_file_registry migration failed:", error);
    throw error;
  }
}

export async function dropAzureBlobConnectorUniqueConstraint(): Promise<void> {
  console.log("🔧 Removing single-connector-per-domain constraint from domain_api_connectors...");
  try {
    await db.execute(sql`
      ALTER TABLE domain_api_connectors
        DROP CONSTRAINT IF EXISTS domain_api_connectors_domain_id_connector_type_key
    `);
    console.log("✅ Dropped UNIQUE(domain_id, connector_type) — multiple connectors of same type now allowed");
  } catch (error) {
    console.warn("⚠️  Could not drop unique constraint (may not exist):", (error as any).message);
  }
}
