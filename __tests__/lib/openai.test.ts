import { runChatCompletion, getOpenAIClient } from '@/lib/openai'

jest.mock('openai', () => {
  return jest.fn(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  }))
})

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
  },
}))

describe('OpenAI Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.OPENAI_API_KEY = 'sk-test-key'
  })

  afterEach(() => {
    delete process.env.OPENAI_API_KEY
  })

  describe('getOpenAIClient', () => {
    it('throws error when OPENAI_API_KEY is not set', () => {
      delete process.env.OPENAI_API_KEY

      expect(() => {
        getOpenAIClient()
      }).toThrow('OPENAI_API_KEY is not configured')
    })

    it('returns client when OPENAI_API_KEY is set', () => {
      process.env.OPENAI_API_KEY = 'sk-valid-key'
      const client = getOpenAIClient()
      expect(client).toBeDefined()
      expect(client.chat).toBeDefined()
    })
  })

  describe('runChatCompletion', () => {
    it('returns chat response with content only', async () => {
      const OpenAI = require('openai')
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Hello, how can I help?',
              tool_calls: undefined,
            },
            finish_reason: 'stop',
          },
        ],
      })

      OpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }))

      const messages = [{ role: 'user' as const, content: 'Hello' }]
      const response = await runChatCompletion(messages)

      expect(response.content).toBe('Hello, how can I help?')
      expect(response.toolCalls).toBeUndefined()
      expect(response.stopReason).toBe('end_turn')
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
          max_tokens: 2000,
          temperature: 0.7,
        })
      )
    })

    it('returns response with tool calls', async () => {
      const OpenAI = require('openai')
      const mockToolCall = {
        id: 'call-123',
        type: 'function',
        function: {
          name: 'calculator',
          arguments: '{"operation":"add","args":[2,3]}',
        },
      }

      const mockCreate = jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: 'I will calculate that for you.',
              tool_calls: [mockToolCall],
            },
            finish_reason: 'tool_calls',
          },
        ],
      })

      OpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }))

      const messages = [{ role: 'user' as const, content: 'Calculate 2 + 3' }]
      const response = await runChatCompletion(messages)

      expect(response.content).toBe('I will calculate that for you.')
      expect(response.toolCalls).toHaveLength(1)
      expect(response.toolCalls![0].function.name).toBe('calculator')
      expect(response.stopReason).toBe('tool_calls')
    })

    it('detects max_tokens stop reason', async () => {
      const OpenAI = require('openai')
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: 'This is a very long response that was cut off',
              tool_calls: undefined,
            },
            finish_reason: 'length',
          },
        ],
      })

      OpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }))

      const messages = [{ role: 'user' as const, content: 'Tell me everything' }]
      const response = await runChatCompletion(messages)

      expect(response.stopReason).toBe('max_tokens')
    })

    it('handles timeout error', async () => {
      const OpenAI = require('openai')
      const mockCreate = jest.fn().mockImplementation(
        () => new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 100)
        )
      )

      OpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }))

      const messages = [{ role: 'user' as const, content: 'Hello' }]

      await expect(runChatCompletion(messages, undefined, 50)).rejects.toThrow('Chat completion timeout')
    })

    it('passes tools correctly when provided', async () => {
      const OpenAI = require('openai')
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Response',
              tool_calls: undefined,
            },
            finish_reason: 'stop',
          },
        ],
      })

      OpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }))

      const tools = [
        {
          type: 'function' as const,
          function: {
            name: 'test_function',
            description: 'A test function',
            parameters: { type: 'object', properties: {} },
          },
        },
      ]

      const messages = [{ role: 'user' as const, content: 'Hello' }]
      await runChatCompletion(messages, tools)

      expect(mockCreate).toHaveBeenCalled()
      const call = mockCreate.mock.calls[0][0]
      expect(call.tools).toEqual(tools)
    })

    it('handles missing content', async () => {
      const OpenAI = require('openai')
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: null,
              tool_calls: undefined,
            },
            finish_reason: 'stop',
          },
        ],
      })

      OpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }))

      const messages = [{ role: 'user' as const, content: 'Hello' }]
      const response = await runChatCompletion(messages)

      expect(response.content).toBe('')
    })

    it('throws error when no choice returned', async () => {
      const OpenAI = require('openai')
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [],
      })

      OpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }))

      const messages = [{ role: 'user' as const, content: 'Hello' }]

      await expect(runChatCompletion(messages)).rejects.toThrow('No choice returned from OpenAI')
    })
  })
})
