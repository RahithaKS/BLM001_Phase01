import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { AuthLayout } from '@/components/AuthLayout';
import { Shield, Loader2, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { setAuthUser } from '@/lib/auth';

export default function VerifyOTP() {
  const [, setLocation] = useLocation();
  const [code, setCode] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [email, setEmail] = useState('');
  const [canResend, setCanResend] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(60);
  const { toast } = useToast();

  useEffect(() => {
    const storedEmail = sessionStorage.getItem('otp_email');
    if (!storedEmail) {
      setLocation('/');
      return;
    }
    setEmail(storedEmail);

    const timer = setInterval(() => {
      setResendCountdown((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [setLocation]);

  const verifyMutation = useMutation({
    mutationFn: async (data: { email: string; otpCode: string; rememberDevice: boolean; deviceFingerprint?: string }) => {
      return await apiRequest<{
        success: boolean;
        user: any;
        deviceToken?: string;
      }>('POST', '/api/auth/verify-otp', data);
    },
    onSuccess: (data) => {
      if (data.user) {
        setAuthUser(data.user);
        queryClient.clear();
      }
      if (data.deviceToken && rememberDevice) {
        localStorage.setItem('device_token', data.deviceToken);
      }
      sessionStorage.removeItem('otp_email');
      toast({
        title: 'Verification successful',
        description: 'Welcome to LedgerLM!',
      });
      setLocation('/dashboard');
    },
    onError: (error: any) => {
      toast({
        title: 'Verification failed',
        description: error.message || 'Invalid or expired code. Please try again.',
        variant: 'destructive',
      });
      setCode('');
    },
  });

  const resendMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/auth/resend-otp', { email });
    },
    onSuccess: () => {
      toast({
        title: 'Code sent',
        description: 'A new verification code has been sent to your email.',
      });
      setCanResend(false);
      setResendCountdown(60);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to resend code',
        description: error.message || 'Please try again later.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length === 6) {
      const deviceFingerprint = navigator.userAgent + navigator.language;
      verifyMutation.mutate({ email, otpCode: code, rememberDevice, deviceFingerprint });
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(value);
  };

  const handleBack = () => {
    sessionStorage.removeItem('otp_email');
    setLocation('/');
  };

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold text-foreground">
              Verify Your Identity
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            We've sent a 6-digit verification code to{' '}
            <strong className="text-foreground">{email}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="code" className="text-sm font-medium">
              Verification Code
            </Label>
            <Input
              id="code"
              type="text"
              inputMode="numeric"
              placeholder="000000"
              value={code}
              onChange={handleCodeChange}
              maxLength={6}
              className="h-11 text-center text-2xl tracking-widest font-mono"
              autoComplete="one-time-code"
              autoFocus
              data-testid="input-otp-code"
            />
            <p className="text-xs text-muted-foreground">
              Enter the 6-digit code from your email
            </p>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-md bg-muted/30">
            <Checkbox
              id="rememberDevice"
              checked={rememberDevice}
              onCheckedChange={(checked) => setRememberDevice(checked === true)}
              data-testid="checkbox-remember-device"
            />
            <div className="space-y-1">
              <Label
                htmlFor="rememberDevice"
                className="text-sm font-medium cursor-pointer"
              >
                Remember this device for 10 days
              </Label>
              <p className="text-xs text-muted-foreground">
                You won't need to verify again on this device for 10 days
              </p>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-11 text-base font-medium"
            disabled={code.length !== 6 || verifyMutation.isPending}
            data-testid="button-verify"
          >
            {verifyMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify Code'
            )}
          </Button>

          <div className="space-y-3">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-muted-foreground">
                  Didn't receive the code?
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => resendMutation.mutate()}
              disabled={!canResend || resendMutation.isPending}
              data-testid="button-resend"
            >
              {resendMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : canResend ? (
                'Resend Code'
              ) : (
                `Resend in ${resendCountdown}s`
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={handleBack}
              data-testid="button-back"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Sign In
            </Button>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
}
