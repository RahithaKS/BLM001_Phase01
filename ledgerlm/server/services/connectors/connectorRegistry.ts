import axios from 'axios';
import { storage } from '../../storage';
import { DomainApiConnector, AnaplanConfig, AzureBlobConfig, CONNECTOR_TYPES } from '@shared/schema';
import { AzureBlobConnector, createAzureBlobConnector } from './azureBlobConnector';
import { DomainAnaplanService } from '../domainAnaplanService';
import { decryptSensitiveFields, encryptSensitiveFields, redactSensitiveFields } from '../../utils/encryption';

export interface ConnectorTypeDefinition {
  type: string;
  name: string;
  description: string;
  icon: string;
  sensitiveFields: string[];
  available: boolean;
}

export const AVAILABLE_CONNECTOR_TYPES: ConnectorTypeDefinition[] = [
  {
    type: CONNECTOR_TYPES.ANAPLAN,
    name: 'Anaplan',
    description: 'Financial planning and modeling data',
    icon: 'chart-bar',
    sensitiveFields: ['password'],
    available: true,
  },
  {
    type: CONNECTOR_TYPES.AZURE_BLOB,
    name: 'Azure Blob Storage',
    description: 'Cloud storage documents and files',
    icon: 'cloud',
    sensitiveFields: ['account_key', 'sas_token', 'client_secret'],
    available: true,
  },
  {
    type: CONNECTOR_TYPES.SALESFORCE,
    name: 'Salesforce',
    description: 'CRM and sales data',
    icon: 'users',
    sensitiveFields: ['client_secret', 'refresh_token'],
    available: false,
  },
  {
    type: CONNECTOR_TYPES.POWER_BI,
    name: 'Power BI',
    description: 'Business intelligence dashboards',
    icon: 'bar-chart',
    sensitiveFields: ['client_secret'],
    available: false,
  },
  {
    type: CONNECTOR_TYPES.TABLEAU,
    name: 'Tableau',
    description: 'Data visualization platform',
    icon: 'pie-chart',
    sensitiveFields: ['token'],
    available: false,
  },
];

export class ConnectorRegistry {
  private anaplanConnectors: Map<string, DomainAnaplanService> = new Map();
  private azureBlobConnectors: Map<string, AzureBlobConnector> = new Map();

  getAvailableConnectorTypes(): ConnectorTypeDefinition[] {
    return AVAILABLE_CONNECTOR_TYPES.filter(c => c.available);
  }

  getAllConnectorTypes(): ConnectorTypeDefinition[] {
    return AVAILABLE_CONNECTOR_TYPES;
  }

  getSensitiveFields(connectorType: string): string[] {
    const def = AVAILABLE_CONNECTOR_TYPES.find(c => c.type === connectorType);
    return def?.sensitiveFields || [];
  }

  encryptConfig(connectorType: string, config: Record<string, any>): Record<string, any> {
    const sensitiveFields = this.getSensitiveFields(connectorType);
    return encryptSensitiveFields(config, sensitiveFields);
  }

  decryptConfig(connectorType: string, config: Record<string, any>): Record<string, any> {
    const sensitiveFields = this.getSensitiveFields(connectorType);
    return decryptSensitiveFields(config, sensitiveFields);
  }

  redactConfig(connectorType: string, config: Record<string, any>): Record<string, any> {
    const sensitiveFields = this.getSensitiveFields(connectorType);
    return redactSensitiveFields(config, sensitiveFields);
  }

  async getAnaplanConnector(domainId: string): Promise<DomainAnaplanService | null> {
    const cacheKey = `anaplan:${domainId}`;
    
    if (this.anaplanConnectors.has(cacheKey)) {
      return this.anaplanConnectors.get(cacheKey)!;
    }

    const connector = await storage.getDomainApiConnector(domainId, CONNECTOR_TYPES.ANAPLAN);
    if (!connector || connector.enabled !== 1) {
      return null;
    }

    return this._buildAnaplanService(connector, domainId, cacheKey);
  }

  async getAnaplanConnectorById(connectorId: string): Promise<DomainAnaplanService | null> {
    const cacheKey = `anaplan_id:${connectorId}`;

    if (this.anaplanConnectors.has(cacheKey)) {
      return this.anaplanConnectors.get(cacheKey)!;
    }

    const connector = await storage.getDomainApiConnectorById(connectorId);
    if (!connector || connector.enabled !== 1 || connector.connectorType !== CONNECTOR_TYPES.ANAPLAN) {
      return null;
    }

    return this._buildAnaplanService(connector, connector.domainId, cacheKey);
  }

  private async _buildAnaplanService(connector: DomainApiConnector, domainId: string, cacheKey: string): Promise<DomainAnaplanService | null> {
    try {
      const config = this.decryptConfig(CONNECTOR_TYPES.ANAPLAN, connector.config as Record<string, any>) as AnaplanConfig;
      
      const domain = await storage.getDomain(domainId);
      if (!domain?.companyId) {
        console.warn(`Domain ${domainId} has no company linked`);
        return null;
      }

      const service = new DomainAnaplanService({
        workspaceId: config.workspace_id,
        modelId: config.model_id,
        processId: config.process_id,
        username: config.username,
        password: config.password,
        domainId,
        companyId: domain.companyId,
      });

      this.anaplanConnectors.set(cacheKey, service);
      return service;
    } catch (error) {
      console.error(`Failed to create Anaplan connector (${cacheKey}):`, error);
      return null;
    }
  }

