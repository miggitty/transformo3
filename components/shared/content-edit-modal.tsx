'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/shared/rich-text-editor';
import { Loader2, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { FieldConfig } from '@/types';

interface ContentEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldConfig: FieldConfig;
  onSave: (value: string) => Promise<void>;
  isLoading?: boolean;
}

export default function ContentEditModal({
  open,
  onOpenChange,
  fieldConfig,
  onSave,
  isLoading = false,
}: ContentEditModalProps) {
  const [value, setValue] = useState(fieldConfig.value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens/closes or field config changes
  useEffect(() => {
    if (open) {
      setValue(fieldConfig.value);
      setError(null);
      setIsSaving(false);
    }
  }, [open, fieldConfig.value]);

  const handleSave = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    setError(null);

    try {
      await onSave(value);
      toast.success(`${fieldConfig.label} updated successfully!`);
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving field:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save changes. Please try again.';
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (isSaving) return;
    onOpenChange(false);
  };

  const renderInput = () => {
    const disabled = isLoading || isSaving;
    
    switch (fieldConfig.inputType) {
      case 'text':
        return (
          <Input
            id="edit-field"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={fieldConfig.placeholder}
            maxLength={fieldConfig.maxLength}
            disabled={disabled}
            className="w-full"
          />
        );
      
      case 'textarea':
        return (
          <Textarea
            id="edit-field"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={fieldConfig.placeholder}
            maxLength={fieldConfig.maxLength}
            disabled={disabled}
            className="min-h-[120px] w-full"
          />
        );
      
      case 'html':
        return (
          <div className="w-full">
            <RichTextEditor
              initialContent={value}
              onUpdate={setValue}
              disabled={disabled}
            />
          </div>
        );
      
      default:
        return null;
    }
  };

  const isDisabled = isLoading || isSaving;
  const hasChanges = value !== fieldConfig.value;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {fieldConfig.label}</DialogTitle>
          <DialogDescription>
            Make changes to your {fieldConfig.label.toLowerCase()} below. Changes will be saved immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-6">
          {/* Input Field */}
          <div className="space-y-2">
            <Label htmlFor="edit-field">{fieldConfig.label}</Label>
            {renderInput()}
            {fieldConfig.maxLength && (
              <p className="text-xs text-muted-foreground">
                {value.length} / {fieldConfig.maxLength} characters
              </p>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setError(null)}
                className="mt-2"
              >
                Dismiss
              </Button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={handleCancel}
              disabled={isDisabled}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={isDisabled || !hasChanges}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 