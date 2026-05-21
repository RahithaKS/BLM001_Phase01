import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Plus, Users, FileText, Edit, Box, Database, Cloud, Upload, Layers, ChevronRight, ChevronLeft, Check, Clock, Tag, Settings, Network, RefreshCw, AlertCircle, CheckCircle2, Loader2, Terminal, Play, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { ColumnConfigDialog } from '@/components/ColumnConfigDialog';
import { HierarchyConfigDialog } from '@/components/HierarchyConfigDialog';
import { SchemaIntelligenceStudio } from '@/components/SchemaIntelligenceStudio';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface Cube {
  id: string;
  domainId: string;
  name: string;
  description: string | null;
  sourceType: string;
  connectorId: string | null;
  ingestionConfig: string | null;
  createdAt: string;
  documentCount?: number;
}

interface CubeUserAccess {
  id: string;
  cubeId: string;
  userEmail: string;
  enabled: number;
  grantedBy: string | null;
  createdAt: string;
}

interface DomainUser {
  id: string;
  email: string;
  role: string;
}

interface DomainConnector {
  id: string;
  connectorType: string;
  displayName: string;
  enabled: boolean;
  status?: string;
  lastSyncAt?: string | null;
  lastSyncResult?: string | null;
  scheduleEnabled?: number;
  scheduleHour?: number;
  scheduleMinute?: number;
  scheduleTimezone?: string;
  blobPrefix?: string | null;
  targetCubeId?: string | null;
}

interface CubeManagementProps {
  domainId: string;
  domainName?: string;
  isSuperAdmin?: boolean;
}

const SOURCE_TYPE_OPTIONS = [
  { value: 'manual', label: 'Manual Upload', icon: Upload, description: 'Upload documents manually to this cube' },
  { value: 'anaplan', label: 'Anaplan', icon: Database, description: 'Sync data automatically from Anaplan' },
  { value: 'azure_blob', label: 'Azure Blob Storage', icon: Cloud, description: 'Sync documents from Azure Blob container' },
  { value: 'all', label: 'All Sources', icon: Layers, description: 'Accept data from any configured source' },
];

function getSourceTypeInfo(sourceType: string) {
  return SOURCE_TYPE_OPTIONS.find(opt => opt.value === sourceType) || SOURCE_TYPE_OPTIONS[0];
}

function parseIngestionConfig(configStr: string | null): { schedule?: { enabled: boolean; time: string; timezone: string } } | null {
  if (!configStr) return null;
  try {
    return typeof configStr === 'string' ? JSON.parse(configStr) : configStr;
  } catch {
    return null;
  }
}

type WizardStep = 'basics' | 'source' | 'access';

