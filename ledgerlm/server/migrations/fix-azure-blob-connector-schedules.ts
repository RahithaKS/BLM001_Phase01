import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * For any azure_blob connector that was auto-created from the cube wizard
 * (has a targetCubeId) but has scheduleEnabled = 0, copy the schedule from the
 * cube's ingestionConfig and enable it.
 *
 * This is a one-time idempotent fix that runs on every startup but only
 * updates rows that genuinely need fixing.
 */
export async function fixAzureBlobConnectorSchedules(): Promise<void> {
  try {
    // Find auto-created connectors (has targetCubeId, schedule disabled) joined with cubes that DO have a schedule
    const result = await db.execute(sql`
      SELECT
        dac.id AS connector_id,
        c.ingestion_config
      FROM domain_api_connectors dac
      JOIN cubes c ON c.id = dac.target_cube_id
      WHERE dac.connector_type = 'azure_blob'
        AND dac.target_cube_id IS NOT NULL
        AND dac.schedule_enabled = 0
        AND c.ingestion_config IS NOT NULL
    `);
    const rows: any[] = Array.isArray(result) ? result : (result as any).rows ?? [];

    let fixed = 0;
    for (const row of rows) {
      try {
        const config = typeof row.ingestion_config === 'string'
          ? JSON.parse(row.ingestion_config)
          : row.ingestion_config;

        if (!config?.schedule?.enabled || !config.schedule.time) continue;

        const [hour, minute] = config.schedule.time.split(':').map(Number);
        const timezone = config.schedule.timezone || 'Asia/Kolkata';

        await db.execute(sql`
          UPDATE domain_api_connectors
          SET schedule_enabled = 1,
              schedule_hour = ${hour},
              schedule_minute = ${minute},
              schedule_timezone = ${timezone},
              updated_at = NOW()
          WHERE id = ${row.connector_id}
        `);
        fixed++;
        console.log(`✅ Fixed schedule for connector ${row.connector_id}: ${hour}:${String(minute).padStart(2,'0')} ${timezone}`);
      } catch (e: any) {
        console.warn(`⚠️  Could not fix schedule for connector ${row.connector_id}:`, e.message);
      }
    }

    if (fixed > 0) {
      console.log(`✨ Fixed schedules on ${fixed} Azure Blob connector(s)`);
    }
  } catch (err: any) {
    // Non-fatal — don't block startup
    console.warn('⚠️  fix-azure-blob-connector-schedules: skipped —', err.message);
  }
}
