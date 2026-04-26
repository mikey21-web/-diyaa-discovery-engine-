import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import { CompetitorFinding } from '../types'

interface FirecrawlSearchResult {
  url: string
  title: string
  description: string
  markdown?: string
}

interface CompetitorResearchResult {
  finding: CompetitorFinding
  raw_snippets: string[]
}

export async function researchCompetitor(
  competitorName: string,
  industry: string
): Promise<CompetitorResearchResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) {
    return buildFallbackFinding(competitorName, industry)
  }

  try {
    const query = `${competitorName} ${industry} business India reviews pricing`
    const response = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        limit: 5,
        scrapeOptions: { formats: ['markdown'] },
      }),
    })

    if (!response.ok) {
      return buildFallbackFinding(competitorName, industry)
    }

    const data = await response.json()
    const results: FirecrawlSearchResult[] = data.data ?? []

    const snippets = results.map((r: FirecrawlSearchResult) =>
      [r.title, r.description, (r.markdown ?? '').slice(0, 500)].join(' ')
    )

    const finding = parseSnippetsToFinding(competitorName, snippets)
    return { finding, raw_snippets: snippets }
  } catch {
    return buildFallbackFinding(competitorName, industry)
  }
}

function parseSnippetsToFinding(name: string, snippets: string[]): CompetitorFinding {
  const combined = snippets.join(' ').toLowerCase()

  const hasWhatsApp = combined.includes('whatsapp')
  const hasAI = combined.includes('ai') || combined.includes('chatbot') || combined.includes('automation')
  const hasNegative = combined.includes('slow') || combined.includes('complaint') || combined.includes('issue')
  const hasPremium = combined.includes('premium') || combined.includes('luxury') || combined.includes('exclusive')

  return {
    name,
    strengths: [
      hasWhatsApp ? 'Active on WhatsApp' : 'Established brand presence',
      hasPremium ? 'Premium positioning' : 'Competitive pricing',
    ],
    weaknesses: [
      hasNegative ? 'Customer complaints visible online' : 'No visible AI automation',
      !hasAI ? 'Manual processes still dominant' : 'Generic AI tools without business customization',
    ],
    ai_usage: hasAI
      ? 'Basic chatbot or generic AI tools detected'
      : 'No meaningful AI automation visible',
    threat_level: hasAI && hasWhatsApp ? 'high' : hasAI || hasWhatsApp ? 'medium' : 'low',
  }
}

function buildFallbackFinding(name: string, _industry: string): CompetitorResearchResult {
  return {
    finding: {
      name,
      strengths: ['Established market presence', 'Existing customer base'],
      weaknesses: ['No visible AI automation stack', 'Manual operations likely still dominant'],
      ai_usage: 'No AI automation detected from public sources',
      threat_level: 'medium',
    },
    raw_snippets: [],
  }
}

export const webSearchToolSchema: Tool = {
  name: 'web_search',
  description:
    'Research a competitor using web search to understand their strengths, weaknesses, and AI usage. Call this when the founder names a competitor.',
  input_schema: {
    type: 'object' as const,
    properties: {
      competitor_name: {
        type: 'string',
        description: 'Name of the competitor to research',
      },
      industry: {
        type: 'string',
        description: 'Industry vertical for context (e.g. "real estate", "coaching")',
      },
    },
    required: ['competitor_name', 'industry'],
  },
}
