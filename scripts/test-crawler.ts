/**
 * Crawler Test Script
 * 
 * Test the crawler locally before deploying
 * 
 * Usage:
 *   npx tsx scripts/test-crawler.ts
 */

import { crawlHTML } from '../lib/crawler/html';
import { crawlPDF } from '../lib/crawler/pdf';
import { normalizeHTMLDocument, normalizePDFDocument, validateDocument } from '../lib/crawler/normalize';
import { GOVERNMENT_SOURCES, getSourceById } from '../lib/crawler/sources';

async function testCrawler() {
  console.log('🧪 Testing Crawler...\n');

  // Test HTML crawling
  console.log('📄 Testing HTML Crawler...');
  const htmlSource = getSourceById('moh-malaysia-covid');
  
  if (htmlSource) {
    try {
      console.log(`Crawling: ${htmlSource.name}`);
      console.log(`URL: ${htmlSource.url}\n`);
      
      const htmlContent = await crawlHTML(htmlSource.url);
      const normalizedHTML = normalizeHTMLDocument(htmlContent, htmlSource);
      const validation = validateDocument(normalizedHTML);
      
      console.log('✅ HTML Crawl Success!');
      console.log(`Title: ${normalizedHTML.title}`);
      console.log(`Word Count: ${normalizedHTML.metadata.word_count}`);
      console.log(`Quality Score: ${normalizedHTML.quality_score}/100`);
      console.log(`Valid: ${validation.valid}`);
      if (!validation.valid) {
        console.log(`Errors: ${validation.errors.join(', ')}`);
      }
      console.log('');
    } catch (error) {
      console.error('❌ HTML Crawl Failed:', error);
    }
  }

  // Test PDF crawling (if you have a PDF source)
  console.log('📑 Testing PDF Crawler...');
  const pdfSource = GOVERNMENT_SOURCES.find(s => s.type === 'pdf');
  
  if (pdfSource) {
    try {
      console.log(`Crawling: ${pdfSource.name}`);
      console.log(`URL: ${pdfSource.url}\n`);
      
      const pdfContent = await crawlPDF(pdfSource.url);
      const normalizedPDF = normalizePDFDocument(pdfContent, pdfSource);
      const validation = validateDocument(normalizedPDF);
      
      console.log('✅ PDF Crawl Success!');
      console.log(`Title: ${normalizedPDF.title}`);
      console.log(`Word Count: ${normalizedPDF.metadata.word_count}`);
      console.log(`Page Count: ${normalizedPDF.metadata.page_count}`);
      console.log(`Quality Score: ${normalizedPDF.quality_score}/100`);
      console.log(`Valid: ${validation.valid}`);
      if (!validation.valid) {
        console.log(`Errors: ${validation.errors.join(', ')}`);
      }
      console.log('');
    } catch (error) {
      console.error('❌ PDF Crawl Failed:', error);
    }
  } else {
    console.log('⚠️ No PDF sources configured\n');
  }

  // List all sources
  console.log('📋 Configured Sources:');
  console.log(`Total: ${GOVERNMENT_SOURCES.length}\n`);
  
  const byFrequency = {
    daily: GOVERNMENT_SOURCES.filter(s => s.crawl_frequency === 'daily'),
    weekly: GOVERNMENT_SOURCES.filter(s => s.crawl_frequency === 'weekly'),
    monthly: GOVERNMENT_SOURCES.filter(s => s.crawl_frequency === 'monthly')
  };
  
  console.log(`Daily: ${byFrequency.daily.length}`);
  byFrequency.daily.forEach(s => console.log(`  - ${s.name} (${s.country})`));
  
  console.log(`\nWeekly: ${byFrequency.weekly.length}`);
  byFrequency.weekly.forEach(s => console.log(`  - ${s.name} (${s.country})`));
  
  console.log(`\nMonthly: ${byFrequency.monthly.length}`);
  byFrequency.monthly.forEach(s => console.log(`  - ${s.name} (${s.country})`));
  
  console.log('\n✅ Test Complete!');
}

testCrawler().catch(console.error);
