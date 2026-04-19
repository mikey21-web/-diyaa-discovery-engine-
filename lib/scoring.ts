// ========================================
// diyaa.ai — AI Readiness Score Calculator
// Score never shown during conversation.
// Used to calibrate report tone and urgency.
// ========================================

import type { TechComfort } from './types'

export function getScoreInterpretation(score: number): {
  tier: string
  description: string
  reportTone: string
} {
  if (score <= 3) {
    return {
      tier: 'Foundational',
      description: 'Your business is at the starting line — but that means the upside is massive. Small automation wins will show ROI within weeks.',
      reportTone: 'basic automation wins, quick ROI framing',
    }
  }
  if (score <= 6) {
    return {
      tier: 'Operational',
      description: 'You have the digital foundation in place. You are ready for AI agents and multi-channel automation that compounds over time.',
      reportTone: 'ready for AI agents, multi-channel automation',
    }
  }
  if (score <= 9) {
    return {
      tier: 'Advanced',
      description: 'Your operations are already digitized. The next level is complex multi-agent systems, voice AI, and custom intelligence layers.',
      reportTone: 'complex multi-agent systems, voice, custom CRM',
    }
  }
  return {
    tier: 'Outlier',
    description: 'You are already leveraging AI. The pitch for you is differentiation — building systems your competitors cannot replicate.',
    reportTone: 'differentiation not adoption',
  }
}
