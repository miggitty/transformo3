import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import { FieldConfig } from '@/types';

export class DocumentGenerator {
  static async downloadAsDocx(fieldConfig: FieldConfig, contentTitle?: string): Promise<void> {
    try {
      let doc: Document;
      
      if (fieldConfig.inputType === 'html') {
        // Convert HTML to DOCX with formatting
        doc = await this.convertHtmlToDocx(fieldConfig.value || '', fieldConfig.label);
      } else {
        // Create simple DOCX for plain text
        doc = this.createPlainTextDocx(fieldConfig.value || '', fieldConfig.label);
      }
      
      // Generate and download file
      const blob = await Packer.toBlob(doc);
      const filename = this.generateFilename(fieldConfig, contentTitle);
      saveAs(blob, filename);
      
    } catch (error) {
      console.error('Document generation failed:', error);
      throw error;
    }
  }
  
  private static async convertHtmlToDocx(html: string, title: string): Promise<Document> {
    // For now, create a simple document with HTML content converted to text
    // In the future, we could use html-to-docx library for rich formatting
    try {
      // Create a document with the HTML content converted to plain text
      return new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              text: title,
              heading: HeadingLevel.HEADING_1,
            }),
            // Note: For full HTML support, we'd need to parse HTML and convert to docx elements
            // For now, we'll create a simple text version
            new Paragraph({
              children: [new TextRun(this.htmlToText(html))],
            }),
          ]
        }]
      });
    } catch (error) {
      console.error('HTML to DOCX conversion failed:', error);
      // Fallback to plain text
      return this.createPlainTextDocx(this.htmlToText(html), title);
    }
  }
  
  private static createPlainTextDocx(text: string, title: string): Document {
    const paragraphs = text.split('\n').map(line => 
      new Paragraph({
        children: [new TextRun(line)],
      })
    );
    
    return new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: title,
            heading: HeadingLevel.HEADING_1,
          }),
          ...paragraphs
        ]
      }]
    });
  }
  
  private static htmlToText(html: string): string {
    // Simple HTML to text conversion
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || '';
  }
  
  private static generateFilename(fieldConfig: FieldConfig, contentTitle?: string): string {
    const timestamp = new Date().toISOString().split('T')[0];
    
    // Sanitize content title for filename (first 30 chars, remove special chars)
    const sanitizedTitle = contentTitle 
      ? contentTitle.substring(0, 30).replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, ' ').trim()
      : null;
    
    // Generate descriptive field names
    const descriptiveFieldName = this.getDescriptiveFieldName(fieldConfig);
    
    // Build filename with content title prefix
    const prefix = sanitizedTitle ? `${sanitizedTitle}_` : '';
    
    return `${prefix}${descriptiveFieldName}_${timestamp}.docx`;
  }

  private static getDescriptiveFieldName(fieldConfig: FieldConfig): string {
    const { fieldKey, assetType } = fieldConfig;
    
    // Map generic field names to more descriptive ones
    const fieldNameMap: Record<string, string> = {
      // Email fields
      'headline_email': 'email_subject',
      'content_email': 'email_content',
      
      // Blog post fields  
      'headline_blog_post': 'blog_post_title',
      'content_blog_post': 'blog_post_content',
      'blog_meta_description_blog_post': 'blog_post_meta_description',
      'blog_url_blog_post': 'blog_post_url',
      
      // YouTube fields
      'headline_youtube_video': 'youtube_title', 
      'content_youtube_video': 'youtube_description',
      
      // Social media fields
      'content_social_blog_post': 'social_blog_post_content',
      'content_social_rant_post': 'social_rant_post_content',
      'content_social_long_video': 'social_long_video_content',
      'content_social_short_video': 'social_short_video_content',
      
      // Content table fields
      'content_title': 'content_title',
      'video_script': 'video_script',
      'transcript': 'transcript',
      'research': 'research',
    };
    
    // Create key for mapping
    const mapKey = assetType ? `${fieldKey}_${assetType}` : fieldKey;
    
    return fieldNameMap[mapKey] || `${assetType || 'content'}_${fieldKey}`;
  }
} 