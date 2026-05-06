import OpenAI from 'openai'
import { logger } from './logger'

const MODEL = 'gpt-4o-mini'

export function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }
  return new OpenAI({ apiKey })
}

interface AgentMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

interface ChatResponse {
  content: string
  toolCalls?: ToolCall[]
  stopReason: 'end_turn' | 'tool_calls' | 'max_tokens'
}

export async function runChatCompletion(
  messages: AgentMessage[],
  tools?: Array<{
    type: 'function'
    function: {
      name: string
      description: string
      parameters: Record<string, unknown>
    }
  }>,
  timeout = 30000
): Promise<ChatResponse> {
  const client = getOpenAIClient()

  try {
    const response = await Promise.race([
      client.chat.completions.create({
        model: MODEL,
        messages: messages as any,
        tools: tools as OpenAI.Chat.ChatCompletionTool[] | undefined,
        max_tokens: 2000,
        temperature: 0.7,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Chat completion timeout')), timeout)
      ),
    ])

    const choice = response.choices[0]
    if (!choice) {
      throw new Error('No choice returned from OpenAI')
    }

    let content = ''
    let toolCalls: ToolCall[] | undefined

    if (choice.message.content) {
      content = choice.message.content
    }

    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      toolCalls = choice.message.tool_calls as ToolCall[]
    }

    const stopReason: ChatResponse['stopReason'] =
      choice.finish_reason === 'tool_calls' ? 'tool_calls' :
      choice.finish_reason === 'length' ? 'max_tokens' :
      'end_turn'

    return { content, toolCalls, stopReason }
  } catch (error) {
    const err = error as any
    logger.error('OpenAI API error', {
      message: err.message,
      status: err.status,
      type: err.type,
    })
    throw error
  }
}
