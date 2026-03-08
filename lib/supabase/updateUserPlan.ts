'use client';

import { createClient } from './client';

export type UserPlan = 'free' | 'pro' | 'business';

export async function updateUserPlan(planType: UserPlan) {
  const supabase = createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Update or insert user plan
  const { data, error } = await supabase
    .from('user_plans')
    .upsert({
      user_id: user.id,
      plan_type: planType,
      status: 'active',
      started_at: new Date().toISOString(),
      expires_at: planType === 'free' ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days for paid plans
    }, {
      onConflict: 'user_id'
    })
    .select()
    .single();

  if (error) {
    console.error('Error updating user plan:', error);
    throw error;
  }

  return data;
}

export async function cancelUserPlan() {
  const supabase = createClient();
  
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

  return data;
}
