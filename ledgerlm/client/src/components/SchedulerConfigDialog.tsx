import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Clock, Loader2, Database, Box } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SchedulerConfig {
  id?: string;
  domainId?: string;
  enabled: number | boolean;
  hour: number;
  minute: number;
  timezone: string;
  anaplanWorkspaceId?: string | null;
  anaplanModelId?: string | null;
  anaplanProcessId?: string | null;
  anaplanUsername?: string | null;
  anaplanPassword?: string | null;
  targetCubeId?: string | null;
  updatedAt?: string;
}

interface Cube {
  id: string;
  name: string;
}

interface SchedulerConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  domainId?: string;
}

export function SchedulerConfigDialog({ isOpen, onClose, domainId }: SchedulerConfigDialogProps) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [hour, setHour] = useState(6);
  const [minute, setMinute] = useState(0);
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [anaplanWorkspaceId, setAnaplanWorkspaceId] = useState("");
  const [anaplanModelId, setAnaplanModelId] = useState("");
  const [anaplanProcessId, setAnaplanProcessId] = useState("");
  const [anaplanUsername, setAnaplanUsername] = useState("");
  const [anaplanPassword, setAnaplanPassword] = useState("");
  const [targetCubeId, setTargetCubeId] = useState<string | null>(null);

  // Fetch cubes for the domain
  const { data: cubes = [] } = useQuery<Cube[]>({
    queryKey: ["/api/cubes", domainId],
    queryFn: async () => {
      if (!domainId) return [];
      const res = await fetch(`/api/cubes?domainId=${domainId}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isOpen && !!domainId,
  });

  const configQueryKey = domainId 
    ? ["/api/domain-admin/scheduler-config", domainId]
    : ["/api/admin/scheduler/config"];

  const configEndpoint = domainId 
    ? `/api/domain-admin/scheduler-config?domainId=${domainId}`
    : "/api/admin/scheduler/config";

  const { data: config, isLoading } = useQuery<SchedulerConfig>({
    queryKey: configQueryKey,
    queryFn: async () => {
      const res = await fetch(configEndpoint, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch config');
      return res.json();
    },
    enabled: isOpen,
  });

  useEffect(() => {
    if (config) {
      setEnabled(config.enabled === 1 || config.enabled === true);
      setHour(config.hour);
      setMinute(config.minute);
      setTimezone(config.timezone);
      setAnaplanWorkspaceId(config.anaplanWorkspaceId || "");
      setAnaplanModelId(config.anaplanModelId || "");
      setAnaplanProcessId(config.anaplanProcessId || "");
      setAnaplanUsername(config.anaplanUsername || "");
      setAnaplanPassword(config.anaplanPassword || "");
      setTargetCubeId(config.targetCubeId || null);
    }
  }, [config]);

  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      const endpoint = domainId 
        ? "/api/domain-admin/scheduler-config"
        : "/api/admin/scheduler/config";
      
      const body = domainId 
        ? { 
            domainId, 
            enabled, 
            hour, 
            minute, 
            timezone,
            anaplanWorkspaceId: anaplanWorkspaceId || null,
            anaplanModelId: anaplanModelId || null,
            anaplanProcessId: anaplanProcessId || null,
            anaplanUsername: anaplanUsername || null,
            anaplanPassword: anaplanPassword || null,
            targetCubeId: targetCubeId || null,
          }
        : { enabled: enabled ? 1 : 0, hour, minute, timezone };
      
      return await apiRequest("PUT", endpoint, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: configQueryKey });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/anaplan/status"] });
      toast({
        title: "Configuration saved",
        description: enabled 
          ? `Automation will run daily at ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${timezone}`
          : "Automation is now disabled",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Save failed",
        description: error.message || "Could not save configuration",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    saveConfigMutation.mutate();
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);

  const timezones = [
    { value: "Asia/Kolkata", label: "IST (Asia/Kolkata)" },
    { value: "UTC", label: "UTC" },
    { value: "Europe/Oslo", label: "CET (Europe/Oslo)" },
    { value: "Europe/Berlin", label: "CET (Europe/Berlin)" },
    { value: "America/New_York", label: "EST (America/New_York)" },
    { value: "America/Los_Angeles", label: "PST (America/Los_Angeles)" },
    { value: "Europe/London", label: "GMT (Europe/London)" },
    { value: "Asia/Tokyo", label: "JST (Asia/Tokyo)" },
    { value: "Asia/Shanghai", label: "CST (Asia/Shanghai)" },
    { value: "Australia/Sydney", label: "AEDT (Australia/Sydney)" },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-scheduler-config">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <DialogTitle data-testid="text-dialog-title">Configure Automation Schedule</DialogTitle>
          </div>
          <DialogDescription data-testid="text-dialog-description">
            Set the time and frequency for automated Anaplan data synchronization
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8" data-testid="loader-config">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1">
                <Label htmlFor="enabled" className="text-base font-medium" data-testid="label-automation-enabled">
                  Enable Automation
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Automatically sync Anaplan data on schedule
                </p>
              </div>
              <Switch
                id="enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
                data-testid="switch-automation-enabled"
              />
            </div>

            {enabled && (
              <>
                <div className="space-y-3">
                  <Label className="text-base font-medium" data-testid="label-schedule-time">
                    Schedule Time
                  </Label>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <Label htmlFor="hour" className="text-sm text-muted-foreground" data-testid="label-hour">
                        Hour (24h)
                      </Label>
                      <Select value={String(hour)} onValueChange={(val) => setHour(Number(val))}>
                        <SelectTrigger id="hour" data-testid="select-hour">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {hours.map((h) => (
                            <SelectItem key={h} value={String(h)} data-testid={`option-hour-${h}`}>
                              {String(h).padStart(2, '0')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <Label htmlFor="minute" className="text-sm text-muted-foreground" data-testid="label-minute">
                        Minute
                      </Label>
                      <Select value={String(minute)} onValueChange={(val) => setMinute(Number(val))}>
                        <SelectTrigger id="minute" data-testid="select-minute">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {minutes.map((m) => (
                            <SelectItem key={m} value={String(m)} data-testid={`option-minute-${m}`}>
                              {String(m).padStart(2, '0')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Daily at {String(hour).padStart(2, '0')}:{String(minute).padStart(2, '0')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone" className="text-base font-medium" data-testid="label-timezone">
                    Timezone
                  </Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger id="timezone" data-testid="select-timezone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timezones.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value} data-testid={`option-timezone-${tz.value}`}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Anaplan Credentials - only shown for domain configs */}
                {domainId && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-muted-foreground" />
                      <Label className="text-base font-medium">Anaplan Connection</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Configure Anaplan credentials for automated data sync
                    </p>
                    
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="workspaceId" className="text-sm text-muted-foreground">
                          Workspace ID
                        </Label>
                        <Input
                          id="workspaceId"
                          value={anaplanWorkspaceId}
                          onChange={(e) => setAnaplanWorkspaceId(e.target.value)}
                          placeholder="e.g., 8a868cdc7e5feca9017e8e4afdd57430"
                          data-testid="input-anaplan-workspace-id"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="modelId" className="text-sm text-muted-foreground">
                          Model ID
                        </Label>
                        <Input
                          id="modelId"
                          value={anaplanModelId}
                          onChange={(e) => setAnaplanModelId(e.target.value)}
                          placeholder="e.g., BE462879B50444F498A0DA70F40FABA2"
                          data-testid="input-anaplan-model-id"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="processId" className="text-sm text-muted-foreground">
                          Export Process ID
                        </Label>
                        <Input
                          id="processId"
                          value={anaplanProcessId}
                          onChange={(e) => setAnaplanProcessId(e.target.value)}
                          placeholder="e.g., 118000000093"
                          data-testid="input-anaplan-process-id"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="anaplanUsername" className="text-sm text-muted-foreground">
                          Anaplan Username
                        </Label>
                        <Input
                          id="anaplanUsername"
                          value={anaplanUsername}
                          onChange={(e) => setAnaplanUsername(e.target.value)}
                          placeholder="your-anaplan-username"
                          data-testid="input-anaplan-username"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="anaplanPassword" className="text-sm text-muted-foreground">
                          Anaplan Password
                        </Label>
                        <Input
                          id="anaplanPassword"
                          type="password"
                          value={anaplanPassword}
                          onChange={(e) => setAnaplanPassword(e.target.value)}
                          placeholder="••••••••"
                          data-testid="input-anaplan-password"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Leave blank to use global environment credentials
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Target Cube Selection */}
                {domainId && cubes.length > 0 && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <Box className="w-4 h-4 text-muted-foreground" />
                      <Label className="text-base font-medium">Target Cube</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Select which cube to store downloaded documents in
                    </p>
                    <Select 
                      value={targetCubeId || ""} 
                      onValueChange={(val) => setTargetCubeId(val || null)}
                    >
                      <SelectTrigger data-testid="select-target-cube">
                        <SelectValue placeholder="Select a cube..." />
                      </SelectTrigger>
                      <SelectContent>
                        {cubes.map((cube) => (
                          <SelectItem key={cube.id} value={cube.id} data-testid={`option-cube-${cube.id}`}>
                            {cube.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!targetCubeId && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Warning: Documents synced without a target cube won't appear in cube-filtered views
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saveConfigMutation.isPending}
            data-testid="button-cancel-config"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saveConfigMutation.isPending || isLoading}
            data-testid="button-save-config"
          >
            {saveConfigMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Configuration"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
