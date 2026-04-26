// ========================================
// diyaa.ai — Firecrawl Utility
// Web intelligence layer for competitor
// research and live market data.
// ========================================

const FIRECRAWL_BASE = 'https://api.firecrawl.dev/v1'

function getKey(): string {
  const key = process.env.FIRECRAWL_API_KEY
  if (!key) throw new Error('FIRECRAWL_API_KEY is not set')
  return key
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FirecrawlSearchResult {
  url: string
  title: string
  description: string
  markdown?: string
}

export interface FirecrawlScrapeResult {
  url: string
  title: string
  markdown: string
  metadata?: {
    description?: string
    keywords?: string
    ogTitle?: string
  }
}

export interface CompetitorIntelligence {
  name: string
  website?: string
  /** Raw scraped text — passed to Groq/Claude for synthesis */
  raw_content: string
  /** Detected signals */
  signals: {
    has_whatsapp: boolean
    has_ai_chatbot: boolean
    has_online_booking: boolean
    has_pricing_page: boolean
    has_negative_reviews: boolean
    estimated_tech_stack: string[]
  }
  /** Snippet snippets used */
  sources: string[]
}

// ─── Core: Search ─────────────────────────────────────────────────────────────

/**
 * Search the web for a query and return structured results.
 * Used for competitor name searches and industry benchmarking.
 */
export async function firecrawlSearch(
  query: string,
  limit = 5
): Promise<FirecrawlSearchResult[]> {
  const key = getKey()

  const res = await fetch(`${FIRECRAWL_BASE}/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      query,
      limit,
      scrapeOptions: { formats: ['markdown'] },
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Firecrawl search failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  return (data.data ?? []) as FirecrawlSearchResult[]
}

// ─── Core: Scrape ─────────────────────────────────────────────────────────────

/**
 * Scrape a single URL and return clean markdown content.
 * Ideal for pulling a competitor's homepage or pricing page.
 */
export async function firecrawlScrape(url: string): Promise<FirecrawlScrapeResult> {
  const key = getKey()

  const res = await fetch(`${FIRECRAWL_BASE}/scrape`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      url,
      formats: ['markdown'],
      onlyMainContent: true,
      timeout: 15000,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Firecrawl scrape failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  return {
    url,
    title: data.data?.metadata?.title ?? url,
    markdown: (data.data?.markdown ?? '').slice(0, 8000), // cap at 8k chars
    metadata: data.data?.metadata,
  }
}

// ─── High-level: Competitor Deep Scan ──────────────────────────────────────────

/**
 * Full competitor intelligence scan.
 * 1. Searches for competitor by name + industry
 * 2. Scrapes their top result URL if found
 * 3. Returns structured signals + raw content for AI synthesis
 */
export async function deepScanCompetitor(
  competitorName: string,
  industry: string,
  city?: string
): Promise<CompetitorIntelligence> {
  const locationHint = city ? ` ${city}` : ' India'
  const searchQuery = `${competitorName} ${industry}${locationHint} business`

  let searchResults: FirecrawlSearchResult[] = []
  try {
    searchResults = await firecrawlSearch(searchQuery, 5)
  } catch {
    // graceful fallback — continue with empty results
  }

  const sources = searchResults.map(r => r.url)
  const snippetText = searchResults
    .map(r => [r.title, r.description, (r.markdown ?? '').slice(0, 600)].join('\n'))
    .join('\n\n---\n\n')

  // Try scraping the top result's website
  let scrapedContent = ''
  const topUrl = searchResults[0]?.url
  if (topUrl && !topUrl.includes('facebook') && !topUrl.includes('justdial')) {
    try {
      const scraped = await firecrawlScrape(topUrl)
      scrapedContent = scraped.markdown
    } catch {
      // non-critical
    }
  }

  const combined = [snippetText, scrapedContent].join('\n\n').toLowerCase()

  const signals = {
    has_whatsapp: combined.includes('whatsapp'),
    has_ai_chatbot: combined.includes('chatbot') || combined.includes('ai assistant') || combined.includes('bot'),
    has_online_booking: combined.includes('book now') || combined.includes('schedule') || combined.includes('appointment'),
    has_pricing_page: combined.includes('pricing') || combined.includes('₹') || combined.includes('price'),
    has_negative_reviews: combined.includes('complaint') || combined.includes('issue') || combined.includes('bad'),
    estimated_tech_stack: detectTechStack(combined),
  }

  return {
    name: competitorName,
    website: topUrl,
    raw_content: [snippetText, scrapedContent].join('\n\n').slice(0, 12000),
    signals,
    sources,
  }
}

function detectTechStack(content: string): string[] {
  const stack: string[] = []
  const checks: [string, string][] = [
    ['shopify', 'Shopify'],
    ['wordpress', 'WordPress'],
    ['wix', 'Wix'],
    ['squarespace', 'Squarespace'],
    ['hubspot', 'HubSpot'],
    ['salesforce', 'Salesforce'],
    ['zoho', 'Zoho CRM'],
    ['intercom', 'Intercom'],
    ['freshdesk', 'Freshdesk'],
    ['razorpay', 'Razorpay'],
    ['stripe', 'Stripe'],
  ]
  for (const [keyword, label] of checks) {
    if (content.includes(keyword)) stack.push(label)
  }
  return stack
}

// ─── High-level: Live Industry Benchmark ──────────────────────────────────────

/**
 * Fetch live market data for an industry.
 * Returns a snippet of real-world context for the AI to use in diagnosis.
 */
export async function fetchIndustryBenchmark(
  industry: string,
  metric: string
): Promise<{ industry: string; metric: string; context: string; sources: string[] }> {
  const query = `${industry} India ${metric} 2024 2025 statistics benchmark`

  let results: FirecrawlSearchResult[] = []
  try {
    results = await firecrawlSearch(query, 3)
  } catch {
    return { industry, metric, context: '', sources: [] }
  }

  const context = results
    .map(r => `[${r.title}]\n${r.description}\n${(r.markdown ?? '').slice(0, 400)}`)
    .join('\n\n---\n\n')
    .slice(0, 4000)

  return {
    industry,
    metric,
    context,
    sources: results.map(r => r.url),
  }
}
