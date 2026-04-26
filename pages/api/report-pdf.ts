import type { NextApiRequest, NextApiResponse } from 'next'
import { getServiceClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { generateReportHTML } from '@/lib/pdf'
import type { ExtractedData } from '@/lib/types'

export const config = {
  api: {
    responseLimit: '50mb',
  },
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { session_id, report_id } = req.body as { session_id?: string; report_id?: string }

  if (!session_id && !report_id) {
    return res.status(400).json({ error: 'Missing session_id or report_id' })
  }

  try {
    const supabase = getServiceClient()
    let actualSessionId = session_id ?? ''
    let actualReportId = report_id ?? ''

    if (report_id) {
      const { data: reportLookup } = await supabase
        .from('reports')
        .select('id, session_id')
        .eq('id', report_id)
        .single()

      if (!reportLookup) {
        return res.status(404).json({ error: 'Report not found' })
      }

      actualSessionId = reportLookup.session_id
      actualReportId = reportLookup.id
    }

    const { data: session } = await supabase
      .from('sessions')
      .select('extracted_data, ai_readiness_score, lead_captured')
      .eq('id', actualSessionId)
      .single()

    if (!session || !session.extracted_data) {
      return res.status(404).json({ error: 'Report not found' })
    }

    if (!session.lead_captured) {
      return res.status(403).json({ error: 'Lead must be submitted to view the report' })
    }

    if (!actualReportId) {
      const { data: report } = await supabase
        .from('reports')
        .select('id')
        .eq('session_id', actualSessionId)
        .single()

      actualReportId = report?.id ?? actualSessionId
    }

    if (!session.lead_captured) {
      return res.status(403).json({ error: 'Lead required to download report' })
    }

    const extractedData = session.extracted_data as ExtractedData
    const readinessScore = session.ai_readiness_score || extractedData.ai_readiness_score || 0

    const html = generateReportHTML(extractedData, readinessScore)

    // Dynamic import to avoid issues on platforms without headless chrome
    let generatePdf: any = null
    try {
      const htmlPdfNode = await import('html-pdf-node')
      generatePdf = htmlPdfNode.generatePdf
    } catch (e) {
      logger.warn('html-pdf-node not available, returning HTML instead')
      res.setHeader('Content-Type', 'text/html')
      return res.status(200).send(html)
    }

    if (!generatePdf) {
      res.setHeader('Content-Type', 'text/html')
      return res.status(200).send(html)
    }

    const options = {
      format: 'A4',
      margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
      printBackground: true,
      scale: 1,
      timeout: 30000,
    }

    const file = { content: html }

    const pdf = await generatePdf(file, options) as Buffer

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="AI_Implementation_Report_${actualReportId.slice(0, 8)}.pdf"`
    )
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')

    logger.info('Report PDF generated', { sessionId: actualSessionId, reportId: actualReportId })
    return res.status(200).send(pdf)
  } catch (err) {
    const error = err as Error
    logger.error('Report PDF generation failed', { message: error.message })
    return res.status(500).json({ error: 'Failed to generate PDF', details: error.message })
  }
}
