import type { Block } from '@/components/knowledge-base/blocks/BlockEditor';

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'productivity' | 'documentation' | 'project' | 'personal' | 'education';
  blocks: Block[];
}

export const templates: DocumentTemplate[] = [
  {
    id: 'meeting-notes',
    name: 'Meeting Notes',
    description: 'Template for recording meeting discussions and action items',
    icon: 'event_note',
    category: 'productivity',
    blocks: [
      {
        id: 'block-1',
        type: 'heading1',
        content: 'Meeting Notes'
      },
      {
        id: 'block-2',
        type: 'text',
        content: '📅 Date: [Insert Date]'
      },
      {
        id: 'block-3',
        type: 'text',
        content: '👥 Attendees: [List attendees]'
      },
      {
        id: 'block-4',
        type: 'divider',
        content: null
      },
      {
        id: 'block-5',
        type: 'heading2',
        content: 'Agenda'
      },
      {
        id: 'block-6',
        type: 'bulletList',
        content: 'Topic 1'
      },
      {
        id: 'block-7',
        type: 'bulletList',
        content: 'Topic 2'
      },
      {
        id: 'block-8',
        type: 'heading2',
        content: 'Discussion Notes'
      },
      {
        id: 'block-9',
        type: 'text',
        content: '[Add discussion points here]'
      },
      {
        id: 'block-10',
        type: 'heading2',
        content: 'Action Items'
      },
      {
        id: 'block-11',
        type: 'checkbox',
        content: 'Action item 1',
        metadata: { checked: false }
      },
      {
        id: 'block-12',
        type: 'checkbox',
        content: 'Action item 2',
        metadata: { checked: false }
      }
    ]
  },
  {
    id: 'project-brief',
    name: 'Project Brief',
    description: 'Comprehensive project planning and overview template',
    icon: 'assignment',
    category: 'project',
    blocks: [
      {
        id: 'block-1',
        type: 'heading1',
        content: 'Project Brief'
      },
      {
        id: 'block-2',
        type: 'callout',
        content: {
          type: 'info',
          text: 'This document outlines the key details and objectives of the project.'
        }
      },
      {
        id: 'block-3',
        type: 'heading2',
        content: 'Project Overview'
      },
      {
        id: 'block-4',
        type: 'text',
        content: '[Describe the project in 2-3 sentences]'
      },
      {
        id: 'block-5',
        type: 'heading2',
        content: 'Objectives'
      },
      {
        id: 'block-6',
        type: 'numberedList',
        content: 'Primary objective'
      },
      {
        id: 'block-7',
        type: 'numberedList',
        content: 'Secondary objective'
      },
      {
        id: 'block-8',
        type: 'heading2',
        content: 'Timeline'
      },
      {
        id: 'block-9',
        type: 'table',
        content: {
          headers: ['Phase', 'Duration', 'Deliverables'],
          rows: [
            {
              id: 'row-1',
              cells: [
                { id: 'cell-1-1', content: 'Planning' },
                { id: 'cell-1-2', content: '2 weeks' },
                { id: 'cell-1-3', content: 'Project plan' }
              ]
            },
            {
              id: 'row-2',
              cells: [
                { id: 'cell-2-1', content: 'Execution' },
                { id: 'cell-2-2', content: '8 weeks' },
                { id: 'cell-2-3', content: 'Final product' }
              ]
            }
          ]
        }
      },
      {
        id: 'block-10',
        type: 'heading2',
        content: 'Resources'
      },
      {
        id: 'block-11',
        type: 'bulletList',
        content: 'Team members'
      },
      {
        id: 'block-12',
        type: 'bulletList',
        content: 'Budget'
      },
      {
        id: 'block-13',
        type: 'bulletList',
        content: 'Tools and software'
      }
    ]
  },
  {
    id: 'technical-documentation',
    name: 'Technical Documentation',
    description: 'Template for API docs, technical specs, and developer guides',
    icon: 'code',
    category: 'documentation',
    blocks: [
      {
        id: 'block-1',
        type: 'heading1',
        content: 'Technical Documentation'
      },
      {
        id: 'block-2',
        type: 'text',
        content: 'Version 1.0 | Last updated: [Date]'
      },
      {
        id: 'block-3',
        type: 'divider',
        content: null
      },
      {
        id: 'block-4',
        type: 'heading2',
        content: 'Overview'
      },
      {
        id: 'block-5',
        type: 'text',
        content: '[Brief description of the system/API/feature]'
      },
      {
        id: 'block-6',
        type: 'heading2',
        content: 'Getting Started'
      },
      {
        id: 'block-7',
        type: 'heading3',
        content: 'Installation'
      },
      {
        id: 'block-8',
        type: 'code',
        content: {
          language: 'bash',
          code: 'npm install package-name'
        }
      },
      {
        id: 'block-9',
        type: 'heading3',
        content: 'Basic Usage'
      },
      {
        id: 'block-10',
        type: 'code',
        content: {
          language: 'javascript',
          code: 'import { Component } from "package-name";\n\nconst example = new Component();'
        }
      },
      {
        id: 'block-11',
        type: 'heading2',
        content: 'API Reference'
      },
      {
        id: 'block-12',
        type: 'toggle',
        content: {
          title: 'Method: functionName()',
          content: 'Description of the method and its parameters',
          isOpen: false
        }
      },
      {
        id: 'block-13',
        type: 'heading2',
        content: 'Examples'
      },
      {
        id: 'block-14',
        type: 'text',
        content: '[Add code examples here]'
      }
    ]
  },
  {
    id: 'presentation',
    name: 'Presentation',
    description: 'Create a slide deck with canvas blocks',
    icon: 'slideshow',
    category: 'productivity',
    blocks: [
      {
        id: 'block-1',
        type: 'heading1',
        content: 'Presentation Title'
      },
      {
        id: 'block-2',
        type: 'text',
        content: 'Use the canvas block below to create your slides'
      },
      {
        id: 'block-3',
        type: 'canvas',
        content: {
          slides: [
            {
              id: 'slide-1',
              title: 'Welcome',
              content: 'Your Presentation Title',
              backgroundColor: '#1e293b',
              textColor: '#ffffff',
              layout: 'title'
            },
            {
              id: 'slide-2',
              title: 'Agenda',
              content: '• Point 1\n• Point 2\n• Point 3',
              backgroundColor: '#0f172a',
              textColor: '#ffffff',
              layout: 'content'
            },
            {
              id: 'slide-3',
              title: 'Thank You',
              content: 'Questions?',
              backgroundColor: '#1e293b',
              textColor: '#ffffff',
              layout: 'title'
            }
          ]
        }
      }
    ]
  },
  {
    id: 'study-notes',
    name: 'Study Notes',
    description: 'Organize learning materials and study resources',
    icon: 'school',
    category: 'education',
    blocks: [
      {
        id: 'block-1',
        type: 'heading1',
        content: 'Study Notes: [Subject]'
      },
      {
        id: 'block-2',
        type: 'text',
        content: '📚 Course: [Course Name] | 📅 Date: [Date]'
      },
      {
        id: 'block-3',
        type: 'divider',
        content: null
      },
      {
        id: 'block-4',
        type: 'heading2',
        content: 'Key Concepts'
      },
      {
        id: 'block-5',
        type: 'callout',
        content: {
          type: 'tip',
          text: 'Important concept to remember'
        }
      },
      {
        id: 'block-6',
        type: 'heading2',
        content: 'Definitions'
      },
      {
        id: 'block-7',
        type: 'toggle',
        content: {
          title: 'Term 1',
          content: 'Definition goes here',
          isOpen: false
        }
      },
      {
        id: 'block-8',
        type: 'toggle',
        content: {
          title: 'Term 2',
          content: 'Definition goes here',
          isOpen: false
        }
      },
      {
        id: 'block-9',
        type: 'heading2',
        content: 'Practice Questions'
      },
      {
        id: 'block-10',
        type: 'checkbox',
        content: 'Question 1',
        metadata: { checked: false }
      },
      {
        id: 'block-11',
        type: 'checkbox',
        content: 'Question 2',
        metadata: { checked: false }
      }
    ]
  },
  {
    id: 'blank',
    name: 'Blank Document',
    description: 'Start from scratch',
    icon: 'description',
    category: 'personal',
    blocks: [
      {
        id: 'block-1',
        type: 'text',
        content: ''
      }
    ]
  }
];

export function getTemplateById(id: string): DocumentTemplate | undefined {
  return templates.find(t => t.id === id);
}

export function getTemplatesByCategory(category: DocumentTemplate['category']): DocumentTemplate[] {
  return templates.filter(t => t.category === category);
}
