import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';

interface AnaplanConfig {
  workspaceId: string;
  modelId: string;
  exportProcessId: string;
  username: string;
  password: string;
}

interface ExportTaskResponse {
  taskId: string;
  taskState: string;
}

interface FileDownloadInfo {
  fileName: string;
  filePath: string;
  fileSize: number;
  success: boolean;
  error?: string;
}

export class AnaplanService {
  private config: AnaplanConfig;
  private client: AxiosInstance;
  private authToken: string | null = null;

  constructor() {
    const workspaceId = process.env.ANAPLAN_WORKSPACE_ID;
    const modelId = process.env.ANAPLAN_MODEL_ID;
    const exportProcessId = process.env.ANAPLAN_EXPORT_PROCESS_ID;
    const username = process.env.ANAPLAN_USERNAME;
    const password = process.env.ANAPLAN_PASSWORD;

    if (!workspaceId || !modelId || !exportProcessId || !username || !password) {
      throw new Error('Anaplan credentials not configured');
    }

    this.config = {
      workspaceId,
      modelId,
      exportProcessId,
      username,
      password,
    };

    this.client = axios.create({
      baseURL: 'https://api.anaplan.com/2/0',
      timeout: 900000, // 15 minutes timeout for very large file downloads (handles 20+ MB files)
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('✅ Anaplan service initialized');
    console.log(`   Workspace: ${this.config.workspaceId}`);
    console.log(`   Model: ${this.config.modelId}`);
    console.log(`   Process: ${this.config.exportProcessId}`);
    
    // Check for optional company targeting
    if (!process.env.ANAPLAN_COMPANY_ID) {
      console.warn('⚠️  ANAPLAN_COMPANY_ID not set - automation will process first company in database');
      console.warn('   For multi-tenant environments, set ANAPLAN_COMPANY_ID to target specific company');
    } else {
      console.log(`   Target Company: ${process.env.ANAPLAN_COMPANY_ID}`);
    }
  }

  private async authenticate(): Promise<void> {
    try {
      const credentials = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
      
      // Anaplan uses a separate auth service at auth.anaplan.com
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
      const url = `/workspaces/${this.config.workspaceId}/models/${this.config.modelId}/processes/${this.config.exportProcessId}/tasks`;
      
      console.log(`🔄 Triggering Anaplan export process: ${this.config.exportProcessId}`);
      
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

    const url = `/workspaces/${this.config.workspaceId}/models/${this.config.modelId}/processes/${this.config.exportProcessId}/tasks/${taskId}`;

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
          
          // Extract file IDs from nested results
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

        // Wait 5 seconds before next check
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error: any) {
        console.error(`❌ Error checking task status:`, error.response?.data || error.message);
        throw error;
      }
    }

    throw new Error(`Export task timed out after ${maxAttempts} attempts`);
  }

  async listExportFiles(): Promise<string[]> {
    await this.ensureAuthenticated();

    try {
      const url = `/workspaces/${this.config.workspaceId}/models/${this.config.modelId}/files`;
      
      const response = await this.client.get(url, {
        headers: this.getAuthHeaders(),
      });

      const files = response.data.files || [];
      const fileNames = files.map((f: any) => f.name);

      console.log(`📁 Found ${fileNames.length} export files in Anaplan model`);
      return fileNames;
    } catch (error: any) {
      console.error('❌ Failed to list export files:', error.response?.data || error.message);
      throw new Error(`Failed to list files: ${error.message}`);
    }
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
      // URL encode the file name to handle special characters like [LM], &, parentheses
      const encodedFileName = encodeURIComponent(fileName);
      const url = `/workspaces/${this.config.workspaceId}/models/${this.config.modelId}/files/${encodedFileName}`;
      
      console.log(`⬇️  Downloading file: ${fileName}`);

      const response = await this.client.get(url, {
        headers: this.getAuthHeaders(),
        responseType: 'arraybuffer',
      });

      // Ensure destination directory exists
      await fs.mkdir(destinationDir, { recursive: true });

      // Anaplan exports are Excel files but don't always have .xlsx extension
      // Add .xlsx if missing to ensure proper processing
      const fileNameWithExtension = fileName.toLowerCase().endsWith('.xlsx') || fileName.toLowerCase().endsWith('.xls')
        ? fileName
        : `${fileName}.xlsx`;
      
      const filePath = path.join(destinationDir, fileNameWithExtension);
      await fs.writeFile(filePath, response.data);

      const fileSize = response.data.length;
      console.log(`✅ Downloaded ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

      return {
        fileName: fileNameWithExtension,  // Return fileName with .xlsx extension
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

  async downloadAllExportFiles(destinationDir: string): Promise<FileDownloadInfo[]> {
    const fileNames = await this.listExportFiles();
    const results: FileDownloadInfo[] = [];

    for (const fileName of fileNames) {
      const result = await this.downloadFile(fileName, destinationDir);
      results.push(result);
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`📦 Downloaded ${successCount}/${results.length} files successfully`);

    return results;
  }

  async runFullExportSync(destinationDir: string): Promise<{
    success: boolean;
    taskId: string;
    files: FileDownloadInfo[];
    error?: string;
  }> {
    try {
      console.log('🚀 Starting Anaplan export synchronization...');
      
      // Step 1: Trigger export process
      const taskId = await this.triggerExportProcess();

      // Step 2: Wait for completion and get file IDs generated by this process
      const exportFileIds = await this.waitForTaskCompletion(taskId);

      // Step 3: Get file names from IDs
      const fileNames = await this.getFileNamesFromIds(exportFileIds);

      // Step 4: Download only the files generated by this process
      const files: FileDownloadInfo[] = [];
      for (const fileName of fileNames) {
        const result = await this.downloadFile(fileName, destinationDir);
        files.push(result);
      }

      const successCount = files.filter(f => f.success).length;
      console.log(`📦 Downloaded ${successCount}/${files.length} files from process`);

      const allSuccessful = files.every(f => f.success);

      return {
        success: allSuccessful,
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

// Only create Anaplan service if credentials are configured
function createAnaplanService(): AnaplanService | null {
  const workspaceId = process.env.ANAPLAN_WORKSPACE_ID;
  const modelId = process.env.ANAPLAN_MODEL_ID;
  const exportProcessId = process.env.ANAPLAN_EXPORT_PROCESS_ID;
  const username = process.env.ANAPLAN_USERNAME;
  const password = process.env.ANAPLAN_PASSWORD;

  if (!workspaceId || !modelId || !exportProcessId || !username || !password) {
    console.log('ℹ️  Anaplan credentials not configured - Anaplan integration disabled');
    return null;
  }

  try {
    return new AnaplanService();
  } catch (error) {
    console.error('❌ Failed to initialize Anaplan service:', error);
    return null;
  }
}

export const anaplanService = createAnaplanService();
