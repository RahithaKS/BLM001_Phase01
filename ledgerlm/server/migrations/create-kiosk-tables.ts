import { db } from "../db";
import { sql } from "drizzle-orm";

export async function createKioskTables() {
  console.log("🔧 Running kiosk tables migration...");
  
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS kiosk_faq_documents (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        domain_id VARCHAR NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size TEXT NOT NULL,
        file_type TEXT NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        uploaded_by VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        uploaded_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✅ Created kiosk_faq_documents table");
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS kiosk_faq_documents_domain_id_idx ON kiosk_faq_documents(domain_id)
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS kiosk_faq_documents_status_idx ON kiosk_faq_documents(status)
    `);
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS kiosk_chats (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        domain_id VARCHAR NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
        title TEXT NOT NULL DEFAULT 'Kiosk Chat',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✅ Created kiosk_chats table");
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS kiosk_chats_user_id_idx ON kiosk_chats(user_id)
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS kiosk_chats_domain_id_idx ON kiosk_chats(domain_id)
    `);
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS kiosk_messages (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        chat_id VARCHAR NOT NULL REFERENCES kiosk_chats(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        role VARCHAR(20) NOT NULL,
        sources JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✅ Created kiosk_messages table");
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS kiosk_messages_chat_id_idx ON kiosk_messages(chat_id)
    `);
    
    console.log("✅ Kiosk tables migration completed successfully");
    return true;
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      console.log("ℹ️ Kiosk tables already exist, skipping...");
      return true;
    }
    console.error("❌ Kiosk tables migration failed:", error.message);
    throw error;
  }
}
