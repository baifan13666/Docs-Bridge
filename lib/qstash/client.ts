import { Client } from '@upstash/qstash';

/**
 * QStash client for publishing messages and creating schedules.
 *
 * Used for:
 * - Queuing crawler worker jobs (government document crawling pipeline)
 * - Scheduling periodic crawl updates via Vercel Cron
 * - Background processing tasks
 *
 * Requires QSTASH_TOKEN environment variable.
 */
export const qstashClient = new Client({
  token: process.env.QSTASH_TOKEN!,
});
