// ========================================
// diyaa.ai — GET /api/report-html
// Returns the full HTML report for PDF export.
// Can be used with browser print or server-side PDF generation.
// ========================================

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServiceClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { generateReportHTML } from '@/lib/pdf'
import type { ExtractedData } from '@/lib/types'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const sessionIdFromRequest = req.query.session_id as string | undefined
  const reportIdFromRequest = req.query.report_id as string | undefined

  if (req.method !== 'GET') return res.status(405).end()

  if (!sessionIdFromRequest && !reportIdFromRequest) {
    return res.status(400).json({ error: 'Missing session_id or report_id' })
  }

  try {
    const supabase = getServiceClient()
    let sessionId = sessionIdFromRequest ?? ''

    if (reportIdFromRequest) {
      const { data: reportLookup } = await supabase
        .from('reports')
        .select('session_id')
        .eq('id', reportIdFromRequest)
        .single()

      if (!reportLookup) {
        return res.status(404).json({ error: 'Report not found' })
      }

      sessionId = reportLookup.session_id
    }

    const { data: session } = await supabase
      .from('sessions')
      .select('extracted_data, ai_readiness_score, lead_captured')
      .eq('id', sessionId)
      .single()

    if (!session || !session.extracted_data) {
      return res.status(404).json({ error: 'Report not found' })
    }

    if (!session.lead_captured) {
      return res.status(403).json({ error: 'Lead must be submitted to view the report' })
    }

    const extractedData = session.extracted_data as ExtractedData
    const readinessScore = session.ai_readiness_score || extractedData.ai_readiness_score || 0

    const html = generateReportHTML(extractedData, readinessScore)

    res.setHeader('Content-Type', 'text/html')
    return res.status(200).send(html)
  } catch (err) {
    const error = err as Error
    logger.error('Report HTML generation failed', { message: error.message })
    return res.status(500).json({ error: 'Internal server error' })
  }
}
