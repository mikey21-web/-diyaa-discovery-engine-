import type { NextApiRequest, NextApiResponse } from 'next'
import { getServiceClient } from '@/lib/supabase'
import { getBenchmarksForVertical } from '@/lib/benchmarks'
import { getScoreInterpretation } from '@/lib/scoring'
import { logger } from '@/lib/logger'
import type { ExtractedData, VerticalKey } from '@/lib/types'

type LeadRow = { name: string | null }

type SessionPollRow = {
  extracted_data: ExtractedData | null
  ai_readiness_score: number | null
  updated_at: string | null
  created_at: string
  lead_captured: boolean
  leads?: LeadRow[] | LeadRow | null
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') return res.status(405).end()

  const { session_id } = req.body
  if (!session_id) return res.status(400).json({ error: 'Missing session_id' })

  try {
    const supabase = getServiceClient()
    const [{ data: sessionData }, { data: reportData }] = await Promise.all([
      supabase
        .from('sessions')
        .select('extracted_data, ai_readiness_score, updated_at, created_at, lead_captured, leads(name)')
        .eq('id', session_id)
        .single(),
      supabase
        .from('reports')
        .select('id')
        .eq('session_id', session_id)
        .single(),
    ])

    const session = sessionData as SessionPollRow | null

    if (!session || !session.extracted_data) {
      return res.status(200).json({ ready: false })
    }

    if (!session.lead_captured) {
      return res.status(403).json({ error: 'Lead must be submitted to view the report' })
    }

    const extracted = session.extracted_data as ExtractedData
    const vertical = (extracted.industry || 'other') as VerticalKey
    const benchmarks = getBenchmarksForVertical(vertical)
    const score = session.ai_readiness_score || extracted.ai_readiness_score || 0
    const interpretation = getScoreInterpretation(score)

    const founderName = Array.isArray(session.leads)
      ? (session.leads[0]?.name ?? '')
      : (session.leads?.name ?? '')

    return res.status(200).json({
      ready: true,
      report: {
        founderName,
        businessName: extracted.business_name || extracted.business || 'Your Business',
        industry: extracted.industry || 'other',
        city: extracted.city || '',
        extractedData: extracted,
        benchmarkData: benchmarks,
        readiness: {
          score,
          tier: interpretation.tier,
          description: interpretation.description,
        },
        reportUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/report/${reportData?.id || session_id}`,
        generatedAt: session.updated_at || session.created_at,
      }
    })
  } catch (err) {
    const error = err as Error
    logger.error('report-poll failed', { message: error.message })
    return res.status(500).json({ error: 'Internal server error' })
  }
}
