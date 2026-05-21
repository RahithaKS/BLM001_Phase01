import { anaplanService } from './anaplanService';
import { versionManager } from './versionManager';
import { db } from '../db';
import { anaplanAutomationLogs, companies, users, companyMemberships } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import * as path from 'path';

interface AutomationResult {
  success: boolean;
  logId: string;
  filesDownloaded: number;
  filesProcessed: number;
  filesFailed: number;
  newVersionsCreated: number;
  archivedVersions: number;
  error?: string;
  details: any;
}

export class AnaplanAutomation {
  private readonly DOWNLOAD_DIR = 'anaplan';

  async runAutomatedSync(
    triggerType: 'scheduled' | 'manual',
    triggeredBy?: string
  ): Promise<AutomationResult> {
    const startedAt = new Date();
    let logId = '';
    let filesDownloaded = 0;
    let filesProcessed = 0;
    let filesFailed = 0;
    let newVersionsCreated = 0;
    let archivedVersions = 0;
    const details: any[] = [];

    try {
      console.log('\n========================================');
      console.log('🚀 ANAPLAN AUTOMATION STARTING');
      console.log(`   Trigger: ${triggerType}`);
      if (triggeredBy) {
        console.log(`   Triggered by: ${triggeredBy}`);
      }
      console.log('========================================\n');

      // Get the target company based on ANAPLAN_COMPANY_ID or first available company
      // This ensures multi-tenant isolation and prevents processing arbitrary tenant data
      const targetCompanyId = process.env.ANAPLAN_COMPANY_ID;
      
      let company;
      if (targetCompanyId) {
        const targetCompany = await db
          .select()
          .from(companies)
          .where(eq(companies.id, targetCompanyId))
          .limit(1);
        
        if (targetCompany.length === 0) {
          throw new Error(`Target company not found: ${targetCompanyId}`);
        }
        company = targetCompany[0];
      } else {
        // Fallback to first company if ANAPLAN_COMPANY_ID not set
        const companiesList = await db.select().from(companies).limit(1);
        
        if (companiesList.length === 0) {
          throw new Error('No company found in database');
        }
        company = companiesList[0];
        console.warn(`⚠️  ANAPLAN_COMPANY_ID not set, using first company: ${company.name}`);
      }

      const companyId = company.id;
      console.log(`🏢 Company: ${company.name} (${companyId})`);

      // Get or create system automation user for scheduled uploads
      // For manual triggers, use the triggering user's ID
      const systemUserId = await this.getSystemUserId(companyId);
      console.log(`🤖 System user ID: ${systemUserId}`);
      
      // Use actual triggering user for manual runs (traceability)
      // Use system user only for automated/scheduled runs
      const uploadUserId = triggeredBy || systemUserId;
      const logTriggeredBy = triggeredBy || systemUserId;
      
      console.log(`👤 Upload user ID: ${uploadUserId} (${triggeredBy ? 'manual' : 'automated'})`);

      // Create automation log entry
      const logResult = await db
        .insert(anaplanAutomationLogs)
        .values({
          companyId,
          status: 'running',
          triggerType,
          triggeredBy: logTriggeredBy,
          filesDownloaded: 0,
          filesProcessed: 0,
          filesFailed: 0,
          newVersionsCreated: 0,
          archivedVersions: 0,
          startedAt,
          details: [],
        })
        .returning({ id: anaplanAutomationLogs.id });

      logId = logResult[0].id;

      // Step 1: Run Anaplan export and download files
      console.log('\n📥 STEP 1: Downloading files from Anaplan...\n');
      
      if (!anaplanService) {
        throw new Error('Anaplan service not configured. Set ANAPLAN_WORKSPACE_ID, ANAPLAN_MODEL_ID, ANAPLAN_EXPORT_PROCESS_ID, ANAPLAN_USERNAME, and ANAPLAN_PASSWORD environment variables.');
      }
      
      const exportResult = await anaplanService.runFullExportSync(this.DOWNLOAD_DIR);

      filesDownloaded = exportResult.files.filter(f => f.success).length;
      filesFailed = exportResult.files.filter(f => !f.success).length;

      console.log(`\n📊 Downloaded ${filesDownloaded} files, ${filesFailed} failed\n`);

      // Continue processing if we have at least some successful downloads
      // Even if some files failed, we should process the ones that succeeded
      if (filesDownloaded === 0) {
        throw new Error('No files were successfully downloaded');
      }

      if (filesFailed > 0) {
        console.warn(`⚠️  ${filesFailed} file(s) failed to download, continuing with ${filesDownloaded} successful downloads`);
      }

      // Step 2: Process each downloaded file and create versions
      console.log('\n📝 STEP 2: Creating versions for downloaded files...\n');

      const createdDocuments: Array<{ documentId: string; fileName: string; filePath: string }> = [];

      for (const file of exportResult.files) {
        if (!file.success) {
          details.push({
            fileName: file.fileName,
            status: 'download_failed',
            error: file.error,
          });
          continue;
        }

        try {
          console.log(`   Processing: ${file.fileName}`);

          // Create new version of this document
          // Use 'anaplan_manual' for manual triggers, 'anaplan_auto' for scheduled
          const documentSource = triggerType === 'manual' ? 'anaplan_manual' : 'anaplan_auto';
          
          const result = await versionManager.createNewVersion(
            companyId,
            uploadUserId,
            file.fileName,
            file.filePath,
            file.fileSize.toString(),
            this.getFileType(file.fileName),
            documentSource,
            {
              processId: process.env.ANAPLAN_EXPORT_PROCESS_ID,
              exportName: file.fileName,
              syncDate: startedAt.toISOString(),
              taskId: exportResult.taskId,
            }
          );

          newVersionsCreated++;
          archivedVersions += result.archivedCount;

          // Track created document for processing
          createdDocuments.push({
            documentId: result.documentId,
            fileName: file.fileName,
            filePath: file.filePath,
          });

          details.push({
            fileName: file.fileName,
            status: 'version_created',
            documentId: result.documentId,
            fileSize: file.fileSize,
            archivedVersions: result.archivedCount,
          });

          console.log(`   ✅ Version created for ${file.fileName} (archived ${result.archivedCount} old versions)`);
        } catch (error: any) {
          console.error(`   ❌ Failed to create version for ${file.fileName}:`, error.message);
          filesFailed++;
          details.push({
            fileName: file.fileName,
            status: 'version_failed',
            error: error.message,
          });
        }
      }

      // Step 3: Trigger automatic processing for all created documents
      console.log('\n🔄 STEP 3: Triggering automatic processing for created documents...\n');

      const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000';

      for (const doc of createdDocuments) {
        let processingTriggered = false;
        let lastError: string = '';

        // Retry logic: Try up to 3 times with 2 second delay between attempts
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            if (attempt > 1) {
              console.log(`   Retry ${attempt}/3 for ${doc.fileName}...`);
              await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
            } else {
              console.log(`   Triggering processing: ${doc.fileName}`);
            }

            // doc.filePath already contains the full relative path (e.g., "uploads/anaplan/filename")
            // so we don't need to prepend "uploads/" again
            
            // Create AbortController for 120 second timeout (large files need more time)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 seconds

            try {
              // Trigger Python backend processing
              const response = await fetch(`${PYTHON_API_URL}/api/v2/enterprise/process/${doc.documentId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  file_path: doc.filePath,
                  company_id: companyId,
                }),
                signal: controller.signal,
              });

              clearTimeout(timeoutId);

              if (!response.ok) {
                throw new Error(`Processing failed: ${response.statusText}`);
              }

              const result = await response.json();
              
              // Update detail status to processing_triggered
              const detailIndex = details.findIndex(d => d.documentId === doc.documentId);
              if (detailIndex >= 0) {
                details[detailIndex].status = 'processing_triggered';
                details[detailIndex].processingStatus = result.status || 'processing';
              }

              filesProcessed++;
              processingTriggered = true;
              console.log(`   ✅ Processing triggered for ${doc.fileName}`);
              break; // Success! Exit retry loop
            } catch (fetchError: any) {
              clearTimeout(timeoutId);
              throw fetchError;
            }
          } catch (error: any) {
            lastError = error.message;
            if (attempt === 3) {
              // Final attempt failed - increment failed counter
              console.error(`   ❌ Failed to trigger processing for ${doc.fileName} after 3 attempts:`, error.message);
              filesFailed++; // BUG FIX: Count processing failures
              
              // Update detail status to processing_failed
              const detailIndex = details.findIndex(d => d.documentId === doc.documentId);
              if (detailIndex >= 0) {
                details[detailIndex].status = 'processing_failed';
                details[detailIndex].processingError = `Failed after 3 attempts: ${error.message}`;
              }
            }
          }
        }
      }

      // Step 4: Archival complete
      console.log('\n🗄️  STEP 4: Version archival and processing complete\n');

      // archivedVersions is tracked by versionManager.createNewVersion
      // We can query for archived count if needed

      const completedAt = new Date();
      
      // BUG FIX: Drive status off both counters to properly classify:
      // - 'failed': No files processed at all
      // - 'partial_success': Some files processed, but some failed
      // - 'success': All files processed successfully
      const status = filesProcessed === 0 
        ? 'failed' 
        : filesFailed > 0 
          ? 'partial_success' 
          : 'success';

      // BUG FIX: Only fail when NO files were processed successfully (not when ANY files fail)
      // Partial success = some files succeeded = still considered successful for resilience
      const overallSuccess = filesProcessed > 0;

      // Update automation log
      await db
        .update(anaplanAutomationLogs)
        .set({
          status,
          filesDownloaded,
          filesProcessed,
          filesFailed,
          newVersionsCreated,
          archivedVersions,
          details,
          completedAt,
        })
        .where(eq(anaplanAutomationLogs.id, logId));

      console.log('\n========================================');
      console.log('✅ ANAPLAN AUTOMATION COMPLETED');
      console.log(`   Status: ${status}`);
      console.log(`   Overall Success: ${overallSuccess} (${filesProcessed > 0 ? 'at least some files processed' : 'no files processed'})`);
      console.log(`   Files Downloaded: ${filesDownloaded}`);
      console.log(`   Files Processed: ${filesProcessed} (chunking/embeddings triggered)`);
      console.log(`   Files Failed: ${filesFailed}`);
      console.log(`   New Versions Created: ${newVersionsCreated}`);
      console.log(`   Duration: ${((completedAt.getTime() - startedAt.getTime()) / 1000).toFixed(2)}s`);
      console.log('========================================\n');

      return {
        success: overallSuccess, // BUG FIX: Return true if at least some files processed
        logId,
        filesDownloaded,
        filesProcessed,
        filesFailed,
        newVersionsCreated,
        archivedVersions,
        details,
      };
    } catch (error: any) {
      const completedAt = new Date();
      console.error('\n❌ ANAPLAN AUTOMATION FAILED:', error.message);

      // Update log with failure status
      if (logId) {
        await db
          .update(anaplanAutomationLogs)
          .set({
            status: 'failed',
            filesDownloaded,
            filesProcessed,
            filesFailed,
            newVersionsCreated,
            archivedVersions,
            errorMessage: error.message,
            details,
            completedAt,
          })
          .where(eq(anaplanAutomationLogs.id, logId));
      }

      return {
        success: false,
        logId,
        filesDownloaded,
        filesProcessed,
        filesFailed,
        newVersionsCreated,
        archivedVersions,
        error: error.message,
        details,
      };
    }
  }

  private getFileType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const typeMap: Record<string, string> = {
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xls': 'application/vnd.ms-excel',
      '.csv': 'text/csv',
      '.txt': 'text/plain',
      '.pdf': 'application/pdf',
    };
    return typeMap[ext] || 'application/octet-stream';
  }

  async getRecentLogs(companyId: string, limit: number = 10): Promise<any[]> {
    const { desc } = await import('drizzle-orm');
    const logs = await db
      .select()
      .from(anaplanAutomationLogs)
      .where(eq(anaplanAutomationLogs.companyId, companyId))
      .orderBy(desc(anaplanAutomationLogs.createdAt))
      .limit(limit);

    return logs;
  }

  /**
   * Get or create a dedicated system user for Anaplan automation
   * Ensures foreign key constraints and company membership are satisfied
   */
  private async getSystemUserId(companyId: string): Promise<string> {
    const SYSTEM_USERNAME = 'anaplan-automation';
    
    // Check if system user already exists
    const existingUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, SYSTEM_USERNAME))
      .limit(1);

    let systemUserId: string;

    if (existingUsers.length > 0) {
      systemUserId = existingUsers[0].id;
    } else {
      // Create system user
      const newUser = await db
        .insert(users)
        .values({
          username: SYSTEM_USERNAME,
          displayName: 'Anaplan Automation',
          password: '', // System user, no password
          role: 'standard',
        })
        .returning({ id: users.id });

      systemUserId = newUser[0].id;
      console.log(`✅ Created system automation user: ${systemUserId}`);
    }

    // Ensure system user has membership in the target company
    const existingMembership = await db
      .select()
      .from(companyMemberships)
      .where(
        and(
          eq(companyMemberships.userId, systemUserId),
          eq(companyMemberships.companyId, companyId)
        )
      )
      .limit(1);

    if (existingMembership.length === 0) {
      await db
        .insert(companyMemberships)
        .values({
          userId: systemUserId,
          companyId,
          role: 'member',
        });
      console.log(`✅ Added system user to company: ${companyId}`);
    }

    return systemUserId;
  }
}

export const anaplanAutomation = new AnaplanAutomation();
