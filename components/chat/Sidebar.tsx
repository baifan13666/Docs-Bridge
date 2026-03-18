'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import UserSettingsModal from '../settings/UserSettingsModal';
import SignInModal from '../auth/SignInModal';
import PerfectScrollbarWrapper from '../ui/PerfectScrollbar';
import * as chatApi from '@/lib/api/chat';

interface Folder {
  id: string;
  name: string;
  icon: string;
  isActive: boolean;
  isSystem: boolean;
}

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

import { ConversationSkeleton } from '../ui/Skeleton';

interface SidebarProps {
  isAuthenticated: boolean;
  userEmail?: string;
  userName?: string;
  userAvatar?: string;
  userPlan?: 'free' | 'pro' | 'business';
  currentConversationId?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({ 
  isAuthenticated, 
  userEmail, 
  userName, 
  userAvatar, 
  userPlan = 'free',
  currentConversationId,
  collapsed = false,
  onToggleCollapse
}: SidebarProps) {
  const t = useTranslations();
  const router = useRouter();
  const [showSettings, setShowSettings] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [initialTab, setInitialTab] = useState<'account' | 'plan' | 'usage' | 'notifications'>('account');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [archivedConversations, setArchivedConversations] = useState<Conversation[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const pathname = usePathname();
  
  const getChatBasePath = () => {
    const segments = (pathname || '').split('/').filter(Boolean);
    if (segments.length === 0) return '/';
    const locale = segments[0];
    return `/${locale}`;
  };

  // Load conversations and folders on mount
  useEffect(() => {
    if (isAuthenticated) {
      loadConversations();
      loadArchivedConversations();
      loadFolders();
    }
  }, [isAuthenticated]);

  async function loadConversations() {
    try {
      const { conversations: fetchedConvs } = await chatApi.fetchConversations(50, 0, false);
      setConversations(fetchedConvs.map(c => ({
        id: c.id,
        title: c.title,
        updated_at: c.updated_at
      })));
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  }

  async function loadArchivedConversations() {
    try {
      const { conversations: fetchedConvs } = await chatApi.fetchConversations(50, 0, true);
      setArchivedConversations(fetchedConvs.map(c => ({
        id: c.id,
        title: c.title,
        updated_at: c.updated_at
      })));
    } catch (error) {
      console.error('Error loading archived conversations:', error);
    }
  }

  async function loadFolders() {
    try {
      setLoadingFolders(true);
      const response = await fetch('/api/kb/folders');
      if (!response.ok) return;
      
      const data = await response.json();
      
      // Map all folders
      const allFolders = data.folders.map((f: any) => ({
        id: f.id,
        name: f.name,
        icon: f.icon || 'folder',
        isActive: f.is_active || false,
        isSystem: f.is_system || false
      }));
      
      // Sort: system folders first, then by name
      allFolders.sort((a: Folder, b: Folder) => {
        if (a.isSystem && !b.isSystem) return -1;
        if (!a.isSystem && b.isSystem) return 1;
        return a.name.localeCompare(b.name);
      });
      
      setFolders(allFolders);
    } catch (error) {
      console.error('Error loading folders:', error);
    } finally {
      setLoadingFolders(false);
    }
  }

  const handleToggleFolder = async (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;
    
    try {
      const response = await fetch(`/api/kb/folders/${folderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !folder.isActive })
      });
      
      if (response.ok) {
        setFolders(folders.map(f => 
          f.id === folderId ? { ...f, isActive: !f.isActive } : f
        ));
      }
    } catch (error) {
      console.error('Error toggling folder:', error);
    }
  };

  const handleNewChat = async () => {
    if (!isAuthenticated) {
      return;
    }
    
    try {
      const newConv = await chatApi.createConversation();
      const basePath = getChatBasePath();
      router.push(`${basePath}?conversation=${newConv.id}`);
      await loadConversations();
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm(t('sidebar.confirmDeleteConversation'))) return;
    
    try {
      await chatApi.deleteConversation(convId);
      setConversations(conversations.filter(c => c.id !== convId));
      setArchivedConversations(archivedConversations.filter(c => c.id !== convId));
      
      // If deleted current conversation, redirect to home
      if (convId === currentConversationId) {
        router.push(getChatBasePath());
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  const handleUnarchiveConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const response = await fetch(`/api/chat/conversations/${convId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: false })
      });

      if (!response.ok) {
        throw new Error('Failed to unarchive conversation');
      }

      // Move from archived to active conversations
      const unarchived = archivedConversations.find(c => c.id === convId);
      if (unarchived) {
        setArchivedConversations(archivedConversations.filter(c => c.id !== convId));
        setConversations([unarchived, ...conversations]);
      }
    } catch (error) {
      console.error('Error unarchiving conversation:', error);
    }
  };

  // Group conversations by date
  const groupConversationsByDate = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const todayConvs: Conversation[] = [];
    const last7DaysConvs: Conversation[] = [];
    const olderConvs: Conversation[] = [];

    conversations.forEach(conv => {
      const convDate = new Date(conv.updated_at);
      if (convDate >= today) {
        todayConvs.push(conv);
      } else if (convDate >= sevenDaysAgo) {
        last7DaysConvs.push(conv);
      } else {
        olderConvs.push(conv);
      }
    });

    return { todayConvs, last7DaysConvs, olderConvs };
  };

