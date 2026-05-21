import { useState, useRef } from "react";
import { useLocation } from "wouter";
import {
  Send,
  Sparkles,
  Paperclip,
  Image as ImageIcon,
  FolderOpen,
  Layers,
  X,
  FileText,
  Share2,
  HelpCircle,
} from "lucide-react";
import { HiSparkles } from "react-icons/hi2";
import { useMutation, useQuery } from "@tanstack/react-query";
import { DataSourcesPanel } from "@/components/DataSourcesPanel";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuthUser } from "@/lib/auth";
import type { Chat, Document } from "@shared/schema";

const actionCards = [
  {
    id: "summary",
    icon: HiSparkles,
    title: "Generate a quick summary",
    description:
      "Condense lengthy financial documents into clear and actionable insights.",
  },
  {
    id: "insights",
    icon: HiSparkles,
    title: "Develop context-aware insights",
    description:
      "Ask finance questions in plain English and get precise answers instantly.",
  },
  {
    id: "simulate",
    icon: HiSparkles,
    title: "Simulate using our Goal seeking AI",
    description:
      "Not just reporting what happened, but simulating what needs to change to hit a target.",
    highlight: true,
  },
];

const quickActions = [
  "Identify and analyze risk indicators",
  "Compare year-over-year profiles",
  "Highlight cash flow insights",
  "Analyze expense breakdown",
];

