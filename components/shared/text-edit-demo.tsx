'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import EditButton from './edit-button';
import ContentEditModal from './content-edit-modal';
import { FieldConfig } from '@/types';

// Demo component to test the text editing functionality
export default function TextEditDemo() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentField, setCurrentField] = useState<FieldConfig | null>(null);
  
  // Demo data
  const [demoData, setDemoData] = useState({
    title: 'Sample Blog Post Title',
    description: 'This is a sample description that can be edited using the textarea input type.',
    content: '<h2>Sample Blog Content</h2><p>This is <strong>rich text content</strong> that can be edited with the HTML editor. It supports:</p><ul><li>Bold and italic formatting</li><li>Headings (H1-H4)</li><li>Bullet and numbered lists</li></ul><p>Try clicking the edit button to modify this content!</p>',
  });

  const fieldConfigs: Record<string, FieldConfig> = {
    title: {
      label: 'Title',
      value: demoData.title,
      fieldKey: 'title',
      inputType: 'text',
      placeholder: 'Enter title...',
      maxLength: 100,
    },
    description: {
      label: 'Description',
      value: demoData.description,
      fieldKey: 'description',
      inputType: 'textarea',
      placeholder: 'Enter description...',
      maxLength: 500,
    },
    content: {
      label: 'Content',
      value: demoData.content,
      fieldKey: 'content',
      inputType: 'html',
      placeholder: 'Enter content...',
    },
  };

  const handleEdit = (fieldConfig: FieldConfig) => {
    setCurrentField(fieldConfig);
    setIsModalOpen(true);
  };

  const handleSave = async (value: string) => {
    if (!currentField) return;
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Update demo data
    setDemoData(prev => ({
      ...prev,
      [currentField.fieldKey]: value,
    }));
    
    // Update current field config with new value
    setCurrentField(prev => prev ? { ...prev, value } : null);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Text Editing Demo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Title Field */}
          <div className="relative group">
            <h3 className="text-lg font-semibold mb-2">Title</h3>
            <div className="p-4 border rounded-lg bg-muted/20 relative">
              <h1 className="text-2xl font-bold">{demoData.title}</h1>
              <EditButton
                fieldConfig={fieldConfigs.title}
                onEdit={handleEdit}
              />
            </div>
          </div>

          {/* Description Field */}
          <div className="relative group">
            <h3 className="text-lg font-semibold mb-2">Description</h3>
            <div className="p-4 border rounded-lg bg-muted/20 relative">
              <p className="text-muted-foreground">{demoData.description}</p>
              <EditButton
                fieldConfig={fieldConfigs.description}
                onEdit={handleEdit}
              />
            </div>
          </div>

          {/* Rich Content Field */}
          <div className="relative group">
            <h3 className="text-lg font-semibold mb-2">Rich Content</h3>
            <div className="p-4 border rounded-lg bg-muted/20 relative">
              <div 
                className="prose dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: demoData.content }}
              />
              <EditButton
                fieldConfig={fieldConfigs.content}
                onEdit={handleEdit}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Modal */}
      {currentField && (
        <ContentEditModal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          fieldConfig={currentField}
          onSave={handleSave}
        />
      )}
    </div>
  );
} 