import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { type BoardTemplate, type Board } from '@shared/schema';

interface BoardEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: BoardTemplate;
  board?: Board;
}

export function BoardEditorDialog({
  open,
  onOpenChange,
  template,
  board,
}: BoardEditorDialogProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const isEditing = !!board;
  const isFromTemplate = !!template && !board;

  const getInitialFormData = () => {
    if (board) {
      const boardSettings = board.settings as any;
      return {
        title: board.title || '',
        description: board.description || '',
        analysisPrompts: boardSettings?.analysisPrompts || '',
        dataSources: {
          enterprise: boardSettings?.dataSources?.enterprise ?? true,
          vault: boardSettings?.dataSources?.vault ?? true,
          webApis: boardSettings?.dataSources?.webApis ?? false,
          financialApis: boardSettings?.dataSources?.financialApis ?? false,
        },
      };
    } else if (template) {
      const config = template.defaultConfig as any;
      return {
        title: template.name || '',
        description: template.description || '',
        analysisPrompts: config?.analysisPrompts || '',
        dataSources: {
          enterprise: config?.dataSources?.enterprise ?? true,
          vault: config?.dataSources?.vault ?? true,
          webApis: config?.dataSources?.webApis ?? false,
          financialApis: config?.dataSources?.financialApis ?? false,
        },
      };
    }
    return {
      title: '',
      description: '',
      analysisPrompts: '',
      dataSources: {
        enterprise: true,
        vault: true,
        webApis: false,
        financialApis: false,
      },
    };
  };

  const [formData, setFormData] = useState(getInitialFormData());

  useEffect(() => {
    if (open) {
      setFormData(getInitialFormData());
    }
  }, [open, template, board]);

  const createBoardMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        title: data.title,
        description: data.description,
        templateId: template?.id || null,
        settings: {
          analysisPrompts: data.analysisPrompts,
          dataSources: data.dataSources,
        },
      };
      
      if (isEditing && board) {
        return apiRequest('PUT', `/api/boards/${board.id}`, payload);
      } else {
        return apiRequest('POST', `/api/boards`, payload);
      }
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/boards'] });
      toast({
        title: 'Success',
        description: `Board ${isEditing ? 'updated' : 'created'} successfully`,
      });
      onOpenChange(false);
      resetForm();
      
      if (!isEditing) {
        setTimeout(() => {
          navigate(`/board/${data.id}`);
        }, 300);
      }
    },
    onError: () => {
      toast({
        title: 'Error',
        description: `Failed to ${isEditing ? 'update' : 'create'} board`,
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      analysisPrompts: '',
      dataSources: {
        enterprise: true,
        vault: true,
        webApis: false,
        financialApis: false,
      },
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createBoardMutation.mutate(formData);
  };

  const handleClose = () => {
    onOpenChange(false);
    if (!isEditing) {
      resetForm();
    }
  };

  const getDialogTitle = () => {
    if (isEditing) return 'Edit Board';
    if (isFromTemplate) return `Create Board from ${template.name}`;
    return 'Create New Board';
  };

  const getDialogDescription = () => {
    if (isFromTemplate) {
      return 'Customize the board settings and analysis prompts, then start analyzing';
    }
    return 'Create a custom board with analysis prompts and data source configuration';
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-board-editor">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">{getDialogTitle()}</DialogTitle>
          <DialogDescription data-testid="text-dialog-description">
            {getDialogDescription()}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title" data-testid="label-board-name">Board Name</Label>
              <Input
                id="title"
                placeholder="e.g., Q4 2024 Financial Review"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                data-testid="input-board-title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" data-testid="label-board-description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of this board's purpose..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                data-testid="input-board-description"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompts" data-testid="label-analysis-prompts">Analysis Prompts</Label>
              <Textarea
                id="prompts"
                placeholder={`I'll help you analyze... I'm configured to:\n- Analyze X and Y\n- Calculate key metrics\n- Identify trends\n\nPlease upload your documents or I can analyze your enterprise data.`}
                value={formData.analysisPrompts}
                onChange={(e) => setFormData({ ...formData, analysisPrompts: e.target.value })}
                rows={8}
                required
                className="font-mono text-sm"
                data-testid="input-board-prompts"
              />
              <p className="text-xs text-muted-foreground" data-testid="text-prompts-help">
                This message will be shown when you start analyzing with this board
              </p>
            </div>

            <div className="space-y-3">
              <Label data-testid="label-data-sources">Data Sources</Label>
              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">Enterprise Data</div>
                    <div className="text-xs text-muted-foreground">
                      Access company-wide financial documents
                    </div>
                  </div>
                  <Switch
                    checked={formData.dataSources.enterprise}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        dataSources: { ...formData.dataSources, enterprise: checked },
                      })
                    }
                    data-testid="switch-enterprise"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">Vault Documents</div>
                    <div className="text-xs text-muted-foreground">
                      Personal uploaded documents
                    </div>
                  </div>
                  <Switch
                    checked={formData.dataSources.vault}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        dataSources: { ...formData.dataSources, vault: checked },
                      })
                    }
                    data-testid="switch-vault"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">Web APIs</div>
                    <div className="text-xs text-muted-foreground">
                      Search web for market data and news
                    </div>
                  </div>
                  <Switch
                    checked={formData.dataSources.webApis}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        dataSources: { ...formData.dataSources, webApis: checked },
                      })
                    }
                    data-testid="switch-web-apis"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">Financial APIs</div>
                    <div className="text-xs text-muted-foreground">
                      External financial data sources
                    </div>
                  </div>
                  <Switch
                    checked={formData.dataSources.financialApis}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        dataSources: { ...formData.dataSources, financialApis: checked },
                      })
                    }
                    data-testid="switch-financial-apis"
                  />
                </div>
              </div>
            </div>

          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={createBoardMutation.isPending}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createBoardMutation.isPending}
              data-testid="button-save-board"
            >
              {createBoardMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isEditing ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>{isEditing ? 'Update Board' : 'Create Board'}</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