  async getAzureBlobConnector(domainId: string): Promise<AzureBlobConnector | null> {
    const cacheKey = `azure_blob:${domainId}`;
    
    if (this.azureBlobConnectors.has(cacheKey)) {
      return this.azureBlobConnectors.get(cacheKey)!;
    }

    const connector = await storage.getDomainApiConnector(domainId, CONNECTOR_TYPES.AZURE_BLOB);
    if (!connector || connector.enabled !== 1) {
      return null;
    }

    return this._buildAzureBlobService(connector, cacheKey);
  }

  async getAzureBlobConnectorById(connectorId: string): Promise<AzureBlobConnector | null> {
    const cacheKey = `azure_blob_id:${connectorId}`;

    if (this.azureBlobConnectors.has(cacheKey)) {
      return this.azureBlobConnectors.get(cacheKey)!;
    }

    const connector = await storage.getDomainApiConnectorById(connectorId);
    if (!connector || connector.enabled !== 1 || connector.connectorType !== CONNECTOR_TYPES.AZURE_BLOB) {
      return null;
    }

    return this._buildAzureBlobService(connector, cacheKey);
  }

  private _buildAzureBlobService(connector: DomainApiConnector, cacheKey: string): AzureBlobConnector | null {
    try {
      const config = this.decryptConfig(CONNECTOR_TYPES.AZURE_BLOB, connector.config as Record<string, any>) as AzureBlobConfig;
      const service = createAzureBlobConnector(config, connector.domainId);
      this.azureBlobConnectors.set(cacheKey, service);
      return service;
    } catch (error) {
      console.error(`Failed to create Azure Blob connector (${cacheKey}):`, error);
      return null;
    }
  }

  async testConnection(domainId: string, connectorType: string, config: Record<string, any>): Promise<{ success: boolean; message: string }> {
    try {
      if (connectorType === CONNECTOR_TYPES.AZURE_BLOB) {
        const azureConfig = config as AzureBlobConfig;
        const connector = createAzureBlobConnector(azureConfig, domainId);
        const result = await connector.testConnection();
        return { success: result.success, message: result.message };
      }

      if (connectorType === CONNECTOR_TYPES.ANAPLAN) {
        return await this._testAnaplanConnection(config);
      }

      return { success: false, message: `Connector type '${connectorType}' not supported` };
    } catch (error: any) {
      return { success: false, message: error.message || 'Connection test failed' };
    }
  }

  private async _testAnaplanConnection(config: Record<string, any>): Promise<{ success: boolean; message: string }> {
    try {
      const username = config.username;
      const password = config.password;

      if (!username || !password) {
        return { success: false, message: 'Username and password are required for Anaplan connection test' };
      }

      const credentials = Buffer.from(`${username}:${password}`).toString('base64');

      const response = await axios.post(
        'https://auth.anaplan.com/token/authenticate',
        {},
        {
          headers: { Authorization: `Basic ${credentials}` },
          timeout: 20000,
          validateStatus: () => true,
        }
      );

      if (response.status === 200 && response.data?.tokenInfo?.tokenValue) {
        return { success: true, message: 'Anaplan authentication successful — credentials are valid' };
      }

      const status = response.data?.status || '';
      const msg = response.data?.message || '';

      if (status === 'FAILURE_BAD_CREDENTIAL' || response.status === 401) {
        return { success: false, message: 'Invalid Anaplan credentials — check username and password' };
      }

      return {
        success: false,
        message: `Anaplan auth failed (HTTP ${response.status}): ${msg || status || 'Unknown error'}`,
      };
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        return { success: false, message: 'Cannot reach Anaplan auth service — check network connectivity' };
      }
      return { success: false, message: `Connection test error: ${error.message}` };
    }
  }

  clearCache(domainId?: string, connectorId?: string) {
    if (connectorId) {
      // Clear specific connector-by-id entries (used by sync service)
      this.anaplanConnectors.delete(`anaplan_id:${connectorId}`);
      this.azureBlobConnectors.delete(`azure_blob_id:${connectorId}`);
    }
    if (domainId) {
      this.anaplanConnectors.delete(`anaplan:${domainId}`);
      this.azureBlobConnectors.delete(`azure_blob:${domainId}`);
      // Also purge all connector-id entries for this domain to be safe
      for (const key of this.azureBlobConnectors.keys()) {
        if (key.startsWith('azure_blob_id:')) this.azureBlobConnectors.delete(key);
      }
      for (const key of this.anaplanConnectors.keys()) {
        if (key.startsWith('anaplan_id:')) this.anaplanConnectors.delete(key);
      }
    }
    if (!domainId && !connectorId) {
      this.anaplanConnectors.clear();
      this.azureBlobConnectors.clear();
    }
  }
}

export const connectorRegistry = new ConnectorRegistry();
