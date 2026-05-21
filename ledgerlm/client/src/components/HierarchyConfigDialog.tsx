import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Network, Plus, Trash2, Save, ArrowRight, GripVertical, FileSpreadsheet, Sparkles } from "lucide-react";

interface HierarchyLevel {
  name: string;
  columnName?: string;
}

interface HierarchyConfig {
  id?: string;
  hierarchy_name: string;
  description: string;
  levels: string[];
  column_mappings?: Record<string, string>;
}

interface HierarchyConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domainId: string;
  domainName: string;
}

export function HierarchyConfigDialog({
  open,
  onOpenChange,
  domainId,
  domainName
}: HierarchyConfigDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [hierarchies, setHierarchies] = useState<HierarchyConfig[]>([]);
  const [newHierarchyName, setNewHierarchyName] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hierarchyQuery = useQuery({
    queryKey: ['/api/schema-config/hierarchy-config', domainId],
    queryFn: async () => {
      const res = await fetch(`/api/v2/schema-config/hierarchy-config/${domainId}`);
      if (!res.ok) throw new Error('Failed to fetch hierarchies');
      return res.json();
    },
    enabled: open && !!domainId,
  });

  useEffect(() => {
    if (hierarchyQuery.data?.hierarchies) {
      setHierarchies(hierarchyQuery.data.hierarchies);
    }
  }, [hierarchyQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v2/schema-config/hierarchy-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain_id: domainId,
          hierarchies: hierarchies,
        }),
      });

      if (!res.ok) throw new Error('Failed to save hierarchies');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Hierarchies saved",
        description: `Saved ${hierarchies.length} hierarchy configurations.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/schema-config/hierarchy-config', domainId] });
    },
    onError: (error) => {
      toast({
        title: "Save failed",
        description: String(error),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (hierarchyId: string) => {
      const res = await fetch(`/api/v2/schema-config/hierarchy-config/${hierarchyId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete hierarchy');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Hierarchy deleted" });
      queryClient.invalidateQueries({ queryKey: ['/api/schema-config/hierarchy-config', domainId] });
    },
    onError: (error) => {
      toast({
        title: "Delete failed",
        description: String(error),
        variant: "destructive",
      });
    },
  });

  const addHierarchy = () => {
    if (!newHierarchyName.trim()) return;
    
    setHierarchies(prev => [...prev, {
      hierarchy_name: newHierarchyName.trim(),
      description: '',
      levels: ['Level 1', 'Level 2'],
    }]);
    setNewHierarchyName('');
  };

  const updateHierarchy = (index: number, updates: Partial<HierarchyConfig>) => {
    setHierarchies(prev => prev.map((h, i) => 
      i === index ? { ...h, ...updates } : h
    ));
  };

  const removeHierarchy = (index: number) => {
    const hierarchy = hierarchies[index];
    if (hierarchy.id) {
      deleteMutation.mutate(hierarchy.id);
    }
    setHierarchies(prev => prev.filter((_, i) => i !== index));
  };

  const addLevel = (hierarchyIndex: number) => {
    const hierarchy = hierarchies[hierarchyIndex];
    updateHierarchy(hierarchyIndex, {
      levels: [...hierarchy.levels, `Level ${hierarchy.levels.length + 1}`]
    });
  };

  const updateLevel = (hierarchyIndex: number, levelIndex: number, value: string) => {
    const hierarchy = hierarchies[hierarchyIndex];
    const newLevels = [...hierarchy.levels];
    newLevels[levelIndex] = value;
    updateHierarchy(hierarchyIndex, { levels: newLevels });
  };

  const removeLevel = (hierarchyIndex: number, levelIndex: number) => {
    const hierarchy = hierarchies[hierarchyIndex];
    updateHierarchy(hierarchyIndex, {
      levels: hierarchy.levels.filter((_, i) => i !== levelIndex)
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('domain_id', domainId);

      const res = await fetch('/api/v2/schema-config/analyze-hierarchy', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Failed to analyze file');

      const data = await res.json();
      setDetectedColumns(data.all_columns || []);

      if (data.detected_hierarchies?.length > 0) {
        const newHierarchies = data.detected_hierarchies.map((h: any) => ({
          hierarchy_name: h.hierarchy_name,
          description: h.description || '',
          levels: h.levels,
          column_mappings: h.column_mappings,
        }));
        setHierarchies(prev => [...prev, ...newHierarchies]);

        toast({
          title: "Hierarchies detected",
          description: `Found ${newHierarchies.length} potential hierarchy structure(s) from ${data.hierarchy_candidates?.length || 0} relevant columns.`,
        });
      } else if (data.hierarchy_candidates?.length > 0) {
        const levels = data.hierarchy_candidates.map((c: any) => c.column_name);
        setHierarchies(prev => [...prev, {
          hierarchy_name: 'Detected Structure',
          description: 'Auto-detected from uploaded Excel file',
          levels,
        }]);
        toast({
          title: "Columns detected",
          description: `Found ${levels.length} hierarchy-related columns. Review and adjust the structure.`,
        });
      } else {
        toast({
          title: "No hierarchies found",
          description: "Upload a file with columns like Region, Country, Department, etc.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Analysis failed",
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Domain Hierarchies: {domainName}
          </DialogTitle>
          <DialogDescription>
            Define organizational hierarchies (e.g., Org Structure, Geography) that the AI will use to understand data relationships.
          </DialogDescription>
        </DialogHeader>

        <Card className="border-dashed bg-muted/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Sparkles className="h-4 w-4" />
                  <span>Auto-detect from Excel</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Upload an Excel file to automatically detect hierarchy columns (Region, Country, Department, etc.)
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
                data-testid="input-hierarchy-file"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isAnalyzing}
                data-testid="button-upload-hierarchy-excel"
              >
                {isAnalyzing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                )}
                {isAnalyzing ? 'Analyzing...' : 'Upload Excel'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {hierarchies.map((hierarchy, hIndex) => (
              <Card key={hIndex} data-testid={`hierarchy-card-${hIndex}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <Input
                        value={hierarchy.hierarchy_name}
                        onChange={(e) => updateHierarchy(hIndex, { hierarchy_name: e.target.value })}
                        className="font-medium text-lg"
                        placeholder="Hierarchy Name"
                        data-testid={`input-hierarchy-name-${hIndex}`}
                      />
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => removeHierarchy(hIndex)}
                      data-testid={`button-delete-hierarchy-${hIndex}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs">Description (for AI context)</Label>
                    <Textarea
                      value={hierarchy.description || ''}
                      onChange={(e) => updateHierarchy(hIndex, { description: e.target.value })}
                      placeholder="Describe this hierarchy structure and when it should be used..."
                      className="h-16"
                      data-testid={`textarea-hierarchy-description-${hIndex}`}
                    />
                  </div>

                  <div>
                    <Label className="text-xs mb-2 block">Hierarchy Levels (top to bottom)</Label>
                    <div className="space-y-2">
                      {hierarchy.levels.map((level, lIndex) => (
                        <div key={lIndex} className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <Badge variant="outline" className="w-8 justify-center">{lIndex + 1}</Badge>
                          <Input
                            value={level}
                            onChange={(e) => updateLevel(hIndex, lIndex, e.target.value)}
                            placeholder={`Level ${lIndex + 1} column name`}
                            className="flex-1"
                            data-testid={`input-level-${hIndex}-${lIndex}`}
                          />
                          {lIndex > 0 && (
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => removeLevel(hIndex, lIndex)}
                              data-testid={`button-remove-level-${hIndex}-${lIndex}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => addLevel(hIndex)}
                        className="mt-2"
                        data-testid={`button-add-level-${hIndex}`}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Level
                      </Button>
                    </div>
                  </div>

                  <div className="bg-muted/50 rounded p-3">
                    <Label className="text-xs text-muted-foreground mb-2 block">Preview</Label>
                    <div className="flex items-center flex-wrap gap-1">
                      {hierarchy.levels.map((level, lIndex) => (
                        <span key={lIndex} className="flex items-center">
                          <Badge variant="secondary">{level}</Badge>
                          {lIndex < hierarchy.levels.length - 1 && (
                            <ArrowRight className="h-3 w-3 mx-1 text-muted-foreground" />
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Card className="border-dashed">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Input
                    value={newHierarchyName}
                    onChange={(e) => setNewHierarchyName(e.target.value)}
                    placeholder="New hierarchy name (e.g., Organization Structure)"
                    onKeyDown={(e) => e.key === 'Enter' && addHierarchy()}
                    data-testid="input-new-hierarchy"
                  />
                  <Button onClick={addHierarchy} disabled={!newHierarchyName.trim()} data-testid="button-add-hierarchy">
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-hierarchy">
            Cancel
          </Button>
          <Button 
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || hierarchies.length === 0}
            data-testid="button-save-hierarchy"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Hierarchies
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
