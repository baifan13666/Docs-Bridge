/**
 * Daily Crawler Cron Job
 * 
 * GET /api/crawler/cron/daily
 * 
 * Triggered by Vercel Cron at 2:00 AM daily
 * Queues daily crawl jobs via QStash
 */

import { NextRequest, NextResponse } from 'next/server';
import { qstashClient } from '@/lib/qstash/client';
import { GOVERNMENT_SOURCES } from '@/lib/crawler/sources';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('[Cron Daily] ========================================');
    console.log('[Cron Daily] Starting daily crawl job...');

    // Verify cron secret (Vercel automatically adds this header)
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
    
    if (authHeader !== expectedAuth) {
      console.error('[Cron Daily] Unauthorized request');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get daily sources
    const dailySources = GOVERNMENT_SOURCES.filter(
      source => source.crawl_frequency === 'daily'
    );

    console.log(`[Cron Daily] Found ${dailySources.length} daily sources`);

    if (dailySources.length === 0) {
      console.log('[Cron Daily] No daily sources configured');
      return NextResponse.json({
        success: true,
        message: 'No daily sources to crawl',
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

    for (const source of dailySources) {
      try {
        console.log(`[Cron Daily] Queuing: ${source.name} (${source.id})`);
        
        const result = await qstashClient.publishJSON({
          url: `${process.env.NEXT_PUBLIC_APP_URL}/api/crawler/worker`,
          body: {
            source_id: source.id,
            triggered_by: 'cron_daily',
            timestamp: new Date().toISOString()
          },
          retries: 3,
          delay: queuedJobs.length * 5 // Stagger requests by 5 seconds
        });

        queuedJobs.push({
          source_id: source.id,
          source_name: source.name,
          message_id: result.messageId
        });

        console.log(`[Cron Daily] ✅ Queued: ${source.name}`);
      } catch (error) {
        console.error(`[Cron Daily] ❌ Failed to queue ${source.name}:`, error);
        failedJobs.push({
          source_id: source.id,
          source_name: source.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`[Cron Daily] ✅ Queued ${queuedJobs.length} jobs`);
    if (failedJobs.length > 0) {
      console.log(`[Cron Daily] ⚠️ Failed ${failedJobs.length} jobs`);
    }
    console.log('[Cron Daily] ========================================');

    return NextResponse.json({
      success: true,
      queued: queuedJobs.length,
      failed: failedJobs.length,
      jobs: queuedJobs,
      failures: failedJobs
    });

  } catch (error) {
    console.error('[Cron Daily] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
