import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Send,
  ArrowLeft,
  FileText,
  Paperclip,
  RefreshCw,
  Sparkles,
  X,
  Upload,
  CheckCircle2,
  Clock,
  XCircle,
  Share2,
  Info,
  Database,
  Image,
  Folder,
  Code,
  CheckSquare,
  PenTool,
  DollarSign,
  BarChart3,
  MessageSquare,
  Palette,
  TrendingUp,
  FileDown,
  Link2,
  FolderOpen,
  Layers,
  Square,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuthUser } from "@/lib/auth";
import type { Chat, Message, Document } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { parseCitations } from "@/lib/citations";
import { DataSourcesPanel } from "@/components/DataSourcesPanel";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseCharts } from "@/lib/chartParser";
import { ChartRenderer } from "@/components/ChartRenderer";
import { InteractiveDataTable } from "@/components/InteractiveDataTable";
import { exportChatToPDF, exportChatToWord } from "@/lib/chatExport";
import { preprocessMarkdown } from "@/lib/markdownPreprocessor";
import html2canvas from 'html2canvas';

function getHastText(node: any): string {
  if (!node) return "";
  if (node.type === "text") return node.value || "";
  if (Array.isArray(node.children)) return node.children.map(getHastText).join("");
  return "";
}

function extractTableData(node: any): { headers: string[]; rows: string[][] } {
  const headers: string[] = [];
  const rows: string[][] = [];
  for (const section of node.children || []) {
    if (section.tagName === "thead") {
      for (const tr of section.children || []) {
        if (tr.tagName === "tr") {
          for (const th of tr.children || []) {
            if (th.tagName === "th") headers.push(getHastText(th).trim());
          }
        }
      }
    } else if (section.tagName === "tbody") {
      for (const tr of section.children || []) {
        if (tr.tagName === "tr") {
          const row: string[] = [];
          for (const td of tr.children || []) {
            if (td.tagName === "td") row.push(getHastText(td).trim());
          }
          if (row.length > 0) {
            // Skip TOTAL summary rows (auto-appended by the backend pivot builder)
            // so they don't appear as a data row alongside the InteractiveDataTable grand total
            const firstCellNorm = (row[0] ?? "").replace(/\*/g, "").trim().toLowerCase();
            if (firstCellNorm === "total") continue;
            rows.push(row);
          }
        }
      }
    }
  }
  return { headers, rows };
}

const FALLBACK_QUESTIONS = [
  "Show me the same data for February 2025",
  "Which entity performed best?",
  "What changed between January and February?",
  "Summarize the key takeaways",
];

