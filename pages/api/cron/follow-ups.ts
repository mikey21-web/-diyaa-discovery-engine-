// ========================================
// diyaa.ai — Vercel Cron: Daily Follow-ups
// Runs daily. Sends follow-up emails based on report view status.
// ========================================

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServiceClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import nodemailer from 'nodemailer'

const createTransporter = () => {
  const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    logger.warn('Gmail credentials missing')
    return null
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
  })
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify Vercel cron token
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const transporter = createTransporter()
  if (!transporter) {
    return res.status(500).json({ error: 'Email config missing' })
  }

  try {
    const supabase = getServiceClient()

    // Get leads from last 48 hours that haven't been contacted yet
    const last48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, name, email, session_id, report_url, created_at')
      .eq('status', 'new')
      .gte('created_at', last48h)

    if (leadsError) throw leadsError

    if (!leads || leads.length === 0) {
      logger.info('No new leads to follow up on')
      return res.status(200).json({ followups_sent: 0 })
    }

    let followupsSent = 0

    for (const lead of leads) {
      if (!lead.email) continue

      try {
        // Get report view count
        const { data: report } = await supabase
          .from('reports')
          .select('view_count, share_url')
          .eq('session_id', lead.session_id)
          .single()

        const isViewed = report && report.view_count > 0
        const reportUrl = lead.report_url || report?.share_url || ''
        const calLink = process.env.NEXT_PUBLIC_CAL_LINK || 'https://cal.com/uday-diyaa'
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://diyaa-ai-engine.vercel.app'

        const safeName = escapeHtml(lead.name)
        const safeReportUrl = escapeHtml(reportUrl)

        let subject: string
        let htmlBody: string

        if (isViewed) {
          // They opened the report — thank them and push to booking
          subject = `Let's make it happen — book a call with Uday`
          htmlBody = `
            <h3>Hi ${safeName},</h3>
            <p>I noticed you reviewed your AI Implementation Roadmap. Thank you!</p>
            <p>Now let's talk about which quick wins make sense for your business. I'd love to walk you through:</p>
            <ul>
              <li>Your revenue leak numbers in detail</li>
              <li>Which Month 1 initiative will give you the fastest ROI</li>
              <li>How to build it in 3-4 weeks vs. 6 months</li>
            </ul>
            <p><strong><a href="${escapeHtml(calLink)}">Book a 30-minute call here</a></strong></p>
            <p>Or reply to this email with your availability.</p>
            <p>Best,<br/>Uday<br/>diyaa.ai</p>
          `
        } else {
          // They haven't opened — gentle reminder with fresh link
          subject = `Your AI roadmap is ready — here's what we found`
          htmlBody = `
            <h3>Hi ${safeName},</h3>
            <p>Just following up — your custom AI Implementation Roadmap is waiting. Here's what we uncovered:</p>
            <p><strong><a href="${safeReportUrl}">View Your Roadmap</a></strong></p>
            <p>It shows:</p>
            <ul>
              <li>Your exact revenue leaks (in rupees)</li>
              <li>Quick wins you can implement in Month 1</li>
              <li>Which AI system will give you the fastest ROI</li>
            </ul>
            <p>Takes 5 minutes to review. Then if it resonates, we can talk about execution.</p>
            <p><strong><a href="${escapeHtml(calLink)}">Or book a 30-min call here</a></strong></p>
            <p>Best,<br/>Uday<br/>diyaa.ai<br/><a href="${appUrl}">Visit diyaa.ai</a></p>
          `
        }

        await transporter.sendMail({
          from: `"Uday from diyaa.ai" <${process.env.GMAIL_USER}>`,
          to: lead.email,
          subject,
          replyTo: process.env.GMAIL_USER,
          html: htmlBody,
        })

        // Mark lead as contacted
        await supabase.from('leads').update({ status: 'contacted' }).eq('id', lead.id)

        followupsSent++
        logger.info(`Follow-up sent to ${lead.email}`, { viewed: isViewed })
      } catch (err) {
        logger.warn(`Failed to send follow-up to ${lead.email}`, { error: (err as Error).message })
      }
    }

    return res.status(200).json({ followups_sent: followupsSent, total_leads: leads.length })
  } catch (err) {
    const error = err as Error
    logger.error('Cron follow-ups crashed', { error: error.message })
    return res.status(500).json({ error: 'Cron failed' })
  }
}
