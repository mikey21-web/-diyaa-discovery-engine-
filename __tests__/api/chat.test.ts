import { createMocks } from 'node-mocks-http'
import handler from '@/pages/api/chat'

jest.mock('@/lib/supabase', () => ({
  getServiceClient: jest.fn(),
}))

jest.mock('@/lib/agent/orchestrator', () => ({
  runAgentTurn: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}))

jest.mock('@/lib/rateLimit', () => ({
  rateLimit: jest.fn(() => Promise.resolve({ allowed: true })),
  getIP: jest.fn(() => '127.0.0.1'),
}))

describe('/api/chat', () => {
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
    expect(json.error).toBe('Method not allowed')
    expect(json.code).toBe('METHOD_NOT_ALLOWED')
  })

  it('validates required fields - missing session_id', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: { message: 'hello' },
    })

    await handler(req as any, res as any)

    expect(res._getStatusCode()).toBe(400)
  })

  it('validates required fields - missing message', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: { session_id: 'test-session' },
    })

    await handler(req as any, res as any)

    expect(res._getStatusCode()).toBe(400)
  })

  it('validates message length', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        session_id: 'test-session',
        message: 'x'.repeat(2001),
      },
    })

    await handler(req as any, res as any)

    expect(res._getStatusCode()).toBe(400)
  })

  it('enforces rate limiting', async () => {
    const { rateLimit } = require('@/lib/rateLimit')
    rateLimit.mockResolvedValueOnce({ allowed: false })

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        session_id: 'test-session',
        message: 'test',
      },
    })

    await handler(req as any, res as any)

    expect(res._getStatusCode()).toBe(429)
    const json = JSON.parse(res._getData())
    expect(json.code).toBe('RATE_LIMIT_EXCEEDED')
  })
})
