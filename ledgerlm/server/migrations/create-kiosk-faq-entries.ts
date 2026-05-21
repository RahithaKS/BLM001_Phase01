import { db } from "../db";
import { sql } from "drizzle-orm";

export async function createKioskFaqEntriesTable() {
  try {
    console.log("Running migration: create-kiosk-faq-entries");
    
    const tableCheck = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'kiosk_faq_entries'
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log("Creating kiosk_faq_entries table...");
      
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS kiosk_faq_entries (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          document_id VARCHAR NOT NULL REFERENCES kiosk_faq_documents(id) ON DELETE CASCADE,
          domain_id VARCHAR NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
          billing_category TEXT NOT NULL,
          question TEXT NOT NULL,
          answer TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS kiosk_faq_entries_document_id_idx ON kiosk_faq_entries(document_id)
      `);
      
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS kiosk_faq_entries_domain_id_idx ON kiosk_faq_entries(domain_id)
      `);
      
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS kiosk_faq_entries_billing_category_idx ON kiosk_faq_entries(billing_category)
      `);
      
      console.log("kiosk_faq_entries table created successfully");
    } else {
      console.log("kiosk_faq_entries table already exists, skipping");
    }
    
  } catch (error) {
    console.error("Migration error (create-kiosk-faq-entries):", error);
    throw error;
  }
}
