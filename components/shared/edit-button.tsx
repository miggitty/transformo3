'use client';

import { Button } from '@/components/ui/button';
import { Pen } from 'lucide-react';
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
      className={`absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-lg hover:shadow-xl hover:scale-105 ${disabled ? 'opacity-30 cursor-not-allowed' : ''} ${className}`}
      onClick={handleClick}
      disabled={disabled}
      aria-label={`Edit ${fieldConfig.label}`}
    >
      <Pen className="h-4 w-4 mr-1" />
      <span className="text-xs font-medium">Edit</span>
    </Button>
  );
} 