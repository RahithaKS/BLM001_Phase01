import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Database, FileSpreadsheet, Save, AlertCircle, CheckCircle, Eye, EyeOff, Hash, Calendar, Type } from "lucide-react";

interface ColumnConfig {
  column_index: number;
  original_name: string;
  display_name: string;
  column_type: 'dimension' | 'metric' | 'period' | 'hierarchy' | 'ignore';
  data_type: 'text' | 'number' | 'date' | 'currency' | 'boolean';
  description: string | null;
  aliases: string[];
  aggregation_rule: string | null;
  use_for_sql: boolean;
  use_for_rag: boolean;
  sample_values: string[];
}

interface ColumnConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cubeId: string;
  cubeName: string;
  file?: File | null;
  onSaveComplete?: () => void;
}

const COLUMN_TYPES = [
  { value: 'dimension', label: 'Dimension', icon: Type, description: 'Categorical data for filtering/grouping' },
  { value: 'metric', label: 'Metric', icon: Hash, description: 'Numeric values for aggregation' },
  { value: 'period', label: 'Period', icon: Calendar, description: 'Time-related columns (month, year, date)' },
  { value: 'hierarchy', label: 'Hierarchy', icon: Database, description: 'Part of organizational hierarchy' },
  { value: 'ignore', label: 'Ignore', icon: EyeOff, description: 'Exclude from analysis (e.g., PII)' },
];

const DATA_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'currency', label: 'Currency' },
  { value: 'boolean', label: 'Boolean' },
];

const AGGREGATION_RULES = [
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'count', label: 'Count' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
  { value: 'last', label: 'Last Value' },
];

