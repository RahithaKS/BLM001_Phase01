import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Search, Database, FileSpreadsheet, Loader2, ArrowLeft, Code, Table2, MessageSquare, CheckCircle, AlertCircle, Settings, Network } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { ColumnConfigDialog } from "@/components/ColumnConfigDialog";
import { HierarchyConfigDialog } from "@/components/HierarchyConfigDialog";

interface Cube {
  id: string;
  name: string;
}

interface QueryResult {
  success: boolean;
  results?: Record<string, any>[];
  row_count?: number;
  execution_ms?: number;
  table?: Record<string, any>[];
  narrative?: string;
  generated_sql?: string;
  error?: string;
}

interface IntentResult {
  success: boolean;
  intent?: {
    query_type: string;
    metrics: Array<{ name: string; aggregation: string }>;
    filters: Array<{ column: string; operator: string; value: any }>;
    group_by: string[];
    order_by?: { column: string; direction: string };
    limit: number;
  };
  error?: string;
}

interface IngestionResult {
  success: boolean;
  rows_processed?: number;
  rows_inserted?: number;
  cost_categories?: string[];
  dimensions?: Record<string, string[]>;
  elapsed_seconds?: number;
  error?: string;
}

interface SchemaResult {
  success: boolean;
  cube_id: string;
  row_count: number;
  dimensions: Record<string, string[]>;
  cost_categories: Array<{ name: string; is_summary: boolean }>;
  available_metrics: string[];
}

