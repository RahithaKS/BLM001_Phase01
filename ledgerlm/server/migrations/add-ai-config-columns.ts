import { db } from "../db";
import { sql } from "drizzle-orm";

export async function addAiConfigColumnsToDomains(): Promise<void> {
  try {
    console.log("🔧 Adding AI config columns to domains table...");

    await db.execute(sql`
      ALTER TABLE domains
        ADD COLUMN IF NOT EXISTS ai_provider VARCHAR(20) DEFAULT 'ollama'
    `);

    await db.execute(sql`
      ALTER TABLE domains
        ADD COLUMN IF NOT EXISTS ai_endpoint TEXT
    `);

    await db.execute(sql`
      ALTER TABLE domains
        ADD COLUMN IF NOT EXISTS ai_api_key TEXT
    `);

    await db.execute(sql`
      ALTER TABLE domains
        ADD COLUMN IF NOT EXISTS ai_chat_model TEXT
    `);

    await db.execute(sql`
      ALTER TABLE domains
        ADD COLUMN IF NOT EXISTS ai_chat_api_version TEXT
    `);

    await db.execute(sql`
      ALTER TABLE domains
        ADD COLUMN IF NOT EXISTS ai_embedding_model TEXT
    `);

    await db.execute(sql`
      ALTER TABLE domains
        ADD COLUMN IF NOT EXISTS ai_embedding_api_version TEXT
    `);

    await db.execute(sql`
      ALTER TABLE domains
        ADD COLUMN IF NOT EXISTS ai_system_prompt TEXT
    `);

    console.log("✅ AI config columns added to domains table");

    console.log("🔧 Adding embedding_3072 column to document_embeddings...");
    await db.execute(sql`
      ALTER TABLE document_embeddings
        ADD COLUMN IF NOT EXISTS embedding_3072 vector(3072)
    `);
    console.log("✅ embedding_3072 added to document_embeddings");

    console.log("🔧 Adding embedding_3072 column to enterprise_document_embeddings...");
    await db.execute(sql`
      ALTER TABLE enterprise_document_embeddings
        ADD COLUMN IF NOT EXISTS embedding_3072 vector(3072)
    `);
    console.log("✅ embedding_3072 added to enterprise_document_embeddings");

    // Note: HNSW index is limited to 2000 dims in pgvector; 3072-dim uses sequential scan
    // (acceptable for Bosch pilot volume — can add IVFFlat later if needed)

    console.log("✨ AI config migration completed!");
  } catch (error: any) {
    console.error("Error in AI config migration:", error);
    throw error;
  }
}
