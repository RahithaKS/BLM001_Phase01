import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  X, 
  Plus, 
  RefreshCw, 
  Trash2, 
  BarChart3, 
  Cloud, 
  Users, 
  PieChart, 
  LineChart,
  Plug,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Download,
  Clock,
  CheckCircle,
  FileDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ConnectorType {
  type: string;
  name: string;
  description: string;
  icon: string;
  sensitiveFields: string[];
  available: boolean;
}

interface DomainConnector {
  id: string;
  domainId: string;
  connectorType: string;
  name: string;
  enabled: number;
  tags: string[];
  status: string;
  targetCubeId: string | null;
  lastSyncAt: string | null;
  lastSyncResult: string | null;
  documentCount: number;
  scheduleEnabled: number;
  scheduleHour: number;
  scheduleMinute: number;
  scheduleTimezone: string;
}

interface AdminConnectorsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  domainId: string;
  domainName?: string;
  isSuperAdmin?: boolean;
}

const anaplanFormSchema = z.object({
  name: z.string().min(1, "Display name is required").max(100),
  workspace_id: z.string().min(1, "Workspace ID is required"),
  model_id: z.string().min(1, "Model ID is required"),
  process_id: z.string().min(1, "Process ID is required"),
  username: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
  tags: z.string().optional(),
});

const azureBlobFormSchema = z.object({
  name: z.string().min(1, "Display name is required").max(100),
  account_name: z.string().min(1, "Account name is required"),
  account_key: z.string().min(1, "Account key is required"),
  container_name: z.string().min(1, "Container name is required"),
  endpoint_suffix: z.string().optional().default("core.windows.net"),
  blob_prefix: z.string().optional(),
  tags: z.string().optional(),
});

type AnaplanFormData = z.infer<typeof anaplanFormSchema>;
type AzureBlobFormData = z.infer<typeof azureBlobFormSchema>;