export function CubeManagement({ domainId, domainName, isSuperAdmin }: CubeManagementProps) {
  const { toast } = useToast();
  
  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAccessDialogOpen, setIsAccessDialogOpen] = useState(false);
  const [isMetadataDialogOpen, setIsMetadataDialogOpen] = useState(false);
  const [isSchemaConfigDialogOpen, setIsSchemaConfigDialogOpen] = useState(false);
  const [isHierarchyDialogOpen, setIsHierarchyDialogOpen] = useState(false);
  const [isSchemaStudioOpen, setIsSchemaStudioOpen] = useState(false);

  // Edit credentials dialog
  const [editCredConnector, setEditCredConnector] = useState<DomainConnector | null>(null);
  const [editCredAuthType, setEditCredAuthType] = useState<'account_key' | 'sas_token' | 'azure_ad'>('account_key');
  const [editCredAccountName, setEditCredAccountName] = useState('');
  const [editCredAccountKey, setEditCredAccountKey] = useState('');
  const [editCredSasToken, setEditCredSasToken] = useState('');
  const [editCredTenantId, setEditCredTenantId] = useState('');
  const [editCredClientId, setEditCredClientId] = useState('');
  const [editCredClientSecret, setEditCredClientSecret] = useState('');
  const [editCredContainer, setEditCredContainer] = useState('');
  const [editCredEndpoint, setEditCredEndpoint] = useState('core.windows.net');
  const [editCredPrefix, setEditCredPrefix] = useState('');
  const [selectedCube, setSelectedCube] = useState<Cube | null>(null);
  
  // Wizard state
  const [wizardStep, setWizardStep] = useState<WizardStep>('basics');
  
  // Form state for create
  const [newCubeName, setNewCubeName] = useState('');
  const [newCubeDescription, setNewCubeDescription] = useState('');
  const [newCubeSourceType, setNewCubeSourceType] = useState('manual');
  const [newCubeConnectorId, setNewCubeConnectorId] = useState<string | null>(null);
  const [newCubeScheduleEnabled, setNewCubeScheduleEnabled] = useState(false);
  const [newCubeScheduleTime, setNewCubeScheduleTime] = useState('06:00');
  const [newCubeScheduleTimezone, setNewCubeScheduleTimezone] = useState('Asia/Kolkata');
  const [selectedUsersForCreate, setSelectedUsersForCreate] = useState<Set<string>>(new Set());
  
  // Anaplan config state
  const [anaplanWorkspaceId, setAnaplanWorkspaceId] = useState('');
  const [anaplanModelId, setAnaplanModelId] = useState('');
  const [anaplanProcessId, setAnaplanProcessId] = useState('');
  const [anaplanUsername, setAnaplanUsername] = useState('');
  const [anaplanPassword, setAnaplanPassword] = useState('');
  
  // Azure Blob config state
  const [azureAccountName, setAzureAccountName] = useState('');
  const [azureAuthType, setAzureAuthType] = useState<'account_key' | 'sas_token' | 'azure_ad'>('account_key');
  const [azureAccountKey, setAzureAccountKey] = useState('');
  const [azureSasToken, setAzureSasToken] = useState('');
  const [azureTenantId, setAzureTenantId] = useState('');
  const [azureClientId, setAzureClientId] = useState('');
  const [azureClientSecret, setAzureClientSecret] = useState('');
  const [azureContainerName, setAzureContainerName] = useState('');
  const [azureEndpointSuffix, setAzureEndpointSuffix] = useState('core.windows.net');
  const [azureBlobPrefix, setAzureBlobPrefix] = useState('');
  
  // Form state for edit
  const [editCubeName, setEditCubeName] = useState('');
  const [editCubeDescription, setEditCubeDescription] = useState('');
  const [editCubeSourceType, setEditCubeSourceType] = useState('manual');
  const [editCubeConnectorId, setEditCubeConnectorId] = useState<string | null>(null);
  
  // Access management state
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  
  // Metadata management state
  const [metadataEntities, setMetadataEntities] = useState('');
  const [metadataMetrics, setMetadataMetrics] = useState('');
  const [metadataPeriods, setMetadataPeriods] = useState('');

  // SQL Query Console state
  const [isQueryDialogOpen, setIsQueryDialogOpen] = useState(false);
  const [queryCube, setQueryCube] = useState<Cube | null>(null);

  // Scheduler dialog state
  const [isSchedulerDialogOpen, setIsSchedulerDialogOpen] = useState(false);
  const [schedulerCube, setSchedulerCube] = useState<Cube | null>(null);

  // Fetch cubes
  const { data: cubes = [], isLoading } = useQuery<Cube[]>({
    queryKey: ['/api/domain-admin/cubes', domainId],
    queryFn: async () => {
      const url = isSuperAdmin 
        ? `/api/domain-admin/cubes?domainId=${domainId}` 
        : '/api/domain-admin/cubes';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch cubes');
      return res.json();
    },
    enabled: !!domainId,
  });

  // Fetch cube access for selected cube
  const { data: cubeAccess = [], isLoading: accessLoading } = useQuery<CubeUserAccess[]>({
    queryKey: ['/api/domain-admin/cubes', selectedCube?.id, 'access'],
    queryFn: async () => {
      const res = await fetch(`/api/domain-admin/cubes/${selectedCube!.id}/access`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch cube access');
      return res.json();
    },
    enabled: !!selectedCube && isAccessDialogOpen,
  });

  // Fetch domain users
  const { data: domainUsers = [], isLoading: usersLoading } = useQuery<DomainUser[]>({
    queryKey: ['/api/domain-admin/users', domainId],
    queryFn: async () => {
      const url = isSuperAdmin 
        ? `/api/domain-admin/users?domainId=${domainId}` 
        : '/api/domain-admin/users';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch domain users');
      return res.json();
    },
    enabled: !!domainId && (isAccessDialogOpen || (isCreateDialogOpen && wizardStep === 'access')),
  });

  // Fetch domain connectors
  const { data: domainConnectors = [] } = useQuery<DomainConnector[]>({
    queryKey: ['/api/domain-admin/connectors', domainId],
    queryFn: async () => {
      const url = isSuperAdmin 
        ? `/api/domain-admin/connectors?domainId=${domainId}` 
        : '/api/domain-admin/connectors';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!domainId,
    refetchInterval: 30000,
  });

  // Initialize access state when dialog opens
  useEffect(() => {
    if (cubeAccess.length > 0) {
      const accessEmails = new Set(cubeAccess.filter(a => a.enabled === 1).map(a => a.userEmail.toLowerCase()));
      setSelectedUsers(accessEmails);
    } else if (isAccessDialogOpen && !accessLoading) {
      setSelectedUsers(new Set());
    }
  }, [cubeAccess, isAccessDialogOpen, accessLoading]);

  // Mutations
  const createCubeMutation = useMutation({
    mutationFn: async () => {
      const ingestionConfig: any = {};
      
      // Anaplan configuration
      if (newCubeSourceType === 'anaplan') {
        ingestionConfig.anaplan = {
          workspaceId: anaplanWorkspaceId,
          modelId: anaplanModelId,
          processId: anaplanProcessId,
          username: anaplanUsername,
          password: anaplanPassword,
        };
        if (newCubeScheduleEnabled) {
          ingestionConfig.schedule = {
            enabled: true,
            time: newCubeScheduleTime,
            timezone: newCubeScheduleTimezone,
          };
        }
      }
      
      // Azure Blob configuration
      if (newCubeSourceType === 'azure_blob') {
        const azureAuth = azureAuthType === 'azure_ad'
          ? { tenantId: azureTenantId, clientId: azureClientId, clientSecret: azureClientSecret }
          : azureAuthType === 'sas_token'
            ? { sasToken: azureSasToken }
            : { accountKey: azureAccountKey };
        ingestionConfig.azureBlob = {
          accountName: azureAccountName,
          ...azureAuth,
          containerName: azureContainerName,
          endpointSuffix: azureEndpointSuffix || 'core.windows.net',
          blobPrefix: azureBlobPrefix || null,
        };
        if (newCubeScheduleEnabled) {
          ingestionConfig.schedule = {
            enabled: true,
            time: newCubeScheduleTime,
            timezone: newCubeScheduleTimezone,
          };
        }
      }
      
      const cubeData = await apiRequest<{ id: string }>('POST', '/api/domain-admin/cubes', {
        name: newCubeName,
        description: newCubeDescription || null,
        sourceType: newCubeSourceType,
        connectorId: null, // No longer referencing domain connectors
        ingestionConfig: Object.keys(ingestionConfig).length > 0 ? ingestionConfig : null,
        domainId: isSuperAdmin ? domainId : undefined,
      });
      
      // If users were selected, grant access
      if (selectedUsersForCreate.size > 0 && cubeData?.id) {
        await apiRequest('PUT', `/api/domain-admin/cubes/${cubeData.id}/access/bulk`, {
          userEmails: Array.from(selectedUsersForCreate),
        });
      }
      
      return cubeData;
    },
    onSuccess: () => {
      toast({ title: 'Cube created successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/domain-admin/cubes', domainId] });
      resetCreateForm();
      setIsCreateDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: 'Failed to create cube', description: error.message, variant: 'destructive' });
    },
  });

  const updateCubeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('PUT', `/api/domain-admin/cubes/${selectedCube!.id}`, {
        name: editCubeName,
        description: editCubeDescription || null,
        sourceType: editCubeSourceType,
        connectorId: editCubeConnectorId,
      });
    },
    onSuccess: () => {
      toast({ title: 'Cube updated successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/domain-admin/cubes', domainId] });
      setIsEditDialogOpen(false);
      setSelectedCube(null);
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update cube', description: error.message, variant: 'destructive' });
    },
  });

  const deleteCubeMutation = useMutation({
    mutationFn: async ({ cubeId, force }: { cubeId: string; force: boolean }) => {
      return apiRequest('DELETE', `/api/domain-admin/cubes/${cubeId}?force=${force}`);
    },
    onSuccess: () => {
      toast({ title: 'Cube deleted successfully', description: 'All related data has been removed from the database' });
      queryClient.invalidateQueries({ queryKey: ['/api/domain-admin/cubes', domainId] });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to delete cube', description: error.message, variant: 'destructive' });
    },
  });

  const seedBoschLogicMutation = useMutation({
    mutationFn: async (cubeId: string) => {
      return apiRequest('POST', `/api/domain-admin/cubes/${cubeId}/seed-bosch-logic`);
    },
    onSuccess: (data: any) => {
      const total = (data.termsCreated || 0) + (data.calculationsCreated || 0) + 
                   (data.filtersCreated || 0) + (data.patternsCreated || 0) + (data.columnValuesCreated || 0);
      toast({ 
        title: 'Bosch business logic seeded', 
        description: `Added ${total} rules: ${data.termsCreated} terms, ${data.calculationsCreated} calculations, ${data.filtersCreated} filters, ${data.patternsCreated} patterns, ${data.columnValuesCreated} column values`
      });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to seed business logic', description: error.message, variant: 'destructive' });
    },
  });

  const updateAccessMutation = useMutation({
    mutationFn: async (emails: string[]) => {
      return apiRequest('PUT', `/api/domain-admin/cubes/${selectedCube!.id}/access/bulk`, {
        userEmails: emails,
      });
    },
    onSuccess: () => {
      toast({ title: 'Access updated successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/domain-admin/cubes', selectedCube?.id, 'access'] });
      setIsAccessDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update access', description: error.message, variant: 'destructive' });
    },
  });

  const [syncingConnectorId, setSyncingConnectorId] = useState<string | null>(null);

  const syncNowMutation = useMutation({
    mutationFn: async (connectorId: string) => {
      setSyncingConnectorId(connectorId);
      return apiRequest<{ filesProcessed: number; filesSkipped: number; filesFailed: number }>(
        'POST', `/api/domain-admin/connectors/${connectorId}/sync`
      );
    },
    onSuccess: (data, connectorId) => {
      setSyncingConnectorId(null);
      toast({
        title: 'Sync complete',
        description: `Processed: ${data.filesProcessed}, Skipped: ${data.filesSkipped}, Failed: ${data.filesFailed}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/domain-admin/connectors', domainId] });
      queryClient.invalidateQueries({ queryKey: ['/api/domain-admin/cubes', domainId] });
    },
    onError: (error: any) => {
      setSyncingConnectorId(null);
      toast({ title: 'Sync failed', description: error.message, variant: 'destructive' });
    },
  });

  const updateCredentialsMutation = useMutation({
    mutationFn: async ({ connectorId, body }: { connectorId: string; body: any }) => {
      return apiRequest('PUT', `/api/domain-admin/connectors/${connectorId}`, body);
    },
    onSuccess: () => {
      toast({ title: 'Credentials updated', description: 'The new account key has been saved.' });
      setEditCredConnector(null);
      queryClient.invalidateQueries({ queryKey: ['/api/domain-admin/connectors', domainId] });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update credentials', description: error.message, variant: 'destructive' });
    },
  });

  // Fetch cube metadata when metadata dialog is open
  const { data: cubeMetadata, isLoading: metadataLoading } = useQuery<{
    entities: string[];
    metrics: string[];
    periods: string[];
    customFields: Record<string, any>;
  }>({
    queryKey: ['/api/domain-admin/cubes', selectedCube?.id, 'metadata'],
    queryFn: async () => {
      const res = await fetch(`/api/domain-admin/cubes/${selectedCube?.id}/metadata`, {
        headers: { 'x-user-id': localStorage.getItem('userId') || '' },
      });
      if (!res.ok) throw new Error('Failed to fetch metadata');
      return res.json();
    },
    enabled: isMetadataDialogOpen && !!selectedCube,
  });

  // Update metadata when dialog opens with existing data
  useEffect(() => {
    if (cubeMetadata && isMetadataDialogOpen) {
      setMetadataEntities((cubeMetadata.entities || []).join('\n'));
      setMetadataMetrics((cubeMetadata.metrics || []).join('\n'));
      setMetadataPeriods((cubeMetadata.periods || []).join('\n'));
    }
  }, [cubeMetadata, isMetadataDialogOpen]);

  const saveMetadataMutation = useMutation({
    mutationFn: async (data: { entities: string[]; metrics: string[]; periods: string[] }) => {
      return apiRequest('PUT', `/api/domain-admin/cubes/${selectedCube!.id}/metadata`, data);
    },
    onSuccess: () => {
      toast({ title: 'Metadata saved successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/domain-admin/cubes', selectedCube?.id, 'metadata'] });
      setIsMetadataDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: 'Failed to save metadata', description: error.message, variant: 'destructive' });
    },
  });

  const handleSaveMetadata = () => {
    const entities = metadataEntities.split('\n').map(e => e.trim()).filter(Boolean);
    const metrics = metadataMetrics.split('\n').map(m => m.trim()).filter(Boolean);
    const periods = metadataPeriods.split('\n').map(p => p.trim()).filter(Boolean);
    saveMetadataMutation.mutate({ entities, metrics, periods });
  };

  const handleOpenMetadata = (cube: Cube) => {
    setSelectedCube(cube);
    setMetadataEntities('');
    setMetadataMetrics('');
    setMetadataPeriods('');
    setIsMetadataDialogOpen(true);
  };

  const handleConfigureSchema = (cube: Cube) => {
    setSelectedCube(cube);
    setIsSchemaConfigDialogOpen(true);
  };

  // Helper functions
  const resetCreateForm = () => {
    setNewCubeName('');
    setNewCubeDescription('');
    setNewCubeSourceType('manual');
    setNewCubeConnectorId(null);
    setNewCubeScheduleEnabled(false);
    setNewCubeScheduleTime('06:00');
    setNewCubeScheduleTimezone('Asia/Kolkata');
    setSelectedUsersForCreate(new Set());
    setWizardStep('basics');
    // Reset Anaplan config
    setAnaplanWorkspaceId('');
    setAnaplanModelId('');
    setAnaplanProcessId('');
    setAnaplanUsername('');
    setAnaplanPassword('');
    // Reset Azure Blob config
    setAzureAccountName('');
    setAzureAccountKey('');
    setAzureContainerName('');
    setAzureEndpointSuffix('core.windows.net');
    setAzureBlobPrefix('');
  };

  const handleEditCube = (cube: Cube) => {
    setSelectedCube(cube);
    setEditCubeName(cube.name);
    setEditCubeDescription(cube.description || '');
    setEditCubeSourceType(cube.sourceType || 'manual');
    setEditCubeConnectorId(cube.connectorId);
    setIsEditDialogOpen(true);
  };

  const handleManageAccess = (cube: Cube) => {
    setSelectedCube(cube);
    setSelectedUsers(new Set());
    setIsAccessDialogOpen(true);
  };

  const toggleUserSelection = (email: string, forCreate = false) => {
    const lowerEmail = email.toLowerCase();
    const setter = forCreate ? setSelectedUsersForCreate : setSelectedUsers;
    setter(prev => {
      const next = new Set(prev);
      if (next.has(lowerEmail)) {
        next.delete(lowerEmail);
      } else {
        next.add(lowerEmail);
      }
      return next;
    });
  };

  const getConnectorsForSourceType = (sourceType: string) => {
    const typeMap: Record<string, string> = {
      'anaplan': 'anaplan',
      'azure_blob': 'azure_blob',
    };
    return domainConnectors.filter(c => c.connectorType === typeMap[sourceType] && c.enabled);
  };

  const canProceedToNextStep = () => {
    if (wizardStep === 'basics') {
      return newCubeName.trim().length > 0;
    }
    if (wizardStep === 'source') {
      if (newCubeSourceType === 'anaplan') {
        // Require all Anaplan fields to be filled
        return anaplanWorkspaceId.trim() !== '' && 
               anaplanModelId.trim() !== '' && 
               anaplanProcessId.trim() !== '' &&
               anaplanUsername.trim() !== '' &&
               anaplanPassword.trim() !== '';
      }
      if (newCubeSourceType === 'azure_blob') {
        const hasAuth = azureAuthType === 'azure_ad'
          ? (azureTenantId.trim() !== '' && azureClientId.trim() !== '' && azureClientSecret.trim() !== '')
          : azureAuthType === 'sas_token'
            ? azureSasToken.trim() !== ''
            : azureAccountKey.trim() !== '';
        return azureAccountName.trim() !== '' && hasAuth && azureContainerName.trim() !== '';
      }
      return true;
    }
    return true;
  };

  const handleNextStep = () => {
    if (wizardStep === 'basics') setWizardStep('source');
    else if (wizardStep === 'source') setWizardStep('access');
  };

  const handlePrevStep = () => {
    if (wizardStep === 'source') setWizardStep('basics');
    else if (wizardStep === 'access') setWizardStep('source');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Box className="h-5 w-5" />
            Data Cubes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">Loading cubes...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Box className="h-5 w-5" />
                Data Cubes
              </CardTitle>
              <CardDescription>
                Organize enterprise documents into logical groups and control user access
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setIsHierarchyDialogOpen(true)}
                data-testid="button-configure-hierarchies"
              >
                <Network className="h-4 w-4 mr-1" />
                Hierarchies
              </Button>
              <Button 
                size="sm" 
                onClick={() => {
                  resetCreateForm();
                  setIsCreateDialogOpen(true);
                }}
                data-testid="button-create-cube"
              >
                <Plus className="h-4 w-4 mr-1" />
                New Cube
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {cubes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Box className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No cubes configured yet.</p>
              <p className="text-sm">Create cubes to organize your enterprise documents and control access.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cubes.map((cube) => {
                const sourceInfo = getSourceTypeInfo(cube.sourceType);
                const SourceIcon = sourceInfo.icon;
                const config = parseIngestionConfig(cube.ingestionConfig);
                const hasSchedule = config?.schedule?.enabled;
                const linkedConnector = domainConnectors.find(c => c.id === cube.connectorId);
                const isSyncing = syncingConnectorId === linkedConnector?.id;
                return (
                  <Card key={cube.id} className="hover-elevate" data-testid={`card-cube-${cube.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base">{cube.name}</CardTitle>
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {cube.documentCount || 0}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="flex items-center gap-1 text-xs">
                          <SourceIcon className="h-3 w-3" />
                          {sourceInfo.label}
                        </Badge>
                        {hasSchedule && config?.schedule && (
                          <Badge variant="outline" className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {config.schedule.time} {config.schedule.timezone?.split('/')[1] || config.schedule.timezone}
                          </Badge>
                        )}
                      </div>
                      {cube.description && (
                        <CardDescription className="line-clamp-2 mt-1">{cube.description}</CardDescription>
                      )}
                      {linkedConnector && cube.sourceType === 'azure_blob' && (
                        <div className="mt-2 rounded-md bg-muted/40 px-3 py-2 text-xs space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
                              {linkedConnector.status === 'error' ? (
                                <AlertCircle className="h-3 w-3 text-destructive" />
                              ) : linkedConnector.status === 'active' || linkedConnector.status === 'connected' ? (
                                <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
                              ) : (
                                <Clock className="h-3 w-3" />
                              )}
                              {linkedConnector.status === 'active' || linkedConnector.status === 'connected'
                                ? 'Connected'
                                : linkedConnector.status === 'error'
                                ? 'Error'
                                : 'Pending sync'}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-xs"
                              disabled={isSyncing}
                              onClick={() => syncNowMutation.mutate(linkedConnector.id)}
                              data-testid={`button-sync-now-${cube.id}`}
                            >
                              {isSyncing
                                ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Syncing…</>
                                : <><RefreshCw className="h-3 w-3 mr-1" />Sync Now</>
                              }
                            </Button>
                          </div>
                          {linkedConnector.lastSyncAt && (
                            <div className="text-muted-foreground">
                              Last sync: {new Date(linkedConnector.lastSyncAt).toLocaleString()}
                            </div>
                          )}
                          {linkedConnector.lastSyncResult && (
                            <div className="text-muted-foreground font-mono">{linkedConnector.lastSyncResult}</div>
                          )}
                          {linkedConnector.blobPrefix && (
                            <div className="text-muted-foreground">
                              Folder: <span className="font-mono">{linkedConnector.blobPrefix}</span>
                            </div>
                          )}
                          {linkedConnector.scheduleEnabled === 1 && (
                            <div className="text-muted-foreground">
                              Auto-sync: {String(linkedConnector.scheduleHour).padStart(2,'0')}:{String(linkedConnector.scheduleMinute ?? 0).padStart(2,'0')} {linkedConnector.scheduleTimezone?.split('/')[1] || linkedConnector.scheduleTimezone}
                            </div>
                          )}
                          <div className="pt-0.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs text-muted-foreground"
                              onClick={() => {
                                setEditCredConnector(linkedConnector);
                                setEditCredAuthType('account_key');
                                setEditCredAccountName('');
                                setEditCredAccountKey('');
                                setEditCredSasToken('');
                                setEditCredTenantId('');
                                setEditCredClientId('');
                                setEditCredClientSecret('');
                                setEditCredContainer('');
                                setEditCredEndpoint('core.windows.net');
                                setEditCredPrefix(linkedConnector.blobPrefix || '');
                              }}
                              data-testid={`button-edit-credentials-${cube.id}`}
                            >
                              Edit credentials
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleManageAccess(cube)}
                          data-testid={`button-manage-access-${cube.id}`}
                        >
                          <Users className="h-4 w-4 mr-1" />
                          Access
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenMetadata(cube)}
                          data-testid={`button-metadata-${cube.id}`}
                        >
                          <Tag className="h-4 w-4 mr-1" />
                          Metadata
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleConfigureSchema(cube)}
                          data-testid={`button-schema-config-${cube.id}`}
                        >
                          <Settings className="h-4 w-4 mr-1" />
                          Schema
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedCube(cube);
                            setIsSchemaStudioOpen(true);
                          }}
                          data-testid={`button-schema-studio-${cube.id}`}
                        >
                          <Network className="h-4 w-4 mr-1" />
                          Intelligence
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (confirm(`Seed Bosch business logic for "${cube.name}"? This adds finance terminology, calculation formulas, and query patterns.`)) {
                              seedBoschLogicMutation.mutate(cube.id);
                            }
                          }}
                          disabled={seedBoschLogicMutation.isPending}
                          data-testid={`button-seed-bosch-${cube.id}`}
                        >
                          <Database className="h-4 w-4 mr-1" />
                          {seedBoschLogicMutation.isPending ? 'Seeding...' : 'Seed Bosch'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setQueryCube(cube);
                            setIsQueryDialogOpen(true);
                          }}
                          data-testid={`button-sql-query-${cube.id}`}
                        >
                          <Terminal className="h-4 w-4 mr-1" />
                          Query
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSchedulerCube(cube);
                            setIsSchedulerDialogOpen(true);
                          }}
                          data-testid={`button-scheduler-${cube.id}`}
                        >
                          <Clock className="h-4 w-4 mr-1" />
                          Scheduler
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditCube(cube)}
                          data-testid={`button-edit-cube-${cube.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const hasDocuments = cube.documentCount && cube.documentCount > 0;
                            const message = hasDocuments
                              ? `Delete cube "${cube.name}" and all ${cube.documentCount} documents? This will also remove all related data from the database.`
                              : `Delete cube "${cube.name}"? This will remove all related data from the database.`;
                            if (confirm(message)) {
                              deleteCubeMutation.mutate({ cubeId: cube.id, force: true });
                            }
                          }}
                          data-testid={`button-delete-cube-${cube.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Cube Wizard Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        if (!open) resetCreateForm();
        setIsCreateDialogOpen(open);
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Cube</DialogTitle>
            <DialogDescription>
              {wizardStep === 'basics' && 'Step 1: Enter cube name and description'}
              {wizardStep === 'source' && 'Step 2: Configure data source'}
              {wizardStep === 'access' && 'Step 3: Select users who can access this cube'}
            </DialogDescription>
          </DialogHeader>

          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-2 py-2">
            {['basics', 'source', 'access'].map((step, idx) => (
              <div key={step} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  wizardStep === step 
                    ? 'bg-primary text-primary-foreground' 
                    : idx < ['basics', 'source', 'access'].indexOf(wizardStep)
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                }`}>
                  {idx < ['basics', 'source', 'access'].indexOf(wizardStep) ? <Check className="h-4 w-4" /> : idx + 1}
                </div>
                {idx < 2 && <div className="w-8 h-0.5 bg-muted" />}
              </div>
            ))}
          </div>

          {/* Step 1: Basics */}
          {wizardStep === 'basics' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="cube-name">Cube Name *</Label>
                <Input
                  id="cube-name"
                  placeholder="e.g., KPI Metrics, P&L Reports"
                  value={newCubeName}
                  onChange={(e) => setNewCubeName(e.target.value)}
                  data-testid="input-cube-name"
                />
              </div>
              <div>
                <Label htmlFor="cube-description">Description (optional)</Label>
                <Textarea
                  id="cube-description"
                  placeholder="Describe what data this cube contains..."
                  value={newCubeDescription}
                  onChange={(e) => setNewCubeDescription(e.target.value)}
                  data-testid="input-cube-description"
                />
              </div>
            </div>
          )}

          {/* Step 2: Source Configuration */}
          {wizardStep === 'source' && (
            <div className="space-y-4">
              <div>
                <Label>Data Source</Label>
                <RadioGroup value={newCubeSourceType} onValueChange={setNewCubeSourceType} className="mt-2">
                  {SOURCE_TYPE_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    return (
                      <div key={opt.value} className="flex items-start gap-3 p-3 rounded-lg border hover-elevate cursor-pointer" onClick={() => setNewCubeSourceType(opt.value)}>
                        <RadioGroupItem value={opt.value} id={`source-${opt.value}`} className="mt-1" />
                        <div className="flex-1">
                          <Label htmlFor={`source-${opt.value}`} className="flex items-center gap-2 cursor-pointer font-medium">
                            <Icon className="h-4 w-4" />
                            {opt.label}
                          </Label>
                          <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </RadioGroup>
              </div>

              {/* Anaplan Configuration */}
              {newCubeSourceType === 'anaplan' && (
                <div className="space-y-4 pt-2 border-t">
                  <div>
                    <Label className="text-sm font-medium">Anaplan Configuration</Label>
                    <p className="text-xs text-muted-foreground mb-3">Enter your Anaplan workspace details</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <Label htmlFor="anaplan-workspace">Workspace ID *</Label>
                      <Input
                        id="anaplan-workspace"
                        placeholder="e.g., 8a868cdc7e5feca9017e8e4afdd57430"
                        value={anaplanWorkspaceId}
                        onChange={(e) => setAnaplanWorkspaceId(e.target.value)}
                        data-testid="input-anaplan-workspace"
                      />
                    </div>
                    <div>
                      <Label htmlFor="anaplan-model">Model ID *</Label>
                      <Input
                        id="anaplan-model"
                        placeholder="e.g., BE462879B50444F498A0DA70F40FABA2"
                        value={anaplanModelId}
                        onChange={(e) => setAnaplanModelId(e.target.value)}
                        data-testid="input-anaplan-model"
                      />
                    </div>
                    <div>
                      <Label htmlFor="anaplan-process">Export Process ID *</Label>
                      <Input
                        id="anaplan-process"
                        placeholder="e.g., 118000000093"
                        value={anaplanProcessId}
                        onChange={(e) => setAnaplanProcessId(e.target.value)}
                        data-testid="input-anaplan-process"
                      />
                    </div>
                    <div>
                      <Label htmlFor="anaplan-username">Username (Email) *</Label>
                      <Input
                        id="anaplan-username"
                        type="email"
                        placeholder="user@company.com"
                        value={anaplanUsername}
                        onChange={(e) => setAnaplanUsername(e.target.value)}
                        data-testid="input-anaplan-username"
                      />
                    </div>
                    <div>
                      <Label htmlFor="anaplan-password">Password *</Label>
                      <Input
                        id="anaplan-password"
                        type="password"
                        placeholder="Enter Anaplan password"
                        value={anaplanPassword}
                        onChange={(e) => setAnaplanPassword(e.target.value)}
                        data-testid="input-anaplan-password"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Azure Blob Configuration */}
              {newCubeSourceType === 'azure_blob' && (
                <div className="space-y-4 pt-2 border-t">
                  <div>
                    <Label className="text-sm font-medium">Azure Blob Storage Configuration</Label>
                    <p className="text-xs text-muted-foreground mb-3">Enter your Azure storage account details</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <Label htmlFor="azure-account">Storage Account Name *</Label>
                      <Input
                        id="azure-account"
                        placeholder="e.g., mystorageaccount"
                        value={azureAccountName}
                        onChange={(e) => setAzureAccountName(e.target.value)}
                        data-testid="input-azure-account"
                      />
                    </div>
                    {/* Auth mode toggle */}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAzureAuthType('account_key')}
                        className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${azureAuthType === 'account_key' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
                        data-testid="button-auth-account-key"
                      >
                        Account Key
                      </button>
                      <button
                        type="button"
                        onClick={() => setAzureAuthType('sas_token')}
                        className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${azureAuthType === 'sas_token' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
                        data-testid="button-auth-sas-token"
                      >
                        SAS Token
                      </button>
                      <button
                        type="button"
                        onClick={() => setAzureAuthType('azure_ad')}
                        className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${azureAuthType === 'azure_ad' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
                        data-testid="button-auth-azure-ad"
                      >
                        Azure AD
                      </button>
                    </div>
                    {azureAuthType === 'account_key' && (
                      <div>
                        <Label htmlFor="azure-key">Account Key *</Label>
                        <Input
                          id="azure-key"
                          type="password"
                          placeholder="Enter storage account key"
                          value={azureAccountKey}
                          onChange={(e) => setAzureAccountKey(e.target.value)}
                          data-testid="input-azure-key"
                        />
                      </div>
                    )}
                    {azureAuthType === 'sas_token' && (
                      <div>
                        <Label htmlFor="azure-sas">SAS Token *</Label>
                        <Input
                          id="azure-sas"
                          type="password"
                          placeholder="sv=2023-01-03&ss=b&srt=co&..."
                          value={azureSasToken}
                          onChange={(e) => setAzureSasToken(e.target.value)}
                          data-testid="input-azure-sas"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Account-SAS token. Note: also blocked when "Allow shared key access" is disabled on the account — use Azure AD in that case.</p>
                      </div>
                    )}
                    {azureAuthType === 'azure_ad' && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">Works even when Shared Key access is disabled. Register an app in Entra ID and assign it Storage Blob Data Reader on the container.</p>
                        <div>
                          <Label htmlFor="azure-tenant">Tenant ID *</Label>
                          <Input
                            id="azure-tenant"
                            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                            value={azureTenantId}
                            onChange={(e) => setAzureTenantId(e.target.value)}
                            data-testid="input-azure-tenant"
                          />
                        </div>
                        <div>
                          <Label htmlFor="azure-client-id">Application (Client) ID *</Label>
                          <Input
                            id="azure-client-id"
                            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                            value={azureClientId}
                            onChange={(e) => setAzureClientId(e.target.value)}
                            data-testid="input-azure-client-id"
                          />
                        </div>
                        <div>
                          <Label htmlFor="azure-client-secret">Client Secret *</Label>
                          <Input
                            id="azure-client-secret"
                            type="password"
                            placeholder="Enter client secret value"
                            value={azureClientSecret}
                            onChange={(e) => setAzureClientSecret(e.target.value)}
                            data-testid="input-azure-client-secret"
                          />
                        </div>
                      </div>
                    )}
                    <div>
                      <Label htmlFor="azure-container">Container Name *</Label>
                      <Input
                        id="azure-container"
                        placeholder="e.g., documents"
                        value={azureContainerName}
                        onChange={(e) => setAzureContainerName(e.target.value)}
                        data-testid="input-azure-container"
                      />
                    </div>
                    <div>
                      <Label htmlFor="azure-endpoint">Endpoint Suffix</Label>
                      <Input
                        id="azure-endpoint"
                        placeholder="core.windows.net"
                        value={azureEndpointSuffix}
                        onChange={(e) => setAzureEndpointSuffix(e.target.value)}
                        data-testid="input-azure-endpoint"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Leave as default unless using a private Azure endpoint</p>
                    </div>
                    <div>
                      <Label htmlFor="azure-prefix">Folder Prefix Filter</Label>
                      <Input
                        id="azure-prefix"
                        placeholder="e.g., 2025/ or bosch/pl-data/"
                        value={azureBlobPrefix}
                        onChange={(e) => setAzureBlobPrefix(e.target.value)}
                        data-testid="input-azure-prefix"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Only sync files inside this folder. Leave blank to sync everything in the container.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Schedule config - shown for Anaplan and Azure Blob */}
              {(newCubeSourceType === 'anaplan' || newCubeSourceType === 'azure_blob') && (
                <div className="space-y-3 pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="schedule-enabled" 
                      checked={newCubeScheduleEnabled}
                      onCheckedChange={(checked) => setNewCubeScheduleEnabled(checked === true)}
                      data-testid="checkbox-schedule-enabled"
                    />
                    <Label htmlFor="schedule-enabled" className="flex items-center gap-1 cursor-pointer">
                      <Clock className="h-4 w-4" />
                      Enable automatic sync schedule
                    </Label>
                  </div>
                  {newCubeScheduleEnabled && (
                    <div className="grid grid-cols-2 gap-3 pl-6">
                      <div>
                        <Label htmlFor="schedule-time">Sync Time</Label>
                        <Input
                          id="schedule-time"
                          type="time"
                          value={newCubeScheduleTime}
                          onChange={(e) => setNewCubeScheduleTime(e.target.value)}
                          data-testid="input-schedule-time"
                        />
                      </div>
                      <div>
                        <Label htmlFor="schedule-timezone">Timezone</Label>
                        <Select value={newCubeScheduleTimezone} onValueChange={setNewCubeScheduleTimezone}>
                          <SelectTrigger data-testid="select-schedule-timezone">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Asia/Kolkata">IST (India)</SelectItem>
                            <SelectItem value="UTC">UTC</SelectItem>
                            <SelectItem value="America/New_York">EST (US)</SelectItem>
                            <SelectItem value="America/Los_Angeles">PST (US)</SelectItem>
                            <SelectItem value="Europe/London">GMT (UK)</SelectItem>
                            <SelectItem value="Europe/Berlin">CET (Europe)</SelectItem>
                            <SelectItem value="Asia/Singapore">SGT (Singapore)</SelectItem>
                            <SelectItem value="Asia/Tokyo">JST (Japan)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground pl-6">
                    Configure when data syncs to this cube automatically
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: User Access */}
          {wizardStep === 'access' && (
            <div className="space-y-4">
              <div>
                <Label>Grant Access to Users</Label>
                <p className="text-xs text-muted-foreground mb-2">Select which domain users can access documents in this cube</p>
              </div>
              {usersLoading ? (
                <div className="text-muted-foreground text-sm">Loading users...</div>
              ) : domainUsers.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No users in this domain. You can add users later via User Management.
                </div>
              ) : (
                <>
                  <ScrollArea className="h-48 border rounded-md p-2">
                    <div className="space-y-1">
                      {domainUsers.map((user) => {
                        const isSelected = selectedUsersForCreate.has(user.email.toLowerCase());
                        return (
                          <div 
                            key={user.id} 
                            className="flex items-center gap-3 p-2 rounded hover-elevate cursor-pointer"
                            onClick={() => toggleUserSelection(user.email, true)}
                          >
                            <Checkbox 
                              checked={isSelected} 
                              onClick={(e) => e.stopPropagation()} 
                              onCheckedChange={() => toggleUserSelection(user.email, true)} 
                            />
                            <span className="text-sm flex-1">{user.email}</span>
                            {user.role === 'admin' && <Badge variant="outline" className="text-xs">Admin</Badge>}
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                  <p className="text-xs text-muted-foreground">
                    {selectedUsersForCreate.size} user{selectedUsersForCreate.size !== 1 ? 's' : ''} selected
                  </p>
                </>
              )}
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between gap-2 pt-2">
            <Button 
              variant="outline" 
              onClick={wizardStep === 'basics' ? () => setIsCreateDialogOpen(false) : handlePrevStep}
            >
              {wizardStep === 'basics' ? 'Cancel' : <><ChevronLeft className="h-4 w-4 mr-1" /> Back</>}
            </Button>
            {wizardStep === 'access' ? (
              <Button 
                onClick={() => createCubeMutation.mutate()}
                disabled={createCubeMutation.isPending}
                data-testid="button-confirm-create-cube"
              >
                {createCubeMutation.isPending ? 'Creating...' : 'Create Cube'}
              </Button>
            ) : (
              <Button 
                onClick={handleNextStep}
                disabled={!canProceedToNextStep()}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Cube Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Cube</DialogTitle>
            <DialogDescription>Update cube settings.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-cube-name">Cube Name</Label>
              <Input
                id="edit-cube-name"
                value={editCubeName}
                onChange={(e) => setEditCubeName(e.target.value)}
                data-testid="input-edit-cube-name"
              />
            </div>
            <div>
              <Label htmlFor="edit-cube-description">Description</Label>
              <Textarea
                id="edit-cube-description"
                value={editCubeDescription}
                onChange={(e) => setEditCubeDescription(e.target.value)}
                data-testid="input-edit-cube-description"
              />
            </div>
            <div>
              <Label>Data Source</Label>
              <Select value={editCubeSourceType} onValueChange={setEditCubeSourceType}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_TYPE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <opt.icon className="h-4 w-4" />
                        {opt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => updateCubeMutation.mutate()}
                disabled={!editCubeName.trim() || updateCubeMutation.isPending}
                data-testid="button-confirm-edit-cube"
              >
                {updateCubeMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Access Management Dialog */}
      <Dialog open={isAccessDialogOpen} onOpenChange={setIsAccessDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Access: {selectedCube?.name}</DialogTitle>
            <DialogDescription>Select which domain users can access documents in this cube.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {usersLoading || accessLoading ? (
              <div className="text-muted-foreground text-sm">Loading users...</div>
            ) : domainUsers.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                No users in this domain. Add users via User Management first.
              </div>
            ) : (
              <>
                <ScrollArea className="h-64 border rounded-md p-2">
                  <div className="space-y-1">
                    {domainUsers.map((user) => {
                      const isSelected = selectedUsers.has(user.email.toLowerCase());
                      return (
                        <div 
                          key={user.id} 
                          className="flex items-center gap-3 p-2 rounded hover-elevate cursor-pointer"
                          onClick={() => toggleUserSelection(user.email)}
                          data-testid={`row-user-${user.id}`}
                        >
                          <Checkbox 
                            checked={isSelected} 
                            onClick={(e) => e.stopPropagation()} 
                            onCheckedChange={() => toggleUserSelection(user.email)} 
                            data-testid={`checkbox-user-${user.id}`} 
                          />
                          <span className="text-sm flex-1">{user.email}</span>
                          {user.role === 'admin' && <Badge variant="outline" className="text-xs">Admin</Badge>}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
                <p className="text-xs text-muted-foreground">
                  {selectedUsers.size} user{selectedUsers.size !== 1 ? 's' : ''} selected
                </p>
              </>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAccessDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => updateAccessMutation.mutate(Array.from(selectedUsers))}
                disabled={updateAccessMutation.isPending}
                data-testid="button-save-access"
              >
                {updateAccessMutation.isPending ? 'Saving...' : 'Save Access'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Metadata Management Dialog */}
      <Dialog open={isMetadataDialogOpen} onOpenChange={setIsMetadataDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Cube Metadata: {selectedCube?.name}</DialogTitle>
            <DialogDescription>
              Define the entities, metrics, and periods in this cube to improve AI query accuracy.
              Enter one item per line.
            </DialogDescription>
          </DialogHeader>
          {metadataLoading ? (
            <div className="text-muted-foreground text-sm">Loading metadata...</div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="metadata-entities">Entities (e.g., Korea, Japan, Taiwan)</Label>
                <Textarea
                  id="metadata-entities"
                  placeholder="Korea&#10;Japan&#10;Taiwan&#10;India"
                  value={metadataEntities}
                  onChange={(e) => setMetadataEntities(e.target.value)}
                  className="min-h-[80px] font-mono text-sm"
                  data-testid="input-metadata-entities"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="metadata-metrics">Metrics (e.g., Revenue, Operating Cash Flow)</Label>
                <Textarea
                  id="metadata-metrics"
                  placeholder="Revenue&#10;Operating Cash Flow&#10;Net Income&#10;EBITDA"
                  value={metadataMetrics}
                  onChange={(e) => setMetadataMetrics(e.target.value)}
                  className="min-h-[80px] font-mono text-sm"
                  data-testid="input-metadata-metrics"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="metadata-periods">Periods (e.g., FY24, Q1, Jan 25)</Label>
                <Textarea
                  id="metadata-periods"
                  placeholder="FY24&#10;FY25&#10;Q1&#10;Q2&#10;Jan 25&#10;Feb 25"
                  value={metadataPeriods}
                  onChange={(e) => setMetadataPeriods(e.target.value)}
                  className="min-h-[80px] font-mono text-sm"
                  data-testid="input-metadata-periods"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsMetadataDialogOpen(false)}>Cancel</Button>
                <Button 
                  onClick={handleSaveMetadata}
                  disabled={saveMetadataMutation.isPending}
                  data-testid="button-save-metadata"
                >
                  {saveMetadataMutation.isPending ? 'Saving...' : 'Save Metadata'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Schema Configuration Dialog */}
      {selectedCube && (
        <ColumnConfigDialog
          open={isSchemaConfigDialogOpen}
          onOpenChange={setIsSchemaConfigDialogOpen}
          cubeId={selectedCube.id}
          cubeName={selectedCube.name}
        />
      )}

      {/* Schema Intelligence Studio */}
      {selectedCube && (
        <SchemaIntelligenceStudio
          open={isSchemaStudioOpen}
          onOpenChange={setIsSchemaStudioOpen}
          cubeId={selectedCube.id}
          cubeName={selectedCube.name}
        />
      )}

      {/* Hierarchy Configuration Dialog */}
      {domainId && (
        <HierarchyConfigDialog
          open={isHierarchyDialogOpen}
          onOpenChange={setIsHierarchyDialogOpen}
          domainId={domainId}
          domainName={domainName || 'Domain'}
        />
      )}

      {/* Edit Azure Blob Credentials Dialog */}
      <Dialog open={!!editCredConnector} onOpenChange={(open) => { if (!open) setEditCredConnector(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Azure Blob Credentials</DialogTitle>
            <DialogDescription>
              Update connection details. Credentials are encrypted before storage.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cred-account-name">Storage Account Name</Label>
              <Input
                id="cred-account-name"
                value={editCredAccountName}
                onChange={e => setEditCredAccountName(e.target.value)}
                placeholder="e.g. sargledgeraccount"
                data-testid="input-cred-account-name"
              />
            </div>
            {/* Auth mode toggle */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditCredAuthType('account_key')}
                className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${editCredAuthType === 'account_key' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
                data-testid="button-cred-auth-account-key"
              >
                Account Key
              </button>
              <button
                type="button"
                onClick={() => setEditCredAuthType('sas_token')}
                className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${editCredAuthType === 'sas_token' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
                data-testid="button-cred-auth-sas-token"
              >
                SAS Token
              </button>
              <button
                type="button"
                onClick={() => setEditCredAuthType('azure_ad')}
                className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${editCredAuthType === 'azure_ad' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
                data-testid="button-cred-auth-azure-ad"
              >
                Azure AD
              </button>
            </div>
            {editCredAuthType === 'account_key' && (
              <div className="space-y-1.5">
                <Label htmlFor="cred-account-key">Account Key</Label>
                <Input
                  id="cred-account-key"
                  value={editCredAccountKey}
                  onChange={e => setEditCredAccountKey(e.target.value)}
                  placeholder="Paste the full key from Azure Portal → Access keys"
                  type="password"
                  data-testid="input-cred-account-key"
                />
                <p className="text-xs text-muted-foreground">
                  Azure Portal → Storage Account → Security → Access keys → key1 → Show → copy the full key value
                </p>
              </div>
            )}
            {editCredAuthType === 'sas_token' && (
              <div className="space-y-1.5">
                <Label htmlFor="cred-sas-token">SAS Token</Label>
                <Input
                  id="cred-sas-token"
                  value={editCredSasToken}
                  onChange={e => setEditCredSasToken(e.target.value)}
                  placeholder="sv=2023-01-03&ss=b&srt=co&..."
                  type="password"
                  data-testid="input-cred-sas-token"
                />
                <p className="text-xs text-muted-foreground">
                  Account-SAS tokens are also blocked when "Allow shared key access" is disabled — use Azure AD in that case.
                </p>
              </div>
            )}
            {editCredAuthType === 'azure_ad' && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Works even when Shared Key access is disabled. Assign Storage Blob Data Reader to the app registration on the container.</p>
                <div className="space-y-1.5">
                  <Label htmlFor="cred-tenant-id">Tenant ID</Label>
                  <Input
                    id="cred-tenant-id"
                    value={editCredTenantId}
                    onChange={e => setEditCredTenantId(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    data-testid="input-cred-tenant-id"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cred-client-id">Application (Client) ID</Label>
                  <Input
                    id="cred-client-id"
                    value={editCredClientId}
                    onChange={e => setEditCredClientId(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    data-testid="input-cred-client-id"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cred-client-secret">Client Secret</Label>
                  <Input
                    id="cred-client-secret"
                    value={editCredClientSecret}
                    onChange={e => setEditCredClientSecret(e.target.value)}
                    placeholder="Enter client secret value"
                    type="password"
                    data-testid="input-cred-client-secret"
                  />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="cred-container">Container Name</Label>
              <Input
                id="cred-container"
                value={editCredContainer}
                onChange={e => setEditCredContainer(e.target.value)}
                placeholder="e.g. ledgecontainer"
                data-testid="input-cred-container"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cred-endpoint">Endpoint Suffix</Label>
                <Input
                  id="cred-endpoint"
                  value={editCredEndpoint}
                  onChange={e => setEditCredEndpoint(e.target.value)}
                  placeholder="core.windows.net"
                  data-testid="input-cred-endpoint"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cred-prefix">Folder Prefix</Label>
                <Input
                  id="cred-prefix"
                  value={editCredPrefix}
                  onChange={e => setEditCredPrefix(e.target.value)}
                  placeholder="e.g. LedgerLM/2025/"
                  data-testid="input-cred-prefix"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditCredConnector(null)}>Cancel</Button>
            <Button
              disabled={
                !editCredAccountName.trim() ||
                !editCredContainer.trim() ||
                (editCredAuthType === 'azure_ad'
                  ? (!editCredTenantId.trim() || !editCredClientId.trim() || !editCredClientSecret.trim())
                  : editCredAuthType === 'sas_token'
                    ? !editCredSasToken.trim()
                    : !editCredAccountKey.trim()) ||
                updateCredentialsMutation.isPending
              }
              onClick={() => {
                if (!editCredConnector) return;
                const authFields = editCredAuthType === 'azure_ad'
                  ? { tenant_id: editCredTenantId.trim(), client_id: editCredClientId.trim(), client_secret: editCredClientSecret.trim() }
                  : editCredAuthType === 'sas_token'
                    ? { sas_token: editCredSasToken.trim() }
                    : { account_key: editCredAccountKey.trim() };
                updateCredentialsMutation.mutate({
                  connectorId: editCredConnector.id,
                  body: {
                    config: {
                      account_name: editCredAccountName.trim(),
                      ...authFields,
                      container_name: editCredContainer.trim(),
                      endpoint_suffix: editCredEndpoint.trim() || 'core.windows.net',
                      blob_prefix: editCredPrefix.trim() || null,
                    },
                    ...(editCredPrefix.trim() ? { blobPrefix: editCredPrefix.trim() } : {}),
                  },
                });
              }}
              data-testid="button-save-credentials"
            >
              {updateCredentialsMutation.isPending ? 'Saving…' : 'Save & Close'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* SQL Query Console Dialog */}
      {queryCube && (
        <CubeSqlQueryDialog
          cube={queryCube}
          open={isQueryDialogOpen}
          onOpenChange={(open) => {
            setIsQueryDialogOpen(open);
            if (!open) setQueryCube(null);
          }}
        />
      )}

      {/* Scheduler Dialog */}
      {schedulerCube && (
        <CubeSchedulerDialog
          cube={schedulerCube}
          domainId={domainId}
          isSuperAdmin={isSuperAdmin}
          connectors={domainConnectors.filter(c => c.targetCubeId === schedulerCube.id)}
          open={isSchedulerDialogOpen}
          onOpenChange={(open) => {
            setIsSchedulerDialogOpen(open);
            if (!open) setSchedulerCube(null);
          }}
          onScheduleUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/domain-admin/connectors', domainId] });
          }}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CubeSqlQueryDialog — standalone SQL console for a single cube
// ─────────────────────────────────────────────────────────────────────────────

interface CubeSqlQueryDialogProps {
  cube: { id: string; name: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface QueryResult {
  columns: string[];
  rows: Record<string, any>[];
  rowCount: number;
  truncated: boolean;
}

interface ColumnDefs {
  dimensions: string[];
  metrics: string[];
  cubeId: string;
  cubeName: string;
}

function CubeSqlQueryDialog({ cube, open, onOpenChange }: CubeSqlQueryDialogProps) {
  const STARTER_QUERY = `SELECT cost_category, year, month, SUM(amount_usd) AS total_usd\nFROM cube_fact_data\nWHERE cube_id = '${cube.id}'\nGROUP BY cost_category, year, month\nORDER BY year, month\nLIMIT 100`;

  const [sqlText, setSqlText] = useState(STARTER_QUERY);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [showColumns, setShowColumns] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Fetch column definitions when dialog opens
  const { data: colDefs } = useQuery<ColumnDefs>({
    queryKey: ['/api/domain-admin/cubes', cube.id, 'fact-columns'],
    queryFn: async () => {
      const res = await fetch(`/api/domain-admin/cubes/${cube.id}/fact-columns`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load columns');
      return res.json();
    },
    enabled: open,
  });

  const allColumns = colDefs ? [...colDefs.dimensions, ...colDefs.metrics] : [];

  // Reset state when cube changes
  useEffect(() => {
    if (open) {
      setSqlText(`SELECT cost_category, year, month, SUM(amount_usd) AS total_usd\nFROM cube_fact_data\nWHERE cube_id = '${cube.id}'\nGROUP BY cost_category, year, month\nORDER BY year, month\nLIMIT 100`);
      setResult(null);
      setQueryError(null);
      setSuggestions([]);
    }
  }, [open, cube.id]);

  // ── Autocomplete logic ────────────────────────────────────────────────────

  const getCurrentWord = useCallback((ta: HTMLTextAreaElement) => {
    const pos = ta.selectionStart;
    const text = ta.value;
    let start = pos;
    while (start > 0 && /[\w_]/.test(text[start - 1])) start--;
    return { word: text.slice(start, pos), wordStart: start };
  }, []);

  const handleTextareaInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSqlText(e.target.value);
    setQueryError(null);
    if (allColumns.length === 0) return;
    const { word } = getCurrentWord(e.target);
    if (word.length >= 2) {
      const matches = allColumns.filter(c =>
        c.toLowerCase().startsWith(word.toLowerCase()) && c !== word,
      ).slice(0, 8);
      setSuggestions(matches);
      setActiveSuggestion(0);
    } else {
      setSuggestions([]);
    }
  }, [allColumns, getCurrentWord]);

  const insertSuggestion = useCallback((col: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { wordStart } = getCurrentWord(ta);
    const pos = ta.selectionStart;
    const newText = ta.value.slice(0, wordStart) + col + ta.value.slice(pos);
    setSqlText(newText);
    setSuggestions([]);
    setTimeout(() => {
      ta.selectionStart = ta.selectionEnd = wordStart + col.length;
      ta.focus();
    }, 0);
  }, [getCurrentWord]);

  const insertColumn = useCallback((col: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const newText = ta.value.slice(0, pos) + col + ta.value.slice(pos);
    setSqlText(newText);
    setTimeout(() => {
      ta.selectionStart = ta.selectionEnd = pos + col.length;
      ta.focus();
    }, 0);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestion(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestion(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertSuggestion(suggestions[activeSuggestion]);
    } else if (e.key === 'Escape') {
      setSuggestions([]);
    }
  }, [suggestions, activeSuggestion, insertSuggestion]);

  // ── Run query ─────────────────────────────────────────────────────────────

  const runQuery = async () => {
    if (!sqlText.trim()) return;
    setIsRunning(true);
    setResult(null);
    setQueryError(null);
    setSuggestions([]);
    try {
      const res = await fetch(`/api/domain-admin/cubes/${cube.id}/sql-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ query: sqlText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Query failed');
      setResult(data);
    } catch (err: any) {
      setQueryError(err.message);
    } finally {
      setIsRunning(false);
    }
  };

  // ── CSV export ────────────────────────────────────────────────────────────

  const exportCsv = () => {
    if (!result) return;
    const header = result.columns.join(',');
    const rows = result.rows.map(row =>
      result.columns.map(col => {
        const v = row[col];
        if (v === null || v === undefined) return '';
        const s = String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(','),
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cube.name}-query.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-full max-h-[92vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            SQL Query Console — {cube.name}
          </DialogTitle>
          <DialogDescription>
            SELECT-only queries against cube_fact_data. Results capped at 500 rows. cube_id filter required.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* ── Left: Editor + Results ─────────────────────────────────── */}
          <div className="flex flex-col flex-1 min-w-0">
            {/* SQL Editor */}
            <div className="relative p-4 border-b">
              <textarea
                ref={textareaRef}
                value={sqlText}
                onChange={handleTextareaInput}
                onKeyDown={handleKeyDown}
                onClick={() => setSuggestions([])}
                rows={8}
                spellCheck={false}
                className="w-full font-mono text-sm bg-muted/40 border rounded-md p-3 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="SELECT ..."
                data-testid="input-sql-query"
              />

              {/* Autocomplete dropdown */}
              {suggestions.length > 0 && (
                <div
                  ref={suggestionsRef}
                  className="absolute z-50 left-4 bg-popover border rounded-md shadow-md py-1 min-w-[180px]"
                  style={{ top: 'calc(100% - 16px)' }}
                >
                  {suggestions.map((s, i) => (
                    <button
                      key={s}
                      type="button"
                      className={`w-full text-left px-3 py-1.5 text-sm font-mono hover-elevate ${
                        i === activeSuggestion ? 'bg-accent text-accent-foreground' : ''
                      }`}
                      onMouseDown={(e) => { e.preventDefault(); insertSuggestion(s); }}
                      data-testid={`suggestion-${s}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted-foreground">
                  Tip: Start typing a column name for autocomplete (↑↓ to navigate, Enter/Tab to insert)
                </p>
                <Button
                  size="sm"
                  onClick={runQuery}
                  disabled={isRunning || !sqlText.trim()}
                  data-testid="button-run-query"
                >
                  {isRunning
                    ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Running…</>
                    : <><Play className="h-4 w-4 mr-1" />Run Query</>
                  }
                </Button>
              </div>
            </div>

            {/* Results area */}
            <div className="flex-1 overflow-auto p-4">
              {queryError && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive font-mono" data-testid="query-error">
                  <div className="font-semibold mb-1 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" /> Error
                  </div>
                  {queryError}
                </div>
              )}

              {result && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" data-testid="query-row-count">
                        {result.rowCount} row{result.rowCount !== 1 ? 's' : ''}
                      </Badge>
                      {result.truncated && (
                        <Badge variant="outline" className="text-muted-foreground text-xs">
                          Capped at 500 rows
                        </Badge>
                      )}
                    </div>
                    <Button size="sm" variant="outline" onClick={exportCsv} data-testid="button-export-csv">
                      <Download className="h-4 w-4 mr-1" />
                      Export CSV
                    </Button>
                  </div>

                  {result.rowCount === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Query returned no results.
                    </div>
                  ) : (
                    <div className="overflow-auto rounded-md border max-h-72">
                      <table className="w-full text-xs" data-testid="query-results-table">
                        <thead className="bg-muted/60 sticky top-0">
                          <tr>
                            {result.columns.map(col => (
                              <th key={col} className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {result.rows.map((row, i) => (
                            <tr key={i} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                              {result.columns.map(col => {
                                const v = row[col];
                                const display = v === null || v === undefined
                                  ? <span className="text-muted-foreground/50 italic">null</span>
                                  : typeof v === 'number'
                                    ? v.toLocaleString('en-US', { maximumFractionDigits: 4 })
                                    : String(v);
                                return (
                                  <td key={col} className="px-3 py-1.5 whitespace-nowrap border-b border-muted/40 max-w-[200px] truncate">
                                    {display}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {!result && !queryError && !isRunning && (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  Write a query above and click Run Query to see results.
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Column reference panel ──────────────────────────── */}
          <div className="w-60 shrink-0 border-l flex flex-col">
            <button
              type="button"
              className="flex items-center justify-between px-4 py-3 text-sm font-medium border-b hover-elevate w-full text-left"
              onClick={() => setShowColumns(v => !v)}
              data-testid="button-toggle-columns"
            >
              <span className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Columns
              </span>
              {showColumns ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showColumns && (
              <ScrollArea className="flex-1">
                <div className="p-3 space-y-3">
                  {colDefs ? (
                    <>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                          Dimensions
                        </p>
                        <div className="space-y-0.5">
                          {colDefs.dimensions.map(col => (
                            <button
                              key={col}
                              type="button"
                              title="Click to insert at cursor"
                              onClick={() => insertColumn(col)}
                              className="w-full text-left px-2 py-1 rounded text-xs font-mono hover-elevate truncate"
                              data-testid={`column-dim-${col}`}
                            >
                              {col}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                          Metrics
                        </p>
                        <div className="space-y-0.5">
                          {colDefs.metrics.map(col => (
                            <button
                              key={col}
                              type="button"
                              title="Click to insert at cursor"
                              onClick={() => insertColumn(col)}
                              className="w-full text-left px-2 py-1 rounded text-xs font-mono hover-elevate truncate"
                              data-testid={`column-metric-${col}`}
                            >
                              {col}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-muted-foreground">Loading columns…</div>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CubeSchedulerDialog — manage connector schedules for a single cube
// ─────────────────────────────────────────────────────────────────────────────

interface CubeSchedulerDialogProps {
  cube: { id: string; name: string };
  domainId: string;
  isSuperAdmin?: boolean;
  connectors: DomainConnector[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScheduleUpdated: () => void;
}

const VALID_TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'America/New_York (EST/EDT)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST/PDT)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT)' },
];

interface ConnectorScheduleState {
  enabled: boolean;
  hour: number;
  minute: number;
  timezone: string;
  saving: boolean;
  running: boolean;
}

function CubeSchedulerDialog({
  cube,
  domainId,
  isSuperAdmin,
  connectors,
  open,
  onOpenChange,
  onScheduleUpdated,
}: CubeSchedulerDialogProps) {
  const { toast } = useToast();
  const [schedules, setSchedules] = useState<Record<string, ConnectorScheduleState>>({});

  useEffect(() => {
    if (!open) return;
    const initial: Record<string, ConnectorScheduleState> = {};
    for (const c of connectors) {
      initial[c.id] = {
        enabled: (c.scheduleEnabled ?? 0) === 1,
        hour: c.scheduleHour ?? 6,
        minute: c.scheduleMinute ?? 0,
        timezone: c.scheduleTimezone ?? 'Asia/Kolkata',
        saving: false,
        running: false,
      };
    }
    setSchedules(initial);
  }, [open, connectors]);

  const updateField = (connectorId: string, field: keyof ConnectorScheduleState, value: any) => {
    setSchedules(prev => ({
      ...prev,
      [connectorId]: { ...prev[connectorId], [field]: value },
    }));
  };

  const saveSchedule = async (connectorId: string) => {
    updateField(connectorId, 'saving', true);
    try {
      const s = schedules[connectorId];
      await apiRequest('PATCH', `/api/domain-admin/connectors/${connectorId}/schedule`, {
        scheduleEnabled: s.enabled ? 1 : 0,
        scheduleHour: s.hour,
        scheduleMinute: s.minute,
        scheduleTimezone: s.timezone,
        ...(isSuperAdmin ? { domainId } : {}),
      });
      toast({ title: 'Schedule updated', description: 'Scheduler settings have been saved.' });
      onScheduleUpdated();
    } catch (err: any) {
      toast({ title: 'Failed to update schedule', description: err.message, variant: 'destructive' });
    } finally {
      updateField(connectorId, 'saving', false);
    }
  };

  const runNow = async (connectorId: string) => {
    updateField(connectorId, 'running', true);
    try {
      await apiRequest('POST', `/api/domain-admin/connectors/${connectorId}/sync`);
      toast({ title: 'Sync started', description: 'Manual sync has been triggered.' });
      onScheduleUpdated();
    } catch (err: any) {
      toast({ title: 'Sync failed', description: err.message, variant: 'destructive' });
    } finally {
      updateField(connectorId, 'running', false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Scheduler — {cube.name}
          </DialogTitle>
          <DialogDescription>
            Manage automated data sync schedules for this cube. Changes take effect immediately.
          </DialogDescription>
        </DialogHeader>

        {connectors.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground text-sm space-y-2">
            <Clock className="h-8 w-8 mx-auto opacity-30" />
            <p className="font-medium">No data source connected</p>
            <p className="text-xs">Link a data source connector when creating or editing this cube.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-1">
              {connectors.map(connector => {
                const s = schedules[connector.id];
                if (!s) return null;
                return (
                  <div key={connector.id} className="rounded-md border p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        {connector.connectorType === 'anaplan'
                          ? <Database className="h-4 w-4 text-muted-foreground" />
                          : <Cloud className="h-4 w-4 text-muted-foreground" />}
                        <span className="font-medium text-sm">
                          {connector.displayName || connector.connectorType}
                        </span>
                        <Badge variant="outline" className="text-xs capitalize">
                          {connector.connectorType}
                        </Badge>
                      </div>
                      <Badge
                        variant={s.enabled ? 'default' : 'secondary'}
                        data-testid={`badge-schedule-status-${connector.id}`}
                      >
                        {s.enabled ? 'Active' : 'Stopped'}
                      </Badge>
                    </div>

                    {/* Last sync */}
                    {connector.lastSyncAt && (
                      <p className="text-xs text-muted-foreground">
                        Last sync: {new Date(connector.lastSyncAt).toLocaleString()}
                        {connector.lastSyncResult && ` — ${connector.lastSyncResult}`}
                      </p>
                    )}

                    {/* Enable toggle */}
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`sched-enabled-${connector.id}`}
                        checked={s.enabled}
                        onCheckedChange={(v) => updateField(connector.id, 'enabled', !!v)}
                        data-testid={`checkbox-schedule-enabled-${connector.id}`}
                      />
                      <Label htmlFor={`sched-enabled-${connector.id}`} className="text-sm cursor-pointer">
                        Enable automated daily sync
                      </Label>
                    </div>

                    {/* Time pickers — only when enabled */}
                    {s.enabled && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Hour (0–23)</Label>
                          <Select
                            value={String(s.hour)}
                            onValueChange={(v) => updateField(connector.id, 'hour', Number(v))}
                          >
                            <SelectTrigger data-testid={`select-hour-${connector.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 24 }, (_, i) => (
                                <SelectItem key={i} value={String(i)}>
                                  {String(i).padStart(2, '0')}:00
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Minute</Label>
                          <Select
                            value={String(s.minute)}
                            onValueChange={(v) => updateField(connector.id, 'minute', Number(v))}
                          >
                            <SelectTrigger data-testid={`select-minute-${connector.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[0, 15, 30, 45].map(m => (
                                <SelectItem key={m} value={String(m)}>
                                  :{String(m).padStart(2, '0')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1 col-span-2">
                          <Label className="text-xs text-muted-foreground">Timezone</Label>
                          <Select
                            value={s.timezone}
                            onValueChange={(v) => updateField(connector.id, 'timezone', v)}
                          >
                            <SelectTrigger data-testid={`select-timezone-${connector.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {VALID_TIMEZONES.map(tz => (
                                <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={() => saveSchedule(connector.id)}
                        disabled={s.saving}
                        data-testid={`button-save-schedule-${connector.id}`}
                      >
                        {s.saving
                          ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Saving…</>
                          : 'Save Schedule'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => runNow(connector.id)}
                        disabled={s.running}
                        data-testid={`button-run-now-scheduler-${connector.id}`}
                      >
                        {s.running
                          ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Running…</>
                          : <><Play className="h-3 w-3 mr-1" />Run Now</>}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
