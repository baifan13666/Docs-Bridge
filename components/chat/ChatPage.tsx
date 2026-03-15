'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Sidebar from './Sidebar';
import ChatInterface from './ChatInterface';

interface ChatPageProps {
  isAuthenticated: boolean;
  userEmail?: string;
  userName: string;
  userAvatar: string;
  userPlan: 'free' | 'pro' | 'business';
  conversationId?: string;
}

export default function ChatPage({
  isAuthenticated,
  userEmail,
  userName,
  userAvatar,
  userPlan,
  conversationId
}: ChatPageProps) {
  const t = useTranslations();
  const [modelMode, setModelMode] = useState<'standard' | 'mini'>('mini');
  const [showModelPopover, setShowModelPopover] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current && 
        buttonRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowModelPopover(false);
      }
    }

    if (showModelPopover) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showModelPopover]);

  const handleModelSelect = (mode: 'standard' | 'mini') => {
    setModelMode(mode);
    setShowModelPopover(false);
  };

  return (
    <div className="bg-(--color-bg-primary) text-(--color-text-primary) h-screen flex font-sans antialiased overflow-hidden">
      <Sidebar 
        isAuthenticated={isAuthenticated} 
        userEmail={userEmail}
        userName={userName}
        userAvatar={userAvatar}
        userPlan={userPlan}
        currentConversationId={conversationId}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      
      <div className="flex-1 flex flex-col h-full relative bg-(--color-bg-primary)">
        <header className="py-3 px-4 z-10 flex justify-between items-center bg-(--color-bg-secondary) border-b border-(--color-border) shadow-sm sticky top-0">
          <div className="flex items-center gap-3 relative">
            {/* Logo + Model Selector Button */}
            {isAuthenticated ? (
              <>
                <button
                  ref={buttonRef}
                  onClick={() => setShowModelPopover(!showModelPopover)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-(--color-bg-tertiary) transition-colors cursor-pointer"
                >
                  <div className="w-7 h-7 rounded flex items-center justify-center">
                    <img src="/notextlogo.png" alt="DocsBridge" className="w-full h-full object-contain" />
                  </div>
                  <span className="text-lg font-semibold text-(--color-text-primary)">
                    {modelMode === 'mini' ? t('chatPage.docsBridgeAI') : t('chatPage.docsBridgePlus')}
                  </span>
                  <span className="material-symbols-outlined text-[20px] text-(--color-text-secondary)">
                    {showModelPopover ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {/* Model Selection Popover */}
                {showModelPopover && (
                  <div
                    ref={popoverRef}
                    className="absolute top-full left-0 mt-2 w-64 bg-(--color-bg-secondary) border border-(--color-border) rounded-lg shadow-lg overflow-hidden z-50"
                  >
                    <div className="p-2">
                      <button
                        onClick={() => handleModelSelect('mini')}
                        className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-(--color-bg-tertiary) transition-colors cursor-pointer text-left"
                      >
                        <div className="w-6 h-6 rounded flex items-center justify-center shrink-0 mt-0.5">
                          <img src="/notextlogo.png" alt="DocsBridge AI" className="w-full h-full object-contain" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-(--color-text-primary)">{t('chatPage.docsBridgeAI')}</span>
                            {modelMode === 'mini' && (
                              <span className="material-symbols-outlined text-[18px] text-(--color-accent)">check</span>
                            )}
                          </div>
                          <p className="text-xs text-(--color-text-secondary) mt-0.5">
                            {t('chatPage.fasterResponses')}
                          </p>
                        </div>
                      </button>

                      <button
                        onClick={() => handleModelSelect('standard')}
                        className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-(--color-bg-tertiary) transition-colors cursor-pointer text-left"
                      >
                        <div className="w-6 h-6 rounded flex items-center justify-center shrink-0 mt-0.5">
                          <img src="/notextlogo.png" alt="DocsBridge Plus" className="w-full h-full object-contain" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-(--color-text-primary)">{t('chatPage.docsBridgePlus')}</span>
                            {modelMode === 'standard' && (
                              <span className="material-symbols-outlined text-[18px] text-(--color-accent)">check</span>
                            )}
                          </div>
                          <p className="text-xs text-(--color-text-secondary) mt-0.5">
                            {t('chatPage.bestAccuracy')}
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 px-2">
                <div className="w-7 h-7 rounded p-1 flex items-center justify-center">
                  <img src="/notextlogo.png" alt="DocsBridge" className="w-full h-full object-contain" />
                </div>
                <span className="text-lg font-semibold text-(--color-text-primary)">{t('chatPage.docsBridgeAI')}</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            <button className="p-2 text-(--color-accent) hover:bg-(--color-bg-tertiary) rounded-lg transition-colors cursor-pointer" title={t('header.archive')}>
              <span className="material-symbols-outlined">archive</span>
            </button>
            <button className="p-2 text-(--color-accent) hover:bg-(--color-bg-tertiary) rounded-lg transition-colors cursor-pointer" title={t('header.categories')}>
              <span className="material-symbols-outlined">category</span>
            </button>
            <button className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors cursor-pointer" title={t('header.delete')}>
              <span className="material-symbols-outlined">delete</span>
            </button>
          </div>
        </header>

        <ChatInterface 
          isAuthenticated={isAuthenticated} 
          userEmail={userEmail}
          conversationId={conversationId}
          modelMode={modelMode}
          onModelModeChange={setModelMode}
        />
      </div>
    </div>
  );
}
