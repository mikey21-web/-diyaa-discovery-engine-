import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import { BusinessModel, RevenueLeak } from '../types'

interface CalculatorInput {
  description: string
  frequency_per_week: number
  cost_per_instance_inr: number
}

interface CalculatorOutput {
  annual_leak_inr: number
  estimated_loss_min: number
  estimated_loss_max: number
  monthly_leak_inr: number
  confidence: number
  assumptions: string[]
  disprovers: string[]
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
    estimated_loss_min: Math.round(annual * 0.8),
    estimated_loss_max: Math.round(annual * 1.2),
    monthly_leak_inr: monthly,
    confidence: 0.78,
    assumptions: [
      `Frequency remains near ${input.frequency_per_week}/week`,
      `Unit loss remains near ₹${input.cost_per_instance_inr.toLocaleString('en-IN')}`,
    ],
    disprovers: [
      'Recent process change reduced frequency materially',
      'Unit economics changed over last 30 days',
    ],
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
        description: 'How many times per week this problem causes a loss. Use a single integer e.g. 4',
      },
      cost_per_instance_inr: {
        description: 'Cost in INR each time this problem occurs e.g. 900000',
      },
    },
    required: ['description', 'frequency_per_week', 'cost_per_instance_inr'],
  },
}
