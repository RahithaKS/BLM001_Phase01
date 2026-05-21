import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { X, AlertCircle, CheckCircle2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ConnectDriveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DriveType = "google_drive" | "onedrive" | "dropbox";

interface ImportProgress {
  fileName: string;
  fileSize: string;
  progress: number;
  status: "downloading" | "processing" | "completed" | "error";
  error?: string;
}

export function ConnectDriveDialog({ open, onOpenChange }: ConnectDriveDialogProps) {
  const [driveType, setDriveType] = useState<DriveType>("google_drive");
  const [url, setUrl] = useState("");
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async ({ url, driveType }: { url: string; driveType: DriveType }) => {
      const response = await apiRequest<{
        success: boolean;
        document: {
          id: string;
          name: string;
          fileSize: string;
        };
      }>("POST", "/api/documents/import-from-url", { url, driveType });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Success",
        description: "File imported successfully from cloud drive",
      });
      setUrl("");
      setImportProgress(null);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
      setImportProgress(null);
    },
  });

  const handleImport = () => {
    if (!url.trim()) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid cloud drive link",
        variant: "destructive",
      });
      return;
    }

    // Start import
    setImportProgress({
      fileName: "Downloading...",
      fileSize: "Unknown",
      progress: 0,
      status: "downloading",
    });

    importMutation.mutate({ url, driveType });
  };

  const getPlaceholder = () => {
    switch (driveType) {
      case "google_drive":
        return "https://drive.google.com/file/d/...";
      case "onedrive":
        return "https://1drv.ms/... or https://onedrive.live.com/...";
      case "dropbox":
        return "https://www.dropbox.com/s/...";
    }
  };

  const getInstructions = () => {
    switch (driveType) {
      case "google_drive":
        return "Right-click file → Get link → Set 'Anyone with the link' → Copy link";
      case "onedrive":
        return "Right-click file → Share → Copy link (set permissions to 'Anyone')";
      case "dropbox":
        return "Right-click file → Share → Create link → Copy link";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]" data-testid="dialog-connect-drive">
        <DialogHeader>
          <DialogTitle className="text-xl">Connect Drive</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Make sure the folder or file is set to <strong>'Anyone with the link can view'</strong>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="drive-type">Select Drive Provider</Label>
            <Select value={driveType} onValueChange={(value) => setDriveType(value as DriveType)}>
              <SelectTrigger id="drive-type" data-testid="select-drive-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="google_drive">Google Drive</SelectItem>
                <SelectItem value="onedrive">Microsoft OneDrive</SelectItem>
                <SelectItem value="dropbox">Dropbox</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{getInstructions()}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="drive-url">Drive Link</Label>
            <Input
              id="drive-url"
              type="url"
              placeholder={getPlaceholder()}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={importMutation.isPending}
              data-testid="input-drive-url"
            />
          </div>

          <Alert variant="default">
            <AlertDescription className="text-xs">
              📄 <strong>Supported formats:</strong> PDF, Excel, Word, CSV, images, text files
            </AlertDescription>
          </Alert>

          {importProgress && (
            <div className="space-y-3 p-4 border rounded-lg bg-accent/20">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium">{importProgress.fileName}</p>
                  <p className="text-xs text-muted-foreground">{importProgress.fileSize}</p>
                </div>
                {importProgress.status === "completed" && (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                )}
                {importProgress.status === "error" && (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                )}
              </div>

              {importProgress.status === "downloading" && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Downloading...</span>
                    <span>{importProgress.progress}%</span>
                  </div>
                  <Progress value={importProgress.progress} className="h-2" />
                </div>
              )}

              {importProgress.status === "processing" && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Processing document...</span>
                    <span>{importProgress.progress}%</span>
                  </div>
                  <Progress value={importProgress.progress} className="h-2" />
                </div>
              )}

              {importProgress.status === "error" && importProgress.error && (
                <p className="text-xs text-destructive">{importProgress.error}</p>
              )}

              {importProgress.status === "completed" && (
                <p className="text-xs text-green-600">Import successful!</p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={importMutation.isPending}
              data-testid="button-cancel-import"
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!url.trim() || importMutation.isPending}
              data-testid="button-connect-drive"
            >
              {importMutation.isPending ? "Importing..." : "Connect Drive"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
