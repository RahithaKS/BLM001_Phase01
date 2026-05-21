import { db } from '../db';
import { users, companies, companyMemberships, userSettings } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';

export async function fixCompanyMemberships() {
  console.log('🔧 Fixing company memberships...');

  try {
    const result = await db.execute(sql`SELECT id, slug FROM companies WHERE slug = 'matasma' LIMIT 1`);
    
    if (result.rows.length === 0) {
      const inserted = await db.execute(sql`INSERT INTO companies (name, slug, description) VALUES ('Matasma', 'matasma', 'Matasma - Financial Services') RETURNING id, slug`);
      console.log('✅ Matasma company created');
    } else {
      console.log('✅ Matasma company already exists');
    }

    const adminUsers = await db.execute(sql`
      SELECT id, username FROM users 
      WHERE username IN ('rahitha@matasma.com', 'customer@ledgerlm.ai', 'admin@nemko.com')
    `);

    const companiesResult = await db.execute(sql`
      SELECT id, slug FROM companies 
      WHERE slug IN ('matasma', 'ledgerlm', 'nemko')
    `);

    const userMap = new Map(adminUsers.rows.map((r: any) => [r.username, r.id]));
    const companyMap = new Map(companiesResult.rows.map((r: any) => [r.slug, r.id]));

    const pairs = [
      { username: 'rahitha@matasma.com', companySlug: 'matasma' },
      { username: 'customer@ledgerlm.ai', companySlug: 'ledgerlm' },
      { username: 'admin@nemko.com', companySlug: 'nemko' },
    ];

    for (const { username, companySlug } of pairs) {
      const userId = userMap.get(username);
      const companyId = companyMap.get(companySlug);
      if (!userId || !companyId) continue;

      const existing = await db.execute(sql`
        SELECT id FROM company_memberships WHERE user_id = ${userId} AND company_id = ${companyId} LIMIT 1
      `);

      if (existing.rows.length === 0) {
        await db.execute(sql`
          INSERT INTO company_memberships (user_id, company_id, role) VALUES (${userId}, ${companyId}, 'admin')
        `);
        console.log(`✅ Added company membership for ${username}`);
      } else {
        console.log(`✅ Company membership already exists for ${username}`);
      }

      const settings = await db.execute(sql`
        SELECT id, active_company_id FROM user_settings WHERE user_id = ${userId} LIMIT 1
      `);

      if (settings.rows.length === 0) {
        await db.execute(sql`
          INSERT INTO user_settings (user_id, enterprise_enabled, active_company_id) VALUES (${userId}, 1, ${companyId})
        `);
        console.log(`✅ Created user settings for ${username}`);
      } else if (!(settings.rows[0] as any).active_company_id) {
        await db.execute(sql`
          UPDATE user_settings SET active_company_id = ${companyId}, enterprise_enabled = 1 WHERE user_id = ${userId}
        `);
        console.log(`✅ Updated user settings for ${username}`);
      } else {
        console.log(`✅ User settings already exist for ${username}`);
      }
    }

    console.log('✨ Company memberships fixed successfully!');
  } catch (error: any) {
    console.log(`⚠️  Company memberships migration skipped: ${error.message}`);
  }
}
