'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { templates, type DocumentTemplate } from '@/lib/kb/templates';

interface TemplateSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (template: DocumentTemplate) => void;
}

const categories = [
  { id: 'all', label: 'All Templates', icon: 'apps' },
  { id: 'productivity', label: 'Productivity', icon: 'work' },
  { id: 'documentation', label: 'Documentation', icon: 'description' },
  { id: 'project', label: 'Project', icon: 'folder' },
  { id: 'education', label: 'Education', icon: 'school' },
  { id: 'personal', label: 'Personal', icon: 'person' }
] as const;

export default function TemplateSelector({ isOpen, onClose, onSelect }: TemplateSelectorProps) {
  const t = useTranslations();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  if (!isOpen) return null;

  const filteredTemplates = selectedCategory === 'all'
    ? templates
    : templates.filter(t => t.category === selectedCategory);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-(--color-bg-primary) rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-(--color-border)">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-(--color-text-primary)">
              {t('knowledgeBase.chooseTemplate')}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-(--color-bg-secondary) rounded-lg transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-(--color-text-secondary)">close</span>
            </button>
          </div>

          {/* Category Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  selectedCategory === category.id
                    ? 'bg-(--color-accent) text-white'
                    : 'bg-(--color-bg-secondary) text-(--color-text-secondary) hover:bg-(--color-bg-tertiary)'
                }`}
              >
                <span className="material-symbols-outlined text-lg">{category.icon}</span>
                <span className="text-sm font-medium">{category.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Templates Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map(template => (
              <button
                key={template.id}
                onClick={() => {
                  onSelect(template);
                  onClose();
                }}
                className="group text-left p-6 bg-(--color-bg-secondary) border border-(--color-border) rounded-xl hover:border-(--color-accent) hover:shadow-lg transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-start gap-4 mb-3">
                  <div className="shrink-0 w-12 h-12 bg-(--color-accent)/10 rounded-lg flex items-center justify-center group-hover:bg-(--color-accent)/20 transition-colors">
                    <span className="material-symbols-outlined text-2xl text-(--color-accent)">
                      {template.icon}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-(--color-text-primary) mb-1 group-hover:text-(--color-accent) transition-colors">
                      {template.name}
                    </h3>
                    <p className="text-xs text-(--color-text-secondary) line-clamp-2">
                      {template.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-(--color-text-tertiary)">
                  <span className="material-symbols-outlined text-sm">description</span>
                  <span>{template.blocks.length} blocks</span>
                </div>
              </button>
            ))}
          </div>

          {filteredTemplates.length === 0 && (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-6xl text-(--color-text-tertiary) mb-4 block">
                search_off
              </span>
              <p className="text-(--color-text-secondary)">
                {t('knowledgeBase.noTemplatesFound')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
