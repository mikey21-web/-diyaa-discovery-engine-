import { createMocks } from 'node-mocks-http'
import handler from '@/pages/api/lead'

jest.mock('@/lib/supabase', () => ({
  getServiceClient: jest.fn(),
}))

jest.mock('@/lib/email', () => ({
  sendLeadEmail: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}))

describe('/api/lead', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rejects non-POST requests', async () => {
    const { req, res } = createMocks({
      method: 'GET',
    })

    await handler(req as any, res as any)

    expect(res._getStatusCode()).toBe(405)
    const json = JSON.parse(res._getData())
    expect(json.code).toBe('METHOD_NOT_ALLOWED')
  })

  it('validates required fields - missing name', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: { session_id: 'test-session', email: 'test@example.com' },
    })

    await handler(req as any, res as any)

    expect(res._getStatusCode()).toBe(400)
    const json = JSON.parse(res._getData())
    expect(json.code).toBe('INVALID_INPUT')
  })

  it('validates required fields - missing email', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: { session_id: 'test-session', name: 'John Doe' },
    })

    await handler(req as any, res as any)

    expect(res._getStatusCode()).toBe(400)
  })

  it('validates required fields - missing session_id', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: { name: 'John Doe', email: 'test@example.com' },
    })

    await handler(req as any, res as any)

    expect(res._getStatusCode()).toBe(400)
  })

  it('validates email format', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        session_id: 'test-session',
        name: 'John Doe',
        email: 'invalid-email',
      },
    })

    await handler(req as any, res as any)

    expect(res._getStatusCode()).toBe(400)
    const json = JSON.parse(res._getData())
    expect(json.error).toContain('valid email')
  })
})
