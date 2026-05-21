import { BlobServiceClient, StorageSharedKeyCredential, AnonymousCredential, ContainerClient, BlobItem } from '@azure/storage-blob';
import { ClientSecretCredential } from '@azure/identity';
import { AzureBlobConfig } from '@shared/schema';
import * as fs from 'fs/promises';
import * as path from 'path';
import { nanoid } from 'nanoid';

export interface AzureBlobUploadResult {
  blobName: string;
  url: string;
  size: number;
  success: boolean;
  error?: string;
}

export interface AzureBlobConnectionTest {
  success: boolean;
  message: string;
  containerExists?: boolean;
  blobCount?: number;
}

export interface AzureBlobSyncResult {
  success: boolean;
  filesProcessed: number;
  filesSkipped: number;
  filesFailed: number;
  files: Array<{
    name: string;
    size: number;
    status: 'success' | 'skipped' | 'failed';
    error?: string;
    documentId?: string;
  }>;
  error?: string;
}

export interface BlobFileInfo {
  name: string;
  size: number;
  contentType: string;
  lastModified: Date;
  etag: string;
}

export class AzureBlobConnector {
  private containerClient: ContainerClient;
  private config: AzureBlobConfig;
  private domainId: string;

  constructor(config: AzureBlobConfig, domainId: string) {
    this.config = config;
    this.domainId = domainId;

    let blobServiceClient: BlobServiceClient;

    if (config.tenant_id && config.client_id && config.client_secret) {
      // Azure AD service principal — works when Shared Key access is disabled
      const credential = new ClientSecretCredential(
        config.tenant_id,
        config.client_id,
        config.client_secret
      );
      blobServiceClient = new BlobServiceClient(
        `https://${config.account_name}.blob.${config.endpoint_suffix}`,
        credential
      );
      console.log(`✅ Azure Blob connector initialised (Azure AD) for domain: ${domainId}`);
    } else if (config.sas_token) {
      // Account SAS token — note: also blocked when allowSharedKeyAccess=false on the account
      const rawSas = config.sas_token.trimStart();
      const sasQuery = rawSas.startsWith('?') ? rawSas : `?${rawSas}`;
      const serviceUrl = `https://${config.account_name}.blob.${config.endpoint_suffix}${sasQuery}`;
      blobServiceClient = new BlobServiceClient(serviceUrl, new AnonymousCredential());
      console.log(`✅ Azure Blob connector initialised (SAS) for domain: ${domainId}`);
    } else if (config.account_key) {
      // Shared Key auth
      const sharedKeyCredential = new StorageSharedKeyCredential(
        config.account_name,
        config.account_key
      );
      blobServiceClient = new BlobServiceClient(
        `https://${config.account_name}.blob.${config.endpoint_suffix}`,
        sharedKeyCredential
      );
      console.log(`✅ Azure Blob connector initialised (Shared Key) for domain: ${domainId}`);
    } else {
      throw new Error('Azure Blob connector requires Account Key, SAS Token, or Azure AD credentials');
    }

    console.log(`   Account: ${config.account_name}`);
    console.log(`   Container: ${config.container_name}`);

    this.containerClient = blobServiceClient.getContainerClient(config.container_name);
  }

  async testConnection(): Promise<AzureBlobConnectionTest> {
    try {
      const exists = await this.containerClient.exists();
      
      if (!exists) {
        return {
          success: false,
          message: `Container '${this.config.container_name}' does not exist`,
          containerExists: false,
        };
      }

      let blobCount = 0;
      for await (const _ of this.containerClient.listBlobsFlat()) {
        blobCount++;
        if (blobCount >= 10) break;
      }

      return {
        success: true,
        message: 'Connection successful',
        containerExists: true,
        blobCount,
      };
    } catch (error: any) {
      console.error('Azure Blob connection test failed:', error.message);
      return {
        success: false,
        message: error.message || 'Connection failed',
      };
    }
  }

  async uploadFile(localPath: string, blobName?: string): Promise<AzureBlobUploadResult> {
    try {
      const fileName = blobName || path.basename(localPath);
      const blockBlobClient = this.containerClient.getBlockBlobClient(fileName);
      
      const fileBuffer = await fs.readFile(localPath);
      
      await blockBlobClient.upload(fileBuffer, fileBuffer.length, {
        blobHTTPHeaders: {
          blobContentType: this.getContentType(fileName),
        },
      });

      console.log(`✅ Uploaded ${fileName} to Azure Blob (${(fileBuffer.length / 1024).toFixed(2)} KB)`);

      return {
        blobName: fileName,
        url: blockBlobClient.url,
        size: fileBuffer.length,
        success: true,
      };
    } catch (error: any) {
      console.error(`❌ Failed to upload to Azure Blob:`, error.message);
      return {
        blobName: blobName || path.basename(localPath),
        url: '',
        size: 0,
        success: false,
        error: error.message,
      };
    }
  }

