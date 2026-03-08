/**
 * Government Document Sources
 * 
 * Curated list of government websites and documents for crawling
 */

export interface GovernmentSource {
  id: string;
  name: string;
  country: 'malaysia' | 'philippines' | 'singapore';
  url: string;
  type: 'html' | 'pdf';
  trust_level: number; // 1-5, where 5 is highest trust
  category: 'healthcare' | 'finance' | 'education' | 'housing' | 'social-services' | 'general';
  language: string;
  description: string;
  crawl_frequency?: 'daily' | 'weekly' | 'monthly';
}

export const GOVERNMENT_SOURCES: GovernmentSource[] = [
  // Malaysia
  {
    id: 'moh-malaysia-covid',
    name: 'Ministry of Health Malaysia - COVID-19',
    country: 'malaysia',
    url: 'https://covid-19.moh.gov.my/',
    type: 'html',
    trust_level: 5,
    category: 'healthcare',
    language: 'en',
    description: 'Official COVID-19 information and guidelines from Malaysian Ministry of Health',
    crawl_frequency: 'weekly'
  },
  {
    id: 'mysalam-info',
    name: 'MySalam Health Insurance',
    country: 'malaysia',
    url: 'https://www.mysalam.com.my/',
    type: 'html',
    trust_level: 5,
    category: 'healthcare',
    language: 'en',
    description: 'National health insurance scheme information',
    crawl_frequency: 'monthly'
  },
  {
    id: 'hasil-tax-guide',
    name: 'LHDN Tax Guide',
    country: 'malaysia',
    url: 'https://www.hasil.gov.my/',
    type: 'html',
    trust_level: 5,
    category: 'finance',
    language: 'en',
    description: 'Malaysian tax information and guidelines',
    crawl_frequency: 'monthly'
  },
  {
    id: 'kwsp-epf',
    name: 'KWSP/EPF Information',
    country: 'malaysia',
    url: 'https://www.kwsp.gov.my/',
    type: 'html',
    trust_level: 5,
    category: 'finance',
    language: 'en',
    description: 'Employees Provident Fund information',
    crawl_frequency: 'monthly'
  },
  
  // Philippines
  {
    id: 'doh-philippines',
    name: 'Department of Health Philippines',
    country: 'philippines',
    url: 'https://doh.gov.ph/',
    type: 'html',
    trust_level: 5,
    category: 'healthcare',
    language: 'en',
    description: 'Official health information and programs',
    crawl_frequency: 'weekly'
  },
  {
    id: 'dswd-programs',
    name: 'DSWD Social Programs',
    country: 'philippines',
    url: 'https://www.dswd.gov.ph/',
    type: 'html',
    trust_level: 5,
    category: 'social-services',
    language: 'en',
    description: 'Social welfare and development programs',
    crawl_frequency: 'monthly'
  },
  {
    id: 'philhealth',
    name: 'PhilHealth Information',
    country: 'philippines',
    url: 'https://www.philhealth.gov.ph/',
    type: 'html',
    trust_level: 5,
    category: 'healthcare',
    language: 'en',
    description: 'National health insurance program',
    crawl_frequency: 'monthly'
  },
  
  // Singapore
  {
    id: 'gov-sg-services',
    name: 'Gov.sg Services',
    country: 'singapore',
    url: 'https://www.gov.sg/',
    type: 'html',
    trust_level: 5,
    category: 'general',
    language: 'en',
    description: 'Singapore government services and information',
    crawl_frequency: 'weekly'
  },
  {
    id: 'moh-singapore',
    name: 'Ministry of Health Singapore',
    country: 'singapore',
    url: 'https://www.moh.gov.sg/',
    type: 'html',
    trust_level: 5,
    category: 'healthcare',
    language: 'en',
    description: 'Healthcare policies and programs',
    crawl_frequency: 'weekly'
  },
  {
    id: 'cpf-singapore',
    name: 'CPF Board Singapore',
    country: 'singapore',
    url: 'https://www.cpf.gov.sg/',
    type: 'html',
    trust_level: 5,
    category: 'finance',
    language: 'en',
    description: 'Central Provident Fund information',
    crawl_frequency: 'monthly'
  }
];

/**
 * Get source by ID
 */
export function getSourceById(id: string): GovernmentSource | undefined {
  return GOVERNMENT_SOURCES.find(source => source.id === id);
}

/**
 * Get sources by country
 */
export function getSourcesByCountry(country: 'malaysia' | 'philippines' | 'singapore'): GovernmentSource[] {
  return GOVERNMENT_SOURCES.filter(source => source.country === country);
}

/**
 * Get sources by category
 */
export function getSourcesByCategory(category: string): GovernmentSource[] {
  return GOVERNMENT_SOURCES.filter(source => source.category === category);
}

/**
 * Get high-priority sources (trust level >= 4)
 */
export function getHighPrioritySources(): GovernmentSource[] {
  return GOVERNMENT_SOURCES.filter(source => source.trust_level >= 4);
}