function generateContextualFollowUps(
  messages: Array<{ role: string; content: string }>,
): string[] {
  try {
    const lastUserMsg =
      [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const lastAiMsg =
      [...messages].reverse().find((m) => m.role === "assistant")?.content ?? "";
    const combined = (lastUserMsg + " " + lastAiMsg).toLowerCase();

    // Extract entity names (e.g. BGSW, BGSV, BGSW/NE-MX, BGSW (India))
    const rawEntities =
      (lastAiMsg + " " + lastUserMsg).match(
        /BGS[A-Z][A-Z0-9/\-]*(?:\s*\([^)]+\))?/gi,
      ) ?? [];
    const entities = [...new Set(rawEntities.map((e) => e.trim()))].slice(0, 3);
    const entityA = entities[0] ?? "BGSW (India)";
    const entityB = entities[1] ?? "BGSV (Vietnam)";

    // Detect current month and derive the next one
    const monthMap: Record<string, string> = {
      january: "February",
      february: "March",
      march: "April",
      april: "May",
      may: "June",
      june: "July",
      july: "August",
      august: "September",
      september: "October",
      october: "November",
      november: "December",
      december: "January",
    };
    const monthFound = Object.keys(monthMap).find((m) => combined.includes(m));
    const currentMonth = monthFound
      ? monthFound.charAt(0).toUpperCase() + monthFound.slice(1)
      : "January";
    const nextMonth = monthFound ? monthMap[monthFound] : "February";

    // Topic detection
    const isGbPnl =
      /gb p&l|gb p\.l|cost summary|sub.cost.category|cost breakdown|highest cost|which.*cost|cost.*entity/i.test(
        combined,
      );
    const isRevenue =
      /revenue summary|revenue.*entity|entity.*revenue|revenue.*month|billing summary/i.test(
        combined,
      );
    const isBilling =
      /billing utilization|billed capacity|onsite|offshore|utilization/i.test(
        combined,
      );
    const isHeadcount =
      /headcount|head count|employee count|employees|workforce/i.test(combined);
    const isEntityPnl =
      /entity p&l|entity p\.l|ebit|entity.*profit|profit.*entity/i.test(
        combined,
      );
    const isAttrition =
      /attrition|attrition pipeline|exit|resignation|turnover/i.test(combined);

    if (isGbPnl) {
      return [
        `Show me the same breakdown for ${nextMonth} 2025`,
        entities.length >= 2
          ? `Compare ${entityA} vs ${entityB} costs in ${currentMonth}`
          : `Which entity had the highest cost in ${nextMonth}?`,
        `What is the YTD cost total across all entities?`,
        `Which sub-cost category had the largest share in ${currentMonth}?`,
      ];
    }

    if (isRevenue) {
      return [
        `What is the revenue for ${nextMonth} 2025?`,
        entities.length >= 1
          ? `Show ${entityA} revenue vs cost for ${currentMonth}`
          : `Show revenue vs cost comparison for ${currentMonth}`,
        `Which entity had the highest revenue in ${currentMonth}?`,
        `What is the YTD revenue across all entities?`,
      ];
    }

    if (isBilling) {
      return [
        `What is the billed capacity for ${nextMonth} 2025?`,
        entities.length >= 1
          ? `Compare onsite vs offshore billing for ${entityA}`
          : `Compare onsite vs offshore billing for all entities`,
        `Which resource type has the highest utilization in ${currentMonth}?`,
        `Show unbilled capacity breakdown for ${currentMonth}`,
      ];
    }

    if (isHeadcount) {
      return [
        `Show headcount trend from ${currentMonth} to ${nextMonth} 2025`,
        entities.length >= 2
          ? `Compare headcount for ${entityA} vs ${entityB}`
          : `Which entity has the highest headcount?`,
        `What is the headcount breakdown by salary level?`,
        `Compare onsite vs offshore headcount for ${currentMonth}`,
      ];
    }

    if (isEntityPnl) {
      return [
        entities.length >= 1
          ? `Drill down into ${entityA} cost details for ${currentMonth}`
          : `Drill down into the top entity cost details`,
        `What is the EBIT for ${currentMonth} across all entities?`,
        entities.length >= 2
          ? `Compare ${entityA} vs ${entityB} P&L`
          : `Compare P&L across all entities`,
        `Show entity P&L trend from ${currentMonth} to ${nextMonth}`,
      ];
    }

    if (isAttrition) {
      return [
        `Which entity has the highest attrition risk?`,
        `Show attrition pipeline by salary level`,
        `Compare pipeline headcount vs actual headcount`,
        `Which month had the most exits?`,
      ];
    }

    // Generic fallback with extracted context
    return [
      `Show me the same data for ${nextMonth} 2025`,
      entities.length >= 1
        ? `Which entity performed best in ${currentMonth}?`
        : `Which entity performed best?`,
      `What changed between ${currentMonth} and ${nextMonth}?`,
      `Summarize the key takeaways`,
    ];
  } catch {
    return FALLBACK_QUESTIONS;
  }
}

interface ProcessingStatus {
  status: string;
  total_chunks?: number;
  processed_chunks?: number;
  company_name?: string;
  error_message?: string;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1" data-testid="typing-indicator">
      <div
        className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce"
        style={{ animationDelay: "0ms" }}
      />
      <div
        className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce"
        style={{ animationDelay: "150ms" }}
      />
      <div
        className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce"
        style={{ animationDelay: "300ms" }}
      />
    </div>
  );
}

function AnalysisProgress() {
  return (
    <div
      className="bg-accent/50 border-t border-accent px-4 py-2 flex items-center gap-2"
      data-testid="analysis-progress"
    >
      <Sparkles className="w-4 h-4 text-primary animate-pulse" />
      <span className="text-sm font-medium">Analysis in progress...</span>
    </div>
  );
}

