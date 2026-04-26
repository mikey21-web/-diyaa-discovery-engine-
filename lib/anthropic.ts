import Anthropic from '@anthropic-ai/sdk'

export class AnthropicBusyError extends Error {
  constructor() {
    super('Anthropic overloaded')
    this.name = 'AnthropicBusyError'
  }
}

let _client: Anthropic | null = null

export function getAnthropicClient(): Anthropic {
  if (!_client) {
    const key =
      process.env.ANTHROPIC_API_KEY_SONNET ||
      process.env.ANTHROPIC_API_KEY
    if (!key) throw new Error('ANTHROPIC_API_KEY not set')
    _client = new Anthropic({ apiKey: key })
  }
  return _client
}

export function getOpusClient(): Anthropic {
  const key =
    process.env.ANTHROPIC_API_KEY_OPUS ||
    process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not set')
  return new Anthropic({ apiKey: key })
}

export async function callAnthropic<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    if (e.status === 529 || e.message?.includes('overloaded')) {
      throw new AnthropicBusyError()
    }
    throw err
  }
}
