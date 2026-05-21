import { useState, useEffect, useCallback, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  X,
  Database,
  FileText,
  Globe,
  ChevronRight,
  Lock,
  BarChart3,
  Cloud,
  Plug,
  Box,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ManageVaultDialog } from "./ManageVaultDialog";

interface DataSource {
  id: string;
  name: string;
  description: string;
  icon: ReactNode;
  enabled: boolean;
  status?: string;
  locked?: boolean;
  isConnector?: boolean;
  connectorType?: string;
  tags?: string[];
}

interface ConnectorSource {
  id: string;
  connectorType: string;
  name: string;
  tags: string[];
  status: string;
  documentCount: number;
}

interface UserDataSourcesResponse {
  sources: ConnectorSource[];
  userSourcePrefs: Record<string, boolean>;
}

interface AccessibleCube {
  id: string;
  name: string;
  description: string | null;
  documentCount?: number;
}

interface AccessibleCubesResponse {
  cubes: AccessibleCube[];
  cubePreferences: Record<string, boolean>;
}

interface DataSourcesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: string;
}

export function DataSourcesPanel({
  isOpen,
  onClose,
  chatId,
}: DataSourcesPanelProps) {
  const { toast } = useToast();
  const [isVaultDialogOpen, setIsVaultDialogOpen] = useState(false);
  const [isEnterpriseConnectorsOpen, setIsEnterpriseConnectorsOpen] = useState(false);
  const [enabledConnectors, setEnabledConnectors] = useState<Record<string, boolean>>({});
  
  const [coreDataSources, setCoreDataSources] = useState<DataSource[]>([
    {
      id: "enterprise",
      name: "ENTERPRISE DATA",
      description: "Company-wide financial documents",
      icon: <Database className="w-4 h-4" />,
      enabled: false,
    },
    {
      id: "vault",
      name: "VAULT ANALYSIS",
      description: "Search uploaded documents",
      icon: <FileText className="w-4 h-4" />,
      enabled: false,
      locked: false,
    },
    {
      id: "web",
      name: "WEB APIs",
      description: "Web search for current information",
      icon: <Globe className="w-4 h-4" />,
      enabled: false,
    },
  ]);

  const { data: userSettings } = useQuery<{ enterpriseEnabled: number }>({
    queryKey: ["/api/user/settings"],
    enabled: isOpen,
  });

  const { data: userDataSources } = useQuery<UserDataSourcesResponse>({
    queryKey: ["/api/user/data-sources"],
    enabled: isOpen,
  });

  const { data: accessibleCubesData } = useQuery<AccessibleCubesResponse>({
    queryKey: ["/api/user/accessible-cubes"],
    enabled: isOpen,
  });

  const accessibleCubes = accessibleCubesData?.cubes || [];
  const [enabledCubes, setEnabledCubes] = useState<Record<string, boolean>>({});
  const [cubesInitialized, setCubesInitialized] = useState(false);

  const updateCubePrefsMutation = useMutation({
    mutationFn: async (prefs: Record<string, boolean>) => {
      return await apiRequest("PATCH", "/api/user/cube-preferences", {
        cubePreferences: prefs,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/accessible-cubes"] });
    },
    onError: () => {
      toast({
        title: "Failed to save preference",
        description: "Could not save cube preference",
        variant: "destructive",
      });
    },
  });

  const updateConnectorPrefsMutation = useMutation({
    mutationFn: async (prefs: Record<string, boolean>) => {
      return await apiRequest("PATCH", "/api/user/data-sources/preferences", {
        connectorPreferences: prefs,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/data-sources"] });
    },
    onError: () => {
      toast({
        title: "Failed to save preference",
        description: "Could not save data source preference",
        variant: "destructive",
      });
    },
  });

  const { data: chatStatus } = useQuery<{
    hasMessages: boolean;
    messageCount: number;
  }>({
    queryKey: ["/api/chats", chatId, "has-messages"],
    enabled: isOpen && !!chatId,
  });

  const { data: chatDocuments = [] } = useQuery<any[]>({
    queryKey: ["/api/chats", chatId, "documents"],
    enabled: isOpen && !!chatId,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (enterpriseEnabled: number) => {
      return await apiRequest("PATCH", "/api/user/settings", {
        enterpriseEnabled,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/settings"] });
      toast({
        title: "Settings updated",
        description: "Enterprise data source settings saved",
      });
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Could not update settings",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (userSettings) {
      setCoreDataSources((sources) =>
        sources.map((source) =>
          source.id === "enterprise"
            ? { ...source, enabled: userSettings.enterpriseEnabled === 1 }
            : source,
        ),
      );
    }
  }, [userSettings]);

  useEffect(() => {
    if (chatStatus && chatDocuments !== undefined) {
      const hasDocuments = chatDocuments.length > 0;
      const hasMessages = chatStatus.hasMessages;

      setCoreDataSources((sources) =>
        sources.map((source) =>
          source.id === "vault"
            ? {
                ...source,
                enabled: hasDocuments,
                locked: hasMessages,
                status: hasDocuments
                  ? `${chatDocuments.length} document(s)`
                  : undefined,
              }
            : source,
        ),
      );
    }
  }, [chatStatus, chatDocuments]);

  useEffect(() => {
    if (userDataSources?.userSourcePrefs) {
      setEnabledConnectors(userDataSources.userSourcePrefs);
    }
  }, [userDataSources?.userSourcePrefs]);

  useEffect(() => {
    if (accessibleCubesData && !cubesInitialized) {
      const savedPrefs = accessibleCubesData.cubePreferences || {};
      const initialCubePrefs: Record<string, boolean> = {};
      accessibleCubes.forEach(cube => {
        // Use saved preference if exists, otherwise default to true (enabled)
        initialCubePrefs[cube.id] = savedPrefs[cube.id] !== undefined ? savedPrefs[cube.id] : true;
      });
      setEnabledCubes(initialCubePrefs);
      setCubesInitialized(true);
    }
  }, [accessibleCubesData, accessibleCubes, cubesInitialized]);

  // Reset initialization state when panel closes
  useEffect(() => {
    if (!isOpen) {
      setCubesInitialized(false);
    }
  }, [isOpen]);

  const toggleCube = (cubeId: string) => {
    const newValue = !enabledCubes[cubeId];
    const newPrefs = { ...enabledCubes, [cubeId]: newValue };
    setEnabledCubes(newPrefs);
    updateCubePrefsMutation.mutate(newPrefs);
  };

  const getConnectorIcon = (type: string) => {
    switch (type) {
      case "anaplan": return <BarChart3 className="w-4 h-4" />;
      case "azure_blob": return <Cloud className="w-4 h-4" />;
      default: return <Plug className="w-4 h-4" />;
    }
  };

  const connectorDataSources: DataSource[] = (userDataSources?.sources || []).map(source => ({
    id: source.id,
    name: source.name.toUpperCase(),
    description: `${source.documentCount} documents synced`,
    icon: getConnectorIcon(source.connectorType),
    enabled: enabledConnectors[source.id] ?? false,
    isConnector: true,
    connectorType: source.connectorType,
    tags: source.tags,
  }));

  const allDataSources = [...coreDataSources, ...connectorDataSources];

  const toggleDataSource = (id: string, isConnector?: boolean) => {
    if (isConnector) {
      const newValue = !enabledConnectors[id];
      const newPrefs = { ...enabledConnectors, [id]: newValue };
      setEnabledConnectors(newPrefs);
      updateConnectorPrefsMutation.mutate(newPrefs);
      return;
    }

    if (id === "enterprise") {
      const currentSource = coreDataSources.find((s) => s.id === "enterprise");
      if (!currentSource) return;

      const newEnabled = currentSource.enabled ? 0 : 1;
      updateSettingsMutation.mutate(newEnabled);
    } else if (id === "vault") {
      const vaultSource = coreDataSources.find((s) => s.id === "vault");
      if (vaultSource?.locked) {
        toast({
          title: "Cannot modify vault",
          description:
            "Vault documents cannot be changed after chat has started",
          variant: "destructive",
        });
        return;
      }
      return;
    } else {
      setCoreDataSources((sources) =>
        sources.map((source) =>
          source.id === id ? { ...source, enabled: !source.enabled } : source,
        ),
      );
    }
  };

  const handleManageClick = (sourceId: string) => {
    if (sourceId === "vault") {
      setIsVaultDialogOpen(true);
    } else if (sourceId === "enterprise") {
      setIsEnterpriseConnectorsOpen(true);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="w-80 border-l bg-accent flex flex-col h-full">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-semibold" data-testid="text-data-sources-title">
          Data Sources
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          data-testid="button-close-data-sources"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <p className="text-xs text-muted-foreground mb-4">
          Toggle data sources ON/OFF to control which sources the AI uses for analysis.
        </p>

        <div className="space-y-4">
          <div className="text-xs font-medium text-muted-foreground mb-2">
            Core Data Sources
          </div>

          {coreDataSources.map((source, index) => (
            <div
              key={source.id}
              className="border rounded-lg p-4 space-y-3"
              data-testid={`data-source-${source.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {source.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold">
                        {index + 1}. {source.name}
                      </span>
                      {source.enabled && (
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                      )}
                      {source.locked && (
                        <Tooltip>
                          <TooltipTrigger>
                            <Lock className="w-3 h-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">
                              Cannot change after chat has started
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {source.description}
                    </p>
                    {source.status && (
                      <div className="mt-1 inline-block">
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                          {source.status}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Switch
                        checked={source.enabled}
                        onCheckedChange={() => toggleDataSource(source.id)}
                        disabled={source.locked || source.id === "vault"}
                        data-testid={`switch-${source.id}`}
                      />
                    </div>
                  </TooltipTrigger>
                  {source.locked && (
                    <TooltipContent>
                      <p className="text-xs">Locked - chat has started</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </div>

              {source.id === "vault" && (
                <div className="space-y-2 pl-11">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1 px-2"
                    onClick={() => handleManageClick(source.id)}
                    disabled={source.locked}
                    data-testid={`button-manage-${source.id}`}
                  >
                    Manage Documents
                    <ChevronRight className="w-3 h-3" />
                  </Button>
                </div>
              )}
              
              {source.id === "enterprise" && (
                <div className="space-y-2 pl-11">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1 px-2"
                    onClick={() => handleManageClick(source.id)}
                    data-testid={`button-manage-${source.id}`}
                  >
                    Manage Data Sources
                    <ChevronRight className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          ))}

          {connectorDataSources.length > 0 && (
            <>
              <div className="text-xs font-medium text-muted-foreground mt-6 mb-2">
                Connected Data Sources
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                These are configured by your administrator. Toggle ON to include in AI analysis.
              </p>

              {connectorDataSources.map((source, index) => (
                <div
                  key={source.id}
                  className="border rounded-lg p-4 space-y-2"
                  data-testid={`data-source-connector-${source.connectorType}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        {source.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold">
                            {coreDataSources.length + index + 1}. {source.name}
                          </span>
                          {source.enabled && (
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {source.description}
                        </p>
                        {source.tags && source.tags.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {source.tags.slice(0, 3).map(tag => (
                              <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <Switch
                      checked={source.enabled}
                      onCheckedChange={() => toggleDataSource(source.id, true)}
                      data-testid={`switch-connector-${source.connectorType}`}
                    />
                  </div>
                </div>
              ))}
            </>
          )}

          {accessibleCubes.length > 0 && (
            <>
              <div className="text-xs font-medium text-muted-foreground mt-6 mb-2">
                Data Cubes
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Filter enterprise data by cubes you have access to.
              </p>

              {accessibleCubes.map((cube) => (
                <div
                  key={cube.id}
                  className="border rounded-lg p-3 space-y-1"
                  data-testid={`data-cube-${cube.id}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-7 h-7 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                        <Box className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{cube.name}</span>
                          {enabledCubes[cube.id] && (
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                          )}
                        </div>
                        {cube.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {cube.description}
                          </p>
                        )}
                        {cube.documentCount !== undefined && (
                          <span className="text-xs text-muted-foreground">
                            {cube.documentCount} document(s)
                          </span>
                        )}
                      </div>
                    </div>
                    <Switch
                      checked={enabledCubes[cube.id] ?? true}
                      onCheckedChange={() => toggleCube(cube.id)}
                      data-testid={`switch-cube-${cube.id}`}
                    />
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <ManageVaultDialog
        isOpen={isVaultDialogOpen}
        onClose={() => setIsVaultDialogOpen(false)}
        chatId={chatId}
      />

      <Dialog open={isEnterpriseConnectorsOpen} onOpenChange={setIsEnterpriseConnectorsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enterprise Data Sources</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-96 overflow-y-auto">
            {accessibleCubes.length > 0 && (
              <>
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Box className="w-4 h-4" />
                    Data Cubes
                  </h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Toggle cubes ON/OFF to include their documents in AI analysis.
                  </p>
                  <div className="space-y-2">
                    {accessibleCubes.map((cube) => (
                      <div
                        key={cube.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                        data-testid={`cube-toggle-${cube.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center">
                            <Box className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{cube.name}</p>
                            {cube.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {cube.description}
                              </p>
                            )}
                            {cube.documentCount !== undefined && (
                              <p className="text-xs text-muted-foreground">
                                {cube.documentCount} document(s)
                              </p>
                            )}
                          </div>
                        </div>
                        <Switch
                          checked={enabledCubes[cube.id] ?? true}
                          onCheckedChange={() => toggleCube(cube.id)}
                          data-testid={`switch-dialog-cube-${cube.id}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {connectorDataSources.length > 0 && (
              <>
                {accessibleCubes.length > 0 && <hr className="my-4" />}
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Plug className="w-4 h-4" />
                    Connectors
                  </h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Toggle connectors ON/OFF to include their data in AI analysis.
                  </p>
                  <div className="space-y-2">
                    {connectorDataSources.map((source) => (
                      <div
                        key={source.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                        data-testid={`connector-toggle-${source.connectorType}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                            {source.icon}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{source.name}</p>
                            <p className="text-xs text-muted-foreground">{source.description}</p>
                          </div>
                        </div>
                        <Switch
                          checked={source.enabled}
                          onCheckedChange={() => toggleDataSource(source.id, true)}
                          data-testid={`switch-dialog-connector-${source.connectorType}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {accessibleCubes.length === 0 && connectorDataSources.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No data sources available. Contact your administrator to get access.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
