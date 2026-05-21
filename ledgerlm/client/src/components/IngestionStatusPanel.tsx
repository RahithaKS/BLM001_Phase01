import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface IngestionJob {
  id: string;
  cube_id: string;
  document_id: string | null;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  total_rows: number | null;
  processed_rows: number | null;
  error_message: string | null;
  file_name: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface IngestionStatusPanelProps {
  jobId?: string | null;
  cubeId?: string;
  onComplete?: () => void;
}

export function IngestionStatusPanel({ jobId, cubeId, onComplete }: IngestionStatusPanelProps) {
  const [isComplete, setIsComplete] = useState(false);

  const { data: jobData, isLoading, isError, error } = useQuery<{ success: boolean; job: IngestionJob }>({
    queryKey: ['/api/v2/semantic-sql/ingestion-jobs', jobId],
    queryFn: async () => {
      const res = await fetch(`/api/v2/semantic-sql/ingestion-jobs/${jobId}`);
      if (!res.ok) throw new Error('Failed to fetch job status');
      return res.json();
    },
    enabled: !!jobId && !isComplete,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.job?.status === 'succeeded' || data?.job?.status === 'failed') {
        return false;
      }
      return 2000;
    },
    retry: 2,
  });

  const job = jobData?.job;
  const progress = job?.total_rows && job?.processed_rows 
    ? Math.round((job.processed_rows / job.total_rows) * 100)
    : 0;

  useEffect(() => {
    if (job && (job.status === 'succeeded' || job.status === 'failed')) {
      setIsComplete(true);
      if (onComplete) {
        setTimeout(onComplete, 1500);
      }
    }
  }, [job?.status, onComplete]);

  if (!jobId) {
    return null;
  }

  if (isLoading && !job) {
    return (
      <Card data-testid="card-ingestion-status-loading">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading ingestion status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card data-testid="card-ingestion-status-error">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">
              Failed to load ingestion status: {error instanceof Error ? error.message : 'Unknown error'}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!job) {
    return null;
  }

  const getStatusIcon = () => {
    switch (job.status) {
      case 'queued':
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'succeeded':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  const getStatusBadge = () => {
    switch (job.status) {
      case 'queued':
        return <Badge variant="outline" data-testid="badge-status-queued">Queued</Badge>;
      case 'running':
        return <Badge className="bg-blue-500" data-testid="badge-status-running">Processing</Badge>;
      case 'succeeded':
        return <Badge className="bg-green-500" data-testid="badge-status-succeeded">Complete</Badge>;
      case 'failed':
        return <Badge variant="destructive" data-testid="badge-status-failed">Failed</Badge>;
      default:
        return null;
    }
  };

  const formatNumber = (n: number | null) => {
    if (n === null) return '0';
    return n.toLocaleString();
  };

  return (
    <Card data-testid="card-ingestion-status">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className="font-medium text-sm" data-testid="text-ingestion-title">
              {job.file_name || 'File Ingestion'}
            </span>
          </div>
          {getStatusBadge()}
        </div>

        {job.status === 'running' && (
          <>
            <Progress value={progress} className="h-2" data-testid="progress-ingestion" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span data-testid="text-rows-progress">
                {formatNumber(job.processed_rows)} / {formatNumber(job.total_rows)} rows
              </span>
              <span data-testid="text-progress-percent">{progress}%</span>
            </div>
          </>
        )}

        {job.status === 'succeeded' && job.processed_rows && (
          <p className="text-sm text-muted-foreground" data-testid="text-success-message">
            Successfully loaded {formatNumber(job.processed_rows)} rows into the cube.
          </p>
        )}

        {job.status === 'failed' && job.error_message && (
          <p className="text-sm text-destructive" data-testid="text-error-message">
            {job.error_message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface IngestionJobHistoryProps {
  cubeId: string;
  limit?: number;
}

export function IngestionJobHistory({ cubeId, limit = 5 }: IngestionJobHistoryProps) {
  const { data, isLoading, isError, error } = useQuery<{ success: boolean; jobs: IngestionJob[] }>({
    queryKey: ['/api/v2/semantic-sql/cubes', cubeId, 'ingestion-jobs'],
    queryFn: async () => {
      const res = await fetch(`/api/v2/semantic-sql/cubes/${cubeId}/ingestion-jobs?limit=${limit}`);
      if (!res.ok) throw new Error('Failed to fetch ingestion history');
      return res.json();
    },
    enabled: !!cubeId,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading history...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive p-2" data-testid="error-ingestion-history">
        <XCircle className="h-4 w-4" />
        <span>Failed to load history: {error instanceof Error ? error.message : 'Unknown error'}</span>
      </div>
    );
  }

  const jobs = data?.jobs || [];

  if (jobs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground p-2" data-testid="text-no-history">
        No ingestion history yet.
      </p>
    );
  }

  return (
    <div className="space-y-2" data-testid="list-ingestion-history">
      {jobs.map((job) => (
        <div key={job.id} className="flex items-center justify-between p-2 border rounded text-sm" data-testid={`item-job-${job.id}`}>
          <div className="flex items-center gap-2">
            {job.status === 'succeeded' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
            {job.status === 'failed' && <XCircle className="h-4 w-4 text-destructive" />}
            {job.status === 'running' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            {job.status === 'queued' && <Clock className="h-4 w-4 text-muted-foreground" />}
            <span className="truncate max-w-[200px]">{job.file_name || 'Unknown file'}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>{job.processed_rows?.toLocaleString() || 0} rows</span>
            <span className="text-xs">
              {new Date(job.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
