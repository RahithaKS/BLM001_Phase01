import { db } from "../db";
import { sql } from "drizzle-orm";

export async function addSsoGroupColumnsToDomains(): Promise<void> {
  try {
    console.log("🔧 Adding SSO group columns to domains table...");

    await db.execute(sql`
      ALTER TABLE domains
        ADD COLUMN IF NOT EXISTS sso_group_id TEXT
    `);

    await db.execute(sql`
      ALTER TABLE domains
        ADD COLUMN IF NOT EXISTS sso_default_role VARCHAR(20) NOT NULL DEFAULT 'standard'
    `);

    console.log("✅ SSO group columns added to domains table");
  } catch (error: any) {
    console.error("Error adding SSO group columns:", error);
    throw error;
  }
}
