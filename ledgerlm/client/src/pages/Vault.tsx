import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Upload,
  FileText,
  Trash2,
  Download,
  MoreVertical,
  File,
  FileSpreadsheet,
  Filter,
  Search,
  Link as LinkIcon,
  Eye,
  Ban,
  Sparkles,
  HelpCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getAuthUser } from "@/lib/auth";
import type { Document } from "@shared/schema";
import { ConnectDriveDialog } from "@/components/ConnectDriveDialog";

export default function Vault() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [showConnectDrive, setShowConnectDrive] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "date">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const { data: documents = [], isLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const user = getAuthUser();
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: {
          "x-user-id": user?.id || "",
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      return response.json();
    },
    onSuccess: async (data) => {
      queryClient.refetchQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Success",
        description: "Document uploaded successfully. Processing started...",
      });
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      if (data?.id) {
        try {
          const user = getAuthUser();
          await fetch(`/api/documents/${data.id}/process`, {
            method: "POST",
            headers: {
              "x-user-id": user?.id || "",
              "Content-Type": "application/json",
            },
          });
        } catch (error) {
          console.error("Auto-process failed:", error);
        }
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to upload document",
        variant: "destructive",
      });
      setUploading(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const user = getAuthUser();
      const response = await fetch(`/api/documents/${id}`, {
        method: "DELETE",
        headers: {
          "x-user-id": user?.id || "",
        },
      });

      if (!response.ok) {
        throw new Error("Delete failed");
      }
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Success",
        description: "Document deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete document",
        variant: "destructive",
      });
    },
  });

  const processMutation = useMutation({
    mutationFn: async (id: string) => {
      const user = getAuthUser();
      const response = await fetch(`/api/documents/${id}/process`, {
        method: "POST",
        headers: {
          "x-user-id": user?.id || "",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Processing failed");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Processing Started",
        description: "Document processing has been initiated",
      });
      queryClient.refetchQueries({ queryKey: ["/api/documents"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start document processing",
        variant: "destructive",
      });
    },
  });

  const createAnalysisMutation = useMutation({
    mutationFn: async (documentIds: string[]) => {
      const user = getAuthUser();

      const selectedDocNames = documents
        .filter((doc) => documentIds.includes(doc.id))
        .map((doc) => doc.name)
        .slice(0, 2)
        .join(", ");

      const chatTitle =
        documentIds.length > 2
          ? `Analysis: ${selectedDocNames} and ${documentIds.length - 2} more`
          : `Analysis: ${selectedDocNames}`;

      const chatResponse = await fetch("/api/chats", {
        method: "POST",
        headers: {
          "x-user-id": user?.id || "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: chatTitle,
          preview: `Analysis session with ${documentIds.length} document${documentIds.length > 1 ? "s" : ""}`,
        }),
      });

      if (!chatResponse.ok) {
        throw new Error("Failed to create chat");
      }

      const chat = await chatResponse.json();

      for (const docId of documentIds) {
        const associateResponse = await fetch(
          `/api/chats/${chat.id}/documents`,
          {
            method: "POST",
            headers: {
              "x-user-id": user?.id || "",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ documentId: docId }),
          },
        );

        if (!associateResponse.ok) {
          console.error(`Failed to associate document ${docId}`);
        }
      }

      return chat;
    },
    onSuccess: (chat) => {
      toast({
        title: "Analysis Created",
        description: `Started analysis with ${selectedDocs.size} document${selectedDocs.size > 1 ? "s" : ""}`,
      });
      setSelectedDocs(new Set());
      queryClient.refetchQueries({ queryKey: ["/api/chats"] });
      setLocation(`/chat/${chat.id}`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create analysis session",
        variant: "destructive",
      });
    },
  });

  const getDocumentStatus = (documentId: string) => {
    return useQuery({
      queryKey: ["/api/documents", documentId, "status"],
      refetchInterval: 5000,
      enabled: !!documentId,
    });
  };

  const handleFileSelect = (files: FileList | null) => {
    const file = files?.[0];
    if (file) {
      setUploading(true);
      uploadMutation.mutate(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDownload = async (doc: Document) => {
    try {
      const user = getAuthUser();
      const response = await fetch(`/api/documents/${doc.id}/download`, {
        headers: {
          "x-user-id": user?.id || "",
        },
      });

      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download document",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: string) => {
    const size = parseInt(bytes);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "pdf":
        return (
          <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
            <FileText className="w-4 h-4 text-red-500" />
          </div>
        );
      case "xls":
      case "xlsx":
      case "csv":
        return (
          <div className="w-8 h-8 rounded-lg bg-green-600/10 flex items-center justify-center">
            <FileSpreadsheet className="w-4 h-4 text-green-600" />
          </div>
        );
      case "doc":
      case "docx":
        return (
          <div className="w-8 h-8 rounded-lg bg-blue-600/10 flex items-center justify-center">
            <FileText className="w-4 h-4 text-blue-600" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
            <File className="w-4 h-4 text-muted-foreground" />
          </div>
        );
    }
  };

  const handleSort = (column: "name" | "date") => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  const filteredDocuments = documents
    .filter((doc) => doc.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "name") {
        const comparison = a.name.localeCompare(b.name);
        return sortOrder === "asc" ? comparison : -comparison;
      } else {
        const dateA = new Date(a.uploadedAt).getTime();
        const dateB = new Date(b.uploadedAt).getTime();
        return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
      }
    });

  const toggleSelectAll = () => {
    if (selectedDocs.size === filteredDocuments.length) {
      setSelectedDocs(new Set());
    } else {
      setSelectedDocs(new Set(filteredDocuments.map((d) => d.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedDocs);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedDocs(newSelected);
  };

  const { data: stats = { totalDocuments: 0, vectorIndexed: 0, currentSessions: 0, totalSessions: 0 }, isLoading: statsLoading } = useQuery<{
    totalDocuments: number;
    vectorIndexed: number;
    currentSessions: number;
    totalSessions: number;
  }>({
    queryKey: ['/api/vault/stats'],
  });

  function SessionCount({ documentId }: { documentId: string }) {
    const { data: sessionData, isLoading } = useQuery<{ count: number }>({
      queryKey: ["/api/documents", documentId, "sessions"],
    });

    if (isLoading) {
      return <span className="text-sm text-muted-foreground">...</span>;
    }

    if (!sessionData || sessionData.count === 0) {
      return <span className="text-sm text-foreground">N/A</span>;
    }

    return <span className="text-sm text-foreground">{sessionData.count}</span>;
  }

  function ProcessingStatusBadge({ documentId }: { documentId: string }) {
    const { data: statusData } = useQuery<{
      status: string;
      processedChunks: number;
    }>({
      queryKey: ["/api/documents", documentId, "status"],
      refetchInterval: 5000,
    });

    if (!statusData || statusData.status !== "completed") {
      return null;
    }

    return (
      <Badge
        variant="secondary"
        className="ml-2 bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/20"
        data-testid={`badge-processed-${documentId}`}
      >
        <CheckCircle2 className="w-3 h-3 mr-1" />
        {statusData.processedChunks} chunks
      </Badge>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-primary/10">
      <div className="flex-1 overflow-auto p-6">
        <div className="h-full bg-white rounded-2xl overflow-auto flex flex-col">
          <div className="px-6 lg:px-8 py-3.5 flex items-center justify-between gap-3 bg-primary/40 flex-shrink-0">
            <h1
              className="text-xl font-semibold text-foreground"
              data-testid="text-vault-title"
            >
              Vault
            </h1>
            <div className="flex items-center gap-2 justify-end">
              <Button variant="ghost" size="icon" data-testid="button-help">
                <HelpCircle className="w-5 h-5 text-primary" />
              </Button>
              <Button
                variant="outline"
                className="gap-2 bg-white"
                size="sm"
                data-testid="button-data-sources"
              >
                Data Sources
                <Badge variant="secondary" className="ml-1">
                  3
                </Badge>
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:items-start">
              <div className="space-y-3 flex flex-col">
                <h2
                  className="text-sm font-medium text-foreground"
                  data-testid="text-document-history"
                >
                  Document History
                </h2>
                <div className="grid grid-cols-2 gap-3 flex-1">
                  <Card className="p-4" data-testid="card-total-documents">
                    <div className="text-xs text-muted-foreground mb-2">
                      Total Documents
                    </div>
                    <div className="text-3xl font-bold text-foreground">
                      {statsLoading ? '...' : stats.totalDocuments}
                    </div>
                  </Card>
                  <Card className="p-4" data-testid="card-vector-indexed">
                    <div className="text-xs text-muted-foreground mb-2">
                      Vector Indexed
                    </div>
                    <div className="text-3xl font-bold text-foreground">
                      {statsLoading ? '...' : stats.vectorIndexed}
                    </div>
                  </Card>
                  <Card className="p-4" data-testid="card-current-sessions">
                    <div className="text-xs text-muted-foreground mb-2">
                      Current Sessions
                    </div>
                    <div className="text-3xl font-bold text-foreground">
                      {statsLoading ? '...' : stats.currentSessions}
                    </div>
                  </Card>
                  <Card className="p-4" data-testid="card-total-sessions">
                    <div className="text-xs text-muted-foreground mb-2">
                      Total Sessions
                    </div>
                    <div className="text-3xl font-bold text-foreground">
                      {statsLoading ? '...' : stats.totalSessions}
                    </div>
                  </Card>
                </div>
              </div>

              <div className="space-y-3 flex flex-col">
                <h2
                  className="text-sm font-medium text-foreground"
                  data-testid="text-file-upload"
                >
                  File Upload
                </h2>
                <Card
                  className={`p-4 border-2 border-dashed transition-colors flex-1 flex items-center justify-center ${
                    dragActive ? "border-primary bg-primary/5" : "border-border"
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <div className="flex flex-col items-center gap-2 text-center w-full">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <Upload className="w-4 h-4 text-primary" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="font-medium text-sm text-foreground">
                        Upload Files
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="text-primary hover:underline"
                          data-testid="button-browse-files"
                        >
                          Click to Browse
                        </button>{" "}
                        or drag and drop your files
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground">or</div>
                    <p className="text-xs text-muted-foreground">
                      Connect a Public Drive link to analyze documents
                    </p>
                    <Button
                      className="bg-primary text-primary-foreground"
                      size="sm"
                      onClick={() => setShowConnectDrive(true)}
                      data-testid="button-connect-drive"
                    >
                      <LinkIcon className="w-4 h-4 mr-2" />
                      Connect Drive
                    </Button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files)}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                    data-testid="input-file-upload"
                  />
                </Card>
              </div>
            </div>

            <div className="space-y-3 bg-white -mx-6 lg:-mx-8 px-6 lg:px-8 py-5 -mb-6">
              <div className="flex items-center justify-between">
                <h2
                  className="text-base font-semibold text-foreground"
                  data-testid="text-all-files"
                >
                  All Files ({filteredDocuments.length})
                </h2>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search for document by name or type"
                      className="pl-10 w-80 h-9 bg-white"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      data-testid="input-search-documents"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white"
                    data-testid="button-filter"
                  >
                    <Filter className="w-4 h-4 mr-2" />
                    Filter
                  </Button>
                </div>
              </div>

              {/* <Card className="overflow-hidden bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-4 py-3 font-medium text-sm text-muted-foreground w-12">
                          <Checkbox
                            checked={
                              selectedDocs.size === filteredDocuments.length &&
                              filteredDocuments.length > 0
                            }
                            onCheckedChange={toggleSelectAll}
                            data-testid="checkbox-select-all"
                          />
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-sm text-muted-foreground">
                          Document Name
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-sm text-muted-foreground">
                          Upload Date
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-sm text-muted-foreground">
                          Sessions
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-sm text-muted-foreground">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="text-center py-12 text-muted-foreground text-sm"
                          >
                            Loading documents...
                          </td>
                        </tr>
                      ) : filteredDocuments.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="text-center py-12 text-muted-foreground text-sm"
                          >
                            {searchQuery
                              ? "No documents found"
                              : "No documents yet. Upload your first document to get started."}
                          </td>
                        </tr>
                      ) : (
                        filteredDocuments.map((doc) => (
                          <tr
                            key={doc.id}
                            className="border-b last:border-b-0 hover-elevate transition-colors"
                            data-testid={`row-document-${doc.id}`}
                          >
                            <td className="px-4 py-3">
                              <Checkbox
                                checked={selectedDocs.has(doc.id)}
                                onCheckedChange={() => toggleSelect(doc.id)}
                                data-testid={`checkbox-${doc.id}`}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                {getFileIcon(doc.name)}
                                <div className="min-w-0">
                                  <p
                                    className="font-medium text-sm text-foreground truncate"
                                    data-testid={`text-document-name-${doc.id}`}
                                  >
                                    {doc.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatFileSize(doc.fileSize)}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td
                              className="px-4 py-3 text-sm text-foreground"
                              data-testid={`text-upload-date-${doc.id}`}
                            >
                              {formatDate(doc.uploadedAt)}
                            </td>
                            <td
                              className="px-4 py-3"
                              data-testid={`text-sessions-${doc.id}`}
                            >
                              <SessionCount documentId={doc.id} />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDownload(doc)}
                                  data-testid={`button-download-${doc.id}`}
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      data-testid={`button-menu-${doc.id}`}
                                    >
                                      <MoreVertical className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() =>
                                        processMutation.mutate(doc.id)
                                      }
                                      data-testid={`menu-process-document-${doc.id}`}
                                    >
                                      <Sparkles className="w-4 h-4 mr-2" />
                                      Process Document
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      data-testid={`menu-start-analysis-${doc.id}`}
                                    >
                                      <Sparkles className="w-4 h-4 mr-2" />
                                      Start New Analysis
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleDownload(doc)}
                                      data-testid={`menu-view-file-${doc.id}`}
                                    >
                                      <Eye className="w-4 h-4 mr-2" />
                                      View File
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleDownload(doc)}
                                      data-testid={`menu-download-${doc.id}`}
                                    >
                                      <Download className="w-4 h-4 mr-2" />
                                      Download File
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        deleteMutation.mutate(doc.id)
                                      }
                                      className="text-destructive focus:text-destructive"
                                      data-testid={`menu-delete-${doc.id}`}
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Delete File
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card> */}
              <Card className="overflow-hidden bg-white backdrop-blur-sm flex-shrink-0">
                <div className="overflow-x-auto">
                  <div>
                    <table className="w-full">
                      <thead className="bg-primary/5">
                        <tr className="border-b bg-primary/5">
                          <th className="text-left px-4 py-3 font-medium text-sm text-muted-foreground w-12">
                            <Checkbox
                              checked={
                                selectedDocs.size ===
                                  filteredDocuments.length &&
                                filteredDocuments.length > 0
                              }
                              onCheckedChange={toggleSelectAll}
                              data-testid="checkbox-select-all"
                            />
                          </th>
                          <th
                            className="text-left px-4 py-3 font-medium text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                            onClick={() => handleSort("name")}
                            data-testid="header-document-name"
                          >
                            <div className="flex items-center gap-2">
                              Document Name
                              {sortBy === "name" ? (
                                sortOrder === "asc" ? (
                                  <ArrowUp className="w-4 h-4" />
                                ) : (
                                  <ArrowDown className="w-4 h-4" />
                                )
                              ) : (
                                <ArrowUpDown className="w-4 h-4 opacity-50" />
                              )}
                            </div>
                          </th>
                          <th
                            className="text-left px-4 py-3 font-medium text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                            onClick={() => handleSort("date")}
                            data-testid="header-upload-date"
                          >
                            <div className="flex items-center gap-2">
                              Upload Date
                              {sortBy === "date" ? (
                                sortOrder === "asc" ? (
                                  <ArrowUp className="w-4 h-4" />
                                ) : (
                                  <ArrowDown className="w-4 h-4" />
                                )
                              ) : (
                                <ArrowUpDown className="w-4 h-4 opacity-50" />
                              )}
                            </div>
                          </th>
                          <th className="text-left px-4 py-3 font-medium text-sm text-muted-foreground">
                            Sessions
                          </th>
                          <th className="text-left px-4 py-3 font-medium text-sm text-muted-foreground">
                            Actions
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {isLoading ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="text-center py-12 text-muted-foreground text-sm"
                            >
                              Loading documents...
                            </td>
                          </tr>
                        ) : filteredDocuments.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="text-center py-12 text-muted-foreground text-sm"
                            >
                              {searchQuery
                                ? "No documents found"
                                : "No documents yet. Upload your first document to get started."}
                            </td>
                          </tr>
                        ) : (
                          filteredDocuments.map((doc) => (
                            <tr
                              key={doc.id}
                              className="border-b last:border-b-0 hover:bg-muted/50 transition-colors"
                              data-testid={`row-document-${doc.id}`}
                            >
                              <td className="px-4 py-3">
                                <Checkbox
                                  checked={selectedDocs.has(doc.id)}
                                  onCheckedChange={() => toggleSelect(doc.id)}
                                  data-testid={`checkbox-${doc.id}`}
                                />
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  {getFileIcon(doc.name)}
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1">
                                      <p
                                        className="font-medium text-sm text-foreground truncate"
                                        data-testid={`text-document-name-${doc.id}`}
                                      >
                                        {doc.name}
                                      </p>
                                      <ProcessingStatusBadge
                                        documentId={doc.id}
                                      />
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      {formatFileSize(doc.fileSize)}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td
                                className="px-4 py-3 text-sm text-foreground"
                                data-testid={`text-upload-date-${doc.id}`}
                              >
                                {formatDate(doc.uploadedAt)}
                              </td>
                              <td
                                className="px-4 py-3"
                                data-testid={`text-sessions-${doc.id}`}
                              >
                                <SessionCount documentId={doc.id} />
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDownload(doc)}
                                    data-testid={`button-download-${doc.id}`}
                                  >
                                    <Download className="w-4 h-4" />
                                  </Button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        data-testid={`button-menu-${doc.id}`}
                                      >
                                        <MoreVertical className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem
                                        onClick={() =>
                                          processMutation.mutate(doc.id)
                                        }
                                        data-testid={`menu-process-document-${doc.id}`}
                                      >
                                        <Sparkles className="w-4 h-4 mr-2" />
                                        Process Document
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        data-testid={`menu-start-analysis-${doc.id}`}
                                      >
                                        <Sparkles className="w-4 h-4 mr-2" />
                                        Start New Analysis
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => handleDownload(doc)}
                                        data-testid={`menu-view-file-${doc.id}`}
                                      >
                                        <Eye className="w-4 h-4 mr-2" />
                                        View File
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => handleDownload(doc)}
                                        data-testid={`menu-download-${doc.id}`}
                                      >
                                        <Download className="w-4 h-4 mr-2" />
                                        Download File
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() =>
                                          deleteMutation.mutate(doc.id)
                                        }
                                        className="text-destructive focus:text-destructive"
                                        data-testid={`menu-delete-${doc.id}`}
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Delete File
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>

              {selectedDocs.size > 0 && (
                <div className="flex justify-center mt-4">
                  <Button
                    size="default"
                    className="gap-2"
                    onClick={() =>
                      createAnalysisMutation.mutate(Array.from(selectedDocs))
                    }
                    disabled={createAnalysisMutation.isPending}
                    data-testid="button-create-analysis-bulk"
                  >
                    {createAnalysisMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    {createAnalysisMutation.isPending
                      ? "Creating..."
                      : `Create New Analysis (${selectedDocs.size} selected)`}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConnectDriveDialog
        open={showConnectDrive}
        onOpenChange={setShowConnectDrive}
      />
    </div>
  );
}
