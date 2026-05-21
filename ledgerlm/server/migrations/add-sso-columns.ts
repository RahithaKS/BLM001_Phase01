import { db } from "../db";
import { sql } from "drizzle-orm";

export async function addSsoColumnsToDomains(): Promise<void> {
  try {
    console.log("🔧 Adding SSO columns to domains table...");

    await db.execute(sql`
      ALTER TABLE domains
        ADD COLUMN IF NOT EXISTS auth_method VARCHAR(20) NOT NULL DEFAULT 'otp'
    `);

    await db.execute(sql`
      ALTER TABLE domains
        ADD COLUMN IF NOT EXISTS sso_tenant_id TEXT
    `);

    await db.execute(sql`
      ALTER TABLE domains
        ADD COLUMN IF NOT EXISTS sso_client_id TEXT
    `);

    await db.execute(sql`
      ALTER TABLE domains
        ADD COLUMN IF NOT EXISTS sso_client_secret TEXT
    `);

    console.log("✅ SSO columns added to domains table");
    console.log("✨ SSO columns migration completed!");
  } catch (error: any) {
    console.error("Error adding SSO columns:", error);
    throw error;
  }
}
