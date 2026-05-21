import { db } from "../db";
import { sql } from "drizzle-orm";

export async function addEmailConfigColumnsToDomains(): Promise<void> {
  try {
    console.log("🔧 Adding email config columns to domains table...");

    await db.execute(sql`
      ALTER TABLE domains
        ADD COLUMN IF NOT EXISTS email_provider VARCHAR(20) DEFAULT 'default'
    `);

    await db.execute(sql`
      ALTER TABLE domains
        ADD COLUMN IF NOT EXISTS email_smtp_user TEXT
    `);

    await db.execute(sql`
      ALTER TABLE domains
        ADD COLUMN IF NOT EXISTS email_smtp_pass TEXT
    `);

    await db.execute(sql`
      ALTER TABLE domains
        ADD COLUMN IF NOT EXISTS email_from_address TEXT
    `);

    await db.execute(sql`
      ALTER TABLE domains
        ADD COLUMN IF NOT EXISTS email_from_name TEXT
    `);

    console.log("✅ Email config columns added to domains table");
    console.log("✨ Email config migration completed!");
  } catch (error: any) {
    console.error("Error adding email config columns:", error);
    throw error;
  }
}
