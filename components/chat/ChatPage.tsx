'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Sidebar from './Sidebar';
import ChatInterface from './ChatInterface';
import ConfirmDialog from '../ui/ConfirmDialog';

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
  const router = useRouter();
  const [modelMode, setModelMode] = useState<'standard' | 'mini'>('mini');
  const [showModelPopover, setShowModelPopover] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const [hasMessages, setHasMessages] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
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

  // Check if conversation is archived and has messages
  useEffect(() => {
    async function checkConversationStatus() {
      if (!conversationId || !isAuthenticated) {
        setIsArchived(false);
        setHasMessages(false);
        return;
      }

      try {
        // Check conversation details
        const convResponse = await fetch(`/api/chat/conversations/${conversationId}`);
        if (convResponse.ok) {
          const convData = await convResponse.json();
          setIsArchived(convData.conversation?.is_archived || false);
        }

        // Check if conversation has messages
        const messagesResponse = await fetch(`/api/chat/messages?conversation_id=${conversationId}`);
        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json();
          setHasMessages(messagesData.messages && messagesData.messages.length > 0);
        }
      } catch (error) {
        console.error('Error checking conversation status:', error);
      }
    }

    checkConversationStatus();
  }, [conversationId, isAuthenticated]);

  const handleModelSelect = (mode: 'standard' | 'mini') => {
    setModelMode(mode);
    setShowModelPopover(false);
  };

  const handleArchiveToggle = async () => {
    if (!conversationId) {
      toast.error(t('header.noActiveConversation'), {
        description: t('header.selectConversationFirst')
      });
      return;
    }

    if (!isAuthenticated) {
      toast.error(t('sidebar.signInRequired'));
      return;
    }

    if (!hasMessages) {
      toast.error(t('header.noActiveConversation'), {
        description: t('header.noMessagesYet')
      });
      return;
    }

    setShowArchiveDialog(true);
  };

  const confirmArchiveToggle = async () => {
    if (!conversationId) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/chat/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: !isArchived })
      });

      if (!response.ok) {
        throw new Error('Failed to update conversation');
      }

      setIsArchived(!isArchived);
      toast.success(
        isArchived ? t('header.conversationUnarchived') : t('header.conversationArchived')
      );
      setShowArchiveDialog(false);
      
      // Redirect to home if archiving current conversation
      if (!isArchived) {
        router.push('/');
      } else {
        // Just refresh if unarchiving
        router.refresh();
      }
    } catch (error) {
      console.error('Error toggling archive:', error);
      toast.error(t('common.error'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = () => {
    if (!conversationId) {
      toast.error(t('header.noActiveConversation'), {
        description: t('header.selectConversationFirst')
      });
      return;
    }

    if (!isAuthenticated) {
      toast.error(t('sidebar.signInRequired'));
      return;
    }

    if (!hasMessages) {
      toast.error(t('header.noActiveConversation'), {
        description: t('header.noMessagesYet')
      });
      return;
    }

    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!conversationId) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/chat/conversations/${conversationId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete conversation');
      }

      toast.success(t('header.conversationDeleted'));
      setShowDeleteDialog(false);
      
      // Redirect to home
      router.push('/');
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast.error(t('common.error'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCategories = () => {
    // TODO: Implement categories functionality
    toast.info('Categories feature coming soon!');
  };

  return (
    <>
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
              <button 
                onClick={handleArchiveToggle}
                disabled={!conversationId || !hasMessages}
                className={`p-2 rounded-lg transition-colors ${
                  conversationId && hasMessages
                    ? 'text-(--color-accent) hover:bg-(--color-bg-tertiary) cursor-pointer' 
                    : 'text-(--color-text-tertiary) cursor-not-allowed opacity-50'
                }`}
                title={isArchived ? t('header.unarchive') : t('header.archive')}
              >
                <span className="material-symbols-outlined">
                  {isArchived ? 'unarchive' : 'archive'}
                </span>
              </button>
              <button 
                onClick={handleCategories}
                disabled={!conversationId || !hasMessages}
                className={`p-2 rounded-lg transition-colors ${
                  conversationId && hasMessages
                    ? 'text-(--color-accent) hover:bg-(--color-bg-tertiary) cursor-pointer' 
                    : 'text-(--color-text-tertiary) cursor-not-allowed opacity-50'
                }`}
                title={t('header.categories')}
              >
                <span className="material-symbols-outlined">category</span>
              </button>
              <button 
                onClick={handleDelete}
                disabled={!conversationId || !hasMessages}
                className={`p-2 rounded-lg transition-colors ${
                  conversationId && hasMessages
                    ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950 cursor-pointer' 
                    : 'text-(--color-text-tertiary) cursor-not-allowed opacity-50'
                }`}
                title={t('header.delete')}
              >
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

      {/* Archive/Unarchive Confirmation Dialog */}
      <ConfirmDialog
        show={showArchiveDialog}
        title={isArchived ? t('header.unarchiveConversation') : t('header.archiveConversation')}
        description={isArchived ? t('header.unarchiveDescription') : t('header.archiveDescription')}
        confirmText={isArchived ? t('header.unarchive') : t('header.archive')}
        confirmVariant="primary"
        onConfirm={confirmArchiveToggle}
        onCancel={() => setShowArchiveDialog(false)}
        loading={actionLoading}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        show={showDeleteDialog}
        title={t('header.deleteConversation')}
        description={t('header.deleteDescription')}
        confirmText={t('common.delete')}
        confirmVariant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteDialog(false)}
        loading={actionLoading}
      />
    </>
  );
}
