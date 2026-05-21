import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { getAuthUser } from '@/lib/auth';
import { Trash2, Plus, Users, Globe, Key, Edit, Shield, Lock, Cpu } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useLocation } from 'wouter';

interface Domain {
  id: string;
  name: string;
  adminEmail: string;
  defaultOtp: string | null;
  authMethod: string;
  ssoTenantId: string | null;
  ssoClientId: string | null;
  ssoClientSecret: string | null;
  ssoGroupId: string | null;
  ssoDefaultRole: string;
  emailProvider: string | null;
  emailSmtpUser: string | null;
  emailSmtpPass: string | null;
  emailFromAddress: string | null;
  emailFromName: string | null;
  aiProvider: string | null;
  aiEndpoint: string | null;
  aiApiKey: string | null;
  aiChatModel: string | null;
  aiChatApiVersion: string | null;
  aiEmbeddingModel: string | null;
  aiEmbeddingApiVersion: string | null;
  aiSystemPrompt: string | null;
  userCount: number;
  createdAt: string;
}

interface DomainUser {
  id: string;
  domainId: string;
  email: string;
  role: string;
  hardcodedOtp: string | null;
  createdAt: string;
}

const defaultSsoFields = { ssoTenantId: '', ssoClientId: '', ssoClientSecret: '', ssoGroupId: '', ssoDefaultRole: 'standard' };
const defaultEmailFields = { emailProvider: 'default', emailSmtpUser: '', emailSmtpPass: '', emailFromAddress: '', emailFromName: '' };
const defaultAiFields = {
  aiProvider: 'ollama',
  aiEndpoint: '',
  aiApiKey: '',
  aiChatModel: '',
  aiChatApiVersion: '2024-12-01-preview',
  aiEmbeddingModel: '',
  aiEmbeddingApiVersion: '2024-02-01',
  aiSystemPrompt: '',
};

