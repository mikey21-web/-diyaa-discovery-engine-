import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import { BusinessModel, RevenueLeak } from '../types'

interface CalculatorInput {
  description: string
  frequency_per_week: number
  cost_per_instance_inr: number
}

interface CalculatorOutput {
  annual_leak_inr: number
  monthly_leak_inr: number
  confidence_note: string
  leak: RevenueLeak
}

export function calculateLeak(input: CalculatorInput): CalculatorOutput {
  const annual = Math.round(input.frequency_per_week * 52 * input.cost_per_instance_inr)
  const monthly = Math.round(annual / 12)

  const leak: RevenueLeak = {
    description: input.description,
    frequency_per_week: input.frequency_per_week,
    cost_per_instance_inr: input.cost_per_instance_inr,
    annual_leak_inr: annual,
    confidence: 'calculated',
  }

  return {
    annual_leak_inr: annual,
    monthly_leak_inr: monthly,
    confidence_note: `${input.frequency_per_week}x/week × ₹${input.cost_per_instance_inr}/instance × 52 weeks`,
    leak,
  }
}

export function totalLeakFromModel(model: BusinessModel): number {
  return model.leaks.reduce((sum, l) => sum + l.annual_leak_inr, 0)
}

export const calculatorToolSchema: Tool = {
  name: 'calculator',
  description:
    'Calculate annual revenue leak from a recurring operational problem. Use whenever the founder mentions a specific problem with a frequency and cost estimate.',
  input_schema: {
    type: 'object' as const,
    properties: {
      description: {
        type: 'string',
        description: 'Plain English description of the leak (e.g. "Slow lead response losing deals")',
      },
      frequency_per_week: {
        type: 'number',
        description: 'How many times per week this problem causes a loss. Single integer only — if unsure, use the midpoint. e.g. 4 not "4-5"',
      },
      cost_per_instance_inr: {
        type: 'number',
        description: 'Cost in INR per occurrence. Single integer only e.g. 900000',
      },
    },
    required: ['description', 'frequency_per_week', 'cost_per_instance_inr'],
  },
}
