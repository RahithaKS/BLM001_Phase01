import { createDomainAnaplanService, DomainAnaplanConfig } from './domainAnaplanService';
import { versionManager } from './versionManager';
import { storage } from '../storage';
import { db } from '../db';
import { anaplanAutomationLogs, companies, users, companyMemberships } from '@shared/schema';
import { connectorRegistry } from './connectors/connectorRegistry';
import { CONNECTOR_TYPES } from '@shared/schema';
import { eq } from 'drizzle-orm';
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

export class DomainAnaplanAutomation {
  private readonly DOWNLOAD_DIR = 'uploads/anaplan';

  async runDomainSync(
    domainId: string,
    companyId: string,
    triggerType: 'scheduled' | 'manual',
    triggeredBy?: string,
    connectorId?: string
  ): Promise<AutomationResult> {

    // Fetch all enabled Anaplan connectors for this domain
    const allConnectors = await storage.getDomainApiConnectors(domainId);
    const anaplanConnectors = allConnectors.filter(
      c => c.connectorType === CONNECTOR_TYPES.ANAPLAN && c.enabled === 1 &&
           (!connectorId || c.id === connectorId)
    );

    if (anaplanConnectors.length === 0) {
      return {
        success: false,
        logId: '',
        filesDownloaded: 0,
        filesProcessed: 0,
        filesFailed: 0,
        newVersionsCreated: 0,
        archivedVersions: 0,
        error: connectorId
          ? `Anaplan connector ${connectorId} not found or disabled`
          : 'No enabled Anaplan connectors configured for this domain',
        details: [],
      };
    }

    // Aggregate results across all connectors
    let totalFilesDownloaded = 0;
    let totalFilesProcessed = 0;
    let totalFilesFailed = 0;
    let totalNewVersions = 0;
    let totalArchived = 0;
    const allDetails: any[] = [];
    let lastLogId = '';
    let anySuccess = false;

    for (const connector of anaplanConnectors) {
      const result = await this._syncOneConnector(
        connector,
        domainId,
        companyId,
        triggerType,
        triggeredBy
      );
      lastLogId = result.logId || lastLogId;
      totalFilesDownloaded += result.filesDownloaded;
      totalFilesProcessed += result.filesProcessed;
      totalFilesFailed += result.filesFailed;
      totalNewVersions += result.newVersionsCreated;
      totalArchived += result.archivedVersions;
      allDetails.push(...result.details);
      if (result.success) anySuccess = true;
    }

    return {
      success: anySuccess,
      logId: lastLogId,
      filesDownloaded: totalFilesDownloaded,
      filesProcessed: totalFilesProcessed,
      filesFailed: totalFilesFailed,
      newVersionsCreated: totalNewVersions,
      archivedVersions: totalArchived,
      details: allDetails,
    };
  }

