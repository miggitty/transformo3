'use client';

import type { PasswordValidation } from '@/types/auth';

interface RequirementItemProps {
  met: boolean;
  children: React.ReactNode;
}

const RequirementItem = ({ met, children }: RequirementItemProps) => (
  <div className={`flex items-center gap-2 ${met ? 'text-green-600' : 'text-gray-400'}`}>
    <span className="text-sm">{met ? '✓' : '○'}</span>
    <span className="text-sm">{children}</span>
  </div>
);

interface PasswordRequirementsProps {
  validation: PasswordValidation;
  className?: string;
}

export function PasswordRequirements({ validation, className = '' }: PasswordRequirementsProps) {
  return (
    <div className={`space-y-1 p-3 bg-gray-50 rounded-md ${className}`}>
      <p className="text-sm font-medium text-gray-700 mb-2">
        Password Requirements:
      </p>
      <RequirementItem met={validation.requirements.length}>
        At least 8 characters
      </RequirementItem>
      <RequirementItem met={validation.requirements.lowercase}>
        One lowercase letter (a-z)
      </RequirementItem>
      <RequirementItem met={validation.requirements.uppercase}>
        One uppercase letter (A-Z)
      </RequirementItem>
      <RequirementItem met={validation.requirements.digit}>
        One number (0-9)
      </RequirementItem>
    </div>
  );
} 