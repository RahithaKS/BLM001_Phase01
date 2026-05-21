import { useMemo } from 'react';
import { Check, X } from 'lucide-react';
import { PASSWORD_REQUIREMENTS } from '@shared/schema';

interface PasswordStrengthMeterProps {
  password: string;
}

const UPPERCASE_REGEX = /[A-Z]/;
const LOWERCASE_REGEX = /[a-z]/;
const NUMBER_REGEX = /[0-9]/;
const SPECIAL_CHAR_REGEX = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const checks = useMemo(() => {
    return {
      minLength: password.length >= PASSWORD_REQUIREMENTS.minLength,
      hasUppercase: UPPERCASE_REGEX.test(password),
      hasLowercase: LOWERCASE_REGEX.test(password),
      hasNumber: NUMBER_REGEX.test(password),
      hasSpecial: SPECIAL_CHAR_REGEX.test(password),
    };
  }, [password]);

  const strength = useMemo(() => {
    const passedChecks = Object.values(checks).filter(Boolean).length;
    if (passedChecks === 0) return { label: '', color: 'bg-gray-200', width: '0%' };
    if (passedChecks <= 2) return { label: 'Weak', color: 'bg-red-500', width: '33%' };
    if (passedChecks <= 3) return { label: 'Fair', color: 'bg-yellow-500', width: '66%' };
    if (passedChecks <= 4) return { label: 'Good', color: 'bg-blue-500', width: '83%' };
    return { label: 'Strong', color: 'bg-green-500', width: '100%' };
  }, [checks]);

  const requirements = [
    { key: 'minLength', label: `At least ${PASSWORD_REQUIREMENTS.minLength} characters`, met: checks.minLength },
    { key: 'hasUppercase', label: 'One uppercase letter', met: checks.hasUppercase },
    { key: 'hasLowercase', label: 'One lowercase letter', met: checks.hasLowercase },
    { key: 'hasNumber', label: 'One number', met: checks.hasNumber },
    { key: 'hasSpecial', label: 'One special character (!@#$%^&*)', met: checks.hasSpecial },
  ];

  const allMet = Object.values(checks).every(Boolean);

  return (
    <div className="space-y-3" data-testid="password-strength-meter">
      {password && (
        <>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Password strength:</span>
              <span className={`font-medium ${
                strength.label === 'Strong' ? 'text-green-600' :
                strength.label === 'Good' ? 'text-blue-600' :
                strength.label === 'Fair' ? 'text-yellow-600' :
                strength.label === 'Weak' ? 'text-red-600' : ''
              }`} data-testid="strength-label">
                {strength.label}
              </span>
            </div>
            <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${strength.color}`}
                style={{ width: strength.width }}
                data-testid="strength-bar"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            {requirements.map((req) => (
              <div
                key={req.key}
                className="flex items-center gap-2 text-xs"
                data-testid={`requirement-${req.key}`}
              >
                {req.met ? (
                  <Check className="h-3.5 w-3.5 text-green-600" data-testid={`check-${req.key}`} />
                ) : (
                  <X className="h-3.5 w-3.5 text-gray-400" data-testid={`x-${req.key}`} />
                )}
                <span className={req.met ? 'text-green-600' : 'text-muted-foreground'}>
                  {req.label}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
