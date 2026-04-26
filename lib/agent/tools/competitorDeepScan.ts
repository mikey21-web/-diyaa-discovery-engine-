// ========================================
// diyaa.ai — Competitor Deep Scan Tool
// Powered by Firecrawl.
// Scrapes + analyses competitor websites
// in real-time during the chat session.
// ========================================

import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import { deepScanCompetitor, fetchIndustryBenchmark } from '../../firecrawl'
import type { CompetitorFinding } from '../types'

export interface DeepScanResult {
  finding: CompetitorFinding
  benchmark?: {
    context: string
    sources: string[]
  }
  raw_content_snippet: string
}

export async function runDeepScan(
  competitorName: string,
  industry: string,
  city?: string,
  benchmarkMetric?: string
): Promise<DeepScanResult> {
  // Run competitor scan (and optionally a benchmark fetch) in parallel
  const [intel, benchmark] = await Promise.all([
    deepScanCompetitor(competitorName, industry, city),
    benchmarkMetric
      ? fetchIndustryBenchmark(industry, benchmarkMetric)
      : Promise.resolve(null),
  ])

  // Map raw signals → CompetitorFinding for the orchestrator
  const finding: CompetitorFinding = {
    name: intel.name,
    strengths: buildStrengths(intel.signals),
    weaknesses: buildWeaknesses(intel.signals),
    ai_usage: buildAiUsage(intel.signals),
    threat_level: computeThreatLevel(intel.signals),
  }

  return {
    finding,
    benchmark: benchmark
      ? { context: benchmark.context, sources: benchmark.sources }
      : undefined,
    raw_content_snippet: intel.raw_content.slice(0, 2000),
  }
}

// ─── Signal → Narrative helpers ───────────────────────────────────────────────

function buildStrengths(s: ReturnType<typeof parseSignals>): string[] {
  const strengths: string[] = []
  if (s.has_whatsapp) strengths.push('Active WhatsApp presence — already capturing mobile leads')
  if (s.has_online_booking) strengths.push('Online booking enabled — lower friction for customers')
  if (s.has_pricing_page) strengths.push('Transparent pricing — faster customer decision cycle')
  if (s.estimated_tech_stack.length > 0)
    strengths.push(`Tech stack detected: ${s.estimated_tech_stack.join(', ')}`)
  if (strengths.length === 0) strengths.push('Established market presence with existing customer base')
  return strengths.slice(0, 3)
}

function buildWeaknesses(s: ReturnType<typeof parseSignals>): string[] {
  const weaknesses: string[] = []
  if (!s.has_ai_chatbot) weaknesses.push('No AI chatbot or automation visible on website')
  if (!s.has_whatsapp) weaknesses.push('No WhatsApp — missing India\'s #1 business channel')
  if (s.has_negative_reviews) weaknesses.push('Negative reviews visible publicly — trust gap')
  if (!s.has_pricing_page) weaknesses.push('No pricing transparency — losing high-intent visitors')
  if (weaknesses.length === 0) weaknesses.push('Appears operationally manual based on public signals')
  return weaknesses.slice(0, 3)
}

function buildAiUsage(s: ReturnType<typeof parseSignals>): string {
  if (s.has_ai_chatbot && s.has_whatsapp)
    return 'AI chatbot + WhatsApp detected — moderately automated'
  if (s.has_ai_chatbot) return 'Basic AI chatbot visible — no WhatsApp integration'
  if (s.has_whatsapp) return 'WhatsApp active but no AI layer — manual responses'
  return 'No AI automation detected from public-facing signals'
}

function computeThreatLevel(s: ReturnType<typeof parseSignals>): 'low' | 'medium' | 'high' {
  let score = 0
  if (s.has_whatsapp) score += 1
  if (s.has_ai_chatbot) score += 2
  if (s.has_online_booking) score += 1
  if (s.estimated_tech_stack.length >= 2) score += 1
  if (score >= 4) return 'high'
  if (score >= 2) return 'medium'
  return 'low'
}

// Reuse the signal type shape inline (avoids circular import)
type Signals = {
  has_whatsapp: boolean
  has_ai_chatbot: boolean
  has_online_booking: boolean
  has_pricing_page: boolean
  has_negative_reviews: boolean
  estimated_tech_stack: string[]
}

// Identity helper so TypeScript is happy with the overloaded param
function parseSignals(s: Signals): Signals {
  return s
}
void parseSignals

// ─── Anthropic Tool Schema ─────────────────────────────────────────────────────

export const competitorDeepScanToolSchema: Tool = {
  name: 'competitor_deep_scan',
  description:
    'Deep-scan a competitor by scraping their website and running real-time web research via Firecrawl. ' +
    'Use this when the founder mentions a specific competitor by name. ' +
    'Returns their strengths, weaknesses, AI usage, threat level, and optionally live industry benchmarks. ' +
    'Always prefer this over web_search when a specific competitor name is available.',
  input_schema: {
    type: 'object' as const,
    properties: {
      competitor_name: {
        type: 'string',
        description: 'Exact or approximate name of the competitor (e.g. "Prestige Group", "Cure.fit")',
      },
      industry: {
        type: 'string',
        description: 'Industry vertical for context (e.g. "real estate", "coaching", "restaurant")',
      },
      city: {
        type: 'string',
        description: 'City/location for localised search (e.g. "Hyderabad", "Bangalore"). Optional.',
      },
      benchmark_metric: {
        type: 'string',
        description:
          'Optional: an industry metric to fetch live benchmarks for (e.g. "average revenue per location", "lead conversion rate"). ' +
          'Leave blank if not needed.',
      },
    },
    required: ['competitor_name', 'industry'],
  },
}
