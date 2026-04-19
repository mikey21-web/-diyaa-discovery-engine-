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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' })
  }

  const { session_id, name, email } = req.body;

  // Manual Validation (Production Grade)
  if (!session_id || !name || !email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid Name and Email required.', code: 'INVALID_INPUT' });
  }

  try {
    const supabase = getServiceClient()

    // 1. Fetch Session + Report + Check Duplicates in PARALLEL
    const [sessionRes, reportRes, leadCheckRes] = await Promise.all([
      supabase.from('sessions').select('extracted_data').eq('id', session_id).single(),
      supabase.from('reports').select('share_url').eq('session_id', session_id).single(),
      supabase.from('leads').select('id').eq('session_id', session_id).maybeSingle()
    ]);

    if (leadCheckRes.data) {
      return res.status(200).json({ success: true });
    }

    const extractedData = sessionRes.data?.extracted_data as ExtractedData | null;
    const reportUrl = reportRes.data?.share_url || null;

    // 2. Atomic Lead Insert
    const { error: insertError } = await supabase.from('leads').insert({
      session_id,
      name,
      email,
      industry: extractedData?.industry || null,
      city: extractedData?.city || null,
      report_url: reportUrl,
      status: 'new',
      email_failed: false
    });

    if (insertError) throw insertError;

    // 3. Mark session complete
    await supabase.from('sessions').update({ lead_captured: true }).eq('id', session_id);

    // 4. Background Email Dispatch (Fire and Forget with Recovery Log)
    sendLeadEmail({
      name,
      email,
      session_id,
      industry: extractedData?.industry,
      city: extractedData?.city,
      report_url: reportUrl,
      ai_readiness_score: extractedData?.ai_readiness_score,
    }).catch(async (e) => {
      logger.error('CRITICAL: Email failed for lead', { email, session_id, err: e });
      await supabase.from('leads').update({ email_failed: true }).eq('session_id', session_id);
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    const error = err as Error
    logger.error('Lead Capture Crash:', { msg: error.message });
    return res.status(500).json({ error: 'Could not capture lead. Please try again.', code: 'INTERNAL_ERROR' })
  }
}
