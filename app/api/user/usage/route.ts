/**
 * User Usage API
 * 
 * GET /api/user/usage - Get current usage statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get usage data
    const { data: usage, error: usageError } = await supabase
      .from('user_plans')
      .select('messages_used, messages_limit, tokens_used, cycle_start_date, cycle_end_date')
      .eq('user_id', user.id)
      .single();

    if (usageError) {
      console.error('[Usage API] Error fetching usage:', usageError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch usage data' },
        { status: 500 }
      );
    }

    // Calculate days until reset
    const cycleEnd = new Date(usage.cycle_end_date);
    const now = new Date();
    const daysUntilReset = Math.ceil((cycleEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return NextResponse.json({
      success: true,
      usage: {
        messages_used: usage.messages_used,
        messages_limit: usage.messages_limit,
        tokens_used: usage.tokens_used,
        cycle_start_date: usage.cycle_start_date,
        cycle_end_date: usage.cycle_end_date,
        days_until_reset: Math.max(0, daysUntilReset),
        usage_percentage: Math.round((usage.messages_used / usage.messages_limit) * 100)
      }
    });

  } catch (error) {
    console.error('[Usage API] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
