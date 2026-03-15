'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import type { Block } from './BlockEditor';

interface CanvasBlockProps {
  block: Block;
  readOnly: boolean;
  focused: boolean;
  onFocus: () => void;
  onChange: (content: any) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  showMoveUp: boolean;
  showMoveDown: boolean;
}

interface Slide {
  id: string;
  title: string;
  content: string;
  backgroundColor: string;
  textColor: string;
  layout: 'title' | 'content' | 'two-column' | 'image-text';
}

export default function CanvasBlock({
  block,
  readOnly,
  focused,
  onFocus,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  showMoveUp,
  showMoveDown
}: CanvasBlockProps) {
  const t = useTranslations();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPresenting, setIsPresenting] = useState(false);
  const [editingSlide, setEditingSlide] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const slides: Slide[] = block.content?.slides || [
    {
      id: 'slide-1',
      title: 'Title Slide',
      content: 'Click to edit',
      backgroundColor: '#1e293b',
      textColor: '#ffffff',
      layout: 'title'
    }
  ];

  useEffect(() => {
    if (canvasRef.current && slides[currentSlide]) {
      renderSlideToCanvas(slides[currentSlide]);
    }
  }, [currentSlide, slides]);

  const renderSlideToCanvas = (slide: Slide) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = 1920;
    canvas.height = 1080;

    // Background
    ctx.fillStyle = slide.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Text
    ctx.fillStyle = slide.textColor;
    
    if (slide.layout === 'title') {
      // Title layout
      ctx.font = 'bold 120px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(slide.title, canvas.width / 2, canvas.height / 2 - 100);
      
      ctx.font = '48px Inter, sans-serif';
      ctx.fillText(slide.content, canvas.width / 2, canvas.height / 2 + 100);
    } else if (slide.layout === 'content') {
      // Content layout
      ctx.font = 'bold 80px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(slide.title, 100, 150);
      
      ctx.font = '40px Inter, sans-serif';
      const lines = slide.content.split('\n');
      lines.forEach((line, i) => {
        ctx.fillText(line, 100, 300 + i * 80);
      });
    }
  };

  const addSlide = () => {
    const newSlide: Slide = {
      id: `slide-${Date.now()}`,
      title: 'New Slide',
      content: 'Content',
      backgroundColor: '#1e293b',
      textColor: '#ffffff',
      layout: 'content'
    };
    onChange({ slides: [...slides, newSlide] });
    setCurrentSlide(slides.length);
  };

  const updateSlide = (slideId: string, updates: Partial<Slide>) => {
    const updatedSlides = slides.map(s => 
      s.id === slideId ? { ...s, ...updates } : s
    );
    onChange({ slides: updatedSlides });
  };

  const deleteSlide = (slideId: string) => {
    if (slides.length === 1) return;
    const updatedSlides = slides.filter(s => s.id !== slideId);
    onChange({ slides: updatedSlides });
    if (currentSlide >= updatedSlides.length) {
      setCurrentSlide(updatedSlides.length - 1);
    }
  };

  const exportAsImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const link = document.createElement('a');
    link.download = `slide-${currentSlide + 1}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  const currentSlideData = slides[currentSlide];

  if (isPresenting) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full"
          onClick={() => {
            if (currentSlide < slides.length - 1) {
              setCurrentSlide(currentSlide + 1);
            }
          }}
        />
        
        {/* Presentation Controls */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/80 px-6 py-3 rounded-full">
          <button
            onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
            disabled={currentSlide === 0}
            className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer disabled:opacity-30"
          >
            <span className="material-symbols-outlined text-white">chevron_left</span>
          </button>
          
          <span className="text-white text-sm font-medium">
            {currentSlide + 1} / {slides.length}
          </span>
          
          <button
            onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))}
            disabled={currentSlide === slides.length - 1}
            className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer disabled:opacity-30"
          >
            <span className="material-symbols-outlined text-white">chevron_right</span>
          </button>
          
          <div className="w-px h-6 bg-white/20 mx-2" />
          
          <button
            onClick={() => setIsPresenting(false)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-white">close</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative" onClick={onFocus}>
      <div className="bg-(--color-bg-secondary) border border-(--color-border) rounded-xl overflow-hidden">
        {/* Canvas Preview */}
        <div className="relative bg-black aspect-video flex items-center justify-center">
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-full"
          />
          
          {!readOnly && (
            <button
              onClick={() => setIsPresenting(true)}
              className="absolute top-4 right-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors cursor-pointer flex items-center gap-2 backdrop-blur-sm"
            >
              <span className="material-symbols-outlined">play_arrow</span>
              <span className="text-sm font-medium">{t('knowledgeBase.blocks.present')}</span>
            </button>
          )}
        </div>

        {/* Slide Controls */}
        <div className="p-4 border-t border-(--color-border)">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
                disabled={currentSlide === 0}
                className="p-2 hover:bg-(--color-bg-tertiary) rounded-lg transition-colors cursor-pointer disabled:opacity-30"
              >
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
              
              <span className="text-sm text-(--color-text-secondary)">
                {currentSlide + 1} / {slides.length}
              </span>
              
              <button
                onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))}
                disabled={currentSlide === slides.length - 1}
                className="p-2 hover:bg-(--color-bg-tertiary) rounded-lg transition-colors cursor-pointer disabled:opacity-30"
              >
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>

            {!readOnly && (
              <div className="flex items-center gap-2">
                <button
                  onClick={addSlide}
                  className="px-3 py-1.5 text-xs bg-(--color-accent) text-white rounded-lg hover:bg-(--color-accent-hover) transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  {t('knowledgeBase.blocks.addSlide')}
                </button>
                
                <button
                  onClick={exportAsImage}
                  className="p-2 hover:bg-(--color-bg-tertiary) rounded-lg transition-colors cursor-pointer"
                  title={t('knowledgeBase.blocks.exportSlide')}
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                </button>
              </div>
            )}
          </div>

          {/* Slide Editor */}
          {!readOnly && currentSlideData && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-(--color-text-secondary) mb-1 block">
                  {t('knowledgeBase.blocks.slideTitle')}
                </label>
                <input
                  type="text"
                  value={currentSlideData.title}
                  onChange={(e) => updateSlide(currentSlideData.id, { title: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-(--color-bg-primary) border border-(--color-border) rounded-lg outline-none focus:border-(--color-accent)"
                />
              </div>

              <div>
                <label className="text-xs text-(--color-text-secondary) mb-1 block">
                  {t('knowledgeBase.blocks.slideContent')}
                </label>
                <textarea
                  value={currentSlideData.content}
                  onChange={(e) => updateSlide(currentSlideData.id, { content: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-(--color-bg-primary) border border-(--color-border) rounded-lg outline-none focus:border-(--color-accent) resize-none"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-(--color-text-secondary) mb-1 block">
                    {t('knowledgeBase.blocks.layout')}
                  </label>
                  <select
                    value={currentSlideData.layout}
                    onChange={(e) => updateSlide(currentSlideData.id, { layout: e.target.value as any })}
                    className="w-full px-3 py-2 text-sm bg-(--color-bg-primary) border border-(--color-border) rounded-lg outline-none cursor-pointer"
                  >
                    <option value="title">{t('knowledgeBase.blocks.layoutTitle')}</option>
                    <option value="content">{t('knowledgeBase.blocks.layoutContent')}</option>
                    <option value="two-column">{t('knowledgeBase.blocks.layoutTwoColumn')}</option>
                    <option value="image-text">{t('knowledgeBase.blocks.layoutImageText')}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-(--color-text-secondary) mb-1 block">
                    {t('knowledgeBase.blocks.backgroundColor')}
                  </label>
                  <input
                    type="color"
                    value={currentSlideData.backgroundColor}
                    onChange={(e) => updateSlide(currentSlideData.id, { backgroundColor: e.target.value })}
                    className="w-full h-9 rounded-lg cursor-pointer"
                  />
                </div>

                <div>
                  <label className="text-xs text-(--color-text-secondary) mb-1 block">
                    {t('knowledgeBase.blocks.textColor')}
                  </label>
                  <input
                    type="color"
                    value={currentSlideData.textColor}
                    onChange={(e) => updateSlide(currentSlideData.id, { textColor: e.target.value })}
                    className="w-full h-9 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {slides.length > 1 && (
                <button
                  onClick={() => deleteSlide(currentSlideData.id)}
                  className="w-full px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                  {t('knowledgeBase.blocks.deleteSlide')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Slide Thumbnails */}
        <div className="p-4 border-t border-(--color-border) flex gap-2 overflow-x-auto">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              onClick={() => setCurrentSlide(index)}
              className={`shrink-0 w-32 h-20 rounded-lg border-2 transition-all cursor-pointer ${
                currentSlide === index
                  ? 'border-(--color-accent) ring-2 ring-(--color-accent)/20'
                  : 'border-(--color-border) hover:border-(--color-accent)/50'
              }`}
              style={{ backgroundColor: slide.backgroundColor }}
            >
              <div className="text-xs font-medium truncate px-2" style={{ color: slide.textColor }}>
                {slide.title}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Block Actions */}
      {focused && !readOnly && (
        <div className="absolute -left-12 top-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button onClick={onMoveUp} disabled={!showMoveUp} className="p-1 hover:bg-(--color-bg-tertiary) rounded cursor-pointer disabled:opacity-30">
            <span className="material-symbols-outlined text-sm">arrow_upward</span>
          </button>
          <button onClick={onMoveDown} disabled={!showMoveDown} className="p-1 hover:bg-(--color-bg-tertiary) rounded cursor-pointer disabled:opacity-30">
            <span className="material-symbols-outlined text-sm">arrow_downward</span>
          </button>
          <button onClick={onDelete} className="p-1 hover:bg-red-500/10 rounded cursor-pointer">
            <span className="material-symbols-outlined text-sm text-red-500">delete</span>
          </button>
        </div>
      )}
    </div>
  );
}
