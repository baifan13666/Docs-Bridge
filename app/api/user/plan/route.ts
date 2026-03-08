import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserPlan } from '@/lib/supabase/queries/user';

/**
 * GET /api/user/plan
 * Get user's current plan
 */
export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const plan = await getUserPlan();
    
    if (!plan) {
      // Return default free plan if not found
      return NextResponse.json({
        success: true,
        plan: {
          user_id: user.id,
          plan_type: 'free',
          status: 'active',
          started_at: new Date().toISOString(),
          expires_at: null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      plan,
    });
  } catch (error) {
    console.error('Error fetching user plan:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
