import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface DomainAnaplanConfig {
  workspaceId: string;
  modelId: string;
  processId: string;
  username: string;
  password: string;
  domainId: string;
  companyId: string;
}

interface FileDownloadInfo {
  fileName: string;
  filePath: string;
  fileSize: number;
  success: boolean;
  error?: string;
}

export class DomainAnaplanService {
  private config: DomainAnaplanConfig;
  private client: AxiosInstance;
  private authToken: string | null = null;

  constructor(config: DomainAnaplanConfig) {
    if (!config.workspaceId || !config.modelId || !config.processId || !config.username || !config.password) {
      throw new Error('Incomplete Anaplan configuration');
    }

    this.config = config;
    this.client = axios.create({
      baseURL: 'https://api.anaplan.com/2/0',
      timeout: 900000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log(`✅ Domain Anaplan service initialized for domain: ${config.domainId}`);
    console.log(`   Workspace: ${this.config.workspaceId}`);
    console.log(`   Model: ${this.config.modelId}`);
    console.log(`   Process: ${this.config.processId}`);
    console.log(`   Company: ${this.config.companyId}`);
  }

  getConfig(): DomainAnaplanConfig {
    return this.config;
  }

  private async authenticate(): Promise<void> {
    try {
      const credentials = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
      
      const authResponse = await axios.post('https://auth.anaplan.com/token/authenticate', {}, {
        headers: {
          Authorization: `Basic ${credentials}`,
        },
        timeout: 30000,
      });

      this.authToken = authResponse.data.tokenInfo.tokenValue;
      console.log('✅ Anaplan authentication successful');
    } catch (error: any) {
      console.error('❌ Anaplan authentication failed:', error.response?.data || error.message);
      throw new Error(`Anaplan authentication failed: ${error.message}`);
    }
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.authToken) {
      await this.authenticate();
    }
  }

  private getAuthHeaders(): Record<string, string> {
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    return {
      Authorization: `Bearer ${this.authToken}`,
    };
  }

  async triggerExportProcess(): Promise<string> {
    await this.ensureAuthenticated();

    try {
      const url = `/workspaces/${this.config.workspaceId}/models/${this.config.modelId}/processes/${this.config.processId}/tasks`;
      
      console.log(`🔄 Triggering Anaplan export process: ${this.config.processId}`);
      
      const response = await this.client.post(
        url,
        {
          localeName: 'en_US',
        },
        {
          headers: this.getAuthHeaders(),
        }
      );

      const taskId = response.data.task?.taskId;
      
      if (!taskId) {
        throw new Error('No taskId returned from Anaplan');
      }

      console.log(`✅ Export process triggered successfully, taskId: ${taskId}`);
      return taskId;
    } catch (error: any) {
      console.error('❌ Failed to trigger export process:', error.response?.data || error.message);
      throw new Error(`Failed to trigger export: ${error.message}`);
    }
  }

  async waitForTaskCompletion(taskId: string, maxAttempts: number = 360): Promise<string[]> {
    await this.ensureAuthenticated();

    const url = `/workspaces/${this.config.workspaceId}/models/${this.config.modelId}/processes/${this.config.processId}/tasks/${taskId}`;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await this.client.get(url, {
          headers: this.getAuthHeaders(),
        });

        const taskState = response.data.task?.taskState;
        const currentStep = response.data.task?.currentStep || 'unknown';

        console.log(`   Task status (${attempt}/${maxAttempts}): ${taskState} - ${currentStep}`);

        if (taskState === 'COMPLETE') {
          console.log('✅ Export task completed successfully');
          
          const nestedResults = response.data.task?.result?.nestedResults || [];
          const fileIds = nestedResults
            .filter((r: any) => r.objectId)
            .map((r: any) => r.objectId);
          
          console.log(`📁 Process generated ${fileIds.length} export file(s)`);
          return fileIds;
        }

        if (taskState === 'FAILED' || taskState === 'CANCELLED') {
          const errorMessage = response.data.task?.result?.details || 'Task failed';
          throw new Error(`Export task ${taskState.toLowerCase()}: ${errorMessage}`);
        }

        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error: any) {
        console.error(`❌ Error checking task status:`, error.response?.data || error.message);
        throw error;
      }
    }

    throw new Error(`Export task timed out after ${maxAttempts} attempts`);
  }

  async getFileNamesFromIds(fileIds: string[]): Promise<string[]> {
    await this.ensureAuthenticated();

    try {
      const url = `/workspaces/${this.config.workspaceId}/models/${this.config.modelId}/files`;
      
      const response = await this.client.get(url, {
        headers: this.getAuthHeaders(),
      });

      const files = response.data.files || [];
      const fileMap = new Map(files.map((f: any) => [f.id, f.name]));
      
      const fileNames = fileIds
        .map(id => fileMap.get(id))
        .filter((name): name is string => name !== undefined);

      console.log(`📁 Resolved ${fileNames.length}/${fileIds.length} file names from export`);
      return fileNames;
    } catch (error: any) {
      console.error('❌ Failed to get file names:', error.response?.data || error.message);
      throw new Error(`Failed to get file names: ${error.message}`);
    }
  }

  async downloadFile(fileName: string, destinationDir: string): Promise<FileDownloadInfo> {
    await this.ensureAuthenticated();

    try {
      const encodedFileName = encodeURIComponent(fileName);
      const url = `/workspaces/${this.config.workspaceId}/models/${this.config.modelId}/files/${encodedFileName}`;
      
      console.log(`⬇️  Downloading file: ${fileName}`);

      const response = await this.client.get(url, {
        headers: this.getAuthHeaders(),
        responseType: 'arraybuffer',
      });

      await fs.mkdir(destinationDir, { recursive: true });

      const fileNameWithExtension = fileName.toLowerCase().endsWith('.xlsx') || fileName.toLowerCase().endsWith('.xls')
        ? fileName
        : `${fileName}.xlsx`;
      
      const filePath = path.join(destinationDir, fileNameWithExtension);
      await fs.writeFile(filePath, response.data);

      const fileSize = response.data.length;
      console.log(`✅ Downloaded ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

      return {
        fileName: fileNameWithExtension,
        filePath,
        fileSize,
        success: true,
      };
    } catch (error: any) {
      console.error(`❌ Failed to download ${fileName}:`, error.response?.data || error.message);
      return {
        fileName,
        filePath: '',
        fileSize: 0,
        success: false,
        error: error.message,
      };
    }
  }

  async runFullExportSync(destinationDir: string): Promise<{
    success: boolean;
    taskId: string;
    files: FileDownloadInfo[];
    error?: string;
  }> {
    try {
      console.log(`🚀 Starting Anaplan export sync for domain: ${this.config.domainId}...`);
      
      const taskId = await this.triggerExportProcess();
      const exportFileIds = await this.waitForTaskCompletion(taskId);
      const fileNames = await this.getFileNamesFromIds(exportFileIds);

      const files: FileDownloadInfo[] = [];
      for (const fileName of fileNames) {
        const result = await this.downloadFile(fileName, destinationDir);
        files.push(result);
      }

      const successCount = files.filter(f => f.success).length;
      console.log(`📦 Downloaded ${successCount}/${files.length} files from process`);

      return {
        success: files.every(f => f.success),
        taskId,
        files,
      };
    } catch (error: any) {
      console.error('❌ Export synchronization failed:', error.message);
      return {
        success: false,
        taskId: '',
        files: [],
        error: error.message,
      };
    }
  }
}

export function createDomainAnaplanService(config: DomainAnaplanConfig): DomainAnaplanService {
  return new DomainAnaplanService(config);
}
