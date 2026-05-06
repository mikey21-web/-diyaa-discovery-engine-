// ========================================
// diyaa.ai — POST /api/lead
// Captures lead data after session.
// ========================================

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServiceClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { sendLeadEmail } from '@/lib/email'
import type { LeadRequest, LeadResponse, ApiError, ExtractedData } from '@/lib/types'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LeadResponse | ApiError>
) {
  const requestId = Math.random().toString(36).slice(2, 10)
  const startedAt = Date.now()

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' })
  }

  const { session_id, name, email } = req.body as LeadRequest

  if (!session_id || !name || !email) {
    return res.status(400).json({ error: 'Name and email are required.', code: 'INVALID_INPUT' })
  }

  if (!email.includes('@')) {
    return res.status(400).json({ error: 'Enter a valid email address.', code: 'INVALID_INPUT' })
  }

  try {
    const supabase = getServiceClient()

    const [sessionRes, reportRes] = await Promise.all([
      supabase.from('sessions').select('extracted_data').eq('id', session_id).single(),
      supabase.from('reports').select('id, share_url').eq('session_id', session_id).single(),
    ]);

    const extractedData = sessionRes.data?.extracted_data as ExtractedData | null;
    const reportUrl = reportRes.data?.share_url || null;

    const { error: insertError } = await supabase.from('leads').insert({
      session_id,
      name,
      email,
      industry: extractedData?.industry || undefined,
      city: extractedData?.city || undefined,
      report_url: reportUrl,
      status: 'new',
    })

    if (insertError && !insertError.message?.includes('duplicate')) {
      throw insertError
    }

    await supabase.from('sessions').update({ lead_captured: true }).eq('id', session_id)

    try {
      await sendLeadEmail({
        name,
        email,
        industry: extractedData?.industry || undefined,
        report_url: reportUrl,
        ai_readiness_score: extractedData?.ai_readiness_score ?? undefined,
      })
    } catch (emailErr) {
      logger.warn('Email send failed, but lead was captured', { requestId, error: (emailErr as Error).message })
    }

    return res.status(200).json({ success: true, report_id: reportRes.data?.id || session_id } as any)
  } catch (err) {
    const error = err as Error
    logger.error('Lead Capture Crash', { msg: error.message, requestId })
    return res.status(500).json({ error: 'Could not capture lead. Please try again.', code: 'INTERNAL_ERROR' })
  } finally {
    logger.info('Lead request completed', { requestId, durationMs: Date.now() - startedAt })
  }
}
