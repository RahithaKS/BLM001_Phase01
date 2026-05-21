import { db } from "../db";
import { sql } from "drizzle-orm";

export async function runDomainEnhancementsMigration() {
  console.log("🔧 Running domain enhancements migration...");
  
  try {
    // Add company_id column to domains if not exists
    await db.execute(sql`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'domains' AND column_name = 'company_id') THEN
          ALTER TABLE domains ADD COLUMN company_id VARCHAR REFERENCES companies(id) ON DELETE SET NULL;
          CREATE INDEX IF NOT EXISTS domains_company_id_idx ON domains(company_id);
        END IF;
      END $$;
    `);
    console.log("✅ Added company_id column to domains table");
    
    // Add user_quota column to domains if not exists
    await db.execute(sql`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'domains' AND column_name = 'user_quota') THEN
          ALTER TABLE domains ADD COLUMN user_quota INTEGER DEFAULT 50;
        END IF;
      END $$;
    `);
    console.log("✅ Added user_quota column to domains table");
    
    // Drop the unique constraint on domain_users.email if it exists (to allow multi-domain users)
    await db.execute(sql`
      DO $$ 
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'domain_users_email_unique') THEN
          ALTER TABLE domain_users DROP CONSTRAINT domain_users_email_unique;
        END IF;
      END $$;
    `);
    console.log("✅ Removed global unique constraint on domain_users.email");
    
    // Create composite unique index on (domain_id, email) if not exists
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS domain_users_domain_email_idx ON domain_users(domain_id, email);
    `);
    console.log("✅ Created composite unique index on domain_users(domain_id, email)");
    
    // Create domain_scheduler_config table if not exists
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS domain_scheduler_config (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        domain_id VARCHAR NOT NULL UNIQUE REFERENCES domains(id) ON DELETE CASCADE,
        enabled INTEGER NOT NULL DEFAULT 0,
        hour INTEGER NOT NULL DEFAULT 6,
        minute INTEGER NOT NULL DEFAULT 0,
        timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
        anaplan_workspace_id VARCHAR(100),
        anaplan_model_id VARCHAR(100),
        anaplan_process_id VARCHAR(100),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_by VARCHAR REFERENCES users(id) ON DELETE SET NULL
      );
    `);
    console.log("✅ Created domain_scheduler_config table");
    
    // Create index on domain_scheduler_config.domain_id
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS domain_scheduler_config_domain_id_idx ON domain_scheduler_config(domain_id);
    `);
    console.log("✅ Created index on domain_scheduler_config.domain_id");
    
    // Backfill: Link existing domains to companies based on domain name matching
    await db.execute(sql`
      UPDATE domains d
      SET company_id = (
        SELECT c.id FROM companies c 
        WHERE LOWER(c.slug) = LOWER(REPLACE(d.name, '.', '-'))
        OR LOWER(c.name) = LOWER(SPLIT_PART(d.name, '.', 1))
        LIMIT 1
      )
      WHERE d.company_id IS NULL;
    `);
    console.log("✅ Backfilled company_id for existing domains");
    
    console.log("✨ Domain enhancements migration completed successfully!");
    return true;
  } catch (error) {
    console.error("❌ Domain enhancements migration failed:", error);
    return false;
  }
}
