import { db } from "../db";
import { sql } from "drizzle-orm";

export async function addCubeIdToChunks() {
  console.log('🔧 Adding cube_id columns to enterprise chunks and embeddings tables...');

  try {
    await db.execute(sql`
      ALTER TABLE enterprise_document_chunks 
      ADD COLUMN IF NOT EXISTS cube_id VARCHAR REFERENCES cubes(id) ON DELETE SET NULL
    `);
    console.log('✅ Added cube_id column to enterprise_document_chunks');
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      console.log('✅ cube_id column already exists in enterprise_document_chunks');
    } else {
      console.error('Error adding cube_id to enterprise_document_chunks:', error.message);
    }
  }

  try {
    await db.execute(sql`
      ALTER TABLE enterprise_document_embeddings 
      ADD COLUMN IF NOT EXISTS cube_id VARCHAR REFERENCES cubes(id) ON DELETE SET NULL
    `);
    console.log('✅ Added cube_id column to enterprise_document_embeddings');
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      console.log('✅ cube_id column already exists in enterprise_document_embeddings');
    } else {
      console.error('Error adding cube_id to enterprise_document_embeddings:', error.message);
    }
  }

  try {
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS enterprise_document_chunks_cube_id_idx 
      ON enterprise_document_chunks(cube_id)
    `);
    console.log('✅ Created index on enterprise_document_chunks.cube_id');
  } catch (error: any) {
    console.log('Index on enterprise_document_chunks.cube_id already exists or error:', error.message);
  }

  try {
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS enterprise_document_embeddings_cube_id_idx 
      ON enterprise_document_embeddings(cube_id)
    `);
    console.log('✅ Created index on enterprise_document_embeddings.cube_id');
  } catch (error: any) {
    console.log('Index on enterprise_document_embeddings.cube_id already exists or error:', error.message);
  }

  console.log('✨ Cube ID columns migration completed!');
}
