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
  const sessionId = req.query.session_id as string

  if (req.method !== 'GET') return res.status(405).end()

  if (!sessionId) {
    return res.status(400).json({ error: 'Missing session_id' })
  }

  try {
    const supabase = getServiceClient()

    const { data: session } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (!session || !session.extracted_data) {
      return res.status(404).json({ error: 'Report not found' })
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