  const { todayConvs, last7DaysConvs, olderConvs } = groupConversationsByDate();

  return (
    <>
      <aside className={`bg-(--color-sidebar-bg) flex flex-col h-full shrink-0 text-(--color-sidebar-text) border-r border-(--color-sidebar-border) transition-all duration-300 ${
        collapsed ? 'w-[60px]' : 'w-[260px]'
      }`}>
        <Link href="/" className={`p-4 flex items-center gap-3 border-b border-(--color-sidebar-border) hover:bg-(--color-sidebar-hover) transition-colors cursor-pointer ${
          collapsed ? 'justify-center' : ''
        }`}>
          <div className="w-8 h-8 bg-white rounded flex items-center justify-center p-1 shrink-0">
            <img src="/notextlogo.png" alt={t('common.appName')} className="w-full h-full object-contain" />
          </div>
          {!collapsed && (
            <h1 className="font-semibold text-lg text-white tracking-wide">{t('common.appName')}</h1>
          )}
        </Link>

        <div className={`p-3 flex items-center border-b border-(--color-sidebar-border) ${
          collapsed ? 'justify-center' : 'justify-between'
        }`}>
          <button 
            onClick={onToggleCollapse}
            className="flex items-center justify-center p-2 rounded-lg hover:bg-(--color-sidebar-hover) transition-colors text-(--color-sidebar-text) cursor-pointer"
            title={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
          {!collapsed && (
            <button
              onClick={handleNewChat}
              className={`flex items-center justify-center p-2 rounded-lg transition-colors text-(--color-sidebar-text) ${
                isAuthenticated ? 'hover:bg-(--color-sidebar-hover) cursor-pointer' : 'opacity-50 cursor-not-allowed'
              }`}
              disabled={!isAuthenticated}
              title={isAuthenticated ? t('sidebar.newChat') : t('chat.signInToStartChat')}
            >
              <span className="material-symbols-outlined">edit_square</span>
            </button>
          )}
        </div>

        {collapsed ? (
          // Collapsed view - show icons only
          <div className="flex-1 px-2 py-2 flex flex-col items-center gap-2">
            {isAuthenticated && folders.length > 0 && (
              <div className="relative group">
                <button className="p-2 rounded-lg hover:bg-(--color-sidebar-hover) transition-colors text-(--color-sidebar-text) cursor-pointer">
                  <span className="material-symbols-outlined">folder</span>
                </button>
                <div className="absolute left-full ml-2 top-0 hidden group-hover:block z-50 bg-(--color-bg-secondary) border border-(--color-border) rounded-lg shadow-lg p-2 min-w-[200px]">
                  <div className="text-xs font-semibold text-(--color-text-secondary) mb-2 px-2">
                    {t('sidebar.knowledgeBase')}
                  </div>
                  {folders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => handleToggleFolder(folder.id)}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-(--color-bg-tertiary) text-sm text-(--color-text-primary) cursor-pointer"
                    >
                      <span className="truncate">{folder.name}</span>
                      {folder.isActive && (
                        <span className="material-symbols-outlined text-[14px] text-green-400">check_circle</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          // Expanded view - show full content
          <PerfectScrollbarWrapper className="flex-1 px-3 py-2">
          <div className="space-y-6">
          {isAuthenticated ? (
            <>
              {/* Knowledge Base Section - All Folders */}
              <div>
                <h3 className="text-xs font-semibold text-(--color-sidebar-text-secondary) mb-2 px-3 uppercase tracking-wider">
                  {t('sidebar.knowledgeBase')}
                </h3>
                <div className="space-y-0.5">
                  {loadingFolders ? (
                    <>
                      <ConversationSkeleton />
                      <ConversationSkeleton />
                      <ConversationSkeleton />
                    </>
                  ) : (
                    folders.map((folder) => (
                      <button 
                        key={folder.id}
                        onClick={() => handleToggleFolder(folder.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                          folder.isActive
                            ? 'bg-(--color-sidebar-active)/40 text-(--color-sidebar-text) border border-(--color-sidebar-border)'
                            : 'hover:bg-(--color-sidebar-hover) text-(--color-sidebar-text-secondary) hover:text-(--color-sidebar-text)'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`material-symbols-outlined text-[18px] ${
                            folder.isActive ? 'text-blue-400' : 'text-(--color-sidebar-text-secondary)'
                          }`}>
                            {folder.icon}
                          </span>
                          <span className="font-medium truncate">{folder.name}</span>
                        </div>
                        {folder.isActive && (
                          <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5 shrink-0">
                            <span className="material-symbols-outlined text-[10px]">check_circle</span>
                            {t('common.active')}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                  
                  {userPlan === 'pro' || userPlan === 'business' ? (
                    <Link 
                      href="/knowledge-base"
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                        pathname?.includes('knowledge-base')
                          ? 'bg-(--color-sidebar-active) text-(--color-sidebar-text) border border-(--color-sidebar-border)'
                          : 'hover:bg-(--color-sidebar-hover) text-(--color-sidebar-text-secondary) hover:text-(--color-sidebar-text)'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">folder_special</span>
                        <span>{t('sidebar.manageKnowledge')}</span>
                      </div>
                    </Link>
                  ) : (
                    <button
                      onClick={() => {
                        setInitialTab('plan');
                        setShowSettings(true);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 hover:bg-(--color-sidebar-hover) rounded-lg text-sm text-(--color-sidebar-text-secondary) hover:text-(--color-sidebar-text) transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">folder_special</span>
                        <span>{t('sidebar.manageKnowledge')}</span>
                      </div>
                      <div
                        className="flex items-center gap-1 bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded"
                        title="Pro Feature"
                      >
                        <span className="material-symbols-outlined text-[12px]">workspace_premium</span>
                        <span className="text-[10px] font-bold">{t('sidebar.proFeature')}</span>
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {/* Conversations Section */}
              {todayConvs.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-(--color-sidebar-text-secondary) mb-2 px-3 uppercase tracking-wider">{t('sidebar.today')}</h3>
                  <div className="space-y-0.5">
                    {todayConvs.map((conv) => (
                      <div
                        key={conv.id}
                        className={`group relative flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                          currentConversationId === conv.id
                            ? 'bg-(--color-sidebar-active) text-(--color-sidebar-text) border border-(--color-sidebar-border)'
                            : 'hover:bg-(--color-sidebar-hover) text-(--color-sidebar-text-secondary) hover:text-(--color-sidebar-text)'
                        }`}
                        onClick={() => router.push(`${getChatBasePath()}?conversation=${conv.id}`)}
                      >
                        <span className="truncate font-medium flex-1">{conv.title}</span>
                        <button
                          onClick={(e) => handleDeleteConversation(conv.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-(--color-bg-primary) rounded transition-all"
                          title={t('common.delete')}
                        >
                          <span className="material-symbols-outlined text-[16px] text-red-500">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {last7DaysConvs.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-(--color-sidebar-text-secondary) mb-2 px-3 uppercase tracking-wider">
                    {t('sidebar.previous7Days')}
                  </h3>
                  <div className="space-y-0.5">
                    {last7DaysConvs.map((conv) => (
                      <div
                        key={conv.id}
                        className={`group relative flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                          currentConversationId === conv.id
                            ? 'bg-(--color-sidebar-active) text-(--color-sidebar-text) border border-(--color-sidebar-border)'
                            : 'hover:bg-(--color-sidebar-hover) text-(--color-sidebar-text-secondary) hover:text-(--color-sidebar-text)'
                        }`}
                        onClick={() => router.push(`${getChatBasePath()}?conversation=${conv.id}`)}
                      >
                        <span className="truncate font-medium flex-1">{conv.title}</span>
                        <button
                          onClick={(e) => handleDeleteConversation(conv.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-(--color-bg-primary) rounded transition-all"
                          title={t('common.delete')}
                        >
                          <span className="material-symbols-outlined text-[16px] text-red-500">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {olderConvs.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-(--color-sidebar-text-secondary) mb-2 px-3 uppercase tracking-wider">
                    {t('sidebar.older')}
                  </h3>
                  <div className="space-y-0.5">
                    {olderConvs.map((conv) => (
                      <div
                        key={conv.id}
                        className={`group relative flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                          currentConversationId === conv.id
                            ? 'bg-(--color-sidebar-active) text-(--color-sidebar-text) border border-(--color-sidebar-border)'
                            : 'hover:bg-(--color-sidebar-hover) text-(--color-sidebar-text-secondary) hover:text-(--color-sidebar-text)'
                        }`}
                        onClick={() => router.push(`${getChatBasePath()}?conversation=${conv.id}`)}
                      >
                        <span className="truncate font-medium flex-1">{conv.title}</span>
                        <button
                          onClick={(e) => handleDeleteConversation(conv.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-(--color-bg-primary) rounded transition-all"
                          title={t('common.delete')}
                        >
                          <span className="material-symbols-outlined text-[16px] text-red-500">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Archived Conversations Section */}
              {archivedConversations.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowArchived(!showArchived)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-(--color-sidebar-text-secondary) uppercase tracking-wider hover:text-(--color-sidebar-text) transition-colors cursor-pointer"
                  >
                    <span>{t('sidebar.archived')}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] bg-(--color-sidebar-active) px-1.5 py-0.5 rounded">
                        {archivedConversations.length}
                      </span>
                      <span className="material-symbols-outlined text-[16px]">
                        {showArchived ? 'expand_less' : 'expand_more'}
                      </span>
                    </div>
                  </button>
                  {showArchived && (
                    <div className="space-y-0.5 mt-2">
                      {archivedConversations.map((conv) => (
                        <div
                          key={conv.id}
                          className={`group relative flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                            currentConversationId === conv.id
                              ? 'bg-(--color-sidebar-active) text-(--color-sidebar-text) border border-(--color-sidebar-border)'
                              : 'hover:bg-(--color-sidebar-hover) text-(--color-sidebar-text-secondary) hover:text-(--color-sidebar-text)'
                          }`}
                          onClick={() => router.push(`${getChatBasePath()}?conversation=${conv.id}`)}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="material-symbols-outlined text-[16px] text-(--color-sidebar-text-secondary)">
                              archive
                            </span>
                            <span className="truncate font-medium">{conv.title}</span>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                            <button
                              onClick={(e) => handleUnarchiveConversation(conv.id, e)}
                              className="p-1 hover:bg-(--color-bg-primary) rounded transition-all"
                              title={t('header.unarchive')}
                            >
                              <span className="material-symbols-outlined text-[16px] text-blue-500">unarchive</span>
                            </button>
                            <button
                              onClick={(e) => handleDeleteConversation(conv.id, e)}
                              className="p-1 hover:bg-(--color-bg-primary) rounded transition-all"
                              title={t('common.delete')}
                            >
                              <span className="material-symbols-outlined text-[16px] text-red-500">delete</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center text-center py-12 px-4">
              <span className="material-symbols-outlined text-5xl text-(--color-sidebar-text-secondary) mb-4">lock</span>
              <h3 className="text-base font-semibold text-(--color-sidebar-text) mb-2">
                {t('sidebar.signInRequired')}
              </h3>
              <p className="text-sm text-(--color-sidebar-text-secondary) mb-6">
                {t('chat.signInToSaveHistory')}
              </p>
              <button
                onClick={() => setShowSignIn(true)}
                className="w-full max-w-[200px] flex items-center justify-center gap-2 px-4 py-2.5 bg-(--color-accent) text-white rounded-lg hover:bg-(--color-accent-hover) transition-colors font-medium cursor-pointer shadow-sm"
              >
                <span className="material-symbols-outlined text-[20px]">login</span>
                {t('sidebar.signIn')}
              </button>
            </div>
          )}
        </div>
        </PerfectScrollbarWrapper>
        )}

        <div className={`p-3 border-t border-(--color-sidebar-border) ${collapsed ? 'flex justify-center' : ''}`}>
          {isAuthenticated ? (
            <button
              onClick={() => setShowSettings(true)}
              className={`w-full flex items-center rounded-lg hover:bg-(--color-sidebar-hover) transition-colors cursor-pointer ${
                collapsed ? 'justify-center p-2' : 'justify-between p-2'
              }`}
            >
              {collapsed ? (
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[#0F172A] text-sm font-bold shadow-sm">
                  {userName?.[0]?.toUpperCase() || userEmail?.[0]?.toUpperCase() || 'U'}
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    {userAvatar ? (
                      <>
                        <img 
                          src={userAvatar} 
                          alt={userName || 'User'} 
                          className="w-8 h-8 rounded-full shadow-sm object-cover"
                          referrerPolicy="no-referrer"
                          crossOrigin="anonymous"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[#0F172A] text-sm font-bold shadow-sm" style={{ display: 'none' }}>
                          {userName?.[0]?.toUpperCase() || userEmail?.[0]?.toUpperCase() || 'U'}
                        </div>
                      </>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[#0F172A] text-sm font-bold shadow-sm">
                        {userName?.[0]?.toUpperCase() || userEmail?.[0]?.toUpperCase() || 'U'}
                      </div>
                    )}
                    <div className="text-left">
                      <div className="text-sm font-medium text-(--color-sidebar-text)">
                        {userName || t('sidebar.userProfile')}
                      </div>
                      <div className="text-xs text-(--color-sidebar-text-secondary) capitalize">{t(`sidebar.${userPlan}Plan`)}</div>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-(--color-sidebar-text-secondary)">settings</span>
                </>
              )}
            </button>
          ) : (
            <div className={`w-full flex items-center rounded-lg ${
              collapsed ? 'justify-center p-2' : 'gap-3 p-2'
            }`}>
              <div className="w-8 h-8 rounded-full bg-(--color-sidebar-active) flex items-center justify-center text-(--color-sidebar-text-secondary) shadow-sm">
                <span className="material-symbols-outlined text-sm">person</span>
              </div>
              {!collapsed && (
                <div className="text-left">
                  <div className="text-sm font-medium text-(--color-sidebar-text)">{t('common.guest')}</div>
                  <div className="text-xs text-(--color-sidebar-text-secondary)">{t('common.notSignedIn')}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {showSettings && (
        <UserSettingsModal
          onClose={() => {
            setShowSettings(false);
            setInitialTab('account');
          }}
          userEmail={userEmail}
          userName={userName}
          userPlan={userPlan}
          initialTab={initialTab}
        />
      )}

      {showSignIn && (
        <SignInModal
          onClose={() => setShowSignIn(false)}
        />
      )}
    </>
  );
}