export default function SuperAdmin() {
  const [, setLocation] = useLocation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isUsersDialogOpen, setIsUsersDialogOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [newDomain, setNewDomain] = useState({
    name: '', adminEmail: '', defaultOtp: '', authMethod: 'otp', ...defaultSsoFields, ...defaultEmailFields, ...defaultAiFields,
  });
  const [editDomain, setEditDomain] = useState({
    adminEmail: '', defaultOtp: '', authMethod: 'otp', ...defaultSsoFields, ...defaultEmailFields, ...defaultAiFields,
  });
  const { toast } = useToast();

  const user = getAuthUser();
  const isSuperAdmin = user?.username?.toLowerCase() === 'customer@ledgerlm.ai';

  if (!isSuperAdmin) {
    return (
      <div className="h-full flex items-center justify-center bg-primary/10">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-destructive" />
              Access Denied
            </CardTitle>
            <CardDescription>
              This page is only accessible by the Super Admin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation('/dashboard')} className="w-full">
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: domains = [], isLoading } = useQuery<Domain[]>({
    queryKey: ['/api/super-admin/domains'],
  });

  const { data: domainUsers = [], isLoading: usersLoading } = useQuery<DomainUser[]>({
    queryKey: ['/api/super-admin/domains', selectedDomain?.id, 'users'],
    enabled: !!selectedDomain,
  });

  const createDomainMutation = useMutation({
    mutationFn: async (data: typeof newDomain) => {
      return apiRequest('POST', '/api/super-admin/domains', {
        name: data.name,
        adminEmail: data.adminEmail,
        defaultOtp: data.defaultOtp || null,
        authMethod: data.authMethod,
        ...(data.authMethod === 'microsoft_sso' ? {
          ssoTenantId: data.ssoTenantId || null,
          ssoClientId: data.ssoClientId || null,
          ssoClientSecret: data.ssoClientSecret || null,
          ssoGroupId: data.ssoGroupId || null,
          ssoDefaultRole: data.ssoDefaultRole || 'standard',
        } : {}),
        emailProvider: data.emailProvider || 'default',
        ...(data.emailProvider !== 'default' ? {
          emailSmtpUser: data.emailSmtpUser || null,
          emailSmtpPass: data.emailSmtpPass || null,
          emailFromAddress: data.emailFromAddress || null,
          emailFromName: data.emailFromName || null,
        } : {}),
        aiProvider: data.aiProvider || 'ollama',
        ...(data.aiProvider === 'azure_openai' ? {
          aiEndpoint: data.aiEndpoint || null,
          aiApiKey: data.aiApiKey || null,
          aiChatModel: data.aiChatModel || null,
          aiChatApiVersion: data.aiChatApiVersion || null,
          aiEmbeddingModel: data.aiEmbeddingModel || null,
          aiEmbeddingApiVersion: data.aiEmbeddingApiVersion || null,
          aiSystemPrompt: data.aiSystemPrompt || null,
        } : {}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/domains'] });
      setIsCreateDialogOpen(false);
      setNewDomain({ name: '', adminEmail: '', defaultOtp: '', authMethod: 'otp', ...defaultSsoFields, ...defaultEmailFields, ...defaultAiFields });
      toast({ title: 'Domain created successfully' });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to create domain',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    },
  });

  const updateDomainMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof editDomain }) => {
      return apiRequest('PUT', `/api/super-admin/domains/${id}`, {
        adminEmail: data.adminEmail,
        defaultOtp: data.defaultOtp || null,
        authMethod: data.authMethod,
        ...(data.authMethod === 'microsoft_sso' ? {
          ssoTenantId: data.ssoTenantId || null,
          ssoClientId: data.ssoClientId || null,
          ssoClientSecret: data.ssoClientSecret || null,
          ssoGroupId: data.ssoGroupId || null,
          ssoDefaultRole: data.ssoDefaultRole || 'standard',
        } : {}),
        emailProvider: data.emailProvider || 'default',
        ...(data.emailProvider !== 'default' ? {
          emailSmtpUser: data.emailSmtpUser || null,
          emailSmtpPass: data.emailSmtpPass || null,
          emailFromAddress: data.emailFromAddress || null,
          emailFromName: data.emailFromName || null,
        } : {}),
        aiProvider: data.aiProvider || 'ollama',
        ...(data.aiProvider === 'azure_openai' ? {
          aiEndpoint: data.aiEndpoint || null,
          aiApiKey: data.aiApiKey || null,
          aiChatModel: data.aiChatModel || null,
          aiChatApiVersion: data.aiChatApiVersion || null,
          aiEmbeddingModel: data.aiEmbeddingModel || null,
          aiEmbeddingApiVersion: data.aiEmbeddingApiVersion || null,
          aiSystemPrompt: data.aiSystemPrompt || null,
        } : { aiProvider: 'ollama' }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/domains'] });
      setIsEditDialogOpen(false);
      setSelectedDomain(null);
      toast({ title: 'Domain updated successfully' });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update domain',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    },
  });

  const deleteDomainMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/super-admin/domains/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/domains'] });
      toast({ title: 'Domain deleted successfully' });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to delete domain',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    },
  });

  const handleCreateDomain = (e: React.FormEvent) => {
    e.preventDefault();
    if (newDomain.name && newDomain.adminEmail) {
      createDomainMutation.mutate(newDomain);
    }
  };

  const handleUpdateDomain = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedDomain && editDomain.adminEmail) {
      updateDomainMutation.mutate({ id: selectedDomain.id, data: editDomain });
    }
  };

  const openEditDialog = (domain: Domain) => {
    setSelectedDomain(domain);
    setEditDomain({
      adminEmail: domain.adminEmail,
      defaultOtp: domain.defaultOtp || '',
      authMethod: domain.authMethod || 'otp',
      ssoTenantId: domain.ssoTenantId || '',
      ssoClientId: domain.ssoClientId || '',
      ssoClientSecret: domain.ssoClientSecret === '********' ? '********' : '',
      ssoGroupId: domain.ssoGroupId || '',
      ssoDefaultRole: domain.ssoDefaultRole || 'standard',
      emailProvider: domain.emailProvider || 'default',
      emailSmtpUser: domain.emailSmtpUser || '',
      emailSmtpPass: domain.emailSmtpPass === '********' ? '********' : '',
      emailFromAddress: domain.emailFromAddress || '',
      emailFromName: domain.emailFromName || '',
      aiProvider: domain.aiProvider || 'ollama',
      aiEndpoint: domain.aiEndpoint || '',
      aiApiKey: domain.aiApiKey === '********' ? '********' : '',
      aiChatModel: domain.aiChatModel || '',
      aiChatApiVersion: domain.aiChatApiVersion || '2024-12-01-preview',
      aiEmbeddingModel: domain.aiEmbeddingModel || '',
      aiEmbeddingApiVersion: domain.aiEmbeddingApiVersion || '2024-02-01',
      aiSystemPrompt: domain.aiSystemPrompt || '',
    });
    setIsEditDialogOpen(true);
  };

  const openUsersDialog = (domain: Domain) => {
    setSelectedDomain(domain);
    setIsUsersDialogOpen(true);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-primary/10">
      <div className="flex-1 overflow-auto p-6">
        <div className="h-full bg-white rounded-2xl overflow-auto flex flex-col">
          <div className="px-6 lg:px-8 py-3.5 flex items-center justify-between gap-3 bg-primary/40 flex-shrink-0">
            <div>
              <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Super Admin - Domain Management
              </h1>
              <p className="text-sm text-muted-foreground">Manage domains and assign domain administrators</p>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-domain">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Domain
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
                <DialogHeader className="flex-shrink-0">
                  <DialogTitle>Create New Domain</DialogTitle>
                  <DialogDescription>
                    Add a new domain and assign a domain administrator
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateDomain} className="space-y-4 overflow-y-auto flex-1 pr-1">
                  <div className="space-y-2">
                    <Label htmlFor="domain-name">Domain Name</Label>
                    <Input
                      id="domain-name"
                      placeholder="e.g., in.bosch.com"
                      value={newDomain.name}
                      onChange={(e) => setNewDomain({ ...newDomain, name: e.target.value })}
                      required
                      data-testid="input-domain-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-email">Domain Admin Email</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      placeholder="admin@in.bosch.com"
                      value={newDomain.adminEmail}
                      onChange={(e) => setNewDomain({ ...newDomain, adminEmail: e.target.value })}
                      required
                      data-testid="input-admin-email"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="auth-method">Authentication Method</Label>
                    <Select
                      value={newDomain.authMethod}
                      onValueChange={(val) => setNewDomain({ ...newDomain, authMethod: val })}
                    >
                      <SelectTrigger id="auth-method" data-testid="select-auth-method">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="otp">Email OTP</SelectItem>
                        <SelectItem value="microsoft_sso">Microsoft SSO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {newDomain.authMethod === 'otp' && (
                    <div className="space-y-2">
                      <Label htmlFor="default-otp">Default OTP (optional)</Label>
                      <Input
                        id="default-otp"
                        placeholder="6-digit code (e.g., 123456)"
                        value={newDomain.defaultOtp}
                        onChange={(e) => setNewDomain({ ...newDomain, defaultOtp: e.target.value })}
                        maxLength={10}
                        data-testid="input-default-otp"
                      />
                      <p className="text-xs text-muted-foreground">
                        If set, all users in this domain will use this OTP code
                      </p>
                    </div>
                  )}

                  {newDomain.authMethod === 'microsoft_sso' && (
                    <div className="space-y-3 rounded-md border p-3">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        Azure App Registration
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor="sso-tenant-id">Tenant ID</Label>
                        <Input
                          id="sso-tenant-id"
                          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          value={newDomain.ssoTenantId}
                          onChange={(e) => setNewDomain({ ...newDomain, ssoTenantId: e.target.value })}
                          data-testid="input-sso-tenant-id"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sso-client-id">Client ID</Label>
                        <Input
                          id="sso-client-id"
                          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          value={newDomain.ssoClientId}
                          onChange={(e) => setNewDomain({ ...newDomain, ssoClientId: e.target.value })}
                          data-testid="input-sso-client-id"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sso-client-secret">Client Secret</Label>
                        <Input
                          id="sso-client-secret"
                          type="password"
                          placeholder="Azure client secret value"
                          value={newDomain.ssoClientSecret}
                          onChange={(e) => setNewDomain({ ...newDomain, ssoClientSecret: e.target.value })}
                          data-testid="input-sso-client-secret"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Redirect URI to register in Azure: <code className="font-mono text-xs bg-muted px-1 rounded">{window.location.origin}/api/auth/sso/microsoft/callback</code>
                      </p>
                    </div>
                  )}

                  {newDomain.authMethod === 'microsoft_sso' && (
                    <div className="space-y-3 rounded-md border p-3">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        User Access Control
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor="sso-group-id">Azure AD Group ID</Label>
                        <Input
                          id="sso-group-id"
                          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          value={newDomain.ssoGroupId}
                          onChange={(e) => setNewDomain({ ...newDomain, ssoGroupId: e.target.value })}
                          data-testid="input-sso-group-id"
                        />
                        <p className="text-xs text-muted-foreground">
                          Only members of this Azure AD group can access the platform. Leave blank to use invite-only access.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sso-default-role">Default Role for New Users</Label>
                        <Select
                          value={newDomain.ssoDefaultRole}
                          onValueChange={(val) => setNewDomain({ ...newDomain, ssoDefaultRole: val })}
                        >
                          <SelectTrigger id="sso-default-role" data-testid="select-sso-default-role">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="standard">Standard (Viewer)</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Role assigned automatically when a group member logs in for the first time.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="email-provider">Email Provider</Label>
                    <Select
                      value={newDomain.emailProvider}
                      onValueChange={(val) => setNewDomain({ ...newDomain, emailProvider: val })}
                    >
                      <SelectTrigger id="email-provider" data-testid="select-email-provider">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default (Global GoDaddy)</SelectItem>
                        <SelectItem value="microsoft">Microsoft SMTP (Office 365)</SelectItem>
                        <SelectItem value="godaddy">GoDaddy SMTP (Per-Domain)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {newDomain.emailProvider !== 'default' && (
                    <div className="space-y-3 rounded-md border p-3">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Key className="h-4 w-4" />
                        {newDomain.emailProvider === 'microsoft' ? 'Microsoft Office 365 SMTP' : 'GoDaddy SMTP'}
                      </p>
                      {newDomain.emailProvider === 'microsoft' && (
                        <p className="text-xs text-muted-foreground">
                          Auto-configured: smtp.office365.com · Port 587 · STARTTLS
                        </p>
                      )}
                      {newDomain.emailProvider === 'godaddy' && (
                        <p className="text-xs text-muted-foreground">
                          Auto-configured: smtpout.secureserver.net · Port 465 · SSL
                        </p>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="email-smtp-user">
                          {newDomain.emailProvider === 'microsoft' ? 'Mailbox Email' : 'SMTP Email / Username'}
                        </Label>
                        <Input
                          id="email-smtp-user"
                          type="email"
                          placeholder={newDomain.emailProvider === 'microsoft' ? 'noreply@in.bosch.com' : 'noreply@yourdomain.com'}
                          value={newDomain.emailSmtpUser}
                          onChange={(e) => setNewDomain({ ...newDomain, emailSmtpUser: e.target.value })}
                          data-testid="input-email-smtp-user"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email-smtp-pass">
                          {newDomain.emailProvider === 'microsoft' ? 'App Password' : 'SMTP Password'}
                        </Label>
                        <Input
                          id="email-smtp-pass"
                          type="password"
                          placeholder={newDomain.emailProvider === 'microsoft' ? 'Microsoft app password' : 'SMTP password'}
                          value={newDomain.emailSmtpPass}
                          onChange={(e) => setNewDomain({ ...newDomain, emailSmtpPass: e.target.value })}
                          data-testid="input-email-smtp-pass"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email-from-name">From Name</Label>
                        <Input
                          id="email-from-name"
                          placeholder="Bosch LedgerLM"
                          value={newDomain.emailFromName}
                          onChange={(e) => setNewDomain({ ...newDomain, emailFromName: e.target.value })}
                          data-testid="input-email-from-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email-from-address">From Address</Label>
                        <Input
                          id="email-from-address"
                          type="email"
                          placeholder="noreply@in.bosch.com"
                          value={newDomain.emailFromAddress}
                          onChange={(e) => setNewDomain({ ...newDomain, emailFromAddress: e.target.value })}
                          data-testid="input-email-from-address"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="ai-provider">AI Provider</Label>
                    <Select
                      value={newDomain.aiProvider}
                      onValueChange={(val) => setNewDomain({ ...newDomain, aiProvider: val })}
                    >
                      <SelectTrigger id="ai-provider" data-testid="select-ai-provider">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ollama">Ollama / Qwen (Default)</SelectItem>
                        <SelectItem value="azure_openai">Azure OpenAI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {newDomain.aiProvider === 'azure_openai' && (
                    <div className="space-y-3 rounded-md border p-3">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Cpu className="h-4 w-4" />
                        Azure OpenAI Configuration
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor="ai-endpoint">Azure Endpoint</Label>
                        <Input
                          id="ai-endpoint"
                          placeholder="https://xxx.cognitiveservices.azure.com"
                          value={newDomain.aiEndpoint}
                          onChange={(e) => setNewDomain({ ...newDomain, aiEndpoint: e.target.value })}
                          data-testid="input-ai-endpoint"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ai-api-key">API Key</Label>
                        <Input
                          id="ai-api-key"
                          type="password"
                          placeholder="Azure OpenAI API key"
                          value={newDomain.aiApiKey}
                          onChange={(e) => setNewDomain({ ...newDomain, aiApiKey: e.target.value })}
                          data-testid="input-ai-api-key"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <Label htmlFor="ai-chat-model">Chat Deployment</Label>
                          <Input
                            id="ai-chat-model"
                            placeholder="gpt-5.2-chat"
                            value={newDomain.aiChatModel}
                            onChange={(e) => setNewDomain({ ...newDomain, aiChatModel: e.target.value })}
                            data-testid="input-ai-chat-model"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ai-chat-api-version">Chat API Version</Label>
                          <Input
                            id="ai-chat-api-version"
                            placeholder="2024-12-01-preview"
                            value={newDomain.aiChatApiVersion}
                            onChange={(e) => setNewDomain({ ...newDomain, aiChatApiVersion: e.target.value })}
                            data-testid="input-ai-chat-api-version"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <Label htmlFor="ai-embedding-model">Embedding Deployment</Label>
                          <Input
                            id="ai-embedding-model"
                            placeholder="text-embedding-3-large"
                            value={newDomain.aiEmbeddingModel}
                            onChange={(e) => setNewDomain({ ...newDomain, aiEmbeddingModel: e.target.value })}
                            data-testid="input-ai-embedding-model"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ai-embedding-api-version">Embedding API Version</Label>
                          <Input
                            id="ai-embedding-api-version"
                            placeholder="2024-02-01"
                            value={newDomain.aiEmbeddingApiVersion}
                            onChange={(e) => setNewDomain({ ...newDomain, aiEmbeddingApiVersion: e.target.value })}
                            data-testid="input-ai-embedding-api-version"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ai-system-prompt">System Prompt Override (optional)</Label>
                        <Textarea
                          id="ai-system-prompt"
                          placeholder="Leave blank to use the default LedgerLM financial analyst prompt"
                          value={newDomain.aiSystemPrompt}
                          onChange={(e) => setNewDomain({ ...newDomain, aiSystemPrompt: e.target.value })}
                          className="min-h-[80px] text-sm"
                          data-testid="input-ai-system-prompt"
                        />
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={createDomainMutation.isPending}
                    data-testid="button-submit-create-domain"
                  >
                    {createDomainMutation.isPending ? 'Creating...' : 'Create Domain'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Managed Domains
                </CardTitle>
                <CardDescription>All domains registered in the system</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">Loading domains...</div>
                ) : domains.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No domains created yet. Click "Create Domain" to add one.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Domain</TableHead>
                        <TableHead>Admin Email</TableHead>
                        <TableHead>Auth Method</TableHead>
                        <TableHead>Users</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {domains.map((domain) => (
                        <TableRow key={domain.id} data-testid={`row-domain-${domain.id}`}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Globe className="h-4 w-4 text-muted-foreground" />
                              {domain.name}
                            </div>
                          </TableCell>
                          <TableCell>{domain.adminEmail}</TableCell>
                          <TableCell>
                            {domain.authMethod === 'microsoft_sso' ? (
                              <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                                <Lock className="h-3 w-3" />
                                Microsoft SSO
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground">
                                <Key className="h-3 w-3" />
                                {domain.defaultOtp ? `OTP: ${domain.defaultOtp}` : 'Email OTP'}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openUsersDialog(domain)}
                              className="gap-1"
                              data-testid={`button-view-users-${domain.id}`}
                            >
                              <Users className="h-3 w-3" />
                              {domain.userCount}
                            </Button>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(domain.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEditDialog(domain)}
                                data-testid={`button-edit-domain-${domain.id}`}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  if (confirm(`Delete domain "${domain.name}"? This will also delete all users in this domain.`)) {
                                    deleteDomainMutation.mutate(domain.id);
                                  }
                                }}
                                disabled={deleteDomainMutation.isPending}
                                data-testid={`button-delete-domain-${domain.id}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Edit Domain Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Edit Domain: {selectedDomain?.name}</DialogTitle>
            <DialogDescription>Update domain settings</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateDomain} className="space-y-4 overflow-y-auto flex-1 pr-1">
            <div className="space-y-2">
              <Label htmlFor="edit-admin-email">Domain Admin Email</Label>
              <Input
                id="edit-admin-email"
                type="email"
                value={editDomain.adminEmail}
                onChange={(e) => setEditDomain({ ...editDomain, adminEmail: e.target.value })}
                required
                data-testid="input-edit-admin-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-auth-method">Authentication Method</Label>
              <Select
                value={editDomain.authMethod}
                onValueChange={(val) => setEditDomain({ ...editDomain, authMethod: val })}
              >
                <SelectTrigger id="edit-auth-method" data-testid="select-edit-auth-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="otp">Email OTP</SelectItem>
                  <SelectItem value="microsoft_sso">Microsoft SSO</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editDomain.authMethod === 'otp' && (
              <div className="space-y-2">
                <Label htmlFor="edit-default-otp">Default OTP (optional)</Label>
                <Input
                  id="edit-default-otp"
                  placeholder="6-digit code"
                  value={editDomain.defaultOtp}
                  onChange={(e) => setEditDomain({ ...editDomain, defaultOtp: e.target.value })}
                  maxLength={10}
                  data-testid="input-edit-default-otp"
                />
              </div>
            )}

            {editDomain.authMethod === 'microsoft_sso' && (
              <div className="space-y-3 rounded-md border p-3">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Azure App Registration
                </p>
                <div className="space-y-2">
                  <Label htmlFor="edit-sso-tenant-id">Tenant ID</Label>
                  <Input
                    id="edit-sso-tenant-id"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={editDomain.ssoTenantId}
                    onChange={(e) => setEditDomain({ ...editDomain, ssoTenantId: e.target.value })}
                    data-testid="input-edit-sso-tenant-id"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-sso-client-id">Client ID</Label>
                  <Input
                    id="edit-sso-client-id"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={editDomain.ssoClientId}
                    onChange={(e) => setEditDomain({ ...editDomain, ssoClientId: e.target.value })}
                    data-testid="input-edit-sso-client-id"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-sso-client-secret">Client Secret</Label>
                  <Input
                    id="edit-sso-client-secret"
                    type="password"
                    placeholder={editDomain.ssoClientSecret === '********' ? 'Leave unchanged or enter new secret' : 'Azure client secret value'}
                    value={editDomain.ssoClientSecret}
                    onChange={(e) => setEditDomain({ ...editDomain, ssoClientSecret: e.target.value })}
                    data-testid="input-edit-sso-client-secret"
                  />
                  {editDomain.ssoClientSecret === '********' && (
                    <p className="text-xs text-muted-foreground">
                      A secret is already saved. Clear the field and type a new value to replace it.
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Redirect URI: <code className="font-mono text-xs bg-muted px-1 rounded">{window.location.origin}/api/auth/sso/microsoft/callback</code>
                </p>
              </div>
            )}

            {editDomain.authMethod === 'microsoft_sso' && (
              <div className="space-y-3 rounded-md border p-3">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  User Access Control
                </p>
                <div className="space-y-2">
                  <Label htmlFor="edit-sso-group-id">Azure AD Group ID</Label>
                  <Input
                    id="edit-sso-group-id"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={editDomain.ssoGroupId}
                    onChange={(e) => setEditDomain({ ...editDomain, ssoGroupId: e.target.value })}
                    data-testid="input-edit-sso-group-id"
                  />
                  <p className="text-xs text-muted-foreground">
                    Only members of this Azure AD group can access the platform. Leave blank to use invite-only access.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-sso-default-role">Default Role for New Users</Label>
                  <Select
                    value={editDomain.ssoDefaultRole}
                    onValueChange={(val) => setEditDomain({ ...editDomain, ssoDefaultRole: val })}
                  >
                    <SelectTrigger id="edit-sso-default-role" data-testid="select-edit-sso-default-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard (Viewer)</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Role assigned automatically when a group member logs in for the first time.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-email-provider">Email Provider</Label>
              <Select
                value={editDomain.emailProvider}
                onValueChange={(val) => setEditDomain({ ...editDomain, emailProvider: val })}
              >
                <SelectTrigger id="edit-email-provider" data-testid="select-edit-email-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default (Global GoDaddy)</SelectItem>
                  <SelectItem value="microsoft">Microsoft SMTP (Office 365)</SelectItem>
                  <SelectItem value="godaddy">GoDaddy SMTP (Per-Domain)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editDomain.emailProvider !== 'default' && (
              <div className="space-y-3 rounded-md border p-3">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  {editDomain.emailProvider === 'microsoft' ? 'Microsoft Office 365 SMTP' : 'GoDaddy SMTP'}
                </p>
                {editDomain.emailProvider === 'microsoft' && (
                  <p className="text-xs text-muted-foreground">
                    Auto-configured: smtp.office365.com · Port 587 · STARTTLS
                  </p>
                )}
                {editDomain.emailProvider === 'godaddy' && (
                  <p className="text-xs text-muted-foreground">
                    Auto-configured: smtpout.secureserver.net · Port 465 · SSL
                  </p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="edit-email-smtp-user">
                    {editDomain.emailProvider === 'microsoft' ? 'Mailbox Email' : 'SMTP Email / Username'}
                  </Label>
                  <Input
                    id="edit-email-smtp-user"
                    type="email"
                    placeholder={editDomain.emailProvider === 'microsoft' ? 'noreply@in.bosch.com' : 'noreply@yourdomain.com'}
                    value={editDomain.emailSmtpUser}
                    onChange={(e) => setEditDomain({ ...editDomain, emailSmtpUser: e.target.value })}
                    data-testid="input-edit-email-smtp-user"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email-smtp-pass">
                    {editDomain.emailProvider === 'microsoft' ? 'App Password' : 'SMTP Password'}
                  </Label>
                  <Input
                    id="edit-email-smtp-pass"
                    type="password"
                    placeholder={editDomain.emailSmtpPass === '********' ? 'Leave unchanged or enter new password' : (editDomain.emailProvider === 'microsoft' ? 'Microsoft app password' : 'SMTP password')}
                    value={editDomain.emailSmtpPass}
                    onChange={(e) => setEditDomain({ ...editDomain, emailSmtpPass: e.target.value })}
                    data-testid="input-edit-email-smtp-pass"
                  />
                  {editDomain.emailSmtpPass === '********' && (
                    <p className="text-xs text-muted-foreground">
                      A password is already saved. Clear the field and type a new value to replace it.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email-from-name">From Name</Label>
                  <Input
                    id="edit-email-from-name"
                    placeholder="Bosch LedgerLM"
                    value={editDomain.emailFromName}
                    onChange={(e) => setEditDomain({ ...editDomain, emailFromName: e.target.value })}
                    data-testid="input-edit-email-from-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email-from-address">From Address</Label>
                  <Input
                    id="edit-email-from-address"
                    type="email"
                    placeholder="noreply@in.bosch.com"
                    value={editDomain.emailFromAddress}
                    onChange={(e) => setEditDomain({ ...editDomain, emailFromAddress: e.target.value })}
                    data-testid="input-edit-email-from-address"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-ai-provider">AI Provider</Label>
              <Select
                value={editDomain.aiProvider}
                onValueChange={(val) => setEditDomain({ ...editDomain, aiProvider: val })}
              >
                <SelectTrigger id="edit-ai-provider" data-testid="select-edit-ai-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ollama">Ollama / Qwen (Default)</SelectItem>
                  <SelectItem value="azure_openai">Azure OpenAI</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editDomain.aiProvider === 'azure_openai' && (
              <div className="space-y-3 rounded-md border p-3">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  Azure OpenAI Configuration
                </p>
                <div className="space-y-2">
                  <Label htmlFor="edit-ai-endpoint">Azure Endpoint</Label>
                  <Input
                    id="edit-ai-endpoint"
                    placeholder="https://xxx.cognitiveservices.azure.com"
                    value={editDomain.aiEndpoint}
                    onChange={(e) => setEditDomain({ ...editDomain, aiEndpoint: e.target.value })}
                    data-testid="input-edit-ai-endpoint"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-ai-api-key">API Key</Label>
                  <Input
                    id="edit-ai-api-key"
                    type="password"
                    placeholder={editDomain.aiApiKey === '********' ? 'Leave unchanged or enter new key' : 'Azure OpenAI API key'}
                    value={editDomain.aiApiKey}
                    onChange={(e) => setEditDomain({ ...editDomain, aiApiKey: e.target.value })}
                    data-testid="input-edit-ai-api-key"
                  />
                  {editDomain.aiApiKey === '********' && (
                    <p className="text-xs text-muted-foreground">
                      A key is already saved. Clear the field and type a new value to replace it.
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-ai-chat-model">Chat Deployment</Label>
                    <Input
                      id="edit-ai-chat-model"
                      placeholder="gpt-5.2-chat"
                      value={editDomain.aiChatModel}
                      onChange={(e) => setEditDomain({ ...editDomain, aiChatModel: e.target.value })}
                      data-testid="input-edit-ai-chat-model"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-ai-chat-api-version">Chat API Version</Label>
                    <Input
                      id="edit-ai-chat-api-version"
                      placeholder="2024-12-01-preview"
                      value={editDomain.aiChatApiVersion}
                      onChange={(e) => setEditDomain({ ...editDomain, aiChatApiVersion: e.target.value })}
                      data-testid="input-edit-ai-chat-api-version"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-ai-embedding-model">Embedding Deployment</Label>
                    <Input
                      id="edit-ai-embedding-model"
                      placeholder="text-embedding-3-large"
                      value={editDomain.aiEmbeddingModel}
                      onChange={(e) => setEditDomain({ ...editDomain, aiEmbeddingModel: e.target.value })}
                      data-testid="input-edit-ai-embedding-model"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-ai-embedding-api-version">Embedding API Version</Label>
                    <Input
                      id="edit-ai-embedding-api-version"
                      placeholder="2024-02-01"
                      value={editDomain.aiEmbeddingApiVersion}
                      onChange={(e) => setEditDomain({ ...editDomain, aiEmbeddingApiVersion: e.target.value })}
                      data-testid="input-edit-ai-embedding-api-version"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-ai-system-prompt">System Prompt Override (optional)</Label>
                  <Textarea
                    id="edit-ai-system-prompt"
                    placeholder="Leave blank to use the default LedgerLM financial analyst prompt"
                    value={editDomain.aiSystemPrompt}
                    onChange={(e) => setEditDomain({ ...editDomain, aiSystemPrompt: e.target.value })}
                    className="min-h-[80px] text-sm"
                    data-testid="input-edit-ai-system-prompt"
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateDomainMutation.isPending} data-testid="button-submit-edit-domain">
                {updateDomainMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Users Dialog */}
      <Dialog open={isUsersDialogOpen} onOpenChange={setIsUsersDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Users in {selectedDomain?.name}</DialogTitle>
            <DialogDescription>View all users registered in this domain</DialogDescription>
          </DialogHeader>
          {usersLoading ? (
            <div className="py-8 text-center">Loading users...</div>
          ) : domainUsers.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No users in this domain yet</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Hardcoded OTP</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {domainUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <span className={user.role === 'admin' ? 'text-primary font-medium' : 'text-muted-foreground'}>
                        {user.role === 'admin' ? 'Admin' : 'Standard'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {user.hardcodedOtp ? (
                        <span className="font-mono text-sm">{user.hardcodedOtp}</span>
                      ) : (
                        <span className="text-muted-foreground">Email OTP</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
