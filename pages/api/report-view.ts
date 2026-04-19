import type { NextApiRequest, NextApiResponse } from 'next'
import { getServiceClient } from '@/lib/supabase'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { session_id } = req.body

  if (!session_id) {
    return res.status(400).json({ error: 'session_id required' })
  }

  try {
    const supabase = getServiceClient()

    // C4: Atomic view_count increment via Supabase RPC
    await supabase.rpc('increment_view_count', { p_session_id: session_id })

    // Mark lead as having opened their report
    await supabase
      .from('leads')
      .update({ report_opened: true })
      .eq('session_id', session_id)

    return res.status(200).json({ ok: true })

  } catch (error) {
    console.error('View count error:', error)
    // Fail silently — never break the report page over analytics
    return res.status(200).json({ ok: true })
  }
}
