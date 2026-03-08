'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { useFontSize } from '../providers/FontSizeProvider';
import PerfectScrollbarWrapper from '../ui/PerfectScrollbar';
import { getUserProfile, updateUserProfile, getUserPlan, upgradePlan, getUserUsage, type UserPlan, type UsageData } from '@/lib/api/user';

interface UserSettingsModalProps {
  onClose: () => void;
  userEmail?: string;
  userName?: string;
  userPlan?: 'free' | 'pro' | 'business';
  initialTab?: 'account' | 'plan' | 'usage' | 'notifications';
}

type Tab = 'account' | 'plan' | 'usage' | 'notifications';

export default function UserSettingsModal({ onClose, userEmail, userName, userPlan = 'free', initialTab = 'account' }: UserSettingsModalProps) {
  const t = useTranslations();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [fullName, setFullName] = useState('');
  const [language, setLanguage] = useState('en');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationSound, setNotificationSound] = useState('default');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [message, setMessage] = useState('');
  const [mounted, setMounted] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<UserPlan>(userPlan);
  const [upgradingPlan, setUpgradingPlan] = useState(false);
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { fontSize, setFontSize } = useFontSize();
  
  // Store original values to restore on cancel
  const [originalTheme, setOriginalTheme] = useState<string | undefined>();
  const [originalFontSize, setOriginalFontSize] = useState<'small' | 'medium' | 'large' | 'extra-large'>('medium');

  useEffect(() => {
    setMounted(true);
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      setLoadingData(true);
      
      // Load profile, plan, and usage in parallel
      const [profile, planData, usage] = await Promise.all([
        getUserProfile(),
        getUserPlan(),
        getUserUsage(),
      ]);

      // Set profile data
      if (profile) {
        setFullName(profile.full_name || '');
        setLanguage(profile.language || 'en');
        setSoundEnabled(profile.sound_enabled !== false);
        setNotificationSound(profile.notification_sound || 'default');
        
        if (profile.theme) {
          setTheme(profile.theme);
          setOriginalTheme(profile.theme);
        } else {
          setOriginalTheme(theme);
        }
        
        if (profile.font_size) {
          setFontSize(profile.font_size as any);
          setOriginalFontSize(profile.font_size as any);
        } else {
          setOriginalFontSize(fontSize);
        }
      }

      // Set plan data
      if (planData) {
        setCurrentPlan(planData.plan_type);
      }

      // Set usage data
      if (usage) {
        setUsageData(usage);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      // Fallback to props
      setFullName(userName || '');
      setOriginalTheme(theme);
      setOriginalFontSize(fontSize);
    } finally {
      setLoadingData(false);
    }
  };

  const handleClose = () => {
    // Restore original theme and font size if not saved
    if (originalTheme) {
      setTheme(originalTheme);
    }
    setFontSize(originalFontSize);
    onClose();
  };

  const handleSaveChanges = async () => {
    setLoading(true);
    setMessage('');

    try {
      await updateUserProfile({
        full_name: fullName,
        language: language,
        font_size: fontSize,
        theme: theme,
        sound_enabled: soundEnabled,
        notification_sound: notificationSound,
      });

      setMessage(t('settings.account.saveSuccess'));
      // Update original values after successful save
      setOriginalTheme(theme);
      setOriginalFontSize(fontSize);
      
      const currentLocale = pathname.split('/')[1];
      // Only refresh if language changed (which requires page reload)
      if (language !== currentLocale) {
        const newPath = pathname.replace(`/${currentLocale}`, `/${language}`);
        router.push(newPath);
      }
      // Don't refresh for theme/font changes - they're already applied
    } catch (error) {
      console.error('Error saving changes:', error);
      setMessage(error instanceof Error ? error.message : 'Failed to save changes');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgradePlan = async (planType: UserPlan) => {
    if (planType === currentPlan) return;
    
    setUpgradingPlan(true);
    try {
      await upgradePlan(planType);
      setCurrentPlan(planType);
      setMessage(t('settings.plan.upgradeSuccess'));
      router.refresh();
    } catch (error) {
      console.error('Error upgrading plan:', error);
      setMessage('Failed to upgrade plan');
    } finally {
      setUpgradingPlan(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
    handleClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-(--color-bg-secondary) rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-(--color-border)">
          <h2 className="text-2xl font-bold text-(--color-text-primary)">{t('settings.title')}</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-(--color-bg-tertiary) rounded-lg transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-(--color-text-secondary)">{t('common.close')}</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-8 px-6 border-b border-(--color-border)">
          <button
            onClick={() => setActiveTab('account')}
            className={`pb-3 pt-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'account'
                ? 'border-(--color-accent) text-(--color-accent)'
                : 'border-transparent text-(--color-text-secondary) hover:text-(--color-text-primary)'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">person</span>
            {t('settings.tabs.account')}
          </button>
          <button
            onClick={() => setActiveTab('plan')}
            className={`pb-3 pt-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'plan'
                ? 'border-(--color-accent) text-(--color-accent)'
                : 'border-transparent text-(--color-text-secondary) hover:text-(--color-text-primary)'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">workspace_premium</span>
            {t('settings.tabs.plan')}
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`pb-3 pt-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'notifications'
                ? 'border-(--color-accent) text-(--color-accent)'
                : 'border-transparent text-(--color-text-secondary) hover:text-(--color-text-primary)'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">notifications</span>
            {t('settings.tabs.notifications')}
          </button>
          <button
            onClick={() => setActiveTab('usage')}
            className={`pb-3 pt-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'usage'
                ? 'border-(--color-accent) text-(--color-accent)'
                : 'border-transparent text-(--color-text-secondary) hover:text-(--color-text-primary)'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">analytics</span>
            {t('settings.tabs.usage')}
          </button>
        </div>

        {/* Content */}
        <PerfectScrollbarWrapper className="flex-1 p-6">
          {activeTab === 'account' && (
            <div className="max-w-2xl">
              <h3 className="text-xl font-bold text-(--color-text-primary) mb-6">{t('settings.account.title')}</h3>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-(--color-text-primary) mb-2">
                    {t('settings.account.fullName')}
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={t('settings.account.fullNamePlaceholder')}
                    className="w-full px-4 py-3 rounded-xl border border-(--color-border) bg-(--color-input-bg) text-(--color-text-primary) focus:ring-2 focus:ring-(--color-accent) focus:border-(--color-accent) outline-none transition-shadow"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-(--color-text-primary) mb-2">
                    {t('settings.account.emailAddress')}
                  </label>
                  <input
                    type="email"
                    value={userEmail || ''}
                    disabled
                    className="w-full px-4 py-3 rounded-xl border border-(--color-border) bg-(--color-bg-tertiary) text-(--color-text-secondary) cursor-not-allowed"
                  />

                </div>

                <div>
                  <label className="block text-sm font-semibold text-(--color-text-primary) mb-2">
                    {t('settings.account.languagePreference')}
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-(--color-border) bg-(--color-input-bg) text-(--color-text-primary) focus:ring-2 focus:ring-(--color-accent) focus:border-(--color-accent) outline-none transition-shadow cursor-pointer"
                  >
                    <option value="en">{t('settings.account.languages.en')}</option>
                    <option value="ms">{t('settings.account.languages.ms')}</option>
                    <option value="zh">{t('settings.account.languages.zh')}</option>
                    <option value="ta">{t('settings.account.languages.ta')}</option>
                    <option value="tl">{t('settings.account.languages.tl')}</option>
                    <option value="id">{t('settings.account.languages.id')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-(--color-text-primary) mb-2">
                    {t('settings.account.fontSize')}
                  </label>
                  <select
                    value={fontSize}
                    onChange={(e) => setFontSize(e.target.value as any)}
                    className="w-full px-4 py-3 rounded-xl border border-(--color-border) bg-(--color-input-bg) text-(--color-text-primary) focus:ring-2 focus:ring-(--color-accent) focus:border-(--color-accent) outline-none transition-shadow cursor-pointer"
                  >
                    <option value="small">{t('settings.account.fontSizes.small')}</option>
                    <option value="medium">{t('settings.account.fontSizes.medium')}</option>
                    <option value="large">{t('settings.account.fontSizes.large')}</option>
                    <option value="extra-large">{t('settings.account.fontSizes.extraLarge')}</option>
                  </select>

                </div>

                <div>
                  <label className="block text-sm font-semibold text-(--color-text-primary) mb-2">
                    {t('settings.account.theme')}
                  </label>
                  {!mounted ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-(--color-border) bg-(--color-bg-tertiary)">
                        <span className="material-symbols-outlined text-[24px]">light_mode</span>
                        <span className="font-medium">{t('common.loading')}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setTheme('light')}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all cursor-pointer ${
                          theme === 'light'
                            ? 'border-(--color-accent) bg-(--color-bg-tertiary)'
                            : 'border-(--color-border) hover:border-(--color-border-secondary)'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[24px] text-(--color-text-primary)">light_mode</span>
                        <span className="font-medium text-(--color-text-primary)">{t('settings.account.light')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTheme('dark')}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all cursor-pointer ${
                          theme === 'dark'
                            ? 'border-(--color-accent) bg-(--color-bg-tertiary)'
                            : 'border-(--color-border) hover:border-(--color-border-secondary)'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[24px] text-(--color-text-primary)">dark_mode</span>
                        <span className="font-medium text-(--color-text-primary)">{t('settings.account.dark')}</span>
                      </button>
                    </div>
                  )}

                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSaveChanges}
                    disabled={loading}
                    className="px-6 py-3 bg-(--color-button-primary-bg) text-(--color-button-primary-text) rounded-xl font-semibold hover:bg-(--color-button-primary-hover) transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? t('common.saving') : t('common.save')}
                  </button>
                  {message && (
                    <span className={`text-sm font-medium ${
                      message === t('settings.account.saveSuccess')
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {message}
                    </span>
                  )}
                </div>

                <div className="pt-6 border-t border-(--color-border)">
                  <button
                    onClick={handleSignOut}
                    className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium text-sm flex items-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[20px]">logout</span>
                    {t('settings.account.signOut')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'plan' && (
            <div>
              <h3 className="text-xl font-bold text-(--color-text-primary) mb-6">{t('settings.plan.title')}</h3>
              
              {loadingData ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-(--color-bg-secondary) p-6 rounded-2xl border-2 border-(--color-border) animate-pulse">
                      <div className="h-8 bg-(--color-bg-tertiary) rounded mb-4"></div>
                      <div className="h-12 bg-(--color-bg-tertiary) rounded mb-6"></div>
                      <div className="h-20 bg-(--color-bg-tertiary) rounded mb-6"></div>
                      <div className="space-y-3 mb-6">
                        <div className="h-4 bg-(--color-bg-tertiary) rounded"></div>
                        <div className="h-4 bg-(--color-bg-tertiary) rounded"></div>
                        <div className="h-4 bg-(--color-bg-tertiary) rounded"></div>
                      </div>
                      <div className="h-12 bg-(--color-bg-tertiary) rounded"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Free Plan */}
                  <div className={`bg-(--color-bg-secondary) p-6 rounded-2xl border-2 ${
                    currentPlan === 'free' ? 'border-(--color-border-secondary)' : 'border-(--color-border)'
                  } relative`}>
                    {currentPlan === 'free' && (
                      <div className="absolute top-4 right-4 bg-(--color-bg-tertiary) text-(--color-text-primary) text-xs font-bold px-3 py-1 rounded-full">
                        {t('settings.plan.currentPlan')}
                      </div>
                    )}
                    <h4 className="text-2xl font-bold text-(--color-text-primary) mb-2 mt-4">{t('settings.plan.free.name')}</h4>
                    <div className="mb-6">
                      <span className="text-4xl font-bold text-(--color-text-primary)">{t('settings.plan.free.price')}</span>
                      <span className="text-(--color-text-secondary) font-medium">{t('settings.plan.free.period')}</span>
                    </div>
                    <p className="text-sm text-(--color-text-secondary) mb-6 pb-6 border-b border-(--color-border)">
                      {t('settings.plan.free.description')}
                    </p>
                    <ul className="space-y-3 mb-6">
                      <li className="flex items-start gap-2 text-sm">
                        <span className="material-symbols-outlined text-(--color-accent) text-[20px] mt-0.5">check_circle</span>
                        <span>{t('settings.plan.free.features.assistant')}</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm">
                        <span className="material-symbols-outlined text-(--color-accent) text-[20px] mt-0.5">check_circle</span>
                        <span>{t('settings.plan.free.features.knowledgeBase')}</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm">
                        <span className="material-symbols-outlined text-(--color-accent) text-[20px] mt-0.5">check_circle</span>
                        <span>{t('settings.plan.free.features.messageLimits')}</span>
                      </li>
                    </ul>
                    {currentPlan === 'free' && (
                      <button
                        disabled
                        className="w-full py-3 px-4 rounded-xl font-semibold border-2 border-(--color-border) text-(--color-text-secondary) bg-(--color-bg-tertiary) cursor-default"
                      >
                        {t('settings.plan.currentlyActive')}
                      </button>
                    )}
                  </div>

                  {/* Pro Plan */}
                  <div className={`bg-(--color-bg-secondary) p-6 rounded-2xl border-2 ${
                    currentPlan === 'pro' ? 'border-(--color-accent) ring-4 ring-blue-50 dark:ring-blue-950' : 'border-(--color-accent)'
                  } relative`}>
                    <div className="absolute top-0 left-0 right-0 bg-(--color-accent) text-white text-xs font-bold px-4 py-1.5 text-center rounded-t-xl">
                      {t('settings.plan.recommended')}
                    </div>
                    {currentPlan === 'pro' && (
                      <div className="absolute top-10 right-4 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                        {t('settings.plan.currentPlan')}
                      </div>
                    )}
                    <h4 className="text-2xl font-bold text-(--color-accent) mb-2 mt-8">{t('settings.plan.pro.name')}</h4>
                    <div className="mb-6">
                      <span className="text-4xl font-bold text-(--color-text-primary)">{t('settings.plan.pro.price')}</span>
                      <span className="text-(--color-text-secondary) font-medium">{t('settings.plan.pro.period')}</span>
                    </div>
                    <p className="text-sm text-(--color-text-secondary) mb-6 pb-6 border-b border-(--color-border)">
                      {t('settings.plan.pro.description')}
                    </p>
                    <ul className="space-y-3 mb-6">
                      <li className="flex items-start gap-2 text-sm">
                        <span className="material-symbols-outlined text-(--color-accent) text-[20px] mt-0.5">check_circle</span>
                        <span>{t('settings.plan.pro.features.everything')}</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm">
                        <span className="material-symbols-outlined text-(--color-accent) text-[20px] mt-0.5">check_circle</span>
                        <span>{t('settings.plan.pro.features.uploadDocs')}</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm">
                        <span className="material-symbols-outlined text-(--color-accent) text-[20px] mt-0.5">check_circle</span>
                        <span className="font-semibold text-(--color-accent)">{t('settings.plan.pro.features.personalKB')}</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm">
                        <span className="material-symbols-outlined text-(--color-accent) text-[20px] mt-0.5">check_circle</span>
                        <span>{t('settings.plan.pro.features.higherLimits')}</span>
                      </li>
                    </ul>
                    {currentPlan !== 'pro' && (
                      <button 
                        onClick={() => handleUpgradePlan('pro')}
                        disabled={upgradingPlan}
                        className="w-full py-3 px-4 rounded-xl font-bold text-white bg-(--color-accent) hover:bg-(--color-accent-hover) transition-colors shadow-md cursor-pointer disabled:opacity-50"
                      >
                        {upgradingPlan ? t('common.loading') : t('settings.plan.upgradeToPro')}
                      </button>
                    )}
                    {currentPlan === 'pro' && (
                      <button
                        disabled
                        className="w-full py-3 px-4 rounded-xl font-semibold border-2 border-(--color-border) text-(--color-text-secondary) bg-(--color-bg-tertiary) cursor-default"
                      >
                        {t('settings.plan.currentlyActive')}
                      </button>
                    )}
                  </div>

                  {/* Business Plan */}
                  <div className={`bg-(--color-bg-secondary) p-6 rounded-2xl border-2 ${
                    currentPlan === 'business' ? 'border-(--color-border-secondary)' : 'border-(--color-border)'
                  } relative`}>
                    {currentPlan === 'business' && (
                      <div className="absolute top-4 right-4 bg-(--color-bg-tertiary) text-(--color-text-primary) text-xs font-bold px-3 py-1 rounded-full">
                        {t('settings.plan.currentPlan')}
                      </div>
                    )}
                    <h4 className="text-2xl font-bold text-(--color-text-primary) mb-2 mt-4">{t('settings.plan.business.name')}</h4>
                    <div className="mb-6">
                      <span className="text-4xl font-bold text-(--color-text-primary)">{t('settings.plan.business.price')}</span>
                    </div>
                    <p className="text-sm text-(--color-text-secondary) mb-6 pb-6 border-b border-(--color-border)">
                      {t('settings.plan.business.description')}
                    </p>
                    <ul className="space-y-3 mb-6">
                      <li className="flex items-start gap-2 text-sm">
                        <span className="material-symbols-outlined text-(--color-text-tertiary) text-[20px] mt-0.5">check_circle</span>
                        <span>{t('settings.plan.business.features.everything')}</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm">
                        <span className="material-symbols-outlined text-(--color-text-tertiary) text-[20px] mt-0.5">check_circle</span>
                        <span>{t('settings.plan.business.features.aiAgents')}</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm">
                        <span className="material-symbols-outlined text-(--color-text-tertiary) text-[20px] mt-0.5">check_circle</span>
                        <span>{t('settings.plan.business.features.teamWorkspace')}</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm">
                        <span className="material-symbols-outlined text-(--color-text-tertiary) text-[20px] mt-0.5">check_circle</span>
                        <span>{t('settings.plan.business.features.prioritySupport')}</span>
                      </li>
                    </ul>
                    {currentPlan !== 'business' && (
                      <button className="w-full py-3 px-4 rounded-xl font-bold border-2 border-(--color-accent) text-(--color-accent) hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors cursor-pointer">
                        {t('settings.plan.contactUs')}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="max-w-2xl">
              <h3 className="text-xl font-bold text-(--color-text-primary) mb-6">{t('settings.notifications.title')}</h3>

              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-(--color-bg-tertiary) rounded-xl border border-(--color-border)">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-(--color-accent) text-[24px] mt-1">volume_up</span>
                    <div>
                      <h4 className="font-semibold text-(--color-text-primary) mb-1">{t('settings.notifications.soundNotifications')}</h4>
                      <p className="text-sm text-(--color-text-secondary)">
                        {t('settings.notifications.soundDescription')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                      soundEnabled ? 'bg-(--color-accent)' : 'bg-(--color-border-secondary)'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        soundEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {soundEnabled && (
                  <div>
                    <label className="block text-sm font-semibold text-(--color-text-primary) mb-2">
                      {t('settings.notifications.notificationSound')}
                    </label>
                    <select
                      value={notificationSound}
                      onChange={(e) => setNotificationSound(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-(--color-border) bg-(--color-input-bg) text-(--color-text-primary) focus:ring-2 focus:ring-(--color-accent) focus:border-(--color-accent) outline-none transition-shadow cursor-pointer"
                    >
                      <option value="default">{t('settings.notifications.sounds.default')}</option>
                      <option value="chime">{t('settings.notifications.sounds.chime')}</option>
                      <option value="bell">{t('settings.notifications.sounds.bell')}</option>
                      <option value="ding">{t('settings.notifications.sounds.ding')}</option>
                      <option value="pop">{t('settings.notifications.sounds.pop')}</option>
                    </select>
                    <button
                      onClick={() => {
                        const audio = new Audio('/sounds/notification.mp3');
                        audio.play().catch(() => {});
                      }}
                      className="mt-3 text-sm text-(--color-accent) hover:text-(--color-accent-hover) font-medium flex items-center gap-2 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">play_circle</span>
                      {t('settings.notifications.testSound')}
                    </button>
                  </div>
                )}

                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-900 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-(--color-accent) text-[20px] mt-0.5">info</span>
                    <div className="text-sm text-(--color-text-primary)">
                      <p className="font-medium mb-1">{t('settings.notifications.aboutNotifications')}</p>
                      <p className="text-(--color-text-secondary)">
                        {t('settings.notifications.aboutDescription')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSaveChanges}
                    disabled={loading}
                    className="px-6 py-3 bg-(--color-button-primary-bg) text-(--color-button-primary-text) rounded-xl font-semibold hover:bg-(--color-button-primary-hover) transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? t('common.saving') : t('common.save')}
                  </button>
                  {message && (
                    <span className={`text-sm font-medium ${
                      message === t('settings.account.saveSuccess')
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {message}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'usage' && (
            <div className="max-w-2xl">
              <h3 className="text-xl font-bold text-(--color-text-primary) mb-6">{t('settings.usage.title')}</h3>
              
              {loadingData ? (
                <div className="bg-(--color-bg-tertiary) p-6 rounded-xl border border-(--color-border) animate-pulse">
                  <div className="h-6 bg-(--color-bg-secondary) rounded mb-4 w-1/2"></div>
                  <div className="h-4 bg-(--color-bg-secondary) rounded mb-6 w-3/4"></div>
                  <div className="h-12 bg-(--color-bg-secondary) rounded mb-4"></div>
                  <div className="h-3 bg-(--color-bg-secondary) rounded mb-5"></div>
                  <div className="h-20 bg-(--color-bg-secondary) rounded"></div>
                </div>
              ) : usageData ? (
                <div className="bg-(--color-bg-tertiary) p-6 rounded-xl border border-(--color-border)">
                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <h4 className="text-base font-bold text-(--color-text-primary)">{t('settings.usage.aiMessageLimit')}</h4>
                      <p className="text-sm text-(--color-text-secondary) mt-1">
                        {t('settings.usage.cycleResets', { days: usageData.days_until_reset })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-(--color-accent)">
                        {usageData.messages_used} <span className="text-base font-medium text-(--color-text-secondary)">/ {usageData.messages_limit}</span>
                      </p>
                      <p className="text-xs font-semibold uppercase tracking-wider text-(--color-text-secondary) mt-1">
                        {t('settings.usage.messagesUsed')}
                      </p>
                    </div>
                  </div>
                  <div className="w-full bg-(--color-border) rounded-full h-3 mb-5 overflow-hidden">
                    <div
                      className="bg-(--color-accent) h-3 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(usageData.usage_percentage, 100)}%` }}
                    ></div>
                  </div>
                  {usageData.usage_percentage >= 80 && (
                    <div className="flex items-start gap-3 p-4 bg-blue-50/50 dark:bg-blue-950/50 rounded-xl border border-blue-100 dark:border-blue-900">
                      <span className="material-symbols-outlined text-(--color-accent) text-[20px] mt-0.5">info</span>
                      <p className="text-sm text-(--color-text-primary) font-medium leading-relaxed">
                        {t('settings.usage.approachingLimitSimple')}{' '}
                        <button
                          onClick={() => setActiveTab('plan')}
                          className="text-(--color-accent) font-bold hover:underline cursor-pointer"
                        >
                          {t('settings.usage.upgradeToPro')}
                        </button>{' '}
                        {t('settings.usage.toIncreaseCapacity')}
                      </p>
                    </div>
                  )}
                  
                  {/* Token usage info */}
                  <div className="mt-6 pt-6 border-t border-(--color-border)">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-(--color-text-primary)">{t('settings.usage.tokensUsed')}</h4>
                        <p className="text-xs text-(--color-text-secondary) mt-1">
                          {t('settings.usage.tokensDescription')}
                        </p>
                      </div>
                      <p className="text-xl font-bold text-(--color-text-primary)">
                        {usageData.tokens_used.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-(--color-bg-tertiary) p-6 rounded-xl border border-(--color-border)">
                  <p className="text-(--color-text-secondary)">{t('settings.usage.noData')}</p>
                </div>
              )}
            </div>
          )}
        </PerfectScrollbarWrapper>
      </div>
    </div>
  );
}
