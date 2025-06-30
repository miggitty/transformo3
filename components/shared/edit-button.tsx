'use client';

import { Button } from '@/components/ui/button';
import { Edit2 } from 'lucide-react';
import { FieldConfig } from '@/types';

interface EditButtonProps {
  fieldConfig: FieldConfig;
  onEdit: (config: FieldConfig) => void;
  disabled?: boolean;
  className?: string;
}

export default function EditButton({
  fieldConfig,
  onEdit,
  disabled = false,
  className = '',
}: EditButtonProps) {
  const handleClick = () => {
    if (disabled) return;
    onEdit(fieldConfig);
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      className={`absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/90 backdrop-blur-sm border border-gray-200 shadow-lg hover:bg-white hover:shadow-xl ${className}`}
      onClick={handleClick}
      disabled={disabled}
      aria-label={`Edit ${fieldConfig.label}`}
    >
      <Edit2 className="h-4 w-4" />
    </Button>
  );
} 