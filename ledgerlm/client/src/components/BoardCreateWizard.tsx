import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { insertBoardSchema, type BoardTemplate, type InsertBoard } from '@shared/schema';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { BoardTemplateGrid } from './BoardTemplateGrid';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { useAuthUser } from '@/lib/auth';

interface BoardCreateWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type WizardStep = 'template' | 'details';

export function BoardCreateWizard({ open, onOpenChange }: BoardCreateWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<BoardTemplate | null>(null);
  const { toast } = useToast();
  const currentUser = useAuthUser();

  const { data: templates = [], isLoading: templatesLoading } = useQuery<BoardTemplate[]>({
    queryKey: ['/api/board-templates'],
    enabled: open,
  });

  const form = useForm<InsertBoard>({
    resolver: zodResolver(insertBoardSchema),
    defaultValues: {
      userId: currentUser?.id || '',
      title: '',
      description: '',
      templateId: undefined,
      analysisTemplate: undefined,
    },
  });

  // Update userId when currentUser becomes available
  useEffect(() => {
    if (currentUser?.id) {
      form.setValue('userId', currentUser.id);
    }
  }, [currentUser?.id, form]);

  const createBoardMutation = useMutation({
    mutationFn: async (data: InsertBoard) => {
      return apiRequest('POST', '/api/boards', data);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['/api/boards'] });
      handleClose();
      toast({
        title: 'Success',
        description: 'Board created successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create board',
        variant: 'destructive',
      });
    },
  });

  const handleTemplateSelect = (template: BoardTemplate) => {
    setSelectedTemplate(template);
    form.setValue('templateId', template.id);
    form.setValue('title', template.name);
    form.setValue('description', template.description);
  };

  const handleNext = () => {
    if (currentStep === 'template' && selectedTemplate) {
      setCurrentStep('details');
    }
  };

  const handleBack = () => {
    if (currentStep === 'details') {
      setCurrentStep('template');
    }
  };

  const handleSubmit = form.handleSubmit(
    (data) => {
      if (!currentUser) {
        toast({
          title: 'Error',
          description: 'Please sign in to create a board',
          variant: 'destructive',
        });
        return;
      }
      
      console.log('Form submission successful, data:', data);
      const boardData = {
        ...data,
        userId: currentUser.id,
      };
      createBoardMutation.mutate(boardData);
    },
    (errors) => {
      console.log('Form validation errors:', errors);
      toast({
        title: 'Validation Error',
        description: 'Please check all required fields',
        variant: 'destructive',
      });
    }
  );

  const handleClose = () => {
    setCurrentStep('template');
    setSelectedTemplate(null);
    form.reset();
    onOpenChange(false);
  };

  const canProceed = currentStep === 'template' ? selectedTemplate !== null : true;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col" data-testid="dialog-create-board-wizard">
        <DialogHeader>
          <DialogTitle>
            {currentStep === 'template' ? 'Choose a Template' : 'Board Details'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1">
          {currentStep === 'template' && (
            <div className="space-y-4">
              {templatesLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading templates...</div>
              ) : (
                <BoardTemplateGrid
                  templates={templates}
                  selectedTemplateId={selectedTemplate?.id}
                  onSelectTemplate={handleTemplateSelect}
                />
              )}
            </div>
          )}

          {currentStep === 'details' && (
            <Form {...form}>
              <form onSubmit={handleSubmit} className="space-y-4" id="board-create-form">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Q4 Financial Analysis" {...field} data-testid="input-board-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Detailed analysis of Q4 performance metrics..."
                          {...field}
                          value={field.value || ''}
                          data-testid="input-board-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          )}
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={currentStep === 'template'}
            data-testid="button-wizard-back"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} data-testid="button-wizard-cancel">
              Cancel
            </Button>
            {currentStep === 'template' ? (
              <Button
                onClick={handleNext}
                disabled={!canProceed}
                data-testid="button-wizard-next"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={(e) => {
                  e.preventDefault();
                  console.log('Create Board button clicked');
                  handleSubmit(e);
                }}
                disabled={createBoardMutation.isPending}
                data-testid="button-wizard-create"
              >
                {createBoardMutation.isPending ? 'Creating...' : 'Create Board'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
