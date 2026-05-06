import { sendLeadEmail, sendErrorAlert } from '@/lib/email'

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}))

describe('Email Functions', () => {
  let mockTransport: any
  const { logger } = require('@/lib/logger')

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.GMAIL_USER = 'test@gmail.com'
    process.env.GMAIL_APP_PASSWORD = 'password'
    process.env.ADMIN_EMAIL = 'admin@gmail.com'

    mockTransport = {
      sendMail: jest.fn().mockResolvedValue({ response: 'sent' }),
    }

    const nodemailer = require('nodemailer')
    nodemailer.createTransport.mockReturnValue(mockTransport)
  })

  afterEach(() => {
    delete process.env.GMAIL_USER
    delete process.env.GMAIL_APP_PASSWORD
    delete process.env.ADMIN_EMAIL
  })

  describe('sendLeadEmail', () => {
    it('sends both admin and lead emails when report URL provided', async () => {
      const leadData = {
        name: 'John Doe',
        email: 'john@example.com',
        industry: 'real_estate',
        ai_readiness_score: 7,
        report_url: 'https://example.com/report/123',
      }

      await sendLeadEmail(leadData)

      expect(mockTransport.sendMail).toHaveBeenCalledTimes(2)

      // Check admin email
      const adminCall = mockTransport.sendMail.mock.calls[0][0]
      expect(adminCall.to).toBe('admin@gmail.com')
      expect(adminCall.subject).toContain('New AI Lead')
      expect(adminCall.html).toContain('John Doe')
      expect(adminCall.html).toContain('john@example.com')
      expect(adminCall.html).toContain('real_estate')
      expect(adminCall.html).toContain('7')

      // Check lead email
      const leadCall = mockTransport.sendMail.mock.calls[1][0]
      expect(leadCall.to).toBe('john@example.com')
      expect(leadCall.subject).toContain('AI Implementation Roadmap')
      expect(leadCall.html).toContain('John Doe')
    })

    it('escapes HTML characters in email content', async () => {
      const leadData = {
        name: 'John <Doe>',
        email: 'john@example.com&test',
        industry: 'real_estate & property',
        report_url: 'https://example.com/report/123?test=1&other=2',
      }

      await sendLeadEmail(leadData)

      const adminCall = mockTransport.sendMail.mock.calls[0][0]
      expect(adminCall.html).toContain('&lt;')
      expect(adminCall.html).toContain('&gt;')
      expect(adminCall.html).toContain('&amp;')
    })

    it('handles missing email gracefully', async () => {
      const leadData = {
        name: 'John Doe',
        industry: 'real_estate',
        ai_readiness_score: 5,
        report_url: 'https://example.com/report/123',
      }

      await sendLeadEmail(leadData)

      expect(mockTransport.sendMail).toHaveBeenCalledTimes(1) // Only admin email
      const adminCall = mockTransport.sendMail.mock.calls[0][0]
      expect(adminCall.to).toBe('admin@gmail.com')
    })

    it('throws error when GMAIL_USER is missing', async () => {
      delete process.env.GMAIL_USER

      const leadData = {
        name: 'John Doe',
        email: 'john@example.com',
      }

      await expect(sendLeadEmail(leadData)).rejects.toThrow(
        'Gmail credentials missing'
      )
    })

    it('throws error when ADMIN_EMAIL is missing', async () => {
      delete process.env.ADMIN_EMAIL

      const leadData = {
        name: 'John Doe',
        email: 'john@example.com',
      }

      await expect(sendLeadEmail(leadData)).rejects.toThrow(
        'ADMIN_EMAIL missing'
      )
    })

    it('logs info message on successful send', async () => {
      const leadData = {
        name: 'John Doe',
        email: 'john@example.com',
        report_url: 'https://example.com/report/123',
      }

      await sendLeadEmail(leadData)

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Admin email sent')
      )
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Report emailed')
      )
    })

    it('logs error on email send failure and re-throws', async () => {
      mockTransport.sendMail.mockRejectedValueOnce(
        new Error('SMTP connection failed')
      )

      const leadData = {
        name: 'John Doe',
        email: 'john@example.com',
        report_url: 'https://example.com/report/123',
      }

      await expect(sendLeadEmail(leadData)).rejects.toThrow(
        'SMTP connection failed'
      )
      expect(logger.error).toHaveBeenCalled()
    })

    it('uses safe defaults for missing optional fields', async () => {
      const leadData = {
        name: 'John Doe',
      }

      await sendLeadEmail(leadData)

      const adminCall = mockTransport.sendMail.mock.calls[0][0]
      expect(adminCall.html).toContain('N/A') // email default
      expect(adminCall.html).toContain('Unknown') // industry default
    })
  })

  describe('sendErrorAlert', () => {
    it('sends error alert email with all details', async () => {
      const errorDetails = {
        error: 'OpenAI API rate limited',
        status: 429,
        keyIndex: 2,
        allKeysExhausted: false,
      }

      await sendErrorAlert(errorDetails)

      expect(mockTransport.sendMail).toHaveBeenCalledTimes(1)
      const call = mockTransport.sendMail.mock.calls[0][0]
      expect(call.to).toBe('admin@gmail.com')
      expect(call.subject).toContain('CRITICAL')
      expect(call.subject).toContain('OpenAI')
      expect(call.html).toContain('rate limited')
      expect(call.html).toContain('429')
      expect(call.html).toContain('Falling back to next key')
    })

    it('indicates all keys exhausted in alert', async () => {
      const errorDetails = {
        error: 'All keys failed',
        status: 429,
        keyIndex: 5,
        allKeysExhausted: true,
      }

      await sendErrorAlert(errorDetails)

      const call = mockTransport.sendMail.mock.calls[0][0]
      expect(call.html).toContain('System is DOWN')
    })

    it('throws error when GMAIL_USER missing', async () => {
      delete process.env.GMAIL_USER

      const errorDetails = {
        error: 'Test error',
        keyIndex: 1,
        allKeysExhausted: false,
      }

      await expect(sendErrorAlert(errorDetails)).rejects.toThrow(
        'Gmail credentials missing'
      )
    })

    it('throws error when ADMIN_EMAIL missing', async () => {
      delete process.env.ADMIN_EMAIL

      const errorDetails = {
        error: 'Test error',
        keyIndex: 1,
        allKeysExhausted: false,
      }

      await expect(sendErrorAlert(errorDetails)).rejects.toThrow(
        'ADMIN_EMAIL missing'
      )
    })

    it('escapes error message in email', async () => {
      const errorDetails = {
        error: 'Error with <special> & characters',
        status: 500,
        keyIndex: 1,
        allKeysExhausted: false,
      }

      await sendErrorAlert(errorDetails)

      const call = mockTransport.sendMail.mock.calls[0][0]
      expect(call.html).toContain('&lt;')
      expect(call.html).toContain('&gt;')
      expect(call.html).toContain('&amp;')
    })
  })
})
