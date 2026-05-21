import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Building2,
  Loader2,
  FileText,
  DollarSign,
  Users,
  Plane,
  ShoppingCart,
  HelpCircle,
  X,
  Bot,
  User,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface KioskChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domainId: string;
}

interface KioskMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: any[];
  createdAt: string;
}

interface KioskChat {
  id: string;
  title: string;
  createdAt: string;
}

const QUICK_ACTIONS = [
  { label: "Contract Issue", icon: FileText, query: "I have a contract-related issue" },
  { label: "Price Error", icon: DollarSign, query: "I'm getting a price-related error" },
  { label: "Access Request", icon: Users, query: "How do I get access to billing systems?" },
  { label: "Travel Billing", icon: Plane, query: "How to bill travel expenses?" },
  { label: "Purchase Billing", icon: ShoppingCart, query: "How to bill purchase actuals?" },
  { label: "Other Query", icon: HelpCircle, query: "I have a general billing question" },
];

export function KioskChatDialog({ open, onOpenChange, domainId }: KioskChatDialogProps) {
  const { toast } = useToast();
  const [inputValue, setInputValue] = useState("");
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading: messagesLoading } = useQuery<KioskMessage[]>({
    queryKey: ["/api/kiosk/messages", activeChatId],
    enabled: !!activeChatId,
  });

  const createChatMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/kiosk/chats", { domainId }) as Response;
      return response.json();
    },
    onSuccess: (chat: KioskChat) => {
      setActiveChatId(chat.id);
      queryClient.invalidateQueries({ queryKey: ["/api/kiosk/chats"] });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      let chatId = activeChatId;
      
      if (!chatId) {
        const response = await apiRequest("POST", "/api/kiosk/chats", { domainId }) as Response;
        const chat: KioskChat = await response.json();
        chatId = chat.id;
        setActiveChatId(chatId);
      }

      setIsStreaming(true);
      setStreamingContent("");

      const response = await fetch("/api/kiosk/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ chatId, message, domainId }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          fullContent += chunk;
          setStreamingContent(fullContent);
        }
      } finally {
        setIsStreaming(false);
        setStreamingContent("");
        queryClient.invalidateQueries({ queryKey: ["/api/kiosk/messages", chatId] });
      }

      return fullContent;
    },
    onError: (error: any) => {
      setIsStreaming(false);
      setStreamingContent("");
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  useEffect(() => {
    if (!open) {
      setActiveChatId(null);
      setInputValue("");
      setStreamingContent("");
      setIsStreaming(false);
    }
  }, [open]);

  const handleSend = () => {
    if (!inputValue.trim() || sendMessageMutation.isPending || isStreaming) return;
    const message = inputValue.trim();
    setInputValue("");
    sendMessageMutation.mutate(message);
  };

  const handleQuickAction = (query: string) => {
    setInputValue(query);
    sendMessageMutation.mutate(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const allMessages = [...messages];
  if (sendMessageMutation.isPending && sendMessageMutation.variables) {
    allMessages.push({
      id: "pending-user",
      role: "user",
      content: sendMessageMutation.variables,
      createdAt: new Date().toISOString(),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0" data-testid="dialog-kiosk-chat">
        <DialogHeader className="px-6 py-4 border-b bg-blue-50 dark:bg-blue-950/50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold" data-testid="text-kiosk-dialog-title">
                  Billing Kiosk
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  NON-MCR Billing Assistant
                </p>
              </div>
            </div>
            <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-300">
              Bosch Internal
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1 px-6 py-4" ref={scrollRef}>
            {allMessages.length === 0 && !isStreaming ? (
              <div className="space-y-6">
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mx-auto mb-4">
                    <Bot className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2" data-testid="text-kiosk-welcome">
                    Welcome to Billing Kiosk
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    I can help you with NON-MCR billing queries. Ask me about contracts, 
                    pricing, travel billing, purchase actuals, and more.
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground text-center">
                    Quick Actions
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {QUICK_ACTIONS.map((action, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        className="h-auto py-3 px-4 justify-start gap-2 hover-elevate"
                        onClick={() => handleQuickAction(action.query)}
                        disabled={sendMessageMutation.isPending || isStreaming}
                        data-testid={`button-quick-action-${index}`}
                      >
                        <action.icon className="w-4 h-4 text-blue-600" />
                        <span className="text-sm">{action.label}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {allMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex gap-3",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                    data-testid={`message-${msg.id}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg px-4 py-3",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/50">
                          <p className="text-xs text-muted-foreground mb-1">Sources:</p>
                          <div className="flex flex-wrap gap-1">
                            {msg.sources.map((source: any, idx: number) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {source.title || `FAQ #${idx + 1}`}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {msg.role === "user" && (
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                ))}

                {isStreaming && streamingContent && (
                  <div className="flex gap-3 justify-start">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="max-w-[80%] rounded-lg px-4 py-3 bg-muted">
                      <div className="text-sm whitespace-pre-wrap">{streamingContent}</div>
                    </div>
                  </div>
                )}

                {isStreaming && !streamingContent && (
                  <div className="flex gap-3 justify-start">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="rounded-lg px-4 py-3 bg-muted">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <div className="px-6 py-4 border-t flex-shrink-0">
            <div className="flex gap-2">
              <Input
                placeholder="Ask about billing, contracts, pricing..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sendMessageMutation.isPending || isStreaming}
                className="flex-1"
                data-testid="input-kiosk-message"
              />
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim() || sendMessageMutation.isPending || isStreaming}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="button-send-kiosk-message"
              >
                {sendMessageMutation.isPending || isStreaming ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
