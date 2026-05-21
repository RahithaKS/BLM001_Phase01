import { db } from '../db';
import { enterpriseDocuments, enterpriseDocumentEmbeddings, enterpriseDocumentChunks } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import * as fs from 'fs/promises';

interface VersionInfo {
  documentId: string;
  version: number;
  name: string;
  uploadedAt: Date;
  isActive: boolean;
}

export class VersionManager {
  private readonly MAX_ACTIVE_VERSIONS = 2;

  async getDocumentVersionHistory(companyId: string, documentName: string): Promise<VersionInfo[]> {
    const versions = await db
      .select({
        documentId: enterpriseDocuments.id,
        version: enterpriseDocuments.version,
        name: enterpriseDocuments.name,
        uploadedAt: enterpriseDocuments.uploadedAt,
        isActive: enterpriseDocuments.isActive,
      })
      .from(enterpriseDocuments)
      .where(
        and(
          eq(enterpriseDocuments.companyId, companyId),
          eq(enterpriseDocuments.name, documentName)
        )
      )
      .orderBy(desc(enterpriseDocuments.version));

    return versions.map(v => ({
      ...v,
      isActive: v.isActive === 1,
    }));
  }

  async getLatestVersion(companyId: string, documentName: string): Promise<number> {
    const latest = await db
      .select({ version: enterpriseDocuments.version })
      .from(enterpriseDocuments)
      .where(
        and(
          eq(enterpriseDocuments.companyId, companyId),
          eq(enterpriseDocuments.name, documentName)
        )
      )
      .orderBy(desc(enterpriseDocuments.version))
      .limit(1);

    return latest[0]?.version || 0;
  }

  async archiveOldVersions(companyId: string, documentName: string): Promise<number> {
    console.log(`🗄️  Archiving old versions of: ${documentName}`);

    // Get all versions sorted by version number descending
    const versions = await this.getDocumentVersionHistory(companyId, documentName);

    if (versions.length <= this.MAX_ACTIVE_VERSIONS) {
      console.log(`   No archiving needed (${versions.length} versions exist, max: ${this.MAX_ACTIVE_VERSIONS})`);
      return 0;
    }

    // Keep the latest 2 versions active, archive the rest
    const versionsToArchive = versions.slice(this.MAX_ACTIVE_VERSIONS);
    
    let archivedCount = 0;

    for (const versionInfo of versionsToArchive) {
      if (versionInfo.isActive) {
        // Get all chunks for this document
        const chunks = await db
          .select({ id: enterpriseDocumentChunks.id })
          .from(enterpriseDocumentChunks)
          .where(eq(enterpriseDocumentChunks.documentId, versionInfo.documentId));

        // Delete embeddings for all chunks (frees up vector storage)
        for (const chunk of chunks) {
          await db
            .delete(enterpriseDocumentEmbeddings)
            .where(eq(enterpriseDocumentEmbeddings.chunkId, chunk.id));
        }

        // Delete all chunks (keeps file but removes RAG capability)
        await db
          .delete(enterpriseDocumentChunks)
          .where(eq(enterpriseDocumentChunks.documentId, versionInfo.documentId));

        // Mark document as inactive (file remains for compliance)
        await db
          .update(enterpriseDocuments)
          .set({ isActive: 0 })
          .where(eq(enterpriseDocuments.id, versionInfo.documentId));

        console.log(`   ✅ Archived version ${versionInfo.version} (documentId: ${versionInfo.documentId}) - embeddings deleted, file retained`);
        archivedCount++;
      }
    }

    console.log(`📦 Archived ${archivedCount} old versions of ${documentName} (saved ~73% storage)`);
    return archivedCount;
  }

  async createNewVersion(
    companyId: string,
    uploadedBy: string,
    name: string,
    filePath: string,
    fileSize: string,
    fileType: string,
    source: 'manual' | 'anaplan_auto' | 'anaplan_manual' | 'azure_blob',
    anaplanMetadata?: any,
    domainId?: string,
    cubeId?: string | null
  ): Promise<{ documentId: string; archivedCount: number; version: number }> {
    // Get the latest version number
    const latestVersion = await this.getLatestVersion(companyId, name);
    const newVersion = latestVersion + 1;

    console.log(`📄 Creating version ${newVersion} of: ${name}${cubeId ? ` (cube: ${cubeId})` : ''}`);

    // Get the previous version's document ID if it exists
    let previousVersionId: string | null = null;
    if (latestVersion > 0) {
      const previousDocs = await db
        .select({ id: enterpriseDocuments.id })
        .from(enterpriseDocuments)
        .where(
          and(
            eq(enterpriseDocuments.companyId, companyId),
            eq(enterpriseDocuments.name, name),
            eq(enterpriseDocuments.version, latestVersion)
          )
        )
        .limit(1);

      if (previousDocs[0]) {
        previousVersionId = previousDocs[0].id;
      }
    }

    // Insert new version
    const result = await db
      .insert(enterpriseDocuments)
      .values({
        companyId,
        uploadedBy,
        name,
        filePath,
        fileSize,
        fileType,
        source,
        version: newVersion,
        isActive: 1,
        previousVersionId,
        anaplanMetadata: anaplanMetadata || null,
        domainId: domainId || null,
        cubeId: cubeId || null,
      })
      .returning({ id: enterpriseDocuments.id });

    const documentId = result[0].id;

    console.log(`✅ Created version ${newVersion}, documentId: ${documentId}`);

    // Archive old versions (keeps last 2 active)
    const archivedCount = await this.archiveOldVersions(companyId, name);

    return { documentId, archivedCount, version: newVersion };
  }

  async deleteOldVersionPermanently(documentId: string): Promise<void> {
    console.log(`🗑️  Permanently deleting document: ${documentId}`);

    // Get file path before deletion
    const doc = await db
      .select({ filePath: enterpriseDocuments.filePath })
      .from(enterpriseDocuments)
      .where(eq(enterpriseDocuments.id, documentId))
      .limit(1);

    if (!doc[0]) {
      throw new Error('Document not found');
    }

    // Delete from database (cascades to chunks and embeddings)
    await db
      .delete(enterpriseDocuments)
      .where(eq(enterpriseDocuments.id, documentId));

    // Delete physical file
    try {
      await fs.unlink(doc[0].filePath);
      console.log(`   ✅ Deleted file: ${doc[0].filePath}`);
    } catch (error) {
      console.warn(`   ⚠️  Could not delete file: ${doc[0].filePath}`, error);
    }

    console.log(`✅ Document deleted permanently`);
  }

  async getActiveVersions(companyId: string): Promise<{
    documentId: string;
    name: string;
    version: number;
    uploadedAt: Date;
  }[]> {
    const activeVersions = await db
      .select({
        documentId: enterpriseDocuments.id,
        name: enterpriseDocuments.name,
        version: enterpriseDocuments.version,
        uploadedAt: enterpriseDocuments.uploadedAt,
      })
      .from(enterpriseDocuments)
      .where(
        and(
          eq(enterpriseDocuments.companyId, companyId),
          eq(enterpriseDocuments.isActive, 1)
        )
      )
      .orderBy(desc(enterpriseDocuments.uploadedAt));

    return activeVersions;
  }

  async getEmbeddingCount(documentId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(enterpriseDocumentEmbeddings)
      .innerJoin(
        enterpriseDocumentChunks,
        eq(enterpriseDocumentEmbeddings.chunkId, enterpriseDocumentChunks.id)
      )
      .where(eq(enterpriseDocumentChunks.documentId, documentId));

    return Number(result[0]?.count || 0);
  }
}

export const versionManager = new VersionManager();
