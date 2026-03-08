import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateUserPlan, type UserPlan } from '@/lib/supabase/queries/user';

/**
 * POST /api/user/plan/upgrade
 * Upgrade user plan
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { plan_type } = body;

    // Validate plan type
    if (!['free', 'pro', 'business'].includes(plan_type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid plan type' },
        { status: 400 }
      );
    }

    // Calculate expiration date for paid plans
    let expiresAt: string | null = null;
    if (plan_type !== 'free') {
      // Set expiration to 30 days from now for paid plans
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 30);
      expiresAt = expirationDate.toISOString();
    }

    const plan = await updateUserPlan(plan_type as UserPlan, expiresAt);

    if (!plan) {
      return NextResponse.json(
        { success: false, error: 'Failed to update plan' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      plan,
    });
  } catch (error) {
    console.error('Error upgrading user plan:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
