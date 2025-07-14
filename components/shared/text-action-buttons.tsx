'use client';

import { Button } from '@/components/ui/button';
import { Download, Copy, Pen } from 'lucide-react';
import { FieldConfig } from '@/types';

interface TextActionButtonsProps {
  fieldConfig: FieldConfig;
  contentTitle?: string; // Content title for filename generation
  onEdit: (config: FieldConfig) => void;
  onCopy: (config: FieldConfig) => void;
  onDownload: (config: FieldConfig) => void;
  disabled?: boolean;
  className?: string;
}

export default function TextActionButtons({
  fieldConfig,
  contentTitle: _,
  onEdit,
  onCopy,
  onDownload,
  disabled = false,
  className = '',
}: TextActionButtonsProps) {
  const handleDownload = () => {
    if (disabled) return;
    onDownload(fieldConfig);
  };

  const handleCopy = () => {
    if (disabled) return;
    onCopy(fieldConfig);
  };

  const handleEdit = () => {
    if (disabled) return;
    onEdit(fieldConfig);
  };

  return (
    <div className={`absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-all duration-300 flex gap-2 ${className}`}>
      {/* Download Button */}
      <Button
        variant="secondary"
        size="sm"
        className={`bg-green-600 hover:bg-green-700 text-white border-0 shadow-lg hover:shadow-xl hover:scale-105 ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
        onClick={handleDownload}
        disabled={disabled}
        aria-label={`Download ${fieldConfig.label}`}
      >
        <Download className="h-4 w-4" />
      </Button>

      {/* Copy Button */}
      <Button
        variant="secondary"
        size="sm"
        className={`bg-purple-600 hover:bg-purple-700 text-white border-0 shadow-lg hover:shadow-xl hover:scale-105 ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
        onClick={handleCopy}
        disabled={disabled}
        aria-label={`Copy ${fieldConfig.label}`}
      >
        <Copy className="h-4 w-4" />
      </Button>

      {/* Edit Button */}
      <Button
        variant="secondary"
        size="sm"
        className={`bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-lg hover:shadow-xl hover:scale-105 ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
        onClick={handleEdit}
        disabled={disabled}
        aria-label={`Edit ${fieldConfig.label}`}
      >
        <Pen className="h-4 w-4 mr-1" />
        <span className="text-xs font-medium">Edit</span>
      </Button>
    </div>
  );
} 