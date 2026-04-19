// ========================================
// diyaa.ai — POST /api/lead
// Captures lead data after session.
// Triggers n8n webhook for WhatsApp follow-up.
// ========================================

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServiceClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { sendLeadEmail } from '@/lib/email'
import type { LeadRequest, LeadResponse, ApiError, ExtractedData } from '@/lib/types'

async function triggerN8nWebhook(leadData: Record<string, unknown>): Promise<void> {
  const webhookUrl = process.env.N8N_LEAD_WEBHOOK_URL
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET

  if (!webhookUrl) {
    logger.warn('N8N_LEAD_WEBHOOK_URL not configured, skipping webhook')
    return
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(webhookSecret ? { 'X-Webhook-Secret': webhookSecret } : {}),
      },
      body: JSON.stringify(leadData),
    })

    if (!response.ok) {
      logger.error('n8n webhook failed', {
        status: response.status,
        statusText: response.statusText,
      })
    } else {
      logger.info('n8n webhook triggered successfully')
    }
  } catch (err) {
    const error = err as Error
    logger.error('n8n webhook request failed', { message: error.message })
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LeadResponse | ApiError>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' })
  }

  const { session_id, name, email, whatsapp } = req.body as LeadRequest

  if (!session_id || !name) {
    return res.status(400).json({ error: 'Missing session_id or name', code: 'BAD_REQUEST' })
  }

  if (!whatsapp && !email) {
    return res.status(400).json({
      error: 'At least one contact method (WhatsApp or email) is required',
      code: 'BAD_REQUEST',
    })
  }

  try {
    const supabase = getServiceClient()

    // Fetch session for context
    const { data: session } = await supabase
      .from('sessions')
      .select('extracted_data')
      .eq('id', session_id)
      .single()

    const extractedData = session?.extracted_data as ExtractedData | null

    // Fetch report URL
    const { data: report } = await supabase
      .from('reports')
      .select('id, share_url')
      .eq('session_id', session_id)
      .single()

    // C3: Check for existing lead to prevent duplicates
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('session_id', session_id)
      .maybeSingle()

    if (existingLead) {
      return res.status(200).json({ success: true }) // Already captured
    }

    // Insert lead
    const { error: insertError } = await supabase.from('leads').insert({
      session_id,
      name,
      email: email || null,
      whatsapp: whatsapp || null,
      industry: extractedData?.industry || null,
      city: extractedData?.city || null,
      report_url: report?.share_url || null,
      status: 'new',
    })

    if (insertError) {
      logger.error('Failed to insert lead', { error: insertError.message })
      return res.status(500).json({ error: 'Failed to save lead', code: 'DB_ERROR' })
    }

    // Mark session as lead captured
    await supabase
      .from('sessions')
      .update({ lead_captured: true })
      .eq('id', session_id)

    // Dispatch emails (Admin alert & Lead copy)
    sendLeadEmail({
      name,
      email,
      whatsapp,
      session_id,
      industry: extractedData?.industry,
      city: extractedData?.city,
      report_url: report?.share_url,
      top_pain_points: extractedData?.top_pain_points,
      ai_readiness_score: extractedData?.ai_readiness_score,
    }).catch(async (e) => {
      logger.error('Failed to send emails', { error: e })
      // Flag the lead so missed emails can be queried and retried
      await supabase
        .from('leads')
        .update({ email_failed: true })
        .eq('session_id', session_id)
    })

    // Trigger n8n webhook for WhatsApp follow-up (fire and forget)
    triggerN8nWebhook({
      name,
      email,
      whatsapp,
      session_id,
      industry: extractedData?.industry,
      city: extractedData?.city,
      report_url: report?.share_url,
      top_pain_points: extractedData?.top_pain_points,
      ai_readiness_score: extractedData?.ai_readiness_score,
    })

    logger.info('Lead captured', {
      sessionId: session_id,
      name,
      industry: extractedData?.industry,
    })

    return res.status(200).json({ success: true })
  } catch (err) {
    const error = err as Error
    logger.error('Lead capture failed', { message: error.message })
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' })
  }
}
