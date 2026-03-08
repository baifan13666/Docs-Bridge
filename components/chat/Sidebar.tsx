'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import UserSettingsModal from '../settings/UserSettingsModal';
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
}

export default function Sidebar({ 
  isAuthenticated, 
  userEmail, 
  userName, 
  userAvatar, 
  userPlan = 'free',
  currentConversationId 
}: SidebarProps) {
  const t = useTranslations();
  const router = useRouter();
  const [showSettings, setShowSettings] = useState(false);
  const [initialTab, setInitialTab] = useState<'account' | 'plan' | 'usage' | 'notifications'>('account');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [officialGovFolder, setOfficialGovFolder] = useState<Folder | null>(null);
  const pathname = usePathname();

  // Load conversations and folders on mount
  useEffect(() => {
    if (isAuthenticated) {
      loadConversations();
      loadOfficialGovFolder();
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

  async function loadOfficialGovFolder() {
    try {
      const response = await fetch('/api/kb/folders');
      if (!response.ok) return;
      
      const data = await response.json();
      // Find the Official Government Docs folder (system folder)
      const govFolder = data.folders.find((f: any) => f.is_system === true);
      
      if (govFolder) {
        setOfficialGovFolder({
          id: govFolder.id,
          name: govFolder.name,
          icon: govFolder.icon || 'library_books',
          isActive: govFolder.is_active || false,
          isSystem: true
        });
      }
    } catch (error) {
      console.error('Error loading official gov folder:', error);
    }
  }

  const handleToggleFolder = async () => {
    if (!officialGovFolder) return;
    
    try {
      const response = await fetch(`/api/kb/folders/${officialGovFolder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !officialGovFolder.isActive })
      });
      
      if (response.ok) {
        setOfficialGovFolder({
          ...officialGovFolder,
          isActive: !officialGovFolder.isActive
        });
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
      router.push(`/?conversation=${newConv.id}`);
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
      
      // If deleted current conversation, redirect to home
      if (convId === currentConversationId) {
        router.push('/');
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
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
      <aside className="w-[260px] bg-(--color-sidebar-bg) flex flex-col h-full shrink-0 text-(--color-sidebar-text) border-r border-(--color-sidebar-border)">
        <Link href="/" className="p-4 flex items-center gap-3 border-b border-(--color-sidebar-border) hover:bg-(--color-sidebar-hover) transition-colors cursor-pointer">
          <div className="w-8 h-8 bg-white rounded flex items-center justify-center p-1">
            <img src="/notextlogo.png" alt={t('common.appName')} className="w-full h-full object-contain" />
          </div>
          <h1 className="font-semibold text-lg text-white tracking-wide">{t('common.appName')}</h1>
        </Link>

        <div className="p-3 flex justify-between items-center border-b border-(--color-sidebar-border)">
          <button className="flex items-center justify-center p-2 rounded-lg hover:bg-(--color-sidebar-hover) transition-colors text-(--color-sidebar-text) cursor-pointer">
            <span className="material-symbols-outlined">menu</span>
          </button>
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
        </div>

        <PerfectScrollbarWrapper className="flex-1 px-3 py-2">
          <div className="space-y-6">
          {isAuthenticated ? (
            <>
              {/* Knowledge Base Section - Only Official Gov Docs */}
              <div>
                <h3 className="text-xs font-semibold text-(--color-sidebar-text-secondary) mb-2 px-3 uppercase tracking-wider">
                  {t('sidebar.knowledgeBase')}
                </h3>
                <div className="space-y-0.5">
                  {officialGovFolder && (
                    <button 
                      onClick={handleToggleFolder}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                        officialGovFolder.isActive
                          ? 'bg-(--color-sidebar-active)/40 text-(--color-sidebar-text) border border-(--color-sidebar-border)'
                          : 'hover:bg-(--color-sidebar-hover) text-(--color-sidebar-text-secondary) hover:text-(--color-sidebar-text)'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`material-symbols-outlined text-[18px] ${
                          officialGovFolder.isActive ? 'text-blue-400' : 'text-(--color-sidebar-text-secondary)'
                        }`}>
                          {officialGovFolder.icon}
                        </span>
                        <span className="font-medium truncate">{officialGovFolder.name}</span>
                      </div>
                      {officialGovFolder.isActive && (
                        <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5 shrink-0">
                          <span className="material-symbols-outlined text-[10px]">check_circle</span>
                          {t('common.active')}
                        </span>
                      )}
                    </button>
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
                        onClick={() => router.push(`/?conversation=${conv.id}`)}
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
                        onClick={() => router.push(`/?conversation=${conv.id}`)}
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
                        onClick={() => router.push(`/?conversation=${conv.id}`)}
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
            </>
          ) : (
            <div className="flex flex-col items-center justify-center text-center opacity-70 py-12">
              <span className="material-symbols-outlined text-4xl text-(--color-sidebar-text-secondary) mb-4">history_toggle_off</span>
              <p className="text-sm text-(--color-sidebar-text-secondary) px-4">
                {t('chat.signInToSaveHistory')}
              </p>
            </div>
          )}
        </div>
        </PerfectScrollbarWrapper>

        <div className="p-3 border-t border-(--color-sidebar-border)">
          {isAuthenticated ? (
            <button
              onClick={() => setShowSettings(true)}
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-(--color-sidebar-hover) transition-colors cursor-pointer"
            >
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
            </button>
          ) : (
            <div className="w-full flex items-center gap-3 p-2 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-(--color-sidebar-active) flex items-center justify-center text-(--color-sidebar-text-secondary) shadow-sm">
                <span className="material-symbols-outlined text-sm">person</span>
              </div>
              <div className="text-left">
                <div className="text-sm font-medium text-(--color-sidebar-text)">{t('common.guest')}</div>
                <div className="text-xs text-(--color-sidebar-text-secondary)">{t('common.notSignedIn')}</div>
              </div>
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
    </>
  );
}