export default function ChatDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [input, setInput] = useState("");
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);
  const [isDataSourcesOpen, setIsDataSourcesOpen] = useState(false);
  
  // Streaming state
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const streamControllerRef = useRef<AbortController | null>(null);

  // Get current auth user reactively - updates on login/logout
  const currentUser = useAuthUser();
  const firstName = currentUser?.displayName?.split(" ")[0] || "there";

  // Auto-open data sources panel if URL param is present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("openDataSources") === "true") {
      setIsDataSourcesOpen(true);
      // Clean up URL parameter
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  const { data: chat, isLoading: chatLoading } = useQuery<Chat>({
    queryKey: ["/api/chats", id],
    enabled: !!id,
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery<
    Message[]
  >({
    queryKey: ["/api/chats", id, "messages"],
    enabled: !!id,
  });

  const { data: chatDocuments = [] } = useQuery<Document[]>({
    queryKey: ["/api/chats", id, "documents"],
    enabled: !!id,
  });

  const { data: documentStatuses } = useQuery<Record<string, ProcessingStatus>>(
    {
      queryKey: ["/api/documents/statuses", chatDocuments.map((d) => d.id)],
      enabled: chatDocuments.length > 0 && !!currentUser,
      queryFn: async () => {
        if (!currentUser) return {};

        const statuses: Record<string, ProcessingStatus> = {};
        await Promise.all(
          chatDocuments.map(async (doc) => {
            try {
              const response = await fetch(`/api/documents/${doc.id}/status`, {
                headers: {
                  "x-user-id": currentUser.id,
                },
              });
              if (response.ok) {
                statuses[doc.id] = await response.json();
              }
            } catch (error) {
              console.error(`Failed to fetch status for ${doc.id}:`, error);
            }
          }),
        );
        return statuses;
      },
      refetchInterval: (data) => {
        // Keep polling if any document is still processing
        const hasProcessing =
          data &&
          Object.values(data).some(
            (s) => s.status === "processing" || s.status === "pending",
          );
        return hasProcessing ? 5000 : false;
      },
    },
  );

  // Check if any documents are still processing (prevents sending questions before doc is ready)
  const hasProcessingDocuments = documentStatuses && Object.values(documentStatuses).some(
    (s) => s.status === "processing" || s.status === "pending"
  );

  // Stop the current streaming generation
  const stopGeneration = () => {
    streamControllerRef.current?.abort();
    streamControllerRef.current = null;
    setIsStreaming(false);
    setStreamingContent("");
    setStreamingMessageId(null);
    // Sync messages with DB (removes any unsaved optimistic state)
    queryClient.invalidateQueries({ queryKey: ["/api/chats", id, "messages"] });
  };

  // Streaming message function - sends message and streams AI response
  const sendStreamingMessage = async (content: string) => {
    if (!currentUser || !id) return;
    
    setIsStreaming(true);
    setStreamingContent("");
    
    // Create a fresh AbortController for this request
    const controller = new AbortController();
    streamControllerRef.current = controller;

    // Optimistically add user message
    const tempUserMsgId = `temp-user-${Date.now()}`;
    queryClient.setQueryData(
      ["/api/chats", id, "messages"],
      (old: Message[] = []) => [
        ...old,
        {
          id: tempUserMsgId,
          chatId: id,
          content,
          role: "user",
          metadata: null,
          createdAt: new Date(),
        } as Message,
      ],
    );
    
    try {
      const response = await fetch(`/api/chats/${id}/messages/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": currentUser.id,
        },
        body: JSON.stringify({ content, role: "user" }),
        signal: controller.signal,
      });
      
      if (!response.ok) {
        throw new Error("Failed to send message");
      }
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }
      
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              
              switch (data.type) {
                case "user_message":
                  // Replace temp user message with real one
                  queryClient.setQueryData(
                    ["/api/chats", id, "messages"],
                    (old: Message[] = []) => old.map(m => 
                      m.id === tempUserMsgId ? data.message : m
                    ),
                  );
                  break;
                  
                case "stream_start":
                  setStreamingMessageId(`streaming-${Date.now()}`);
                  break;
                  
                case "chunk":
                  fullContent += data.content;
                  setStreamingContent(fullContent);
                  break;
                  
                case "complete":
                  // Add final message to cache immediately (no refetch delay)
                  queryClient.setQueryData(
                    ["/api/chats", id, "messages"],
                    (old: Message[] = []) => [...old, data.message],
                  );
                  // Clear streaming state AFTER adding message to prevent flash
                  setIsStreaming(false);
                  setStreamingContent("");
                  setStreamingMessageId(null);
                  break;
                  
                case "error":
                  if (data.message) {
                    queryClient.setQueryData(
                      ["/api/chats", id, "messages"],
                      (old: Message[] = []) => [...old, data.message],
                    );
                  }
                  setIsStreaming(false);
                  setStreamingContent("");
                  setStreamingMessageId(null);
                  break;
                  
                case "done":
                  // Ensure streaming state is cleared (safety net for edge cases)
                  setIsStreaming(false);
                  setStreamingContent("");
                  setStreamingMessageId(null);
                  // Only refetch chat list (for sidebar update), not messages
                  queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
                  break;
              }
            } catch (e) {
              console.error("Failed to parse SSE data:", e);
            }
          }
        }
      }
      
      // Safety net: ensure streaming is always cleaned up after loop exits
      // This handles cases where stream ends without proper done/complete event
      setIsStreaming(false);
      setStreamingContent("");
      setStreamingMessageId(null);
      streamControllerRef.current = null;
      
    } catch (error: any) {
      // User clicked Stop — clean up silently without showing an error
      if (error?.name === 'AbortError') {
        setIsStreaming(false);
        setStreamingContent("");
        setStreamingMessageId(null);
        streamControllerRef.current = null;
        queryClient.invalidateQueries({ queryKey: ["/api/chats", id, "messages"] });
        return;
      }

      console.error("Streaming error:", error);
      setIsStreaming(false);
      setStreamingContent("");
      setStreamingMessageId(null);
      streamControllerRef.current = null;
      
      // Rollback optimistic update and refetch to get actual state
      queryClient.invalidateQueries({
        queryKey: ["/api/chats", id, "messages"],
      });
      queryClient.refetchQueries({
        queryKey: ["/api/chats", id, "messages"],
      });
      
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // Legacy mutation for backwards compatibility (not used for streaming)
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", `/api/chats/${id}/messages`, {
        content,
        role: "user",
      });
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/chats", id, "messages"] });
      queryClient.refetchQueries({ queryKey: ["/api/chats"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!currentUser) {
        throw new Error("Please sign in to upload files");
      }

      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch("/api/documents", {
        method: "POST",
        headers: {
          "x-user-id": currentUser.id,
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file");
      }

      const document = await uploadResponse.json();

      // Associate with chat
      await apiRequest("POST", `/api/chats/${id}/documents`, {
        documentId: document.id,
      });

      // Trigger processing
      await fetch(`/api/documents/${document.id}/process`, {
        method: "POST",
        headers: {
          "x-user-id": currentUser.id,
        },
      });

      return document;
    },
    onSuccess: (document) => {
      queryClient.refetchQueries({ queryKey: ["/api/chats", id, "documents"] });
      toast({
        title: "Document uploaded",
        description: `${document.name} is being processed and will be ready for analysis soon.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description:
          error instanceof Error ? error.message : "Failed to upload file",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming, streamingContent]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Block submission if: no input, already streaming, or documents still processing
    if (!input.trim() || isStreaming || hasProcessingDocuments) return;

    const messageContent = input.trim();
    setInput(""); // Clear immediately for better UX
    sendStreamingMessage(messageContent);
  };

  const handleSuggestedQuestion = (question: string) => {
    // Block if streaming or documents still processing
    if (isStreaming || hasProcessingDocuments) return;
    setInput(""); // Clear input for consistency
    sendStreamingMessage(question);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Add all files to uploading state
    const fileNames = Array.from(files).map((f) => f.name);
    setUploadingFiles((prev) => [...prev, ...fileNames]);

    // Upload all files in parallel
    const uploadPromises = Array.from(files).map(async (file) => {
      try {
        await uploadFileMutation.mutateAsync(file);
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
      } finally {
        setUploadingFiles((prev) => prev.filter((name) => name !== file.name));
      }
    });

    await Promise.all(uploadPromises);

    // Clear the input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCopyLink = () => {
    const chatUrl = `${window.location.origin}/chat/${id}`;
    navigator.clipboard.writeText(chatUrl);
    toast({
      title: "Link copied",
      description: "Chat link copied to clipboard",
    });
  };

  const handleExportPDF = async () => {
    if (!chat || messages.length === 0) {
      toast({
        title: "Cannot export",
        description: "No messages to export",
        variant: "destructive",
      });
      return;
    }

    try {
      // Capture chart images from the rendered DOM before generating PDF
      const chartImages = new Map<string, string[]>();
      const chartContainers = document.querySelectorAll<HTMLDivElement>('[data-pdf-charts]');
      for (const container of chartContainers) {
        const msgId = container.getAttribute('data-pdf-charts');
        if (!msgId) continue;
        try {
          const canvas = await html2canvas(container, {
            scale: 1.5,
            backgroundColor: '#ffffff',
            logging: false,
            useCORS: true,
          });
          chartImages.set(msgId, [canvas.toDataURL('image/png')]);
        } catch {
          // Skip chart if capture fails — don't block the rest of the PDF
        }
      }

      await exportChatToPDF({
        chatTitle: chat.title,
        messages: messages,
        chartImages,
      });
      toast({
        title: "PDF exported",
        description: "Your chat has been exported as PDF",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export chat as PDF",
        variant: "destructive",
      });
    }
  };

  const handleExportWord = async () => {
    if (!chat || messages.length === 0) {
      toast({
        title: "Cannot export",
        description: "No messages to export",
        variant: "destructive",
      });
      return;
    }

    try {
      await exportChatToWord({
        chatTitle: chat.title,
        messages: messages,
      });
      toast({
        title: "Word document exported",
        description: "Your chat has been exported as Word document",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export chat as Word document",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (documentId: string) => {
    const status = documentStatuses?.[documentId];
    if (!status) return null;

    switch (status.status) {
      case "pending":
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="w-3 h-3" />
            Pending
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="secondary" className="gap-1">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Processing {status.processed_chunks}/{status.total_chunks || "?"}
          </Badge>
        );
      case "completed":
        return (
          <Badge className="gap-1 bg-primary/10 text-primary hover:bg-primary/20">
            <CheckCircle2 className="w-3 h-3" />
            Ready: {status.total_chunks || 0} chunks
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="w-3 h-3" />
            Failed
          </Badge>
        );
      default:
        return null;
    }
  };

  if (chatLoading || messagesLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading conversation...</div>
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-muted-foreground">Chat not found</div>
        <Button
          onClick={() => setLocation("/dashboard")}
          data-testid="button-back-dashboard"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const showSuggestedQuestions =
    messages.length === 0 ||
    (messages.length > 0 &&
      messages[messages.length - 1]?.role === "assistant");

  return (
    <div className="h-full flex flex-col overflow-hidden bg-accent">
      {/* Main content area with white background */}
      <div className="flex-1 overflow-hidden p-6">
        <div className="h-full bg-[#F9FAFB] rounded-2xl overflow-hidden flex">
          <div className="flex flex-col flex-1 min-w-0">
            {/* Header inside white box */}
            <div className="px-6 lg:px-10 py-3.5 flex items-center justify-between gap-3 bg-primary/40">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-2xl bg-primary flex items-center justify-center flex-shrink-0">
                  <img
                    src="/Images - Logo/PNGs/120px.png"
                    alt="LedgerLM Logo"
                    className="h-8 w-9"
                  />
                </div>
                <h1
                  className="text-base font-medium"
                  data-testid="text-chat-title"
                >
                  {chat.title}
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 bg-white"
                  onClick={handleExportPDF}
                  disabled={messages.length === 0}
                  data-testid="button-export-pdf"
                >
                  <FileDown className="w-4 h-4" />
                  PDF
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      data-testid="button-share"
                    >
                      <Share2 className="w-5 h-5 text-primary" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      onClick={() =>
                        toast({
                          title: "Coming soon",
                          description: "Share thread feature coming soon!",
                        })
                      }
                      data-testid="menu-share-thread"
                    >
                      <Share2 className="w-4 h-4 mr-2" />
                      Share Thread
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleCopyLink}
                      data-testid="menu-copy-link"
                    >
                      <Link2 className="w-4 h-4 mr-2" />
                      Copy Link
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleExportPDF}
                      disabled={messages.length === 0}
                      data-testid="menu-download-pdf"
                    >
                      <FileDown className="w-4 h-4 mr-2" />
                      Download as PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="ghost" size="icon" data-testid="button-info">
                  <Info className="w-5 h-5 text-primary" />
                </Button>

                {/* <Button
                  variant="outline"
                  className="gap-2 bg-white"
                  size="sm"
                  data-testid="button-data-sources"
                >
                  Data Sources
                  <Badge variant="secondary" className="ml-1">
                    3
                  </Badge>
                </Button> */}
                <Button
                  variant={isDataSourcesOpen ? "secondary" : "outline"}
                  onClick={() => setIsDataSourcesOpen(!isDataSourcesOpen)}
                  className="gap-2 bg-white"
                  size="sm"
                  data-testid="button-data-sources"
                >
                  Data Sources
                  <Badge variant="secondary" className="ml-1">
                    {chatDocuments.length}
                  </Badge>
                </Button>
              </div>
            </div>

            {/* Attached Documents Section */}
            {chatDocuments.length > 0 && (
              <div className="bg-accent/30 px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    Attached Documents ({chatDocuments.length})
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {chatDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-2 bg-card rounded-md px-3 py-2 border"
                    >
                      <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="text-sm font-medium truncate max-w-[200px]">
                        {doc.name}
                      </span>
                      {getStatusBadge(doc.id)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-6 max-w-3xl mx-auto">
                  <div className="text-center">
                    <h2 className="text-3xl font-bold mb-2">Hi {firstName}!</h2>
                    <p className="text-muted-foreground">
                      What financial analysis do you want to run today?
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                    <div
                      className="border rounded-lg p-4 hover-elevate cursor-pointer"
                      onClick={() =>
                        handleSuggestedQuestion("Generate a quick summary")
                      }
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                        <Sparkles className="w-5 h-5 text-primary" />
                      </div>
                      <h3 className="font-semibold mb-1">
                        Generate a quick summary
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Condenses lengthy financial documents into clear and
                        actionable insights.
                      </p>
                    </div>

                    <div
                      className="border rounded-lg p-4 hover-elevate cursor-pointer"
                      onClick={() =>
                        handleSuggestedQuestion(
                          "Develop context-aware insights",
                        )
                      }
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                        <Sparkles className="w-5 h-5 text-primary" />
                      </div>
                      <h3 className="font-semibold mb-1">
                        Develop context-aware insights
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Ask finance questions in plain English and get precise
                        answers instantly.
                      </p>
                    </div>

                    <div
                      className="border rounded-lg p-4 hover-elevate cursor-pointer"
                      onClick={() =>
                        handleSuggestedQuestion(
                          "Simulate using our Goal seeking AI",
                        )
                      }
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                        <Sparkles className="w-5 h-5 text-primary" />
                      </div>
                      <h3 className="font-semibold mb-1">
                        Simulate using our Goal seeking AI
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Not just reporting what happened but simulating what
                        needs to change to hit a target.
                      </p>
                    </div>
                  </div>

                  <div className="w-full">
                    <p className="text-center text-sm text-muted-foreground mb-3">
                      You can also try asking:
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {[
                        "Identify and analyze risk indicators",
                        "Compare year-over-year profits",
                        "Highlight cash flow insights",
                        "Analyze expense breakdown",
                      ].map((question, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="cursor-pointer hover-elevate px-3 py-1.5"
                          onClick={() => handleSuggestedQuestion(question)}
                        >
                          {question}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((message, index) => (
                    <div key={message.id}>
                      <div
                        className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        {message.role === "assistant" ? (
                          <div className="flex gap-3 max-w-[75%]">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                              <img
                                src="/Images - Logo/PNGs/120px.png"
                                alt="LedgerLM Logo"
                                className="h-7 w-7"
                              />
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-foreground">
                                  Analysis Assistant
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(
                                    new Date(message.createdAt),
                                    { addSuffix: true },
                                  )}
                                </span>
                              </div>
                              <div className="rounded-xl p-5 w-full">
                                <div
                                  className="text-sm markdown-content"
                                  data-testid={`text-message-content-${message.id}`}
                                >
                                  {(() => {
                                    const metadata = message.metadata as {
                                      citations?: string[];
                                      tableData?: { headers: string[]; rows: string[][] };
                                    } | null;
                                    const citationsArray =
                                      metadata?.citations || [];

                                    const { textContent, charts } = parseCharts(
                                      message.content,
                                    );
                                    const parsed = parseCitations(
                                      textContent,
                                      citationsArray,
                                    );

                                    const preprocessedContent =
                                      preprocessMarkdown(
                                        parsed.formattedContent,
                                      );

                                    // When a structured InteractiveDataTable is already
                                    // being rendered from metadata.tableData, suppress any
                                    // markdown tables the AI outputs in its response text
                                    // (those are duplicates — raw comparison data the AI
                                    // reproduced from its context).
                                    const hasMetaTableEarly =
                                      !!metadata?.tableData &&
                                      metadata.tableData.headers.length > 0 &&
                                      metadata.tableData.rows.length > 0;

                                    // Shared markdown component map for both splits
                                    const mdComponents = {
                                      table: ({ node }: any) => {
                                        // Suppress AI-reproduced tables when the proper
                                        // interactive table is already rendered separately.
                                        if (hasMetaTableEarly) return null;
                                        const { headers, rows } = extractTableData(node);
                                        if (headers.length > 0 && rows.length > 0) {
                                          return (
                                            <InteractiveDataTable
                                              headers={headers}
                                              rows={rows}
                                            />
                                          );
                                        }
                                        return (
                                          <div className="my-4 overflow-x-auto">
                                            <table className="w-full border-collapse" />
                                          </div>
                                        );
                                      },
                                      h1: ({ node, ...props }: any) => (
                                        <h1 className="text-xl font-bold mt-6 mb-3" {...props} />
                                      ),
                                      h2: ({ node, ...props }: any) => (
                                        <h2 className="text-lg font-semibold mt-5 mb-2" {...props} />
                                      ),
                                      h3: ({ node, ...props }: any) => (
                                        <h3 className="text-base font-semibold mt-4 mb-2" {...props} />
                                      ),
                                      ul: ({ node, ...props }: any) => (
                                        <ul className="list-disc list-outside my-3 space-y-2 pl-6" {...props} />
                                      ),
                                      ol: ({ node, ...props }: any) => (
                                        <ol className="list-decimal list-outside my-3 space-y-2 pl-6" {...props} />
                                      ),
                                      li: ({ node, ...props }: any) => (
                                        <li className="pl-1 leading-relaxed" {...props} />
                                      ),
                                      p: ({ node, ...props }: any) => (
                                        <p className="my-3 leading-relaxed" {...props} />
                                      ),
                                      strong: ({ node, ...props }: any) => (
                                        <strong className="font-semibold" {...props} />
                                      ),
                                      code: ({ node, className, children, ...props }: any) => {
                                        const isInline = !className;
                                        return isInline ? (
                                          <code className="bg-accent/50 px-1.5 py-0.5 rounded text-sm" {...props}>
                                            {children}
                                          </code>
                                        ) : (
                                          <code className="block bg-accent/50 p-3 rounded my-2 overflow-x-auto" {...props}>
                                            {children}
                                          </code>
                                        );
                                      },
                                    };

                                    // ── Table injection logic ──────────────────────────────
                                    // Detect the placeholder the server embeds where the
                                    // Detailed Analysis table should appear.  Split the
                                    // markdown there and render the metadata table inline so
                                    // it appears between Key Findings and Key Observations,
                                    // NOT after the chart.
                                    const PLACEHOLDER = "[Full data table attached";
                                    const hasMetaTable =
                                      !!metadata?.tableData &&
                                      metadata.tableData.headers.length > 0 &&
                                      metadata.tableData.rows.length > 0;

                                    const placeholderIdx = hasMetaTable
                                      ? preprocessedContent.indexOf(PLACEHOLDER)
                                      : -1;

                                    let beforeContent = preprocessedContent;
                                    let afterContent = "";
                                    let splitFound = false;

                                    if (placeholderIdx !== -1) {
                                      const sectionHeading = "### Detailed Analysis";
                                      const sectionStart = preprocessedContent.lastIndexOf(
                                        sectionHeading,
                                        placeholderIdx,
                                      );
                                      const lineEnd = preprocessedContent.indexOf(
                                        "\n",
                                        placeholderIdx,
                                      );
                                      beforeContent = (
                                        sectionStart > 0
                                          ? preprocessedContent.substring(0, sectionStart)
                                          : preprocessedContent.substring(0, placeholderIdx)
                                      ).trimEnd();
                                      afterContent =
                                        lineEnd > 0
                                          ? preprocessedContent.substring(lineEnd + 1).trimStart()
                                          : "";
                                      splitFound = true;
                                    }
                                    // ── End table injection logic ──────────────────────────

                                    return (
                                      <>
                                        {/* Part 1 — Summary + Key Findings (before table) */}
                                        <ReactMarkdown
                                          remarkPlugins={[remarkGfm]}
                                          components={mdComponents}
                                        >
                                          {splitFound ? beforeContent : preprocessedContent}
                                        </ReactMarkdown>

                                        {/* Detailed Analysis table — inline at correct position */}
                                        {splitFound && hasMetaTable && (
                                          <div className="mt-4">
                                            <h3 className="text-base font-semibold mt-4 mb-2">Detailed Analysis</h3>
                                            <InteractiveDataTable
                                              headers={metadata!.tableData!.headers}
                                              rows={metadata!.tableData!.rows}
                                            />
                                          </div>
                                        )}

                                        {/* Part 2 — Key Observations (after table) */}
                                        {splitFound && afterContent && (
                                          <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={mdComponents}
                                          >
                                            {afterContent}
                                          </ReactMarkdown>
                                        )}

                                        {/* Charts */}
                                        {charts.length > 0 && (
                                          <div className="mt-4" data-pdf-charts={String(message.id)}>
                                            {charts.map((chart, chartIndex) => (
                                              <ChartRenderer
                                                key={chartIndex}
                                                spec={chart}
                                              />
                                            ))}
                                          </div>
                                        )}

                                        {parsed.citations.length > 0 && (
                                          <div className="mt-4 pt-3 border-t border-border/50">
                                            <div className="text-xs font-medium text-muted-foreground mb-2">
                                              Sources:
                                            </div>
                                            <div className="space-y-1">
                                              {parsed.citations.map(
                                                (citation) => (
                                                  <div
                                                    key={citation.id}
                                                    className="text-xs text-muted-foreground flex gap-1.5"
                                                  >
                                                    <span className="font-medium">
                                                      {citation.displayNumber}.
                                                    </span>
                                                    <span className="break-all">
                                                      {citation.label}
                                                    </span>
                                                  </div>
                                                ),
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-3 max-w-[75%]">
                            <div className="flex flex-col gap-1.5 w-full">
                              <div className="flex items-center gap-2 justify-end">
                                <span className="text-sm font-semibold text-foreground">
                                  {firstName} (You)
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(
                                    new Date(message.createdAt),
                                    { addSuffix: true },
                                  )}
                                </span>
                              </div>
                              <div className="bg-primary/10 rounded-xl p-5 w-full shadow-sm">
                                <div
                                  className="text-sm whitespace-pre-wrap text-foreground leading-relaxed"
                                  data-testid={`text-message-content-${message.id}`}
                                >
                                  {message.content}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {message.role === "assistant" &&
                        index === messages.length - 1 &&
                        showSuggestedQuestions &&
                        !isStreaming && (
                          <div className="flex gap-2 mt-6 ml-11 flex-wrap">
                            {generateContextualFollowUps(messages).map(
                              (question, qIndex) => (
                                <Badge
                                  key={qIndex}
                                  variant="outline"
                                  className="cursor-pointer hover-elevate px-3 py-1.5"
                                  onClick={() =>
                                    handleSuggestedQuestion(question)
                                  }
                                  data-testid={`badge-suggested-followup-${qIndex}`}
                                >
                                  {question}
                                </Badge>
                              ),
                            )}
                          </div>
                        )}
                    </div>
                  ))}
                  {/* Streaming AI response - shows text as it's generated */}
                  {isStreaming && (
                    <div className="flex justify-start">
                      <div className="flex gap-3 max-w-[75%]">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                          <img
                            src="/Images - Logo/PNGs/120px.png"
                            alt="LedgerLM Logo"
                            className="h-7 w-7"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5 w-full">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">
                              Analysis Assistant
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date().toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <div className="rounded-xl p-5 shadow-sm min-h-[60px]">
                            {streamingContent ? (
                              <div className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed">
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    h3: ({ children }) => (
                                      <h3 className="text-base font-semibold text-foreground mt-4 mb-2 first:mt-0">{children}</h3>
                                    ),
                                    p: ({ children }) => (
                                      <p className="mb-3 last:mb-0 text-sm leading-relaxed">{children}</p>
                                    ),
                                    ul: ({ children }) => (
                                      <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>
                                    ),
                                    li: ({ children }) => (
                                      <li className="text-sm">{children}</li>
                                    ),
                                    strong: ({ children }) => (
                                      <strong className="font-semibold text-foreground">{children}</strong>
                                    ),
                                  }}
                                >
                                  {streamingContent}
                                </ReactMarkdown>
                                <span className="inline-block w-2 h-4 bg-primary/60 animate-pulse ml-0.5" />
                              </div>
                            ) : (
                              <TypingIndicator />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            {isStreaming && !streamingContent && <AnalysisProgress />}

            {/* Uploading Files Indicator */}
            {uploadingFiles.length > 0 && (
              <div className="border-t bg-accent/30 px-4 py-3">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4 animate-pulse text-primary" />
                    <span className="text-sm font-medium">
                      Uploading {uploadingFiles.length}{" "}
                      {uploadingFiles.length === 1 ? "file" : "files"}...
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {uploadingFiles.map((fileName, idx) => (
                      <Badge key={idx} variant="secondary" className="gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        {fileName}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="border-t p-4 bg-white">
              <form onSubmit={handleSubmit}>
                <div className="flex items-center gap-3 bg-accent/20 rounded-lg px-3 py-2.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    data-testid="button-vault"
                    onClick={() => setLocation("/vault")}
                    title="Vault"
                  >
                    <FolderOpen className="w-4 h-4 text-primary" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    data-testid="button-attach-file"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFiles.length > 0}
                    title="Attach File"
                  >
                    <Paperclip className="w-4 h-4 text-muted-foreground" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    data-testid="button-attach-image"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach Image"
                  >
                    <Image className="w-4 h-4 text-muted-foreground" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    data-testid="button-attach-folder"
                    onClick={() => setLocation("/boards")}
                    title="Boards"
                  >
                    <Folder className="w-4 h-4 text-muted-foreground" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    data-testid="button-layers"
                    title="More Options"
                  >
                    <Layers className="w-4 h-4 text-muted-foreground" />
                  </Button>
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={
                      hasProcessingDocuments
                        ? "Please wait for document processing to complete..."
                        : isStreaming
                          ? "Type your next question..."
                          : chatDocuments.length > 0
                            ? `Ask questions about your ${chatDocuments.length} uploaded ${chatDocuments.length === 1 ? "document" : "documents"}...`
                            : "Ask questions about your 1 uploaded document..."
                    }
                    className="flex-1 bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground px-2 py-1"
                    data-testid="input-message"
                    disabled={hasProcessingDocuments}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e);
                      }
                    }}
                  />
                  {isStreaming ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={stopGeneration}
                      data-testid="button-stop-generation"
                      title="Stop generating"
                      className="flex-shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      <Square className="w-4 h-4 fill-current" />
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!input.trim() || hasProcessingDocuments}
                      data-testid="button-send-message"
                      className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 flex-shrink-0"
                    >
                      {hasProcessingDocuments ? (
                        <>
                          Processing...
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        </>
                      ) : (
                        <>
                          Ask LedgerLM
                          <Send className="w-3 h-3" />
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </form>
            </div>
          </div>
          <DataSourcesPanel
            isOpen={isDataSourcesOpen}
            onClose={() => setIsDataSourcesOpen(false)}
            chatId={id!}
          />
        </div>
      </div>
    </div>
  );
}
