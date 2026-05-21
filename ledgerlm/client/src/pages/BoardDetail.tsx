import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, MessageSquare, FolderPlus } from 'lucide-react';
import { type Board, type Chat } from '@shared/schema';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { BoardEditorDialog } from '@/components/BoardEditorDialog';

export default function BoardDetail() {
  const { id: boardId } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const { data: board, isLoading: boardLoading } = useQuery<Board>({
    queryKey: ['/api/boards', boardId],
    enabled: !!boardId,
  });

  const { data: boardThreads = [], isLoading: threadsLoading } = useQuery<Chat[]>({
    queryKey: ['/api/boards', boardId, 'threads'],
    enabled: !!boardId,
  });

  const createChatMutation = useMutation({
    mutationFn: async () => {
      if (!board) throw new Error('Board not found');
      
      const boardSettings = board.settings as any;
      const chatResponse = await apiRequest('POST', '/api/chats', {
        title: `${board.title} - Analysis`,
        templateMessage: boardSettings?.analysisPrompts || `Let's analyze using ${board.title}`,
      }) as Chat;
      
      await apiRequest('POST', `/api/boards/${board.id}/threads`, {
        chatId: chatResponse.id,
      });
      
      return chatResponse;
    },
    onSuccess: (data: Chat) => {
      queryClient.invalidateQueries({ queryKey: ['/api/boards', boardId, 'threads'] });
      navigate(`/chat/${data.id}`);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create analysis chat',
        variant: 'destructive',
      });
    },
  });

  const handleNewAnalysis = () => {
    createChatMutation.mutate();
  };

  const handleOpenChat = (chatId: string) => {
    navigate(`/chat/${chatId}`);
  };

  if (boardLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading board...</div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-muted-foreground" data-testid="text-board-not-found">Board not found</div>
        <Button onClick={() => navigate('/boards')} data-testid="button-back-not-found">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Boards
        </Button>
      </div>
    );
  }

  const boardSettings = board.settings as any;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-primary/10">
      <div className="flex-1 overflow-auto p-6">
        <div className="h-full bg-white rounded-2xl overflow-auto flex flex-col">
          <div className="px-6 lg:px-8 py-3.5 flex items-center justify-between gap-3 bg-primary/40 flex-shrink-0">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/boards')}
                data-testid="button-back-boards"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h1 className="text-xl font-semibold text-foreground" data-testid="text-board-title">{board.title}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditDialogOpen(true)}
                data-testid="button-edit-board"
              >
                Edit Board
              </Button>
              <Button
                onClick={handleNewAnalysis}
                disabled={createChatMutation.isPending}
                data-testid="button-new-analysis"
              >
                {createChatMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    New Analysis
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-8 space-y-8">
            <div className="space-y-4">
              <div className="space-y-2">
                <h2 className="text-sm font-medium text-muted-foreground" data-testid="text-description-label">Description</h2>
                <p className="text-base" data-testid="text-board-description">{board.description || 'No description provided'}</p>
              </div>

              {boardSettings?.analysisPrompts && (
                <div className="space-y-2">
                  <h2 className="text-sm font-medium text-muted-foreground" data-testid="text-config-label">Analysis Configuration</h2>
                  <Card className="p-4 bg-muted/30" data-testid="card-analysis-config">
                    <pre className="text-sm font-mono whitespace-pre-wrap" data-testid="text-analysis-prompts">
                      {boardSettings.analysisPrompts}
                    </pre>
                  </Card>
                </div>
              )}

              {boardSettings?.dataSources && (
                <div className="space-y-2">
                  <h2 className="text-sm font-medium text-muted-foreground" data-testid="text-datasources-label">Data Sources</h2>
                  <div className="flex flex-wrap gap-2" data-testid="container-data-sources">
                    {boardSettings.dataSources.enterprise && (
                      <Card className="px-3 py-1.5 bg-primary/10 border-primary/20" data-testid="badge-datasource-enterprise">
                        <span className="text-sm font-medium">Enterprise Data</span>
                      </Card>
                    )}
                    {boardSettings.dataSources.vault && (
                      <Card className="px-3 py-1.5 bg-primary/10 border-primary/20" data-testid="badge-datasource-vault">
                        <span className="text-sm font-medium">Vault Documents</span>
                      </Card>
                    )}
                    {boardSettings.dataSources.webApis && (
                      <Card className="px-3 py-1.5 bg-primary/10 border-primary/20" data-testid="badge-datasource-web">
                        <span className="text-sm font-medium">Web APIs</span>
                      </Card>
                    )}
                    {boardSettings.dataSources.financialApis && (
                      <Card className="px-3 py-1.5 bg-primary/10 border-primary/20" data-testid="badge-datasource-financial">
                        <span className="text-sm font-medium">Financial APIs</span>
                      </Card>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-foreground" data-testid="text-threads-label">Analysis Threads</h2>
              </div>

              {threadsLoading ? (
                <div className="text-center py-12 text-muted-foreground" data-testid="text-loading-threads">
                  Loading analysis threads...
                </div>
              ) : boardThreads.length === 0 ? (
                <Card className="p-12 text-center" data-testid="card-empty-threads">
                  <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                    <FolderPlus className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2" data-testid="text-empty-title">No analysis threads yet</h3>
                  <p className="text-sm text-muted-foreground mb-4" data-testid="text-empty-description">
                    Start your first analysis with this board's configuration
                  </p>
                  <Button onClick={handleNewAnalysis} disabled={createChatMutation.isPending} data-testid="button-start-first-analysis">
                    {createChatMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Start Analysis
                      </>
                    )}
                  </Button>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {boardThreads.map((chat) => (
                    <Card
                      key={chat.id}
                      className="p-5 space-y-3 hover-elevate cursor-pointer"
                      onClick={() => handleOpenChat(chat.id)}
                      data-testid={`card-thread-${chat.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <MessageSquare className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground truncate" data-testid={`text-thread-title-${chat.id}`}>{chat.title}</h3>
                          <p className="text-xs text-muted-foreground" data-testid={`text-thread-date-${chat.id}`}>
                            {new Date(chat.createdAt).toLocaleDateString()} at{' '}
                            {new Date(chat.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <BoardEditorDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        board={board}
      />
    </div>
  );
}
