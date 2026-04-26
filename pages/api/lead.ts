// ========================================
// diyaa.ai — POST /api/lead
// Captures lead data after session.
// ========================================

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServiceClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { sendLeadEmail } from '@/lib/email'
import type { LeadRequest, LeadResponse, ApiError, ExtractedData } from '@/lib/types'

function normalizeWhatsapp(input: string): string {
  return input.replace(/[^\d+]/g, '')
}

function isValidWhatsapp(input: string): boolean {
  const normalized = normalizeWhatsapp(input)
  return /^\+?\d{10,15}$/.test(normalized)
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LeadResponse | ApiError>
) {
  const requestId = Math.random().toString(36).slice(2, 10)
  const startedAt = Date.now()

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' })
  }

  const { session_id, name, email, whatsapp } = req.body as LeadRequest

  if (!session_id || !name || !whatsapp) {
    return res.status(400).json({ error: 'Name and WhatsApp are required.', code: 'INVALID_INPUT' })
  }

  if (!isValidWhatsapp(whatsapp)) {
    return res.status(400).json({ error: 'Enter a valid WhatsApp number.', code: 'INVALID_INPUT' })
  }

  if (email && !email.includes('@')) {
    return res.status(400).json({ error: 'Enter a valid email address.', code: 'INVALID_INPUT' })
  }

  try {
    const supabase = getServiceClient()

    // 1. Fetch Session + Report in PARALLEL
    const [sessionRes, reportRes] = await Promise.all([
      supabase.from('sessions').select('extracted_data').eq('id', session_id).single(),
      supabase.from('reports').select('id, share_url').eq('session_id', session_id).single(),
    ]);

    const extractedData = sessionRes.data?.extracted_data as ExtractedData | null;
    const reportUrl = reportRes.data?.share_url || null;

    // 2. Atomic Lead Insert (DB unique constraint prevents duplicates even under race conditions)
    const { error: insertError } = await supabase.from('leads').insert({
      session_id,
      name,
      email: email || null,
      whatsapp: normalizeWhatsapp(whatsapp),
      industry: extractedData?.industry || null,
      city: extractedData?.city || null,
      report_url: reportUrl,
      status: 'new',
    })

    // If lead already exists (UNIQUE constraint violation), that's OK — it was a retry
    if (insertError && !insertError.message?.includes('duplicate')) {
      throw insertError
    }

    // 3. Mark session complete
    await supabase.from('sessions').update({ lead_captured: true }).eq('id', session_id)

    // 4. Send email notification directly
    const normalizedWhatsapp = normalizeWhatsapp(whatsapp)
    try {
      await sendLeadEmail({
        name,
        email: email || null,
        whatsapp: normalizedWhatsapp,
        industry: extractedData?.industry || null,
        report_url: reportUrl,
        ai_readiness_score: extractedData?.ai_readiness_score ?? null,
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
