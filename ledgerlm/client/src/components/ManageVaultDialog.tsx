import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, FileText, Loader2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

interface Document {
  id: string;
  name: string;
  fileType: string;
  fileSize: string;
  uploadedAt: string;
}

interface ManageVaultDialogProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: string;
}

export function ManageVaultDialog({ isOpen, onClose, chatId }: ManageVaultDialogProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());

  // Fetch all vault documents for the user
  const { data: allDocuments = [], isLoading: isLoadingDocs } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
    enabled: isOpen,
  });

  // Fetch documents currently attached to this chat
  const { data: chatDocuments = [], isLoading: isLoadingChatDocs } = useQuery<Document[]>({
    queryKey: ["/api/chats", chatId, "documents"],
    enabled: isOpen,
  });

  // Initialize selected documents when chat documents load
  useEffect(() => {
    if (chatDocuments.length > 0) {
      setSelectedDocIds(new Set(chatDocuments.map((doc) => doc.id)));
    }
  }, [chatDocuments]);

  // Save document selection
  const saveDocumentsMutation = useMutation({
    mutationFn: async (documentIds: string[]) => {
      return await apiRequest("POST", `/api/chats/${chatId}/documents`, {
        documentIds,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats", chatId, "documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      toast({
        title: "Documents updated",
        description: `${selectedDocIds.size} document(s) attached to this analysis`,
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Could not update document selection",
        variant: "destructive",
      });
    },
  });

  // Filter documents based on search query
  const filteredDocuments = allDocuments.filter((doc) =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleDocument = (docId: string) => {
    const newSelected = new Set(selectedDocIds);
    if (newSelected.has(docId)) {
      newSelected.delete(docId);
    } else {
      newSelected.add(docId);
    }
    setSelectedDocIds(newSelected);
  };

  const toggleAll = () => {
    if (selectedDocIds.size === filteredDocuments.length) {
      setSelectedDocIds(new Set());
    } else {
      setSelectedDocIds(new Set(filteredDocuments.map((doc) => doc.id)));
    }
  };

  const handleSave = () => {
    saveDocumentsMutation.mutate(Array.from(selectedDocIds));
  };

  const formatFileSize = (size: string) => {
    const bytes = parseInt(size);
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col" data-testid="dialog-manage-vault">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">Manage Vault Documents</DialogTitle>
          <DialogDescription>
            Select which documents from your vault to include in this analysis. Changes will be saved for this conversation.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-documents"
            />
          </div>

          {/* Document Table */}
          <div className="flex-1 border rounded-lg overflow-auto">
            {isLoadingDocs || isLoadingChatDocs ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : allDocuments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-2">
                <FileText className="w-12 h-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No documents in vault</p>
                <p className="text-xs text-muted-foreground">Upload documents to get started</p>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-2">
                <Search className="w-12 h-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No documents match your search</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedDocIds.size === filteredDocuments.length && filteredDocuments.length > 0}
                        onCheckedChange={toggleAll}
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
                    <TableHead>Document Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Uploaded</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocuments.map((doc) => (
                    <TableRow
                      key={doc.id}
                      className="hover-elevate cursor-pointer"
                      onClick={() => toggleDocument(doc.id)}
                      data-testid={`row-document-${doc.id}`}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedDocIds.has(doc.id)}
                          onCheckedChange={() => toggleDocument(doc.id)}
                          data-testid={`checkbox-document-${doc.id}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{doc.name}</TableCell>
                      <TableCell className="text-muted-foreground">{doc.fileType.toUpperCase()}</TableCell>
                      <TableCell className="text-muted-foreground">{formatFileSize(doc.fileSize)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDateTime(doc.uploadedAt, { dateOnly: true })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Selection Summary */}
          {allDocuments.length > 0 && (
            <div className="text-sm text-muted-foreground">
              {selectedDocIds.size} of {allDocuments.length} document(s) selected
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saveDocumentsMutation.isPending}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saveDocumentsMutation.isPending}
            data-testid="button-save"
          >
            {saveDocumentsMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save & Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
