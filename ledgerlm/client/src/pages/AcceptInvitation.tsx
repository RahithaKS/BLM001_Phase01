import { useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { AuthLayout } from '@/components/AuthLayout';
import { XCircle, Loader2, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

export default function AcceptInvitation() {
  const [, setLocation] = useLocation();
  const [displayName, setDisplayName] = useState('');
  const { toast } = useToast();

  const token = new URLSearchParams(window.location.search).get('token');

  const { data: validation, isLoading } = useQuery({
    queryKey: ['/api/invitations/validate', token],
    queryFn: async () => {
      if (!token) throw new Error('No token provided');
      const res = await fetch(`/api/invitations/validate/${token}`);
      if (!res.ok) throw new Error('Invalid token');
      return res.json();
    },
    enabled: !!token,
  });

  const acceptMutation = useMutation({
    mutationFn: async (data: { token: string; displayName: string }) => {
      return apiRequest<{ success: boolean; requiresOtp: boolean; email: string; message: string }>('POST', '/api/invitations/accept', data);
    },
    onSuccess: (data) => {
      if (data.requiresOtp && data.email) {
        sessionStorage.setItem('otp_email', data.email);
        toast({
          title: 'Account created!',
          description: data.message || 'Verification code sent to your email.',
        });
        setLocation('/verify-otp');
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Registration failed',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!displayName.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter your full name',
        variant: 'destructive',
      });
      return;
    }

    if (!token) return;

    acceptMutation.mutate({ token, displayName });
  };

  if (!token) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invalid Invitation</h2>
            <p className="text-muted-foreground">No invitation token found in URL</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!validation?.valid) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invalid or Expired</h2>
            <p className="text-muted-foreground">
              {validation?.error || 'This invitation is no longer valid'}
            </p>
            <Button 
              className="mt-4" 
              onClick={() => setLocation('/')}
              data-testid="button-back-home"
            >
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold text-foreground">
              Accept Invitation
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Create your account for <strong className="text-foreground">{validation.email}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="displayName" className="text-sm font-medium">
              Full Name
            </Label>
            <Input
              id="displayName"
              placeholder="John Doe"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="h-11"
              autoFocus
              data-testid="input-display-name"
            />
            <p className="text-xs text-muted-foreground">
              You'll receive a verification code via email
            </p>
          </div>

          <Button
            type="submit"
            className="w-full h-11 text-base font-medium"
            disabled={acceptMutation.isPending}
            data-testid="button-create-account"
          >
            {acceptMutation.isPending ? 'Creating Account...' : 'Create Account'}
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
