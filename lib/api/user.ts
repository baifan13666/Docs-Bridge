'use client';

export type UserPlan = 'free' | 'pro' | 'business';

export interface UserPlanData {
  id: string;
  user_id: string;
  plan_type: UserPlan;
  status: 'active' | 'cancelled' | 'expired';
  started_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  language?: string;
  theme?: string;
  font_size?: string;
  sound_enabled?: boolean;
  notification_sound?: string;
}

/**
 * Get user profile
 */
export async function getUserProfile(): Promise<UserProfile> {
  const response = await fetch('/api/user/profile');
  
  if (!response.ok) {
    throw new Error('Failed to fetch user profile');
  }
  
  const data = await response.json();
  return data.user;
}

/**
 * Update user profile
 */
export async function updateUserProfile(updates: {
  full_name?: string;
  language?: string;
  theme?: string;
  font_size?: string;
  sound_enabled?: boolean;
  notification_sound?: string;
}): Promise<UserProfile> {
  const response = await fetch('/api/user/profile', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });
  
  if (!response.ok) {
    throw new Error('Failed to update user profile');
  }
  
  const data = await response.json();
  return data.user;
}

/**
 * Get user plan
 */
export async function getUserPlan(): Promise<UserPlanData> {
  const response = await fetch('/api/user/plan');
  
  if (!response.ok) {
    throw new Error('Failed to fetch user plan');
  }
  
  const data = await response.json();
  return data.plan;
}

/**
 * Upgrade user plan
 */
export async function upgradePlan(planType: UserPlan): Promise<UserPlanData> {
  const response = await fetch('/api/user/plan/upgrade', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ plan_type: planType }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to upgrade plan');
  }
  
  const data = await response.json();
  return data.plan;
}

export interface UsageData {
  messages_used: number;
  messages_limit: number;
  tokens_used: number;
  cycle_start_date: string;
  cycle_end_date: string;
  days_until_reset: number;
  usage_percentage: number;
}

/**
 * Get user usage statistics
 */
export async function getUserUsage(): Promise<UsageData> {
  const response = await fetch('/api/user/usage', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch usage data');
  }

  const data = await response.json();
  return data.usage;
}
