import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Bot, Upload, FileText, Trash2, RefreshCw, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import type { KioskFaqDocument } from "@shared/schema";

const BILLING_TYPES = [
  {
    key: "non_mcr_faq",
    title: "FAQs for NON-MCR Billing",
    description: "General frequently asked questions about NON-MCR billing processes",
  },
  {
    key: "fixed_price",
    title: "NON-MCR Fixed Price Billing Process",
    description: "Documentation for fixed price billing procedures",
  },
  {
    key: "t_and_m",
    title: "Non MCR Bosch T&M Billing Cockpit",
    description: "Time and Material billing cockpit documentation",
  },
  {
    key: "at_actuals",
    title: "Non MCR Bosch Billing Cockpit (At Actuals)",
    description: "At Actuals billing cockpit documentation",
  },
];

function getStatusBadge(status: string) {
  switch (status) {
    case "ready":
      return <Badge variant="default" className="bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" /> Ready</Badge>;
    case "processing":
      return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Processing</Badge>;
    case "pending":
      return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
    case "failed":
      return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatFileSize(bytes: string | number) {
  const size = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function BillingTypeCard({ 
  billingType, 
  documents,
  onUpload,
  onDelete,
  isUploading 
}: { 
  billingType: typeof BILLING_TYPES[0];
  documents: KioskFaqDocument[];
  onUpload: (file: File, billingType: string) => void;
  onDelete: (id: string) => void;
  isUploading: boolean;
}) {
  const doc = documents.find(d => d.billingType === billingType.key);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file, billingType.key);
      e.target.value = '';
    }
  };

  return (
    <Card data-testid={`card-billing-type-${billingType.key}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-base">{billingType.title}</CardTitle>
            <CardDescription className="text-sm mt-1">{billingType.description}</CardDescription>
          </div>
          {doc && getStatusBadge(doc.status)}
        </div>
      </CardHeader>
      <CardContent>
        {doc ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <FileText className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" data-testid={`text-filename-${billingType.key}`}>
                  {doc.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(doc.fileSize)} • Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(doc.id)}
                data-testid={`button-delete-${billingType.key}`}
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
            <div className="flex gap-2">
              <label className="flex-1" data-testid={`label-replace-${billingType.key}`}>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                  onChange={handleFileChange}
                  disabled={isUploading}
                  data-testid={`input-file-replace-${billingType.key}`}
                />
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={isUploading}
                  asChild
                  data-testid={`button-replace-${billingType.key}`}
                >
                  <span>
                    <RefreshCw className={`w-4 h-4 mr-2 ${isUploading ? 'animate-spin' : ''}`} />
                    Replace Document
                  </span>
                </Button>
              </label>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-center p-6 border-2 border-dashed rounded-lg border-muted-foreground/25" data-testid={`dropzone-${billingType.key}`}>
              <div className="text-center">
                <FileText className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No document uploaded</p>
              </div>
            </div>
            <label data-testid={`label-upload-${billingType.key}`}>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                onChange={handleFileChange}
                disabled={isUploading}
                data-testid={`input-file-upload-${billingType.key}`}
              />
              <Button
                className="w-full"
                disabled={isUploading}
                asChild
                data-testid={`button-upload-${billingType.key}`}
              >
                <span>
                  <Upload className={`w-4 h-4 mr-2 ${isUploading ? 'animate-spin' : ''}`} />
                  {isUploading ? 'Uploading...' : 'Upload Document'}
                </span>
              </Button>
            </label>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminAgenticWorkflow() {
  const { toast } = useToast();
  const [uploadingType, setUploadingType] = useState<string | null>(null);

  const { data: documents = [], isLoading } = useQuery<KioskFaqDocument[]>({
    queryKey: ['/api/kiosk/faq-documents'],
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, billingType }: { file: File; billingType: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('billingType', billingType);
      
      const response = await fetch('/api/kiosk/faq-documents', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/kiosk/faq-documents'] });
      toast({
        title: "Document Uploaded",
        description: "The FAQ document has been uploaded and is being processed.",
      });
      setUploadingType(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
      setUploadingType(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/kiosk/faq-documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/kiosk/faq-documents'] });
      toast({
        title: "Document Deleted",
        description: "The FAQ document has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleUpload = (file: File, billingType: string) => {
    setUploadingType(billingType);
    uploadMutation.mutate({ file, billingType });
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this document?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Agentic Workflow Settings</h1>
          <p className="text-muted-foreground">
            Manage AI-powered workflow configurations and FAQ documents
          </p>
        </div>

        <Card data-testid="card-billing-kiosk">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>Billing Kiosk</CardTitle>
                <CardDescription>
                  NON-MCR Billing Assistant - Self-service chatbot for billing queries
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Status</p>
                  <p className="text-xs text-muted-foreground">
                    {documents.filter(d => d.status === 'ready').length} of {BILLING_TYPES.length} documents ready
                  </p>
                </div>
                <Badge variant={documents.filter(d => d.status === 'ready').length === BILLING_TYPES.length ? "default" : "secondary"}>
                  {documents.filter(d => d.status === 'ready').length === BILLING_TYPES.length ? "Fully Configured" : "Needs Configuration"}
                </Badge>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">FAQ Documents</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload or update FAQ documents for each billing type. The AI will use these to answer user queries.
                </p>
                
                {isLoading ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {[1, 2, 3, 4].map((i) => (
                      <Card key={i} className="animate-pulse">
                        <CardHeader className="pb-3">
                          <div className="h-4 bg-muted rounded w-3/4"></div>
                          <div className="h-3 bg-muted rounded w-1/2 mt-2"></div>
                        </CardHeader>
                        <CardContent>
                          <div className="h-20 bg-muted rounded"></div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {BILLING_TYPES.map((type) => (
                      <BillingTypeCard
                        key={type.key}
                        billingType={type}
                        documents={documents}
                        onUpload={handleUpload}
                        onDelete={handleDelete}
                        isUploading={uploadingType === type.key}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
