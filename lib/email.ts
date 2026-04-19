import { Resend } from 'resend'
import { logger } from './logger'

export async function sendLeadEmail(leadData: any) {
  const { RESEND_API_KEY, ADMIN_EMAIL } = process.env
  
  if (!RESEND_API_KEY || !ADMIN_EMAIL) {
    logger.warn('Resend credentials missing, skipping email.')
    return
  }

  const resend = new Resend(RESEND_API_KEY)
  const fromEmail = 'onboarding@resend.dev' // Default verified sender for fresh Resend accounts

  try {
    // 1. Alert for you (Admin)
    await resend.emails.send({
      from: `diyaa.ai Engine <${fromEmail}>`,
      to: [ADMIN_EMAIL],
      subject: `🚨 New AI Lead: ${leadData.name}`,
      html: `
        <h2>New Discovery Session Completed!</h2>
        <p><strong>Name:</strong> ${leadData.name}</p>
        <p><strong>WhatsApp:</strong> ${leadData.whatsapp || 'Not provided'}</p>
        <p><strong>Email:</strong> ${leadData.email || 'Not provided'}</p>
        <p><strong>Industry:</strong> ${leadData.industry || 'Unknown'}</p>
        <p><strong>AI Readiness Score:</strong> ${leadData.ai_readiness_score || 'N/A'} / 10</p>
        <br />
        <p><strong>View Full Report:</strong> <a href="${leadData.report_url}">${leadData.report_url}</a></p>
      `,
    })
    logger.info('Admin email sent for new lead.')

    // 2. Report sent directly to the Lead (if they provided email)
    if (leadData.email) {
      await resend.emails.send({
        from: `Diyaa from diyaa.ai <${fromEmail}>`,
        to: [leadData.email],
        subject: `Your AI Implementation Roadmap is Ready`,
        html: `
          <h3>Hi ${leadData.name},</h3>
          <p>Thank you for completing the discovery session.</p>
          <p>Your custom AI Implementation Roadmap has been generated based on our conversation. You can access it securely here:</p>
          <p><a href="${leadData.report_url}">${leadData.report_url}</a></p>
          <br />
          <p>If you have any questions or want to proceed with execution, feel free to reply directly to this email.</p>
          <p>Best regards,<br/>Diyaa<br/>diyaa.ai</p>
        `,
      })
      logger.info('Report emailed directly to the lead.')
    }
  } catch (error) {
    logger.error('Email dispatch failed', { error })
  }
}

export async function sendErrorAlert(errorDetails: { 
  error: string, 
  status?: number, 
  keyIndex: number, 
  allKeysExhausted: boolean 
}) {
  const { RESEND_API_KEY, ADMIN_EMAIL } = process.env
  
  if (!RESEND_API_KEY || !ADMIN_EMAIL) {
    logger.warn('Resend credentials missing, skipping error alert email.')
    return
  }

  const resend = new Resend(RESEND_API_KEY)
  const fromEmail = 'onboarding@resend.dev'

  try {
    await resend.emails.send({
      from: `diyaa.ai Monitor <${fromEmail}>`,
      to: [ADMIN_EMAIL],
      subject: `🚨 CRITICAL: Groq API Error - ${errorDetails.allKeysExhausted ? 'ALL KEYS EXHAUSTED' : 'Key Failed'}`,
      html: `
        <h2>Groq API Issue Detected</h2>
        <p><strong>Error:</strong> ${errorDetails.error}</p>
        <p><strong>Status:</strong> ${errorDetails.status || 'N/A'}</p>
        <p><strong>Key Index:</strong> ${errorDetails.keyIndex}</p>
        <p><strong>Recovery:</strong> ${errorDetails.allKeysExhausted ? 'System is DOWN for chat.' : 'Falling back to next key.'}</p>
        <br />
        <p>Managed via diyaa.ai Monitoring</p>
      `,
    })
    logger.info('Error alert email sent.')
  } catch (error) {
    logger.error('Failed to send error alert email', { error })
  }
}
