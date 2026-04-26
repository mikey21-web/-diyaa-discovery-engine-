import type { NextApiRequest, NextApiResponse } from 'next'
import { getServiceClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { session_id, report_id } = req.body as { session_id?: string; report_id?: string }

  if (!session_id && !report_id) {
    return res.status(400).json({ error: 'session_id or report_id required' })
  }

  try {
    const supabase = getServiceClient()
    let actualSessionId = session_id ?? ''

    if (report_id) {
      const { data: reportLookup } = await supabase
        .from('reports')
        .select('session_id')
        .eq('id', report_id)
        .single()

      if (!reportLookup) {
        return res.status(404).json({ error: 'Report not found' })
      }

      actualSessionId = reportLookup.session_id
    }

    // C4: Atomic view_count increment via Supabase RPC
    await supabase.rpc('increment_view_count', { p_session_id: actualSessionId })

    // Mark lead as having opened their report
    await supabase
      .from('leads')
      .update({ report_opened: true })
      .eq('session_id', actualSessionId)

    return res.status(200).json({ ok: true })

  } catch (error) {
    const err = error as Error
    logger.warn('View count update failed', { message: err.message })
    // Fail silently — never break the report page over analytics
    return res.status(200).json({ ok: true })
  }
}
