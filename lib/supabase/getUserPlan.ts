import { createClient } from './server';

export type UserPlan = 'free' | 'pro' | 'business';

export interface UserPlanData {
  plan_type: UserPlan;
  status: 'active' | 'cancelled' | 'expired';
  started_at: string;
  expires_at: string | null;
}

export async function getUserPlan(): Promise<UserPlan> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return 'free';
  }

  // Query user_plans table
  const { data, error } = await supabase
    .from('user_plans')
    .select('plan_type, status')
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    console.error('Error fetching user plan:', error);
    return 'free';
  }

  // Return free if plan is not active
  if (data.status !== 'active') {
    return 'free';
  }

  return data.plan_type as UserPlan;
}

export async function getUserPlanData(): Promise<UserPlanData | null> {
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

  if (error || !data) {
    console.error('Error fetching user plan data:', error);
    return null;
  }

  return data as UserPlanData;
}