  async uploadBuffer(buffer: Buffer, blobName: string): Promise<AzureBlobUploadResult> {
    try {
      const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
      
      await blockBlobClient.upload(buffer, buffer.length, {
        blobHTTPHeaders: {
          blobContentType: this.getContentType(blobName),
        },
      });

      console.log(`✅ Uploaded ${blobName} to Azure Blob (${(buffer.length / 1024).toFixed(2)} KB)`);

      return {
        blobName,
        url: blockBlobClient.url,
        size: buffer.length,
        success: true,
      };
    } catch (error: any) {
      console.error(`❌ Failed to upload buffer to Azure Blob:`, error.message);
      return {
        blobName,
        url: '',
        size: 0,
        success: false,
        error: error.message,
      };
    }
  }

  async listBlobs(prefix?: string): Promise<string[]> {
    const blobs: string[] = [];
    
    try {
      for await (const blob of this.containerClient.listBlobsFlat({ prefix })) {
        blobs.push(blob.name);
      }
    } catch (error: any) {
      console.error('Failed to list blobs:', error.message);
    }
    
    return blobs;
  }

  async downloadBlob(blobName: string, destinationPath: string): Promise<boolean> {
    try {
      const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
      const downloadResponse = await blockBlobClient.download();
      
      if (!downloadResponse.readableStreamBody) {
        throw new Error('No stream body in response');
      }

      const chunks: Buffer[] = [];
      for await (const chunk of downloadResponse.readableStreamBody) {
        chunks.push(Buffer.from(chunk));
      }
      
      await fs.writeFile(destinationPath, Buffer.concat(chunks));
      console.log(`✅ Downloaded ${blobName} to ${destinationPath}`);
      return true;
    } catch (error: any) {
      console.error(`❌ Failed to download ${blobName}:`, error.message);
      return false;
    }
  }

  async deleteBlob(blobName: string): Promise<boolean> {
    try {
      const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
      await blockBlobClient.delete();
      console.log(`✅ Deleted blob: ${blobName}`);
      return true;
    } catch (error: any) {
      console.error(`❌ Failed to delete ${blobName}:`, error.message);
      return false;
    }
  }

  async listBlobsWithMetadata(prefix?: string): Promise<BlobFileInfo[]> {
    const blobs: BlobFileInfo[] = [];
    
    try {
      for await (const blob of this.containerClient.listBlobsFlat({ prefix, includeMetadata: true })) {
        blobs.push({
          name: blob.name,
          size: blob.properties.contentLength || 0,
          contentType: blob.properties.contentType || 'application/octet-stream',
          lastModified: blob.properties.lastModified || new Date(),
          etag: blob.properties.etag || '',
        });
      }
    } catch (error: any) {
      console.error('Failed to list blobs with metadata:', error.message);
    }
    
    return blobs;
  }

  async downloadBlobToBuffer(blobName: string): Promise<{ buffer: Buffer; size: number } | null> {
    try {
      const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
      const downloadResponse = await blockBlobClient.download();
      
      if (!downloadResponse.readableStreamBody) {
        throw new Error('No stream body in response');
      }

      const chunks: Buffer[] = [];
      for await (const chunk of downloadResponse.readableStreamBody) {
        chunks.push(Buffer.from(chunk));
      }
      
      const buffer = Buffer.concat(chunks);
      return { buffer, size: buffer.length };
    } catch (error: any) {
      console.error(`❌ Failed to download ${blobName}:`, error.message);
      return null;
    }
  }

  isSupportedFileType(fileName: string): boolean {
    const supportedExtensions = ['.pdf', '.xlsx', '.xls', '.csv', '.json', '.txt', '.docx', '.doc'];
    const ext = path.extname(fileName).toLowerCase();
    return supportedExtensions.includes(ext);
  }

  getDomainId(): string {
    return this.domainId;
  }

  private getContentType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xls': 'application/vnd.ms-excel',
      '.csv': 'text/csv',
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.doc': 'application/msword',
    };
    return contentTypes[ext] || 'application/octet-stream';
  }
}

export function createAzureBlobConnector(config: AzureBlobConfig, domainId: string): AzureBlobConnector {
  return new AzureBlobConnector(config, domainId);
}