export default function Dashboard() {
  const [query, setQuery] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const currentUser = useAuthUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const firstName = currentUser?.displayName?.split(" ")[0] || "Admin";

  const [isDataSourcesOpen, setIsDataSourcesOpen] = useState(false);

  const { data: accessibleCubesData } = useQuery<{ cubes: { id: string; enabled?: boolean }[] }>({
    queryKey: ["/api/user/accessible-cubes"],
  });
  const dataSourceCount = (accessibleCubesData?.cubes ?? []).length;

  const createChatMutation = useMutation({
    mutationFn: async ({
      content,
      files,
    }: {
      content: string;
      files: File[];
    }) => {
      console.log(
        "Creating chat with content:",
        content,
        "files:",
        files.length,
      );
      console.log("Current user:", currentUser);

      const chat = await apiRequest<Chat>("POST", "/api/chats", {
        title: content.slice(0, 50) + (content.length > 50 ? "..." : ""),
        preview: content,
      });

      // Upload files if any
      const uploadedDocs: Document[] = [];
      if (files.length > 0) {
        for (const file of files) {
          const formData = new FormData();
          formData.append("file", file);

          const doc = await apiRequest<Document>(
            "POST",
            "/api/documents",
            formData,
            true,
          );
          uploadedDocs.push(doc);
        }

        // Attach documents to chat
        for (const doc of uploadedDocs) {
          await apiRequest("POST", `/api/chats/${chat.id}/documents`, {
            documentId: doc.id,
          });
        }
      }

      await apiRequest("POST", `/api/chats/${chat.id}/messages`, {
        content,
        role: "user",
      });

      return chat;
    },
    onSuccess: (chat) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      toast({
        title: "Analysis started",
        description:
          selectedFiles.length > 0
            ? `Chat created with ${selectedFiles.length} document(s)`
            : "Your financial analysis request has been submitted.",
      });
      setQuery("");
      setSelectedFiles([]);
      setLocation(`/chat/${chat.id}`);
    },
    onError: (error) => {
      console.error("Chat creation failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Check if it's an auth error
      if (
        errorMessage.includes("Session expired") ||
        errorMessage.includes("401")
      ) {
        toast({
          title: "Session Expired",
          description: "Please sign out and sign back in.",
          variant: "destructive",
        });
        setTimeout(() => setLocation("/"), 2000);
      } else {
        toast({
          title: "Error",
          description: "Failed to submit your request. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() || selectedFiles.length > 0) {
      createChatMutation.mutate({
        content: query.trim() || "Analyze these documents",
        files: selectedFiles,
      });
    }
  };

  const handleQuickAction = (action: string) => {
    setQuery(action);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSelectedFiles((prev) => [...prev, ...files]);
      toast({
        title: "Files selected",
        description: `${files.length} file(s) ready to upload`,
      });
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-primary/10">
      {/* Main content area with white background and gaps */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-auto p-6">
          <div className="h-full bg-white rounded-2xl overflow-auto">
          {/* Header inside white box */}
          <div className="px-6 lg:px-10 py-3.5 flex items-center justify-end gap-3 bg-primary/40">
            <Button variant="ghost" size="icon" data-testid="button-share">
              <Share2 className="w-5 h-5 text-primary" />
            </Button>
            <Button variant="ghost" size="icon" data-testid="button-help">
              <HelpCircle className="w-5 h-5 text-primary" />
            </Button>
            <Button
              variant={isDataSourcesOpen ? "secondary" : "outline"}
              onClick={() => setIsDataSourcesOpen(!isDataSourcesOpen)}
              className="gap-2 bg-white"
              size="sm"
              data-testid="button-data-sources"
            >
              Data Sources
              <Badge variant="secondary" className="ml-1">
                {dataSourceCount}
              </Badge>
            </Button>
          </div>

          <div className="px-6 lg:px-10 pt-4 pb-4 space-y-4">
            {/* Greeting and Cards - Narrower centered container */}
            <div className="max-w-[min(90vw,960px)] mx-auto space-y-9">
              <div className="space-y-2">
                <h1
                  className="text-2xl font-bold text-foreground flex items-center gap-2 py-3"
                  data-testid="heading-greeting"
                >
                  <span>👋</span> Hi {firstName}!
                </h1>
                <p className="text-3xl font-bold text-foreground leading-tight">
                  What financial analysis do you want to run today?
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {actionCards.map((card) => (
                  <Card
                    key={card.id}
                    className={`p-4 space-y-2.5 hover-elevate cursor-pointer transition-all rounded-2xl `}
                    data-testid={`card-${card.id}`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
                      <card.icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-semibold text-sm text-foreground leading-tight">
                        {card.title}
                      </h3>
                      <p className="text-xs text-muted-foreground leading-snug">
                        {card.description}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="space-y-2.5">
                <p className="text-center text-sm text-muted-foreground font-medium">
                  You can also try asking
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                  {quickActions.map((action, index) => (
                    <button
                      key={index}
                      onClick={() => handleQuickAction(action)}
                      className="px-3 py-2 rounded-xl border border-border bg-white hover-elevate text-sm text-foreground text-center transition-all"
                      data-testid={`button-quick-action-${index}`}
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Chat Box - Wider container matching reference design */}
            <div className="max-w-[min(96vw,1200px)] mx-auto py-0.5">
              <Card className="p-4 rounded-2xl shadow-sm bg-white dark:bg-gray-900">
                <form onSubmit={handleSubmit} className="space-y-0">
                  <Textarea
                    placeholder="Ask me to do any financial analysis"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="min-h-[60px] resize-none text-base border-0 focus-visible:ring-0 px-0 py-0 placeholder:text-muted-foreground bg-transparent"
                    data-testid="textarea-query"
                  />

                  {selectedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-3 pb-2">
                      {selectedFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg text-sm"
                          data-testid={`selected-file-${index}`}
                        >
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span className="text-foreground">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(index)}
                            className="ml-1 hover:bg-muted-foreground/20 rounded-sm p-0.5"
                            data-testid={`button-remove-file-${index}`}
                          >
                            <X className="w-3 h-3 text-muted-foreground" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-border mt-3">
                    <div className="flex items-center gap-1">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg"
                        onChange={handleFileSelect}
                        className="hidden"
                        data-testid="input-file"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        data-testid="button-vault"
                        onClick={() => setLocation("/vault")}
                        title="Vault"
                      >
                        <FolderOpen className="w-5 h-5 text-primary" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        data-testid="button-attach-file"
                        onClick={handleAttachClick}
                        title="Attach File"
                      >
                        <Paperclip className="w-5 h-5 text-muted-foreground" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        data-testid="button-attach-image"
                        onClick={handleAttachClick}
                        title="Attach Image"
                      >
                        <ImageIcon className="w-5 h-5 text-muted-foreground" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        data-testid="button-folder"
                        onClick={() => setLocation("/boards")}
                        title="Boards"
                      >
                        <FolderOpen className="w-5 h-5 text-muted-foreground" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        data-testid="button-layers"
                        title="More Options"
                      >
                        <Layers className="w-5 h-5 text-muted-foreground" />
                      </Button>
                    </div>

                    <Button
                      type="submit"
                      className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 rounded-lg min-h-9"
                      disabled={
                        (!query.trim() && selectedFiles.length === 0) ||
                        createChatMutation.isPending
                      }
                      data-testid="button-ask-ledgerlm"
                    >
                      {createChatMutation.isPending
                        ? "Processing..."
                        : "Ask LedgerLM"}
                      <Send className="w-3 h-3 " />
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          </div>
        </div>
      </div>
        <DataSourcesPanel
          isOpen={isDataSourcesOpen}
          onClose={() => setIsDataSourcesOpen(false)}
          chatId=""
        />
      </div>
    </div>
  );
}
