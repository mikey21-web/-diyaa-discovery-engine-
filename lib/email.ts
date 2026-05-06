import nodemailer from 'nodemailer'
import { logger } from './logger'

interface LeadEmailData {
  name: string
  email?: string
  industry?: string | null
  ai_readiness_score?: number | null
  report_url?: string | null
}

/**
 * Configure Nodemailer for Gmail
 * Note: Requires Gmail App Password (not standard account password)
 */
const createTransporter = () => {
  const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    logger.warn('Gmail credentials missing (GMAIL_USER/GMAIL_APP_PASSWORD), skipping email.')
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

export async function sendLeadEmail(leadData: LeadEmailData) {
  const transporter = createTransporter()
  const { ADMIN_EMAIL } = process.env

  if (!transporter) {
    throw new Error('Gmail credentials missing (GMAIL_USER/GMAIL_APP_PASSWORD)')
  }

  if (!ADMIN_EMAIL) {
    throw new Error('ADMIN_EMAIL missing')
  }

  const safeName = escapeHtml(leadData.name)
  const safeEmail = escapeHtml(leadData.email || 'N/A')
  const safeIndustry = escapeHtml(leadData.industry || 'Unknown')
  const safeReportUrl = escapeHtml(leadData.report_url || '')

  try {
    await transporter.sendMail({
      from: `"diyaa.ai Engine" <${process.env.GMAIL_USER}>`,
      to: ADMIN_EMAIL,
      subject: `🚨 New AI Lead: ${leadData.name}`,
      html: `
        <h2>New Discovery Session Completed!</h2>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Industry:</strong> ${safeIndustry}</p>
        <p><strong>AI Readiness Score:</strong> ${leadData.ai_readiness_score || 'N/A'} / 10</p>
        <br />
        <p><strong>View Full Report:</strong> <a href="${safeReportUrl}">${safeReportUrl}</a></p>
      `,
    })
    logger.info('Admin email sent for new lead via Gmail.')

    if (leadData.email) {
      await transporter.sendMail({
        from: `"Diyaa from diyaa.ai" <${process.env.GMAIL_USER}>`,
        to: leadData.email,
        subject: `Your AI Implementation Roadmap is Ready`,
        replyTo: process.env.GMAIL_USER,
        html: `
          <h3>Hi ${safeName},</h3>
          <p>Thank you for completing the discovery session.</p>
          <p>Your custom AI Implementation Roadmap has been generated based on our conversation. You can access it securely here:</p>
          <p><a href="${safeReportUrl}">${safeReportUrl}</a></p>
          <br />
          <p>If you have any questions or want to proceed with execution, feel free to reply directly to this email.</p>
          <p>Best regards,<br/>Diyaa<br/>diyaa.ai</p>
        `,
      })
      logger.info('Report emailed directly to the lead via Gmail.')
    }
  } catch (error) {
    logger.error('Gmail email dispatch failed', { error })
    throw error // Re-throw so job dispatcher handles retries
  }
}

export async function sendErrorAlert(errorDetails: {
  error: string,
  status?: number,
  keyIndex: number,
  allKeysExhausted: boolean
}) {
  const transporter = createTransporter()
  const { ADMIN_EMAIL } = process.env

  if (!transporter) {
    throw new Error('Gmail credentials missing (GMAIL_USER/GMAIL_APP_PASSWORD)')
  }

  if (!ADMIN_EMAIL) {
    throw new Error('ADMIN_EMAIL missing')
  }

  const safeError = escapeHtml(errorDetails.error)

  try {
    await transporter.sendMail({
      from: `"diyaa.ai Monitor" <${process.env.GMAIL_USER}>`,
      to: ADMIN_EMAIL,
      subject: `🚨 CRITICAL: OpenAI API Error - ${errorDetails.allKeysExhausted ? 'ALL KEYS EXHAUSTED' : 'Key Failed'}`,
      html: `
        <h2>OpenAI API Issue Detected</h2>
        <p><strong>Error:</strong> ${safeError}</p>
        <p><strong>Status:</strong> ${errorDetails.status || 'N/A'}</p>
        <p><strong>Key Index:</strong> ${errorDetails.keyIndex}</p>
        <p><strong>Recovery:</strong> ${errorDetails.allKeysExhausted ? 'System is DOWN for chat.' : 'Falling back to next key.'}</p>
        <br />
        <p>Managed via diyaa.ai Monitoring</p>
      `,
    })
    logger.info('Error alert email sent via Gmail.')
  } catch (error) {
    logger.error('Failed to send error alert email via Gmail', { error })
    throw error
  }
}