export function ColumnConfigDialog({
  open,
  onOpenChange,
  cubeId,
  cubeName,
  file,
  onSaveComplete
}: ColumnConfigDialogProps) {
  const { toast } = useToast();
  const [columns, setColumns] = useState<ColumnConfig[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [schemaHash, setSchemaHash] = useState<string>('');
  const [hasSynced, setHasSynced] = useState(false);

  // Reset sync flag when dialog closes or cubeId changes
  useEffect(() => {
    if (!open) {
      setHasSynced(false);
      setColumns([]);
    }
  }, [open, cubeId]);

  const existingConfigQuery = useQuery({
    queryKey: ['/api/schema-config/column-config', cubeId],
    queryFn: async () => {
      const res = await fetch(`/api/v2/schema-config/column-config/${cubeId}`);
      if (!res.ok) throw new Error('Failed to fetch config');
      return res.json();
    },
    enabled: open && !!cubeId && !file,
  });

  // If existing config is empty, try to sync from cube_fact_data
  const syncFromDataMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v2/schema-config/sync-columns-from-data/${cubeId}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to sync columns from data');
      return res.json();
    },
    onSuccess: (data) => {
      setHasSynced(true);
      if (data.columns?.length > 0) {
        setColumns(data.columns);
        toast({
          title: data.synced ? "Columns detected" : "Configuration loaded",
          description: `Found ${data.total_columns} columns. Review and configure each column below.`,
        });
      }
    },
    onError: (error) => {
      setHasSynced(true);
      toast({
        title: "Sync failed",
        description: String(error),
        variant: "destructive",
      });
    }
  });

  useEffect(() => {
    if (existingConfigQuery.data?.columns?.length > 0 && !file) {
      setColumns(existingConfigQuery.data.columns);
    } else if (
      existingConfigQuery.data?.columns?.length === 0 && 
      !file && 
      open && 
      cubeId && 
      !hasSynced && 
      !syncFromDataMutation.isPending
    ) {
      // No config exists, try to sync from cube_fact_data (only once)
      syncFromDataMutation.mutate();
    }
  }, [existingConfigQuery.data, file, open, cubeId, hasSynced, syncFromDataMutation.isPending]);

  useEffect(() => {
    if (open && file && cubeId) {
      analyzeFile();
    }
  }, [open, file, cubeId]);

  const analyzeFile = async () => {
    if (!file) return;
    
    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('cube_id', cubeId);

      const res = await fetch('/api/v2/schema-config/analyze-columns', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Failed to analyze file');

      const data = await res.json();
      setColumns(data.columns);
      setSchemaHash(data.schema_hash);

      toast({
        title: "File analyzed",
        description: `Found ${data.total_columns} columns. Review and configure each column below.`,
      });
    } catch (error) {
      toast({
        title: "Analysis failed",
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v2/schema-config/column-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cube_id: cubeId,
          columns: columns,
        }),
      });

      if (!res.ok) throw new Error('Failed to save configuration');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Configuration saved",
        description: `Saved configuration for ${columns.length} columns.`,
      });
      onSaveComplete?.();
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Save failed",
        description: String(error),
        variant: "destructive",
      });
    },
  });

  const updateColumn = (index: number, updates: Partial<ColumnConfig>) => {
    setColumns(prev => prev.map((col, i) => 
      i === index ? { ...col, ...updates } : col
    ));
  };

  const getColumnTypeIcon = (type: string) => {
    const typeInfo = COLUMN_TYPES.find(t => t.value === type);
    if (!typeInfo) return null;
    const Icon = typeInfo.icon;
    return <Icon className="h-4 w-4" />;
  };

  const getColumnTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'dimension': return 'secondary';
      case 'metric': return 'default';
      case 'period': return 'outline';
      case 'hierarchy': return 'secondary';
      case 'ignore': return 'destructive';
      default: return 'secondary';
    }
  };

  const groupedColumns = {
    dimensions: columns.filter(c => c.column_type === 'dimension'),
    metrics: columns.filter(c => c.column_type === 'metric'),
    periods: columns.filter(c => c.column_type === 'period'),
    hierarchies: columns.filter(c => c.column_type === 'hierarchy'),
    ignored: columns.filter(c => c.column_type === 'ignore'),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Configure Columns: {cubeName}
          </DialogTitle>
          <DialogDescription>
            Define how each column should be used for SQL queries and AI analysis.
            Auto-detected types are shown - review and adjust as needed.
          </DialogDescription>
        </DialogHeader>

        {isAnalyzing ? (
          <div className="flex-1 flex items-center justify-center py-8">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-muted-foreground">Analyzing file structure...</p>
            </div>
          </div>
        ) : columns.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-8">
            <div className="flex flex-col items-center gap-4">
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">No columns to configure. Upload a file to analyze.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 py-2 border-b">
              <Badge variant="secondary" data-testid="badge-dimensions-count">
                {groupedColumns.dimensions.length} Dimensions
              </Badge>
              <Badge variant="default" data-testid="badge-metrics-count">
                {groupedColumns.metrics.length} Metrics
              </Badge>
              <Badge variant="outline" data-testid="badge-periods-count">
                {groupedColumns.periods.length} Periods
              </Badge>
              <Badge variant="secondary" data-testid="badge-hierarchies-count">
                {groupedColumns.hierarchies.length} Hierarchies
              </Badge>
              <Badge variant="destructive" data-testid="badge-ignored-count">
                {groupedColumns.ignored.length} Ignored
              </Badge>
            </div>

            <ScrollArea className="flex-1 min-h-0 pr-4">
              <Accordion type="multiple" defaultValue={['dimensions', 'metrics']} className="w-full">
                {Object.entries(groupedColumns).map(([groupKey, groupColumns]) => (
                  groupColumns.length > 0 && (
                    <AccordionItem key={groupKey} value={groupKey}>
                      <AccordionTrigger className="capitalize" data-testid={`accordion-${groupKey}`}>
                        {groupKey} ({groupColumns.length})
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4">
                          {groupColumns.map((col) => (
                            <div 
                              key={col.column_index}
                              className="border rounded-lg p-4 space-y-3"
                              data-testid={`column-config-${col.column_index}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {getColumnTypeIcon(col.column_type)}
                                  <span className="font-medium">{col.original_name}</span>
                                  <Badge variant={getColumnTypeBadgeVariant(col.column_type)}>
                                    {col.column_type}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="flex items-center gap-2">
                                    <Label className="text-xs">SQL</Label>
                                    <Switch 
                                      checked={col.use_for_sql}
                                      onCheckedChange={(checked) => updateColumn(col.column_index, { use_for_sql: checked })}
                                      data-testid={`switch-sql-${col.column_index}`}
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Label className="text-xs">RAG</Label>
                                    <Switch 
                                      checked={col.use_for_rag}
                                      onCheckedChange={(checked) => updateColumn(col.column_index, { use_for_rag: checked })}
                                      data-testid={`switch-rag-${col.column_index}`}
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-3">
                                <div>
                                  <Label className="text-xs">Type</Label>
                                  <Select 
                                    value={col.column_type} 
                                    onValueChange={(v) => updateColumn(col.column_index, { column_type: v as ColumnConfig['column_type'] })}
                                  >
                                    <SelectTrigger data-testid={`select-type-${col.column_index}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {COLUMN_TYPES.map(t => (
                                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div>
                                  <Label className="text-xs">Data Type</Label>
                                  <Select 
                                    value={col.data_type} 
                                    onValueChange={(v) => updateColumn(col.column_index, { data_type: v as ColumnConfig['data_type'] })}
                                  >
                                    <SelectTrigger data-testid={`select-datatype-${col.column_index}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {DATA_TYPES.map(t => (
                                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                {col.column_type === 'metric' && (
                                  <div>
                                    <Label className="text-xs">Aggregation</Label>
                                    <Select 
                                      value={col.aggregation_rule || 'sum'} 
                                      onValueChange={(v) => updateColumn(col.column_index, { aggregation_rule: v })}
                                    >
                                      <SelectTrigger data-testid={`select-aggregation-${col.column_index}`}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {AGGREGATION_RULES.map(r => (
                                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}
                              </div>

                              <div>
                                <Label className="text-xs">Display Name</Label>
                                <Input 
                                  value={col.display_name || ''}
                                  onChange={(e) => updateColumn(col.column_index, { display_name: e.target.value })}
                                  placeholder="Human-readable name"
                                  data-testid={`input-displayname-${col.column_index}`}
                                />
                              </div>

                              <div>
                                <Label className="text-xs">Description (for AI context)</Label>
                                <Textarea 
                                  value={col.description || ''}
                                  onChange={(e) => updateColumn(col.column_index, { description: e.target.value })}
                                  placeholder="Describe what this column means..."
                                  className="h-16"
                                  data-testid={`textarea-description-${col.column_index}`}
                                />
                              </div>

                              <div>
                                <Label className="text-xs">Aliases (comma-separated)</Label>
                                <Input 
                                  value={col.aliases?.join(', ') || ''}
                                  onChange={(e) => updateColumn(col.column_index, { 
                                    aliases: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                                  })}
                                  placeholder="Alternative names for NLP matching"
                                  data-testid={`input-aliases-${col.column_index}`}
                                />
                              </div>

                              {col.sample_values?.length > 0 && (
                                <div>
                                  <Label className="text-xs text-muted-foreground">Sample Values</Label>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {col.sample_values.slice(0, 5).map((v, i) => (
                                      <Badge key={i} variant="outline" className="text-xs">{v}</Badge>
                                    ))}
                                    {col.sample_values.length > 5 && (
                                      <Badge variant="outline" className="text-xs">+{col.sample_values.length - 5} more</Badge>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )
                ))}
              </Accordion>
            </ScrollArea>

            <DialogFooter className="border-t pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-config">
                Cancel
              </Button>
              <Button 
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                data-testid="button-save-config"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Configuration
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
