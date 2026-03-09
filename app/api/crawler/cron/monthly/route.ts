/**
 * Monthly Crawler Cron Job
 * 
 * GET /api/crawler/cron/monthly
 * 
 * Triggered by Vercel Cron at 4:00 AM on the 1st of each month
 * Queues monthly crawl jobs via QStash
 */

import { NextRequest, NextResponse } from 'next/server';
import { qstashClient } from '@/lib/qstash/client';
import { GOVERNMENT_SOURCES } from '@/lib/crawler/sources';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('[Cron Monthly] ========================================');
    console.log('[Cron Monthly] Starting monthly crawl job...');

    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
    
    if (authHeader !== expectedAuth) {
      console.error('[Cron Monthly] Unauthorized request');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get monthly sources
    const monthlySources = GOVERNMENT_SOURCES.filter(
      source => source.crawl_frequency === 'monthly'
    );

    console.log(`[Cron Monthly] Found ${monthlySources.length} monthly sources`);

    if (monthlySources.length === 0) {
      console.log('[Cron Monthly] No monthly sources configured');
      return NextResponse.json({
        success: true,
        message: 'No monthly sources to crawl',
        queued: 0
      });
    }

    // Queue crawl jobs via QStash
    const queuedJobs: Array<{
      source_id: string;
      source_name: string;
      message_id: string;
    }> = [];
    const failedJobs: Array<{
      source_id: string;
      source_name: string;
      error: string;
    }> = [];

    for (const source of monthlySources) {
      try {
        console.log(`[Cron Monthly] Queuing: ${source.name} (${source.id})`);
        
        const result = await qstashClient.publishJSON({
          url: `${process.env.NEXT_PUBLIC_APP_URL}/api/crawler/worker`,
          body: {
            source_id: source.id,
            triggered_by: 'cron_monthly',
            timestamp: new Date().toISOString()
          },
          retries: 3,
          delay: queuedJobs.length * 5
        });

        queuedJobs.push({
          source_id: source.id,
          source_name: source.name,
          message_id: result.messageId
        });

        console.log(`[Cron Monthly] ✅ Queued: ${source.name}`);
      } catch (error) {
        console.error(`[Cron Monthly] ❌ Failed to queue ${source.name}:`, error);
        failedJobs.push({
          source_id: source.id,
          source_name: source.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`[Cron Monthly] ✅ Queued ${queuedJobs.length} jobs`);
    if (failedJobs.length > 0) {
      console.log(`[Cron Monthly] ⚠️ Failed ${failedJobs.length} jobs`);
    }
    console.log('[Cron Monthly] ========================================');

    return NextResponse.json({
      success: true,
      queued: queuedJobs.length,
      failed: failedJobs.length,
      jobs: queuedJobs,
      failures: failedJobs
    });

  } catch (error) {
    console.error('[Cron Monthly] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
