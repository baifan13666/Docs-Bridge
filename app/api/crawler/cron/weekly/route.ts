/**
 * Weekly Crawler Cron Job
 * 
 * GET /api/crawler/cron/weekly
 * 
 * Triggered by Vercel Cron at 3:00 AM every Sunday
 * Queues weekly crawl jobs via QStash
 */

import { NextRequest, NextResponse } from 'next/server';
import { qstashClient } from '@/lib/qstash/client';
import { GOVERNMENT_SOURCES } from '@/lib/crawler/sources';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('[Cron Weekly] ========================================');
    console.log('[Cron Weekly] Starting weekly crawl job...');

    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
    
    if (authHeader !== expectedAuth) {
      console.error('[Cron Weekly] Unauthorized request');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get weekly sources
    const weeklySources = GOVERNMENT_SOURCES.filter(
      source => source.crawl_frequency === 'weekly'
    );

    console.log(`[Cron Weekly] Found ${weeklySources.length} weekly sources`);

    if (weeklySources.length === 0) {
      console.log('[Cron Weekly] No weekly sources configured');
      return NextResponse.json({
        success: true,
        message: 'No weekly sources to crawl',
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

    for (const source of weeklySources) {
      try {
        console.log(`[Cron Weekly] Queuing: ${source.name} (${source.id})`);
        
        const result = await qstashClient.publishJSON({
          url: `${process.env.NEXT_PUBLIC_APP_URL}/api/crawler/worker`,
          body: {
            source_id: source.id,
            triggered_by: 'cron_weekly',
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

        console.log(`[Cron Weekly] ✅ Queued: ${source.name}`);
      } catch (error) {
        console.error(`[Cron Weekly] ❌ Failed to queue ${source.name}:`, error);
        failedJobs.push({
          source_id: source.id,
          source_name: source.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`[Cron Weekly] ✅ Queued ${queuedJobs.length} jobs`);
    if (failedJobs.length > 0) {
      console.log(`[Cron Weekly] ⚠️ Failed ${failedJobs.length} jobs`);
    }
    console.log('[Cron Weekly] ========================================');

    return NextResponse.json({
      success: true,
      queued: queuedJobs.length,
      failed: failedJobs.length,
      jobs: queuedJobs,
      failures: failedJobs
    });

  } catch (error) {
    console.error('[Cron Weekly] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
