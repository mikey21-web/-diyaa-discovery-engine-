import type { NextApiRequest, NextApiResponse } from 'next'
import { getServiceClient } from '@/lib/supabase'
import { loadBusinessModel } from '@/lib/agent/businessModel'
import { buildBotConfigFromModel } from '@/lib/agent/tools/prototypeBuilder'
import { logger } from '@/lib/logger'

interface ProvisionResponse {
  prototype_id: string
  sandbox_url: string
  whatsapp_qr?: string
  status: string
}

interface ApiError {
  error: string
  code: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ProvisionResponse | ApiError>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' })
  }

  const { session_id } = req.body as { session_id: string }
  if (!session_id) {
    return res.status(400).json({ error: 'session_id required', code: 'BAD_REQUEST' })
  }

  try {
    const supabase = getServiceClient()

    // Check if prototype already exists
    const { data: existing } = await supabase
      .from('prototypes')
      .select('*')
      .eq('session_id', session_id)
      .eq('status', 'live')
      .single()

    if (existing) {
      return res.status(200).json({
        prototype_id: existing.id,
        sandbox_url: existing.sandbox_url ?? '',
        whatsapp_qr: existing.whatsapp_qr,
        status: existing.status,
      })
    }

    const model = await loadBusinessModel(session_id)
    const botConfig = buildBotConfigFromModel(model)

    // Provision Evolution API instance
    const evolutionUrl = process.env.EVOLUTION_API_URL
    const evolutionKey = process.env.EVOLUTION_API_KEY

    let sandboxUrl = `${process.env.NEXT_PUBLIC_APP_URL}/sandbox/${session_id}`
    let whatsappQr: string | undefined

    if (evolutionUrl && evolutionKey) {
      try {
        // Create instance
        const createRes = await fetch(`${evolutionUrl}/instance/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: evolutionKey,
          },
          body: JSON.stringify({
            instanceName: botConfig.instance_name,
            integration: 'WHATSAPP-BAILEYS',
            qrcode: true,
          }),
        })

        if (createRes.ok) {
          const createData = await createRes.json()

          // Set instance settings
          await fetch(`${evolutionUrl}/settings/set/${botConfig.instance_name}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: evolutionKey },
            body: JSON.stringify({
              rejectCall: true,
              msgCall: 'I am an AI assistant. Please send a text message.',
              ignoreGroups: true,
              alwaysOnline: true,
              readMessages: true,
            }),
          })

          sandboxUrl = createData.qrcode?.base64
            ? `${evolutionUrl}/instance/qrcode/${botConfig.instance_name}`
            : sandboxUrl
          whatsappQr = createData.qrcode?.base64
        }
      } catch (err) {
        logger.warn('Evolution API provision failed, using fallback', { session_id, err })
      }
    }

    // Store prototype record
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const { data: prototype } = await supabase
      .from('prototypes')
      .insert({
        session_id,
        bot_config: botConfig,
        sandbox_url: sandboxUrl,
        whatsapp_qr: whatsappQr,
        status: 'live',
        expires_at: expiresAt,
      })
      .select('id')
      .single()

    return res.status(200).json({
      prototype_id: prototype?.id ?? session_id,
      sandbox_url: sandboxUrl,
      whatsapp_qr: whatsappQr,
      status: 'live',
    })
  } catch (err) {
    const error = err as Error
    logger.error('Prototype provision error', { msg: error.message, session_id })
    return res.status(500).json({ error: 'Failed to provision prototype', code: 'INTERNAL_ERROR' })
  }
}
