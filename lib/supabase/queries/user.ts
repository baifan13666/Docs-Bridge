import { createClient } from '../server';

export type UserPlan = 'free' | 'pro' | 'business';
export type PlanStatus = 'active' | 'cancelled' | 'expired';

export interface UserPlanData {
  id: string;
  user_id: string;
  plan_type: UserPlan;
  status: PlanStatus;
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
 * Get user's current plan
 */
export async function getUserPlan(): Promise<UserPlanData | null> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('user_plans')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error) {
    console.error('Error fetching user plan:', error);
    return null;
  }

  return data as UserPlanData;
}

/**
 * Get user profile with metadata
 */
export async function getUserProfile(): Promise<UserProfile | null> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email || '',
    full_name: user.user_metadata?.full_name || user.user_metadata?.name,
    avatar_url: user.user_metadata?.avatar_url,
    language: user.user_metadata?.language,
    theme: user.user_metadata?.theme,
    font_size: user.user_metadata?.font_size,
    sound_enabled: user.user_metadata?.sound_enabled,
    notification_sound: user.user_metadata?.notification_sound,
  };
}

/**
 * Update user plan
 */
export async function updateUserPlan(
  planType: UserPlan,
  expiresAt?: string | null
): Promise<UserPlanData | null> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('user_plans')
    .upsert({
      user_id: user.id,
      plan_type: planType,
      status: 'active',
      started_at: new Date().toISOString(),
      expires_at: expiresAt || null,
    }, {
      onConflict: 'user_id'
    })
    .select()
    .single();

  if (error) {
    console.error('Error updating user plan:', error);
    throw error;
  }

  return data as UserPlanData;
}

/**
 * Cancel user plan (set status to cancelled)
 */
export async function cancelUserPlan(): Promise<UserPlanData | null> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('user_plans')
    .update({
      status: 'cancelled',
    })
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Error cancelling user plan:', error);
    throw error;
  }

  return data as UserPlanData;
}