  private async _syncOneConnector(
    connector: any,
    domainId: string,
    companyId: string,
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
      console.log('🚀 ANAPLAN CONNECTOR SYNC STARTING');
      console.log(`   Domain: ${domainId}`);
      console.log(`   Connector: ${connector.name} (${connector.id})`);
      console.log(`   Company: ${companyId}`);
      console.log(`   Trigger: ${triggerType}`);
      if (triggeredBy) console.log(`   Triggered by: ${triggeredBy}`);
      console.log('========================================\n');

      // Decrypt connector credentials
      const config = connectorRegistry.decryptConfig(
        CONNECTOR_TYPES.ANAPLAN,
        connector.config as Record<string, any>
      ) as any;

      if (!config.workspace_id || !config.model_id || !config.process_id) {
        throw new Error(`Connector "${connector.name}" is missing workspace_id, model_id, or process_id`);
      }
      if (!config.username || !config.password) {
        throw new Error(`Connector "${connector.name}" is missing username or password`);
      }

      const company = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
      if (company.length === 0) throw new Error(`Company not found: ${companyId}`);
      console.log(`🏢 Company: ${company[0].name} (${companyId})`);

      const anaplanConfig: DomainAnaplanConfig = {
        workspaceId: config.workspace_id,
        modelId: config.model_id,
        processId: config.process_id,
        username: config.username,
        password: config.password,
        domainId,
        companyId,
      };

      const anaplanService = createDomainAnaplanService(anaplanConfig);

      const systemUserId = await this.getSystemUserId(companyId);
      const uploadUserId = triggeredBy || systemUserId;

      const logResult = await db
        .insert(anaplanAutomationLogs)
        .values({
          companyId,
          status: 'running',
          triggerType,
          triggeredBy: triggeredBy || systemUserId,
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

      console.log('\n📥 STEP 1: Downloading files from Anaplan...\n');

      const domainDownloadDir = path.join(this.DOWNLOAD_DIR, domainId, connector.id);
      const exportResult = await anaplanService.runFullExportSync(domainDownloadDir);

      filesDownloaded = exportResult.files.filter(f => f.success).length;
      filesFailed = exportResult.files.filter(f => !f.success).length;

      console.log(`\n📊 Downloaded ${filesDownloaded} files, ${filesFailed} failed\n`);

      if (filesDownloaded === 0) {
        throw new Error('No files were successfully downloaded');
      }

      console.log('\n📝 STEP 2: Creating versions for downloaded files...\n');

      const createdDocuments: Array<{ documentId: string; fileName: string; filePath: string }> = [];

      for (const file of exportResult.files) {
        if (!file.success) {
          details.push({ fileName: file.fileName, status: 'download_failed', error: file.error });
          continue;
        }

        try {
          console.log(`   Processing: ${file.fileName}`);
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
              connectorId: connector.id,
              connectorName: connector.name,
              processId: config.process_id,
              exportName: file.fileName,
              syncDate: startedAt.toISOString(),
              taskId: exportResult.taskId,
            },
            domainId,
            connector.targetCubeId || null
          );

          newVersionsCreated++;
          archivedVersions += result.archivedCount;
          createdDocuments.push({ documentId: result.documentId, fileName: file.fileName, filePath: file.filePath });
          details.push({ fileName: file.fileName, status: 'version_created', documentId: result.documentId, archivedCount: result.archivedCount });
          console.log(`   ✅ Created new version for ${file.fileName}`);
        } catch (error: any) {
          console.error(`   ❌ Failed to create version for ${file.fileName}:`, error.message);
          details.push({ fileName: file.fileName, status: 'version_failed', error: error.message });
          filesFailed++;
        }
      }

      console.log('\n📝 STEP 3: Triggering document processing...\n');

      for (const doc of createdDocuments) {
        try {
          const response = await fetch(`http://localhost:8000/api/v2/enterprise/process/${doc.documentId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_path: doc.filePath, company_id: companyId }),
          });

          if (response.ok) {
            filesProcessed++;
            details.push({ fileName: doc.fileName, documentId: doc.documentId, status: 'processing_triggered' });
            console.log(`   ✅ Processing triggered for ${doc.fileName}`);
          } else {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }
        } catch (error: any) {
          console.error(`   ❌ Failed to trigger processing for ${doc.fileName}:`, error.message);
          details.push({ fileName: doc.fileName, documentId: doc.documentId, status: 'processing_failed', error: error.message });
        }
      }

      const completedAt = new Date();
      const finalStatus = filesFailed > 0 ? 'partial_success' : 'success';

      await db.update(anaplanAutomationLogs).set({
        status: finalStatus,
        filesDownloaded,
        filesProcessed,
        filesFailed,
        newVersionsCreated,
        archivedVersions,
        completedAt,
        details,
      }).where(eq(anaplanAutomationLogs.id, logId));

      // Update connector status
      await storage.updateDomainApiConnectorStatus(
        connector.id,
        'connected',
        `Last sync: ${filesDownloaded} downloaded, ${filesProcessed} processed`,
        (connector.documentCount || 0) + newVersionsCreated
      );

      console.log('\n========================================');
      console.log('✅ CONNECTOR SYNC COMPLETED');
      console.log(`   Connector: ${connector.name}`);
      console.log(`   Files downloaded: ${filesDownloaded}`);
      console.log(`   Processing triggered: ${filesProcessed}`);
      console.log(`   New versions: ${newVersionsCreated}`);
      console.log('========================================\n');

      return { success: true, logId, filesDownloaded, filesProcessed, filesFailed, newVersionsCreated, archivedVersions, details };

    } catch (error: any) {
      console.error(`\n❌ CONNECTOR SYNC FAILED [${connector.name}]:`, error.message);

      if (logId) {
        await db.update(anaplanAutomationLogs).set({
          status: 'failed',
          filesDownloaded,
          filesProcessed,
          filesFailed,
          newVersionsCreated,
          archivedVersions,
          completedAt: new Date(),
          details: [...details, { error: error.message }],
        }).where(eq(anaplanAutomationLogs.id, logId));
      }

      // Update connector status to error
      await storage.updateDomainApiConnectorStatus(connector.id, 'error', error.message);

      return { success: false, logId, filesDownloaded, filesProcessed, filesFailed, newVersionsCreated, archivedVersions, error: error.message, details };
    }
  }

  private async getSystemUserId(companyId: string): Promise<string> {
    const systemEmail = `anaplan-automation@${companyId}.system.local`;

    let systemUser = await db.select().from(users).where(eq(users.username, systemEmail)).limit(1);

    if (systemUser.length === 0) {
      const newUser = await db.insert(users).values({
        username: systemEmail,
        password: 'system-no-login',
        displayName: 'Anaplan Automation',
        role: 'user',
      }).returning({ id: users.id });

      await db.insert(companyMemberships).values({
        userId: newUser[0].id,
        companyId,
        role: 'member',
      });

      return newUser[0].id;
    }

    return systemUser[0].id;
  }

  private getFileType(fileName: string): string {
    const ext = fileName.toLowerCase().split('.').pop() || '';
    const typeMap: Record<string, string> = {
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls: 'application/vnd.ms-excel',
      csv: 'text/csv',
      pdf: 'application/pdf',
    };
    return typeMap[ext] || 'application/octet-stream';
  }
}

export const domainAnaplanAutomation = new DomainAnaplanAutomation();
