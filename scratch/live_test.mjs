// ============================================================
// diyaa.ai — Full End-to-End Live Test
// Simulates a real founder conversation against the live API.
// Run with:  node scratch/live_test.mjs
// ============================================================

const BASE_URL = 'http://localhost:3000'  // local dev

const FOUNDER_SCRIPT = [
  "I run a real estate agency in Hyderabad. We sell luxury apartments.",
  "We have about 12 people. Revenue is around 40 lakhs a month.",
  "Biggest problem is lead response time. Our team takes 3-4 hours to call back.",
  "Our main competitor is My Home Group. They seem to be getting faster somehow.",
  "We lose maybe 5-6 deals a month because of this.",
  "Yes exactly, that's the core issue. How do we fix it?",
  "Yes I want to see the report.",
]

const DELAY_MS = 3000  // wait 3s between messages (simulate real typing)

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function ruler(label) {
  const line = '─'.repeat(60)
  console.log(`\n${line}`)
  console.log(`  ${label}`)
  console.log(line)
}

async function createSession() {
  ruler('STEP 1 — Creating session')
  const res = await fetch(`${BASE_URL}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  const data = await res.json()
  if (!res.ok) {
    console.error('❌ Session creation failed:', data)
    process.exit(1)
  }
  console.log(`✅ Session ID: ${data.session_id}`)
  console.log(`\n🤖 ARYA:\n"${data.opening_message}"`)
  return data.session_id
}

async function sendMessage(sessionId, message, turnNumber) {
  ruler(`TURN ${turnNumber} — Founder says`)
  console.log(`👤 FOUNDER: "${message}"`)
  console.log(`\n⏳ Waiting for response...`)

  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, message }),
  })

  const data = await res.json()

  if (!res.ok) {
    console.error(`❌ Chat error (HTTP ${res.status}):`, data)
    return null
  }

  console.log(`\n🤖 ARYA (Phase: ${data.phase}):\n"${data.reply}"`)

  if (data.report_ready) {
    console.log(`\n🎉 REPORT READY! report_id: ${data.report_id ?? 'embedded'}`)
  }

  return data
}

// ─── Firecrawl health check ───────────────────────────────────────────────────

async function testFirecrawl() {
  ruler('FIRECRAWL — API Key Health Check')
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) {
    console.log('⚠️  FIRECRAWL_API_KEY not set in environment — skipping direct check')
    console.log('   (it will be loaded server-side by Next.js; this is expected)')
    return
  }

  try {
    const res = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query: 'My Home Group Hyderabad real estate', limit: 2 }),
    })

    if (res.ok) {
      const data = await res.json()
      const count = data.data?.length ?? 0
      console.log(`✅ Firecrawl API is live — returned ${count} results`)
      if (count > 0) {
        console.log(`   Top result: "${data.data[0].title}"`)
        console.log(`   URL: ${data.data[0].url}`)
      }
    } else {
      console.log(`❌ Firecrawl returned HTTP ${res.status}`)
      const text = await res.text()
      console.log(`   Body: ${text.slice(0, 200)}`)
    }
  } catch (err) {
    console.log(`❌ Firecrawl connection error: ${err.message}`)
  }
}

// ─── Diagnosis Report ─────────────────────────────────────────────────────────

function printDiagnosis(turns) {
  ruler('TEST RESULTS — DIAGNOSIS')

  const phases = turns.map(t => t?.phase).filter(Boolean)
  const uniquePhases = [...new Set(phases)]
  console.log(`📊 Phases traversed: ${uniquePhases.join(' → ')}`)

  const reportTurn = turns.find(t => t?.report_ready)
  console.log(`📋 Report triggered: ${reportTurn ? '✅ YES' : '❌ NO (didn\'t reach report phase)'}`)

  // Check for generic vs personalised responses
  let genericCount = 0
  let personalCount = 0
  const genericPhrases = [
    'great question', "i'm here to help", 'certainly', 'absolutely',
    'i understand', "i'm an ai", 'how can i assist',
  ]
  const personalSignals = [
    'hyderabad', 'real estate', 'luxury', '40 lakh', 'my home',
    '₹', '%', 'lead', '3-4 hour', '5-6 deal',
  ]

  turns.forEach((t, i) => {
    if (!t?.reply) return
    const reply = t.reply.toLowerCase()
    const hasGeneric = genericPhrases.some(p => reply.includes(p))
    const hasPersonal = personalSignals.some(p => reply.includes(p))
    if (hasGeneric) genericCount++
    if (hasPersonal) personalCount++
    console.log(`\nTurn ${i + 1} [Phase ${t.phase}]`)
    console.log(`  Generic phrases: ${hasGeneric ? '⚠️  YES' : '✅ none'}`)
    console.log(`  Personalised signals: ${hasPersonal ? '✅ YES' : '⚠️  not detected'}`)
    console.log(`  Reply length: ${t.reply.length} chars`)
  })

  ruler('FINAL VERDICT')
  const totalTurns = turns.filter(t => t?.reply).length
  const personalisationRate = totalTurns > 0 ? Math.round((personalCount / totalTurns) * 100) : 0
  const genericRate = totalTurns > 0 ? Math.round((genericCount / totalTurns) * 100) : 0

  console.log(`Personalisation rate: ${personalisationRate}% (higher = better)`)
  console.log(`Generic phrase rate:  ${genericRate}% (lower = better)`)

  if (personalisationRate >= 70 && genericRate === 0) {
    console.log('\n🟢 VERDICT: Agent is sharp. Diagnoses first, feels personal.')
  } else if (personalisationRate >= 40 && genericRate <= 20) {
    console.log('\n🟡 VERDICT: Decent. Some turns feel generic — review Phase 1 prompts.')
  } else {
    console.log('\n🔴 VERDICT: Too generic. System prompt needs tightening.')
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀 diyaa.ai — Live End-to-End Test')
  console.log(`   Target: ${BASE_URL}`)
  console.log(`   Scenario: Hyderabad Real Estate founder, luxury apartments`)
  console.log(`   Turns: ${FOUNDER_SCRIPT.length}`)

  await testFirecrawl()

  const sessionId = await createSession()
  const turns = []

  for (let i = 0; i < FOUNDER_SCRIPT.length; i++) {
    await sleep(DELAY_MS)
    const result = await sendMessage(sessionId, FOUNDER_SCRIPT[i], i + 1)
    turns.push(result)
    if (result?.report_ready) {
      console.log('\n⛔ Report triggered — stopping conversation early.')
      break
    }
  }

  printDiagnosis(turns)

  console.log(`\n🔗 View session in Supabase: look for session ID ${sessionId}`)
  console.log(`🔗 View report: ${BASE_URL}/report/${sessionId}\n`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