export function AdminConnectorsDialog({
  isOpen,
  onClose,
  domainId,
  domainName,
  isSuperAdmin,
}: AdminConnectorsDialogProps) {
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedConnectorType, setSelectedConnectorType] = useState<string>("");
  const [testingConnector, setTestingConnector] = useState<string | null>(null);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<DomainConnector | null>(null);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleHour, setScheduleHour] = useState(6);
  const [scheduleMinute, setScheduleMinute] = useState(0);
  const [scheduleTimezone, setScheduleTimezone] = useState("Asia/Kolkata");

  const anaplanForm = useForm<AnaplanFormData>({
    resolver: zodResolver(anaplanFormSchema),
    defaultValues: {
      name: "Anaplan - Financial Data",
      workspace_id: "",
      model_id: "",
      process_id: "",
      username: "",
      password: "",
      tags: "",
    },
  });

  const azureBlobForm = useForm<AzureBlobFormData>({
    resolver: zodResolver(azureBlobFormSchema),
    defaultValues: {
      name: "Azure Blob - Documents",
      account_name: "",
      account_key: "",
      container_name: "",
      endpoint_suffix: "core.windows.net",
      blob_prefix: "",
      tags: "",
    },
  });

  const { data: connectorTypes } = useQuery<{ available: ConnectorType[]; all: ConnectorType[] }>({
    queryKey: ["/api/domain-admin/connector-types"],
    enabled: isOpen,
  });

  const queryUrl = isSuperAdmin 
    ? `/api/domain-admin/connectors?domainId=${domainId}` 
    : `/api/domain-admin/connectors`;
    
  const { data: connectors = [], isLoading: isLoadingConnectors } = useQuery<DomainConnector[]>({
    queryKey: ["/api/domain-admin/connectors", domainId],
    queryFn: async () => {
      const res = await fetch(queryUrl, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch connectors');
      return res.json();
    },
    enabled: isOpen && !!domainId,
  });

  const toggleConnectorMutation = useMutation({
    mutationFn: async (connectorId: string) => {
      return await apiRequest("PATCH", `/api/domain-admin/connectors/${connectorId}/toggle`, {
        domainId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/domain-admin/connectors", domainId] });
      toast({ title: "Connector updated", description: "Data source status changed" });
    },
    onError: () => {
      toast({ title: "Update failed", description: "Could not update connector status", variant: "destructive" });
    },
  });

  const createConnectorMutation = useMutation({
    mutationFn: async (data: { connectorType: string; name: string; config: Record<string, string>; tags: string[] }) => {
      return await apiRequest("POST", "/api/domain-admin/connectors", {
        domainId,
        connectorType: data.connectorType,
        name: data.name,
        config: data.config,
        tags: data.tags,
        enabled: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/domain-admin/connectors", domainId] });
      toast({ title: "Connector added", description: "New data source configured successfully" });
      resetForms();
    },
    onError: (error: any) => {
      toast({ title: "Failed to add connector", description: error.message || "Could not add data source", variant: "destructive" });
    },
  });

  const deleteConnectorMutation = useMutation({
    mutationFn: async (connectorId: string) => {
      return await apiRequest("DELETE", `/api/domain-admin/connectors/${connectorId}`, { domainId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/domain-admin/connectors", domainId] });
      toast({ title: "Connector removed", description: "Data source disconnected" });
    },
    onError: () => {
      toast({ title: "Delete failed", description: "Could not remove connector", variant: "destructive" });
    },
  });

  const testConnectorMutation = useMutation({
    mutationFn: async (connectorId: string) => {
      setTestingConnector(connectorId);
      return await apiRequest("POST", `/api/domain-admin/connectors/${connectorId}/test`, { domainId });
    },
    onSuccess: (data: any) => {
      setTestingConnector(null);
      queryClient.invalidateQueries({ queryKey: ["/api/domain-admin/connectors", domainId] });
      toast({
        title: data.success ? "Connection successful" : "Connection failed",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      setTestingConnector(null);
      toast({ title: "Test failed", description: error.message || "Connection test failed", variant: "destructive" });
    },
  });

  const [syncingConnector, setSyncingConnector] = useState<string | null>(null);

  const syncConnectorMutation = useMutation({
    mutationFn: async (connectorId: string) => {
      setSyncingConnector(connectorId);
      return await apiRequest("POST", `/api/domain-admin/connectors/${connectorId}/sync`, { domainId });
    },
    onSuccess: (data: any) => {
      setSyncingConnector(null);
      queryClient.invalidateQueries({ queryKey: ["/api/domain-admin/connectors", domainId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/enterprise-documents"] });
      toast({
        title: data.success ? "Sync completed" : "Sync had issues",
        description: `Processed: ${data.filesProcessed || 0} files${data.filesFailed > 0 ? `, Failed: ${data.filesFailed}` : ''}`,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      setSyncingConnector(null);
      toast({ title: "Sync failed", description: error.message || "Could not sync data source", variant: "destructive" });
    },
  });

  const updateScheduleMutation = useMutation({
    mutationFn: async (data: { connectorId: string; scheduleEnabled: boolean; scheduleHour: number; scheduleMinute: number; scheduleTimezone: string }) => {
      return await apiRequest("PATCH", `/api/domain-admin/connectors/${data.connectorId}/schedule`, {
        domainId,
        scheduleEnabled: data.scheduleEnabled ? 1 : 0,
        scheduleHour: data.scheduleHour,
        scheduleMinute: data.scheduleMinute,
        scheduleTimezone: data.scheduleTimezone,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/domain-admin/connectors", domainId] });
      toast({ title: "Schedule updated", description: "Connector sync schedule has been updated" });
      setShowScheduleDialog(false);
      setEditingSchedule(null);
    },
    onError: (error: any) => {
      toast({ title: "Update failed", description: error.message || "Could not update schedule", variant: "destructive" });
    },
  });

  const openScheduleDialog = (connector: DomainConnector) => {
    setEditingSchedule(connector);
    setScheduleEnabled(connector.scheduleEnabled === 1);
    setScheduleHour(connector.scheduleHour ?? 6);
    setScheduleMinute(connector.scheduleMinute ?? 0);
    setScheduleTimezone(connector.scheduleTimezone ?? "Asia/Kolkata");
    setShowScheduleDialog(true);
  };

  const handleScheduleSave = () => {
    if (!editingSchedule) return;
    updateScheduleMutation.mutate({
      connectorId: editingSchedule.id,
      scheduleEnabled,
      scheduleHour,
      scheduleMinute,
      scheduleTimezone,
    });
  };

  const resetForms = () => {
    setShowAddForm(false);
    setSelectedConnectorType("");
    anaplanForm.reset();
    azureBlobForm.reset();
  };

  const getConnectorIcon = (type: string) => {
    switch (type) {
      case "anaplan": return <BarChart3 className="w-5 h-5" />;
      case "azure_blob": return <Cloud className="w-5 h-5" />;
      case "salesforce": return <Users className="w-5 h-5" />;
      case "power_bi": return <LineChart className="w-5 h-5" />;
      case "tableau": return <PieChart className="w-5 h-5" />;
      default: return <Plug className="w-5 h-5" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected": return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "error": return <XCircle className="w-4 h-4 text-red-500" />;
      case "syncing": return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      default: return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const parseTags = (tagString: string | undefined): string[] => {
    if (!tagString) return [];
    return tagString.split(",").map(t => t.trim()).filter(t => t.length > 0).map(t => t.startsWith("#") ? t : `#${t}`);
  };

  const handleAnaplanSubmit = (data: AnaplanFormData) => {
    const { name, tags, ...config } = data;
    createConnectorMutation.mutate({
      connectorType: "anaplan",
      name,
      config,
      tags: parseTags(tags),
    });
  };

  const handleAzureBlobSubmit = (data: AzureBlobFormData) => {
    const { name, tags, blob_prefix, ...config } = data;
    createConnectorMutation.mutate({
      connectorType: "azure_blob",
      name,
      config,
      blobPrefix: blob_prefix || null,
      tags: parseTags(tags),
    });
  };

  const availableToAdd = connectorTypes?.available || [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle data-testid="text-admin-connectors-title">
            Configure Data Sources {domainName && `- ${domainName}`}
          </DialogTitle>
          <DialogDescription>
            Add and configure API connectors for your domain. Users will see these as data sources they can toggle ON/OFF.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {showAddForm ? (
            <div className="space-y-4 p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Add Data Source Connector</h3>
                <Button variant="ghost" size="icon" onClick={resetForms} data-testid="button-cancel-add">
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {!selectedConnectorType ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Select a connector type:</p>
                  <div className="grid grid-cols-2 gap-3">
                    {availableToAdd.map((type) => (
                      <Button
                        key={type.type}
                        variant="outline"
                        className="h-auto py-4 flex flex-col items-center gap-2"
                        onClick={() => setSelectedConnectorType(type.type)}
                        data-testid={`button-select-${type.type}`}
                      >
                        {getConnectorIcon(type.type)}
                        <span className="font-medium">{type.name}</span>
                        <span className="text-xs text-muted-foreground text-center">{type.description}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              ) : selectedConnectorType === "anaplan" ? (
                <Form {...anaplanForm}>
                  <form onSubmit={anaplanForm.handleSubmit(handleAnaplanSubmit)} className="space-y-4">
                    <FormField
                      control={anaplanForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Display Name (shown to users)</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Anaplan - Actual but Forecast" {...field} data-testid="input-display-name" />
                          </FormControl>
                          <FormDescription>This is what users will see in their Data Sources panel</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={anaplanForm.control} name="workspace_id" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Workspace ID</FormLabel>
                          <FormControl><Input placeholder="8a868cdc7e5feca9..." {...field} data-testid="input-workspace-id" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={anaplanForm.control} name="model_id" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Model ID</FormLabel>
                          <FormControl><Input placeholder="BE462879B504..." {...field} data-testid="input-model-id" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={anaplanForm.control} name="process_id" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Process ID</FormLabel>
                        <FormControl><Input placeholder="118000000093" {...field} data-testid="input-process-id" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={anaplanForm.control} name="username" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username (Email)</FormLabel>
                          <FormControl><Input type="email" placeholder="user@example.com" {...field} data-testid="input-username" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={anaplanForm.control} name="password" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl><Input type="password" placeholder="Enter password" {...field} data-testid="input-password" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={anaplanForm.control} name="tags" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tags (comma-separated)</FormLabel>
                        <FormControl><Input placeholder="#Planning, #Finance" {...field} data-testid="input-tags" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <Button type="submit" disabled={createConnectorMutation.isPending} className="w-full" data-testid="button-save-connector">
                      {createConnectorMutation.isPending ? "Adding..." : "Add Anaplan Connection"}
                    </Button>
                  </form>
                </Form>
              ) : selectedConnectorType === "azure_blob" ? (
                <Form {...azureBlobForm}>
                  <form onSubmit={azureBlobForm.handleSubmit(handleAzureBlobSubmit)} className="space-y-4">
                    <FormField
                      control={azureBlobForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Display Name (shown to users)</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Blob - Bosch Metadata" {...field} data-testid="input-display-name" />
                          </FormControl>
                          <FormDescription>This is what users will see in their Data Sources panel</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={azureBlobForm.control} name="account_name" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Storage Account Name</FormLabel>
                          <FormControl><Input placeholder="mystorageaccount" {...field} data-testid="input-account-name" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={azureBlobForm.control} name="container_name" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Container Name</FormLabel>
                          <FormControl><Input placeholder="my-container" {...field} data-testid="input-container-name" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={azureBlobForm.control} name="account_key" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Key</FormLabel>
                        <FormControl><Input type="password" placeholder="Enter account key" {...field} data-testid="input-account-key" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={azureBlobForm.control} name="endpoint_suffix" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Endpoint Suffix</FormLabel>
                        <FormControl><Input placeholder="core.windows.net" {...field} data-testid="input-endpoint-suffix" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={azureBlobForm.control} name="blob_prefix" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Folder Prefix Filter (optional)</FormLabel>
                        <FormControl><Input placeholder="e.g. LedgerLM/2025/" {...field} data-testid="input-blob-prefix" /></FormControl>
                        <FormDescription>Only sync files under this folder path in the container. Leave blank to sync everything.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={azureBlobForm.control} name="tags" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tags (comma-separated)</FormLabel>
                        <FormControl><Input placeholder="#Storage, #Documents" {...field} data-testid="input-tags" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <Button type="submit" disabled={createConnectorMutation.isPending} className="w-full" data-testid="button-save-connector">
                      {createConnectorMutation.isPending ? "Adding..." : "Add Azure Blob Connection"}
                    </Button>
                  </form>
                </Form>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              {isLoadingConnectors ? (
                <div className="py-8 text-center text-muted-foreground">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Loading connectors...
                </div>
              ) : connectors.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Plug className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-1">No data sources configured</p>
                  <p className="text-sm">Click "Add Connector" to set up integrations.</p>
                </div>
              ) : (
                connectors.map((connector) => (
                  <div
                    key={connector.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                    data-testid={`connector-row-${connector.id}`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="text-muted-foreground">{getConnectorIcon(connector.connectorType)}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{connector.name}</span>
                          {getStatusIcon(connector.status)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {connector.documentCount} docs &middot; {connector.connectorType.replace("_", " ").toUpperCase()}
                          {connector.targetCubeId && <span className="ml-1 text-primary/70"> &middot; cube: {connector.targetCubeId}</span>}
                        </p>

                        {syncingConnector === connector.id ? (
                          <p className="text-xs text-blue-500 flex items-center gap-1 mt-0.5">
                            <FileDown className="w-3 h-3 animate-bounce" />
                            Downloading files from source…
                          </p>
                        ) : connector.lastSyncAt ? (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <CheckCircle className="w-3 h-3 text-green-500" />
                            Last synced {(() => {
                              const diff = Date.now() - new Date(connector.lastSyncAt).getTime();
                              const mins = Math.floor(diff / 60000);
                              if (mins < 1) return 'just now';
                              if (mins < 60) return `${mins}m ago`;
                              const hrs = Math.floor(mins / 60);
                              if (hrs < 24) return `${hrs}h ago`;
                              return `${Math.floor(hrs / 24)}d ago`;
                            })()}
                            {connector.lastSyncResult && (
                              <span className="ml-1 text-muted-foreground/70">&middot; {connector.lastSyncResult}</span>
                            )}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground/60 mt-0.5">Never synced</p>
                        )}

                        {connector.tags && connector.tags.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {connector.tags.slice(0, 3).map(tag => (
                              <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{connector.enabled ? "Active" : "Inactive"}</span>
                        <Switch
                          checked={connector.enabled === 1}
                          onCheckedChange={() => toggleConnectorMutation.mutate(connector.id)}
                          disabled={toggleConnectorMutation.isPending}
                          data-testid={`switch-connector-${connector.id}`}
                        />
                      </div>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => testConnectorMutation.mutate(connector.id)}
                            disabled={testingConnector === connector.id}
                            data-testid={`button-test-${connector.id}`}
                          >
                            <RefreshCw className={`w-4 h-4 ${testingConnector === connector.id ? "animate-spin" : ""}`} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Test Connection</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => syncConnectorMutation.mutate(connector.id)}
                            disabled={syncConnectorMutation.isPending || syncingConnector !== null || connector.enabled !== 1}
                            data-testid={`button-sync-${connector.id}`}
                          >
                            <Download className={`w-4 h-4 ${syncingConnector === connector.id ? "animate-pulse" : ""}`} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Sync Now</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openScheduleDialog(connector)}
                            data-testid={`button-schedule-${connector.id}`}
                            className={connector.scheduleEnabled === 1 ? "text-primary" : ""}
                          >
                            <Clock className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {connector.scheduleEnabled === 1 
                            ? `Scheduled: ${String(connector.scheduleHour).padStart(2, "0")}:${String(connector.scheduleMinute).padStart(2, "0")} ${connector.scheduleTimezone}`
                            : "Configure Schedule"
                          }
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => deleteConnectorMutation.mutate(connector.id)}
                            disabled={deleteConnectorMutation.isPending}
                            data-testid={`button-delete-${connector.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Remove</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => setShowAddForm(true)}
            disabled={showAddForm}
            data-testid="button-add-connector"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Connector
          </Button>

          <Button onClick={onClose} data-testid="button-done">
            Done
          </Button>
        </div>
      </DialogContent>

      {/* Schedule Configuration Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={(open) => !open && setShowScheduleDialog(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle data-testid="text-schedule-dialog-title">
              Configure Sync Schedule
            </DialogTitle>
            <DialogDescription>
              {editingSchedule?.name} - Set up automatic sync for this connector
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="schedule-enabled">Enable Scheduled Sync</Label>
                <p className="text-sm text-muted-foreground">Automatically sync data daily</p>
              </div>
              <Switch
                id="schedule-enabled"
                checked={scheduleEnabled}
                onCheckedChange={setScheduleEnabled}
                data-testid="switch-schedule-enabled"
              />
            </div>

            {scheduleEnabled && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="schedule-hour">Hour (0-23)</Label>
                    <Select
                      value={String(scheduleHour)}
                      onValueChange={(v) => setScheduleHour(parseInt(v))}
                    >
                      <SelectTrigger id="schedule-hour" data-testid="select-schedule-hour">
                        <SelectValue placeholder="Hour" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {String(i).padStart(2, "0")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="schedule-minute">Minute</Label>
                    <Select
                      value={String(scheduleMinute)}
                      onValueChange={(v) => setScheduleMinute(parseInt(v))}
                    >
                      <SelectTrigger id="schedule-minute" data-testid="select-schedule-minute">
                        <SelectValue placeholder="Minute" />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 15, 30, 45].map((min) => (
                          <SelectItem key={min} value={String(min)}>
                            {String(min).padStart(2, "0")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="schedule-timezone">Timezone</Label>
                  <Select
                    value={scheduleTimezone}
                    onValueChange={setScheduleTimezone}
                  >
                    <SelectTrigger id="schedule-timezone" data-testid="select-schedule-timezone">
                      <SelectValue placeholder="Timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                      <SelectItem value="America/Los_Angeles">America/Los_Angeles (PST)</SelectItem>
                      <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                      <SelectItem value="Europe/Paris">Europe/Paris (CET)</SelectItem>
                      <SelectItem value="Asia/Tokyo">Asia/Tokyo (JST)</SelectItem>
                      <SelectItem value="Asia/Singapore">Asia/Singapore (SGT)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                  Sync will run daily at{" "}
                  <span className="font-medium">
                    {String(scheduleHour).padStart(2, "0")}:{String(scheduleMinute).padStart(2, "0")}
                  </span>{" "}
                  {scheduleTimezone}
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowScheduleDialog(false)} data-testid="button-cancel-schedule">
              Cancel
            </Button>
            <Button 
              onClick={handleScheduleSave} 
              disabled={updateScheduleMutation.isPending}
              data-testid="button-save-schedule"
            >
              {updateScheduleMutation.isPending ? "Saving..." : "Save Schedule"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
