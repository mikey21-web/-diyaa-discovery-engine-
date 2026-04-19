// @ts-ignore
import dotenv from 'dotenv'
import path from 'path'
import { getClaudeResponse } from '../lib/claude'
import type { ConversationMessage } from '../lib/types'

// Load env vars from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
console.log('ENV Loaded. Key present:', !!process.env.GROQ_API_KEY)

async function runIndusTests() {
  const cases = [
    "Restaurant owner."
  ]

  console.log('--- TESTING LAZY FOUNDER PROTOCOL (RESTAURANT) ---')

  for (const input of cases) {
    process.stdout.write(`\n[USER]: "${input}"\n`)
    const history: Array<{ role: 'user' | 'assistant'; content: string }> = [
      { role: 'user', content: input }
    ]

    try {
      const response = await getClaudeResponse(history, 1)
      process.stdout.write(`[DIYA]: ${response.content}\n`)
      process.stdout.write(`Phase Tracking: [PHASE:${response.phase}]\n`)
    } catch (error) {
      console.error(`Failed test for "${input}":`, error)
    }
  }
}

runIndusTests()
