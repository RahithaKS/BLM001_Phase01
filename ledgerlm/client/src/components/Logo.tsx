import { Sparkles } from 'lucide-react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export function Logo({ size = 'md', showText = true, className = '' }: LogoProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`${sizeClasses[size]} bg-primary rounded-md flex items-center justify-center`}>
        <Sparkles className="w-5 h-5 text-primary-foreground" />
      </div>
      {showText && (
        <span className={`font-semibold ${textSizeClasses[size]} text-foreground`}>
          LedgerLM
        </span>
      )}
    </div>
  );
}
