import { useState } from 'react';
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

interface TemplateEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: any;
}

export function TemplateEditorDialog({
  open,
  onOpenChange,
  template,
}: TemplateEditorDialogProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const isEditing = !!template;

  const [formData, setFormData] = useState({
    name: template?.name || '',
    description: template?.description || '',
    analysisPrompts: template?.defaultConfig?.analysisPrompts || '',
    dataSources: {
      enterprise: template?.defaultConfig?.dataSources?.enterprise ?? true,
      vault: template?.defaultConfig?.dataSources?.vault ?? true,
      webApis: template?.defaultConfig?.dataSources?.webApis ?? false,
      financialApis: template?.defaultConfig?.dataSources?.financialApis ?? false,
    },
    settings: {
      resultLimit: template?.defaultConfig?.settings?.resultLimit || 10,
      timeout: template?.defaultConfig?.settings?.timeout || 30,
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        slug: data.name.toLowerCase().replace(/\s+/g, '-'),
        name: data.name,
        description: data.description,
        defaultConfig: {
          analysisPrompts: data.analysisPrompts,
          dataSources: data.dataSources,
          settings: data.settings,
        },
      };
      
      if (isEditing) {
        return apiRequest('PUT', `/api/board-templates/${template.id}`, payload);
      } else {
        return apiRequest('POST', `/api/board-templates`, payload);
      }
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/board-templates'] });
      toast({
        title: 'Success',
        description: `Template ${isEditing ? 'updated' : 'created'} successfully`,
      });
      onOpenChange(false);
      resetForm();
      
      // If creating new template, offer to use it
      if (!isEditing && data?.id) {
        setTimeout(() => {
          toast({
            title: 'Ready to use',
            description: 'Your template is ready. Click "Use Template" to create a chat.',
          });
        }, 500);
      }
    },
    onError: () => {
      toast({
        title: 'Error',
        description: `Failed to ${isEditing ? 'update' : 'create'} template`,
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      analysisPrompts: '',
      dataSources: {
        enterprise: true,
        vault: true,
        webApis: false,
        financialApis: false,
      },
      settings: {
        resultLimit: 10,
        timeout: 30,
      },
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createTemplateMutation.mutate(formData);
  };

  const handleClose = () => {
    onOpenChange(false);
    if (!isEditing) {
      resetForm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-template-editor">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Template' : 'Create New Template'}</DialogTitle>
          <DialogDescription>
            Create a custom template with analysis prompts and data source configuration
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                placeholder="e.g., Monthly Expense Analysis"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                data-testid="input-template-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of what this template analyzes..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                required
                data-testid="input-template-description"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompts">Analysis Prompts</Label>
              <Textarea
                id="prompts"
                placeholder={`I'll help you analyze... I'm configured to:\n- Analyze X and Y\n- Calculate key metrics\n- Identify trends\n\nPlease upload your documents or I can analyze your enterprise data.`}
                value={formData.analysisPrompts}
                onChange={(e) => setFormData({ ...formData, analysisPrompts: e.target.value })}
                rows={8}
                required
                className="font-mono text-sm"
                data-testid="input-template-prompts"
              />
              <p className="text-xs text-muted-foreground">
                This message will be shown when users start a chat from this template
              </p>
            </div>

            <div className="space-y-3">
              <Label>Data Sources</Label>
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
              disabled={createTemplateMutation.isPending}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createTemplateMutation.isPending}
              data-testid="button-save-template"
            >
              {createTemplateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isEditing ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>{isEditing ? 'Update Template' : 'Create Template'}</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
