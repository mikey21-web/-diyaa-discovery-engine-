import { getServiceClient } from './supabase'
import { logger } from './logger'
import { sendLeadEmail } from './email'

type JobType = 'lead_webhook' | 'lead_email'

type LeadWebhookPayload = {
  session_id: string
  name: string
  email: string | null
  whatsapp: string
  industry: string | null
  city: string | null
  report_url: string | null
  ai_readiness_score: number | null
}

type LeadEmailPayload = {
  name: string
  email: string | null
  industry: string | null
  report_url: string | null
  ai_readiness_score: number | null
  session_id: string
}

type BackgroundJobRow = {
  id: string
  job_type: JobType
  payload: Record<string, unknown>
  attempts: number
}

const MAX_ATTEMPTS = 5

function computeNextRunISO(attempt: number): string {
  const backoffSeconds = Math.min(300, Math.pow(2, attempt) * 5)
  return new Date(Date.now() + backoffSeconds * 1000).toISOString()
}

export async function enqueueJob(jobType: JobType, payload: Record<string, unknown>): Promise<void> {
  const supabase = getServiceClient()
  const { error } = await supabase.from('background_jobs').insert({
    job_type: jobType,
    payload,
    status: 'pending',
    attempts: 0,
    next_run_at: new Date().toISOString(),
  })

  if (error) {
    throw new Error(`Failed to enqueue job (${jobType}): ${error.message}`)
  }
}

async function runLeadWebhook(payload: LeadWebhookPayload): Promise<void> {
  const webhookUrl = process.env.N8N_LEAD_WEBHOOK_URL
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET

  if (!webhookUrl) return

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(webhookSecret ? { Authorization: `Bearer ${webhookSecret}` } : {}),
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`Webhook failed with status ${response.status}`)
  }
}

async function runLeadEmail(payload: LeadEmailPayload): Promise<void> {
  if (!payload.email) return
  await sendLeadEmail({
    name: payload.name,
    email: payload.email,
    industry: payload.industry,
    report_url: payload.report_url,
    ai_readiness_score: payload.ai_readiness_score,
  })
}

async function processJob(job: BackgroundJobRow): Promise<void> {
  if (job.job_type === 'lead_webhook') {
    await runLeadWebhook(job.payload as unknown as LeadWebhookPayload)
    return
  }

  if (job.job_type === 'lead_email') {
    await runLeadEmail(job.payload as unknown as LeadEmailPayload)
  }
}

export async function processDueJobs(batchSize = 20): Promise<{ processed: number; failed: number }> {
  const supabase = getServiceClient()
  const nowIso = new Date().toISOString()

  const { data: jobs, error } = await supabase
    .from('background_jobs')
    .select('id, job_type, payload, attempts')
    .in('status', ['pending', 'retry'])
    .lte('next_run_at', nowIso)
    .order('next_run_at', { ascending: true })
    .limit(batchSize)

  if (error) {
    logger.warn('Failed to load background jobs', { message: error.message })
    return { processed: 0, failed: 0 }
  }

  let processed = 0
  let failed = 0

  for (const rawJob of jobs || []) {
    const job = rawJob as BackgroundJobRow

    const { data: lockData, error: lockError } = await supabase
      .from('background_jobs')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', job.id)
      .in('status', ['pending', 'retry'])
      .select('id')
      .maybeSingle()

    if (lockError || !lockData) continue

    try {
      await processJob(job)
      processed += 1
      await supabase
        .from('background_jobs')
        .update({ status: 'done', updated_at: new Date().toISOString(), last_error: null })
        .eq('id', job.id)
    } catch (err) {
      failed += 1
      const attempt = job.attempts + 1
      const error = err as Error
      const exhausted = attempt >= MAX_ATTEMPTS

      if (job.job_type === 'lead_email') {
        const payload = job.payload as unknown as LeadEmailPayload
        await supabase
          .from('leads')
          .update({ email_failed: true })
          .eq('session_id', payload.session_id)
      }

      await supabase
        .from('background_jobs')
        .update({
          status: exhausted ? 'failed' : 'retry',
          attempts: attempt,
          last_error: error.message,
          next_run_at: exhausted ? null : computeNextRunISO(attempt),
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)

      logger.warn('Background job failed', {
        jobId: job.id,
        jobType: job.job_type,
        attempt,
        error: error.message,
      })
    }
  }

  return { processed, failed }
}
