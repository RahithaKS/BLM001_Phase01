import { db } from "../db";
import { sql } from "drizzle-orm";

export async function addDomainAnaplanCredentials() {
  console.log("🔧 Adding Anaplan credentials columns to domain_scheduler_config...");
  
  try {
    await db.execute(sql`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'domain_scheduler_config' AND column_name = 'anaplan_username') THEN
          ALTER TABLE domain_scheduler_config ADD COLUMN anaplan_username VARCHAR(255);
        END IF;
      END $$;
    `);
    console.log("✅ Added anaplan_username column");
    
    await db.execute(sql`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'domain_scheduler_config' AND column_name = 'anaplan_password') THEN
          ALTER TABLE domain_scheduler_config ADD COLUMN anaplan_password VARCHAR(255);
        END IF;
      END $$;
    `);
    console.log("✅ Added anaplan_password column");
    
    console.log("✨ Anaplan credentials migration completed successfully!");
    return true;
  } catch (error) {
    console.error("❌ Anaplan credentials migration failed:", error);
    return false;
  }
}
