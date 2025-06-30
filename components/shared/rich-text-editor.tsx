'use client';

import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Toggle } from '@/components/ui/toggle';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Underline as UnderlineIcon,
  Link as LinkIcon,
  Image as ImageIcon,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
} from 'lucide-react';

const TiptapToolbar = ({ editor, disabled }: { editor: Editor | null; disabled?: boolean }) => {
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  if (!editor) {
    return null;
  }

  const addLink = () => {
    if (linkUrl) {
      editor.chain().focus().setLink({ href: linkUrl }).run();
      setLinkUrl('');
      setIsLinkModalOpen(false);
    }
  };

  const removeLink = () => {
    editor.chain().focus().unsetLink().run();
  };

  const addImage = () => {
    const url = window.prompt('Enter image URL:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-1 rounded-md border border-input bg-transparent p-1 ${
      disabled ? 'opacity-50' : ''
    }`}>
      {/* Headings */}
      <Toggle
        size="sm"
        pressed={editor.isActive('heading', { level: 1 })}
        onPressedChange={(pressed) => {
          if (pressed) {
            editor.chain().focus().toggleHeading({ level: 1 }).run();
          } else {
            editor.chain().focus().setParagraph().run();
          }
        }}
        disabled={disabled}
      >
        <Heading1 className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('heading', { level: 2 })}
        onPressedChange={(pressed) => {
          if (pressed) {
            editor.chain().focus().toggleHeading({ level: 2 }).run();
          } else {
            editor.chain().focus().setParagraph().run();
          }
        }}
        disabled={disabled}
      >
        <Heading2 className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('heading', { level: 3 })}
        onPressedChange={(pressed) => {
          if (pressed) {
            editor.chain().focus().toggleHeading({ level: 3 }).run();
          } else {
            editor.chain().focus().setParagraph().run();
          }
        }}
        disabled={disabled}
      >
        <Heading3 className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('heading', { level: 4 })}
        onPressedChange={(pressed) => {
          if (pressed) {
            editor.chain().focus().toggleHeading({ level: 4 }).run();
          } else {
            editor.chain().focus().setParagraph().run();
          }
        }}
        disabled={disabled}
      >
        <Heading4 className="h-4 w-4" />
      </Toggle>

      {/* Text Formatting */}
      <Toggle
        size="sm"
        pressed={editor.isActive('bold')}
        onPressedChange={() => {
          editor.chain().focus().toggleBold().run();
        }}
        disabled={disabled}
      >
        <Bold className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('italic')}
        onPressedChange={() => {
          editor.chain().focus().toggleItalic().run();
        }}
        disabled={disabled}
      >
        <Italic className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('underline')}
        onPressedChange={() => {
          editor.chain().focus().toggleUnderline().run();
        }}
        disabled={disabled}
      >
        <UnderlineIcon className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('strike')}
        onPressedChange={() => {
          editor.chain().focus().toggleStrike().run();
        }}
        disabled={disabled}
      >
        <Strikethrough className="h-4 w-4" />
      </Toggle>

      {/* Lists */}
      <Toggle
        size="sm"
        pressed={editor.isActive('bulletList')}
        onPressedChange={() => {
          editor.chain().focus().toggleBulletList().run();
        }}
        disabled={disabled}
      >
        <List className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('orderedList')}
        onPressedChange={() => {
          editor.chain().focus().toggleOrderedList().run();
        }}
        disabled={disabled}
      >
        <ListOrdered className="h-4 w-4" />
      </Toggle>

      {/* Blockquote */}
      <Toggle
        size="sm"
        pressed={editor.isActive('blockquote')}
        onPressedChange={() => {
          editor.chain().focus().toggleBlockquote().run();
        }}
        disabled={disabled}
      >
        <Quote className="h-4 w-4" />
      </Toggle>

      {/* Text Alignment */}
      <Toggle
        size="sm"
        pressed={editor.isActive({ textAlign: 'left' })}
        onPressedChange={() => {
          editor.chain().focus().setTextAlign('left').run();
        }}
        disabled={disabled}
      >
        <AlignLeft className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive({ textAlign: 'center' })}
        onPressedChange={() => {
          editor.chain().focus().setTextAlign('center').run();
        }}
        disabled={disabled}
      >
        <AlignCenter className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive({ textAlign: 'right' })}
        onPressedChange={() => {
          editor.chain().focus().setTextAlign('right').run();
        }}
        disabled={disabled}
      >
        <AlignRight className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive({ textAlign: 'justify' })}
        onPressedChange={() => {
          editor.chain().focus().setTextAlign('justify').run();
        }}
        disabled={disabled}
      >
        <AlignJustify className="h-4 w-4" />
      </Toggle>

      {/* Link */}
      <div className="relative">
        <Toggle
          size="sm"
          pressed={editor.isActive('link')}
          onPressedChange={() => {
            if (editor.isActive('link')) {
              removeLink();
            } else {
              setIsLinkModalOpen(true);
            }
          }}
          disabled={disabled}
        >
          <LinkIcon className="h-4 w-4" />
        </Toggle>
        
        {isLinkModalOpen && (
          <div className="absolute top-10 left-0 z-50 bg-white border border-gray-200 rounded-md p-2 shadow-lg min-w-[200px]">
            <input
              type="url"
              placeholder="Enter URL..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addLink();
                } else if (e.key === 'Escape') {
                  setIsLinkModalOpen(false);
                  setLinkUrl('');
                }
              }}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex gap-1 mt-2">
              <Button size="sm" onClick={addLink} disabled={!linkUrl}>
                Add
              </Button>
              <Button size="sm" variant="outline" onClick={() => {
                setIsLinkModalOpen(false);
                setLinkUrl('');
              }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Image */}
      <Toggle
        size="sm"
        pressed={false}
        onPressedChange={addImage}
        disabled={disabled}
      >
        <ImageIcon className="h-4 w-4" />
      </Toggle>
    </div>
  );
};

export const RichTextEditor = ({
  initialContent,
  onUpdate,
  disabled,
}: {
  initialContent: string;
  onUpdate: (content: string) => void;
  disabled?: boolean;
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-md',
        },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content: initialContent,
    immediatelyRender: false,
    injectCSS: false, // Disable TipTap's default CSS
    onUpdate: ({ editor }) => {
      if (!disabled) {
        onUpdate(editor.getHTML());
      }
    },
    editable: !disabled,
    editorProps: {
      attributes: {
        class: `focus:outline-none min-h-[150px] p-3 rounded-md border border-input bg-background text-gray-900 ${
          disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
        }`,
      },
    },
  });

  // Update editor editable state when disabled prop changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [editor, disabled]);

  // Update editor content when initialContent changes
  useEffect(() => {
    if (editor && initialContent !== editor.getHTML()) {
      editor.commands.setContent(initialContent);
    }
  }, [editor, initialContent]);

  return (
    <div className="flex flex-col gap-2">
      <TiptapToolbar editor={editor} disabled={disabled} />
      <EditorContent editor={editor} />
    </div>
  );
}; 