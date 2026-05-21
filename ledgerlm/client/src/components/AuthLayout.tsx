import { NetworkBackground } from '@/components/NetworkBackground';
import { Logo } from '@/components/Logo';

interface AuthLayoutProps {
  children: React.ReactNode;
  rightPanelContent?: React.ReactNode;
}

export function AuthLayout({ children, rightPanelContent }: AuthLayoutProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Left Panel - White background with form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-white p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Logo and Tagline */}
          <div className="flex items-center gap-2">
            <img
              src="/Images - Logo/PNGs/120px.png"
              alt="LedgerLM Logo"
              className="h-8 w-9"
            />
            <span className="text-2xl font-bold text-foreground">LedgerLM</span>
          </div>

          {children}
        </div>
      </div>

      {/* Right Panel - Dark teal network background */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <NetworkBackground theme="teal" />
        <div className="relative z-10 flex flex-col items-center justify-center w-full h-full p-12">
          {rightPanelContent || (
            <div className="max-w-md text-center space-y-6">
              <p className="text-xl text-white leading-relaxed">
                Connect, analyze, and summarize financial reports, balance sheets, 
                and audits—all in one secure workspace.
              </p>
              <div className="flex items-center justify-center gap-2 pt-4">
                <div className="w-2 h-2 rounded-full bg-white" data-testid="pagination-dot-1"></div>
                <div className="w-2 h-2 rounded-full bg-white/40" data-testid="pagination-dot-2"></div>
                <div className="w-2 h-2 rounded-full bg-white/40" data-testid="pagination-dot-3"></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
