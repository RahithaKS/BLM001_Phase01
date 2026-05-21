import path from 'path';
import fs from 'fs/promises';
import { storage } from '../storage';
import { connectorRegistry } from './connectors/connectorRegistry';
import { versionManager } from './versionManager';

const PYTHON_API_URL = 'http://localhost:8000';

export interface AzureBlobSyncResult {
  success: boolean;
  filesProcessed: number;
  filesSkipped: number;
  filesFailed: number;
  files: Array<{
    name: string;
    status: string;
    reason?: string;
    error?: string;
    documentId?: string;
    jobId?: string;
  }>;
  error?: string;
}

function getFileMimeType(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  const mimeMap: Record<string, string> = {
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12',
    xlsb: 'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
    xls: 'application/vnd.ms-excel',
    csv: 'text/csv',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    docm: 'application/vnd.ms-word.document.macroEnabled.12',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    pdf: 'application/pdf',
    txt: 'text/plain',
    json: 'application/json',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

export async function syncAzureBlobConnector(
  connectorId: string,
  domainId: string,
  companyId: string,
  triggeredByUserId: string = 'system'
): Promise<AzureBlobSyncResult> {
  const connectorRecord = await storage.getDomainApiConnectorById(connectorId);
  if (!connectorRecord) {
    return { success: false, filesProcessed: 0, filesSkipped: 0, filesFailed: 0, files: [], error: 'Connector not found' };
  }

  const connector = await connectorRegistry.getAzureBlobConnectorById(connectorId);
  if (!connector) {
    return { success: false, filesProcessed: 0, filesSkipped: 0, filesFailed: 0, files: [], error: 'Azure Blob connector not configured or disabled' };
  }

  const targetCubeId = connectorRecord.targetCubeId || null;
  console.log(`[AZURE-SYNC] Starting sync for connector "${connectorRecord.name}" (domain: ${domainId})`);
  console.log(`[AZURE-SYNC] Mode: ${targetCubeId ? `Cube ingestion → cube ${targetCubeId}` : 'RAG document processing'}`);

  const prefix = connectorRecord.blobPrefix || undefined;
  if (prefix) {
    console.log(`[AZURE-SYNC] Folder prefix filter: "${prefix}"`);
  }

  // Load the existing file registry for this connector — one DB call for all files
  const registry = await storage.getBlobRegistryForConnector(connectorId);
  console.log(`[AZURE-SYNC] Registry loaded: ${registry.size} previously ingested file(s)`);

  const blobs = await connector.listBlobsWithMetadata(prefix);
  console.log(`[AZURE-SYNC] Found ${blobs.length} blob(s) in Azure container${prefix ? ` (prefix: "${prefix}")` : ''}`);

  const results: AzureBlobSyncResult['files'] = [];
  let filesProcessed = 0;
  let filesSkipped = 0;
  let filesFailed = 0;

  const uploadsDir = path.join(process.cwd(), 'uploads', 'enterprise', companyId);
  await fs.mkdir(uploadsDir, { recursive: true });

  for (const blob of blobs) {
    // Skip unsupported file types
    if (!connector.isSupportedFileType(blob.name)) {
      results.push({ name: blob.name, status: 'skipped', reason: 'unsupported-type' });
      filesSkipped++;
      continue;
    }

    // ── DELTA DETECTION ────────────────────────────────────────────────────
    // Compare the blob's current etag against what we stored on the last sync.
    // If the etag is identical the file has not changed — skip it.
    const existing = registry.get(blob.name);
    if (existing && existing.etag && existing.etag === blob.etag && existing.status === 'success') {
      results.push({ name: blob.name, status: 'skipped', reason: 'unchanged', documentId: existing.documentId ?? undefined });
      filesSkipped++;
      console.log(`[AZURE-SYNC] ⏭  Unchanged (etag match): ${blob.name}`);
      continue;
    }

    const isUpdate = !!existing;
    console.log(`[AZURE-SYNC] ${isUpdate ? '🔄 Updated' : '🆕 New'} file detected: ${blob.name}`);

    try {
      // Download the blob to a local buffer
      const downloadResult = await connector.downloadBlobToBuffer(blob.name);
      if (!downloadResult) {
        results.push({ name: blob.name, status: 'failed', error: 'Download failed' });
        filesFailed++;
        await storage.upsertBlobRegistryEntry({
          connectorId,
          blobName: blob.name,
          etag: blob.etag,
          lastModified: blob.lastModified,
          status: 'failed',
        });
        continue;
      }

      // Write to the same uploads directory used by manual uploads
      const ext = path.extname(blob.name);
      const baseName = path.basename(blob.name, ext);
      const uniqueFileName = `${baseName}_${Date.now()}${ext}`;
      const filePath = path.join(uploadsDir, uniqueFileName);
      await fs.writeFile(filePath, downloadResult.buffer);

      // Create a versioned document record (same as manual upload)
      const versionResult = await versionManager.createNewVersion(
        companyId,
        triggeredByUserId,
        blob.name,
        filePath,
        String(downloadResult.size),
        getFileMimeType(blob.name),
        'azure_blob',
        { blobName: blob.name, syncDate: new Date().toISOString(), etag: blob.etag },
        domainId,
        targetCubeId
      );

      let jobId: string | null = null;

      if (targetCubeId) {
        // ── CUBE INGESTION PATH ─────────────────────────────────────────────
        // Sends file through the exact same pipeline as a manual admin upload.
        // The enterprise/process endpoint handles column mapping → cube_fact_data.
        try {
          const processResponse = await fetch(
            `${PYTHON_API_URL}/api/v2/enterprise/process/${versionResult.documentId}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                file_path: filePath,
                company_id: companyId,
                cube_id: targetCubeId,
              }),
            }
          );
          if (processResponse.ok) {
            const processData = await processResponse.json();
            jobId = processData.job_id || null;
            console.log(`[AZURE-SYNC] ✅ Cube ingestion started for "${blob.name}" → cube ${targetCubeId} (job: ${jobId})`);
          } else {
            const errText = await processResponse.text();
            console.warn(`[AZURE-SYNC] ⚠️  Cube ingestion HTTP ${processResponse.status} for "${blob.name}": ${errText}`);
          }
        } catch (processError: any) {
          console.warn(`[AZURE-SYNC] ⚠️  Cube ingestion request failed for "${blob.name}":`, processError.message);
        }
      } else {
        // ── RAG DOCUMENT PROCESSING PATH ────────────────────────────────────
        // No targetCubeId — send to the standard RAG pipeline (document search).
        try {
          const processResponse = await fetch(
            `${PYTHON_API_URL}/api/v2/enterprise/process/${versionResult.documentId}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ file_path: filePath, company_id: companyId }),
            }
          );
          if (processResponse.ok) {
            console.log(`[AZURE-SYNC] ✅ RAG processing triggered for "${blob.name}"`);
          }
        } catch (processError: any) {
          console.warn(`[AZURE-SYNC] ⚠️  RAG processing trigger failed for "${blob.name}":`, processError.message);
        }
      }

      // ── UPDATE FILE REGISTRY ────────────────────────────────────────────
      // Store the new etag so this file is skipped on the next sync run.
      await storage.upsertBlobRegistryEntry({
        connectorId,
        blobName: blob.name,
        etag: blob.etag,
        lastModified: blob.lastModified,
        documentId: versionResult.documentId,
        jobId: jobId ?? undefined,
        status: 'success',
      });

      results.push({
        name: blob.name,
        status: isUpdate ? 'updated' : 'new',
        documentId: versionResult.documentId,
        jobId: jobId ?? undefined,
      });
      filesProcessed++;
      console.log(`[AZURE-SYNC] ✅ ${isUpdate ? 'Re-ingested updated' : 'Ingested new'} file: "${blob.name}" (v${versionResult.version})`);

    } catch (error: any) {
      results.push({ name: blob.name, status: 'failed', error: error.message });
      filesFailed++;
      console.error(`[AZURE-SYNC] ❌ Failed to import "${blob.name}":`, error.message);
      // Record the failure in the registry so we retry next sync
      await storage.upsertBlobRegistryEntry({
        connectorId,
        blobName: blob.name,
        etag: blob.etag,
        lastModified: blob.lastModified,
        status: 'failed',
      });
    }
  }

  // Update connector-level sync status
  await storage.updateDomainApiConnector(connectorId, {
    status: filesFailed > 0 && filesProcessed === 0 ? 'error' : 'active',
    lastSyncAt: new Date(),
    lastSyncResult: `New/Updated: ${filesProcessed}, Unchanged: ${filesSkipped - results.filter(r => r.reason === 'unsupported-type').length}, Failed: ${filesFailed}`,
    documentCount: (connectorRecord.documentCount || 0) + filesProcessed,
  });

  console.log(`[AZURE-SYNC] Done — New/Updated: ${filesProcessed}, Skipped (unchanged): ${filesSkipped}, Failed: ${filesFailed}`);

  return {
    success: filesFailed === 0 || filesProcessed > 0,
    filesProcessed,
    filesSkipped,
    filesFailed,
    files: results,
  };
}

export async function syncAllScheduledAzureBlobConnectors(domainId: string, companyId: string): Promise<void> {
  const allConnectors = await storage.getDomainApiConnectors(domainId);
  // All Azure Blob connectors that are enabled AND have scheduling turned on
  const azureConnectors = allConnectors.filter(
    c => c.connectorType === 'azure_blob' && c.enabled === 1 && c.scheduleEnabled === 1
  );

  if (azureConnectors.length === 0) {
    console.log(`[AZURE-SYNC] No scheduled Azure Blob connectors for domain ${domainId}`);
    return;
  }

  console.log(`[AZURE-SYNC] Running scheduled sync for ${azureConnectors.length} Azure Blob connector(s)`);

  for (const connector of azureConnectors) {
    try {
      await syncAzureBlobConnector(connector.id, domainId, companyId, 'system');
    } catch (error: any) {
      console.error(`[AZURE-SYNC] ❌ Scheduled sync failed for connector "${connector.name}":`, error.message);
    }
  }
}
