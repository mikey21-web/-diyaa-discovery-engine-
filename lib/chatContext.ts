import type { ConversationMessage } from './types'

function squashWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim()
}

function truncate(input: string, maxChars: number): string {
  if (input.length <= maxChars) return input
  return `${input.slice(0, maxChars - 3)}...`
}

export function compactConversationHistory(
  history: ConversationMessage[],
  maxRecentMessages = 20
): Array<{ role: 'user' | 'assistant'; content: string }> {
  if (history.length <= maxRecentMessages) {
    return history.map((msg) => ({ role: msg.role, content: msg.content }))
  }

  const older = history.slice(0, history.length - maxRecentMessages)
  const recent = history.slice(history.length - maxRecentMessages)

  const summaryLines = older
    .slice(-30)
    .map((msg) => `${msg.role === 'user' ? 'Founder' : 'Consultant'}: ${truncate(squashWhitespace(msg.content), 180)}`)

  const summaryMessage = {
    role: 'assistant' as const,
    content: `Earlier context summary (compressed to save tokens):\n${summaryLines.join('\n')}`,
  }

  return [
    summaryMessage,
    ...recent.map((msg) => ({ role: msg.role, content: msg.content })),
  ]
}