export default function SemanticSqlTest() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [cubeId, setCubeId] = useState("");
  const [query, setQuery] = useState("");
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [intentResult, setIntentResult] = useState<IntentResult | null>(null);
  const [ingestionResult, setIngestionResult] = useState<IngestionResult | null>(null);
  const [schemaResult, setSchemaResult] = useState<SchemaResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [columnConfigOpen, setColumnConfigOpen] = useState(false);
  const [hierarchyConfigOpen, setHierarchyConfigOpen] = useState(false);

  const { data: cubesData, isLoading: cubesLoading } = useQuery<{ success: boolean; cubes: Cube[] }>({
    queryKey: ['/api/v2/semantic-sql/cubes']
  });

  const { data: healthData } = useQuery<{ status: string; service: string; cubes_available: number }>({
    queryKey: ['/api/v2/semantic-sql/health']
  });

  const executeQueryMutation = useMutation({
    mutationFn: async (queryText: string) => {
      const response = await fetch("/api/v2/semantic-sql/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: queryText,
          cube_id: cubeId,
          user_id: "test-user"
        })
      });
      return response.json();
    },
    onSuccess: (data) => {
      setQueryResult(data);
      if (data.success) {
        toast({ title: "Query executed", description: `${data.row_count} rows returned` });
      } else {
        toast({ title: "Query failed", description: data.error, variant: "destructive" });
      }
    }
  });

  const parseIntentMutation = useMutation({
    mutationFn: async (queryText: string) => {
      const response = await fetch("/api/v2/semantic-sql/parse-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: queryText,
          cube_id: cubeId,
          user_id: "test-user"
        })
      });
      return response.json();
    },
    onSuccess: (data) => {
      setIntentResult(data);
    }
  });

  const ingestFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("cube_id", cubeId);
      const response = await fetch("/api/v2/semantic-sql/ingest", {
        method: "POST",
        body: formData
      });
      return response.json();
    },
    onSuccess: (data) => {
      setIngestionResult(data);
      if (data.success) {
        toast({ 
          title: "Ingestion complete", 
          description: `${data.rows_inserted} rows loaded in ${data.elapsed_seconds?.toFixed(1)}s` 
        });
      } else {
        toast({ title: "Ingestion failed", description: data.error, variant: "destructive" });
      }
    }
  });

  const fetchSchemaMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/v2/semantic-sql/cube/${cubeId}/schema`);
      return response.json();
    },
    onSuccess: (data) => {
      setSchemaResult(data);
    }
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleIngest = () => {
    if (selectedFile) {
      ingestFileMutation.mutate(selectedFile);
    }
  };

  const handleExecuteQuery = () => {
    if (query.trim()) {
      executeQueryMutation.mutate(query);
      parseIntentMutation.mutate(query);
    }
  };

  const sampleQueries = [
    "What is total billed capacity by region for FY24?",
    "Show me headcount by sector",
    "Total amount in USD by project",
    "Average billable hours by cost category",
    "Sum of allocated capacity for Korea"
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Semantic SQL Testing</h1>
            <p className="text-muted-foreground">Test natural language queries on financial data</p>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            {healthData?.status === 'healthy' ? (
              <Badge variant="secondary" className="gap-1" data-testid="badge-health-status">
                <CheckCircle className="h-3 w-3 text-green-500" />
                Semantic SQL Ready
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1" data-testid="badge-health-status">
                <AlertCircle className="h-3 w-3" />
                Service Unavailable
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Label>Select Cube:</Label>
            {cubesLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Select value={cubeId} onValueChange={setCubeId} data-testid="select-cube">
                <SelectTrigger className="w-72" data-testid="select-cube-trigger">
                  <SelectValue placeholder="Select a cube for ingestion/query" />
                </SelectTrigger>
                <SelectContent>
                  {cubesData?.cubes?.map((cube) => (
                    <SelectItem key={cube.id} value={cube.id} data-testid={`select-cube-${cube.id}`}>
                      {cube.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          
          <Button 
            variant="outline" 
            onClick={() => fetchSchemaMutation.mutate()} 
            disabled={!cubeId}
            data-testid="button-fetch-schema"
          >
            <Database className="h-4 w-4 mr-2" />
            Fetch Schema
          </Button>
          
          <Button 
            variant="outline" 
            onClick={() => setColumnConfigOpen(true)} 
            disabled={!cubeId}
            data-testid="button-configure-columns"
          >
            <Settings className="h-4 w-4 mr-2" />
            Configure Columns
          </Button>
          
          <Button 
            variant="outline" 
            onClick={() => setHierarchyConfigOpen(true)}
            data-testid="button-configure-hierarchies"
          >
            <Network className="h-4 w-4 mr-2" />
            Hierarchies
          </Button>
        </div>

        <Tabs defaultValue="query" className="w-full">
          <TabsList data-testid="tabs-list">
            <TabsTrigger value="query" data-testid="tab-query">
              <Search className="h-4 w-4 mr-2" />
              Query
            </TabsTrigger>
            <TabsTrigger value="ingest" data-testid="tab-ingest">
              <Upload className="h-4 w-4 mr-2" />
              Ingest Data
            </TabsTrigger>
            <TabsTrigger value="schema" data-testid="tab-schema">
              <Database className="h-4 w-4 mr-2" />
              Schema
            </TabsTrigger>
          </TabsList>

          <TabsContent value="query" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Natural Language Query
                </CardTitle>
                <CardDescription>
                  Ask questions in plain English about your financial data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Your Question</Label>
                  <Textarea
                    placeholder="e.g., What is total billed capacity by region for FY24?"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="min-h-[80px]"
                    data-testid="input-query"
                  />
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm text-muted-foreground">Try:</span>
                  {sampleQueries.map((q, i) => (
                    <Badge 
                      key={i} 
                      variant="outline" 
                      className="cursor-pointer hover-elevate"
                      onClick={() => setQuery(q)}
                      data-testid={`badge-sample-query-${i}`}
                    >
                      {q}
                    </Badge>
                  ))}
                </div>

                <Button 
                  onClick={handleExecuteQuery} 
                  disabled={executeQueryMutation.isPending || !query.trim() || !cubeId}
                  data-testid="button-execute-query"
                >
                  {executeQueryMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4 mr-2" />
                  )}
                  Execute Query
                </Button>
                {!cubeId && (
                  <span className="text-sm text-muted-foreground">Please select a cube first</span>
                )}
              </CardContent>
            </Card>

            {intentResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    Parsed Intent
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto" data-testid="text-intent-json">
                    {JSON.stringify(intentResult.intent, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}

            {queryResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Table2 className="h-5 w-5" />
                    Query Results
                    {queryResult.success && (
                      <Badge variant="secondary" data-testid="badge-row-count">
                        {queryResult.row_count} rows in {queryResult.execution_ms}ms
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {queryResult.generated_sql && (
                    <div className="space-y-2">
                      <Label>Generated SQL</Label>
                      <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto" data-testid="text-generated-sql">
                        {queryResult.generated_sql}
                      </pre>
                    </div>
                  )}

                  {queryResult.narrative && (
                    <div className="p-4 bg-primary/5 rounded-md" data-testid="text-narrative">
                      {queryResult.narrative}
                    </div>
                  )}

                  {queryResult.results && queryResult.results.length > 0 && (
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {Object.keys(queryResult.results[0]).map((key) => (
                              <TableHead key={key}>{key}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {queryResult.results.slice(0, 20).map((row, i) => (
                            <TableRow key={i} data-testid={`row-result-${i}`}>
                              {Object.values(row).map((val, j) => (
                                <TableCell key={j}>
                                  {val !== null ? String(val) : "—"}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {queryResult.error && (
                    <div className="p-4 bg-destructive/10 text-destructive rounded-md" data-testid="text-error">
                      {queryResult.error}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="ingest" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Upload Excel File
                </CardTitle>
                <CardDescription>
                  Upload a financial Excel file to load into the semantic SQL database
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Excel File (.xlsx, .xls)</Label>
                  <Input 
                    type="file" 
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    data-testid="input-file-upload"
                  />
                </div>

                {selectedFile && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileSpreadsheet className="h-4 w-4" />
                    {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <Button 
                    onClick={handleIngest}
                    disabled={!selectedFile || !cubeId || ingestFileMutation.isPending}
                    data-testid="button-ingest"
                  >
                    {ingestFileMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    {ingestFileMutation.isPending ? "Processing..." : "Upload & Ingest"}
                  </Button>
                  {!cubeId && (
                    <span className="text-sm text-muted-foreground">Please select a cube above first</span>
                  )}
                </div>

                {ingestionResult && (
                  <div className={`p-4 rounded-md ${ingestionResult.success ? 'bg-primary/10' : 'bg-destructive/10'}`}>
                    {ingestionResult.success ? (
                      <div className="space-y-2" data-testid="text-ingestion-success">
                        <p className="font-medium">Ingestion Complete</p>
                        <p>Rows processed: {ingestionResult.rows_processed?.toLocaleString()}</p>
                        <p>Rows inserted: {ingestionResult.rows_inserted?.toLocaleString()}</p>
                        <p>Time: {ingestionResult.elapsed_seconds?.toFixed(1)}s</p>
                        {ingestionResult.cost_categories && (
                          <div>
                            <p className="font-medium mt-2">Cost Categories:</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {ingestionResult.cost_categories.map((cat, i) => (
                                <Badge key={i} variant="outline">{cat}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-destructive" data-testid="text-ingestion-error">{ingestionResult.error}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schema" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Cube Schema
                </CardTitle>
                <CardDescription>
                  View available dimensions and metrics for cube: {cubeId}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {schemaResult ? (
                  <div className="space-y-4" data-testid="text-schema-info">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Total Rows</Label>
                        <p className="text-2xl font-bold">{schemaResult.row_count?.toLocaleString()}</p>
                      </div>
                    </div>

                    <div>
                      <Label>Available Metrics</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {schemaResult.available_metrics?.map((metric, i) => (
                          <Badge key={i} variant="secondary">{metric}</Badge>
                        ))}
                      </div>
                    </div>

                    {Object.keys(schemaResult.dimensions || {}).length > 0 && (
                      <div>
                        <Label>Dimensions</Label>
                        <div className="space-y-2 mt-2">
                          {Object.entries(schemaResult.dimensions).map(([dim, values]) => (
                            <div key={dim} className="border rounded-md p-3">
                              <p className="font-medium">{dim}</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {(values as string[]).slice(0, 10).map((v, i) => (
                                  <Badge key={i} variant="outline">{v}</Badge>
                                ))}
                                {(values as string[]).length > 10 && (
                                  <Badge variant="outline">+{(values as string[]).length - 10} more</Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Click "Fetch Schema" to load cube information</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Schema Configuration Dialogs */}
      <ColumnConfigDialog
        open={columnConfigOpen}
        onOpenChange={setColumnConfigOpen}
        cubeId={cubeId}
        cubeName={cubesData?.cubes?.find(c => c.id === cubeId)?.name || 'Unknown'}
        file={selectedFile}
        onSaveComplete={() => fetchSchemaMutation.mutate()}
      />

      <HierarchyConfigDialog
        open={hierarchyConfigOpen}
        onOpenChange={setHierarchyConfigOpen}
        domainId="in.bosch.com"
        domainName="Bosch India"
      />
    </div>
  );
}
