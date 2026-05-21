import { db } from "../db";
import { sql } from "drizzle-orm";

export async function addBillingTypeColumn() {
  try {
    console.log("Running migration: add-billing-type-column");
    
    // Check if billing_type column already exists
    const columnCheck = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'kiosk_faq_documents' 
      AND column_name = 'billing_type'
    `);
    
    if (columnCheck.rows.length === 0) {
      console.log("Adding billing_type column to kiosk_faq_documents table...");
      
      await db.execute(sql`
        ALTER TABLE kiosk_faq_documents 
        ADD COLUMN IF NOT EXISTS billing_type VARCHAR(100)
      `);
      
      // Create index for billing_type
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS kiosk_faq_documents_billing_type_idx 
        ON kiosk_faq_documents(billing_type)
      `);
      
      console.log("billing_type column added successfully");
    } else {
      console.log("billing_type column already exists, skipping");
    }
    
    // Check if unique constraint exists for domain_id + billing_type
    const constraintCheck = await db.execute(sql`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'kiosk_faq_documents' 
      AND constraint_name = 'kiosk_faq_documents_domain_billing_type_unique'
    `);
    
    if (constraintCheck.rows.length === 0) {
      console.log("Adding unique constraint for domain_id + billing_type...");
      
      // First, delete any duplicate entries keeping only the latest per domain+billingType
      await db.execute(sql`
        DELETE FROM kiosk_faq_documents a
        USING kiosk_faq_documents b
        WHERE a.domain_id = b.domain_id 
          AND a.billing_type = b.billing_type 
          AND a.billing_type IS NOT NULL
          AND a.uploaded_at < b.uploaded_at
      `);
      
      // Add unique constraint (only for non-null billing_type)
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS kiosk_faq_documents_domain_billing_type_unique 
        ON kiosk_faq_documents(domain_id, billing_type) 
        WHERE billing_type IS NOT NULL
      `);
      
      console.log("Unique constraint added successfully");
    } else {
      console.log("Unique constraint already exists, skipping");
    }
    
  } catch (error) {
    console.error("Migration error (add-billing-type-column):", error);
    throw error;
  }
}
