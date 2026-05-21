import { useState, useEffect } from 'react';
import { useLocation, useSearch } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import { NetworkBackground } from '@/components/NetworkBackground';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { setAuthUser } from '@/lib/auth';

interface AuthResponse {
  success: boolean;
  requiresOtp?: boolean;
  user?: {
    id: string;
    username: string;
    displayName: string;
    role: string;
  };
}

interface SsoConfigResponse {
  authMethod: 'otp' | 'microsoft_sso';
}

function extractDomain(email: string): string {
  const at = email.indexOf('@');
  if (at < 0) return '';
  return email.slice(at + 1).toLowerCase().trim();
}

const SSO_ERROR_MESSAGES: Record<string, string> = {
  not_registered: 'Your account is not registered for this domain. Please contact your administrator.',
  domain_mismatch: 'Your Microsoft account email does not match the expected domain.',
  microsoft_error: 'Microsoft returned an error. Please try again.',
  config_error: 'SSO is not configured correctly for this domain. Please contact your administrator.',
  invalid_state: 'Invalid SSO session state. Please try again.',
  missing_params: 'Incomplete SSO response from Microsoft. Please try again.',
  domain_not_found: 'Domain not found. Please contact your administrator.',
  server_error: 'A server error occurred during sign-in. Please try again.',
};

export default function Welcome() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const [email, setEmail] = useState('');
  const [detectedDomain, setDetectedDomain] = useState('');
  const { toast } = useToast();

  // Show SSO error if redirected back from failed SSO
  useEffect(() => {
    const params = new URLSearchParams(search);
    const ssoError = params.get('sso_error');
    if (ssoError) {
      toast({
        title: 'Sign in failed',
        description: SSO_ERROR_MESSAGES[ssoError] || 'An error occurred during Microsoft sign-in.',
        variant: 'destructive',
      });
      window.history.replaceState({}, '', '/');
    }
  }, [search]);

  // Update detected domain as user types email
  useEffect(() => {
    const domain = extractDomain(email);
    setDetectedDomain(domain);
  }, [email]);

  // Fetch SSO config for the detected domain (only when domain looks valid)
  const hasDomain = detectedDomain.length > 0 && detectedDomain.includes('.');
  const { data: ssoConfig, isLoading: ssoConfigLoading } = useQuery<SsoConfigResponse>({
    queryKey: ['/api/auth/sso/config', detectedDomain],
    queryFn: async () => {
      if (!detectedDomain) return { authMethod: 'otp' as const };
      const res = await fetch(`/api/auth/sso/config?domain=${encodeURIComponent(detectedDomain)}`);
      return res.json();
    },
    enabled: hasDomain,
    staleTime: 30_000,
  });

  // True only when config has loaded AND confirmed SSO. While loading, assume unknown (block submit).
  const isSsoEnabled = ssoConfig?.authMethod === 'microsoft_sso';
  // Block the button whenever a valid domain is present but we haven't resolved the auth method yet
  const isResolvingAuthMethod = hasDomain && ssoConfigLoading;

  const signInMutation = useMutation({
    mutationFn: async (data: { email: string; deviceToken?: string }) => {
      return await apiRequest<AuthResponse>('POST', '/api/auth/signin', data);
    },
    onSuccess: (data, variables) => {
      if (data.requiresOtp) {
        sessionStorage.setItem('otp_email', variables.email);
        toast({
          title: 'Verification required',
          description: 'We\'ve sent a verification code to your email.',
        });
        setLocation('/verify-otp');
      } else if (data.user) {
        setAuthUser(data.user);
        queryClient.clear();
        setLocation('/dashboard');
      }
    },
    onError: () => {
      toast({
        title: 'Sign in failed',
        description: 'Please check your credentials and try again.',
        variant: 'destructive',
      });
    },
  });

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      const deviceToken = localStorage.getItem('device_token');
      signInMutation.mutate({ email, deviceToken: deviceToken || undefined });
    }
  };

  const handleMicrosoftSignIn = () => {
    if (!detectedDomain) return;
    window.location.href = `/api/auth/sso/microsoft/initiate?domain=${encodeURIComponent(detectedDomain)}`;
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Left Panel - White background with form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-white p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Logo and Tagline */}
          <div className="space-y-4">
            <img
              src="/Images - Logo/PNGs/120px.png"
              alt="LedgerLM Logo"
              className="h-8 w-9"
            />
            <span className="text-2xl font-bold text-foreground">LedgerLM</span>
            <h1 className="text-3xl font-medium text-foreground leading-tight">
              Turn Financial Data<br />into Clarity.
            </h1>
          </div>

          {/* Sign in form */}
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-foreground">
              Sign in
            </h2>
            <p className="text-sm text-muted-foreground">
              Enter your work email address to get started
            </p>

            <form onSubmit={isSsoEnabled ? (e) => { e.preventDefault(); handleMicrosoftSignIn(); } : handleContinue} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder="you@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 text-base"
                  required
                  autoFocus
                  data-testid="input-email"
                />
              </div>

              {isSsoEnabled ? (
                <Button
                  type="submit"
                  className="w-full h-12 text-base font-medium flex items-center justify-center gap-3"
                  disabled={!email || isResolvingAuthMethod}
                  data-testid="button-microsoft-signin"
                >
                  <MicrosoftIcon />
                  Continue with Microsoft
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-base font-medium"
                  disabled={!email || signInMutation.isPending || isResolvingAuthMethod}
                  data-testid="button-signin"
                >
                  {isResolvingAuthMethod ? 'Checking...' : signInMutation.isPending ? 'Sending code...' : 'Continue with email'}
                  {!isResolvingAuthMethod && <ArrowRight className="ml-2 h-5 w-5" />}
                </Button>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* Right Panel - Dark teal network background with overlay text */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <NetworkBackground theme="teal" />
        <div className="relative z-10 flex flex-col items-center justify-center w-full h-full p-12">
          <div className="max-w-md text-center space-y-6">
            <p className="text-xl text-white leading-relaxed">
              Connect, analyze, and summarize financial reports, balance sheets, 
              and audits—all in one secure workspace.
            </p>
            {/* Pagination dots */}
            <div className="flex items-center justify-center gap-2 pt-4">
              <div className="w-2 h-2 rounded-full bg-white" data-testid="pagination-dot-1"></div>
              <div className="w-2 h-2 rounded-full bg-white/40" data-testid="pagination-dot-2"></div>
              <div className="w-2 h-2 rounded-full bg-white/40" data-testid="pagination-dot-3"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}
