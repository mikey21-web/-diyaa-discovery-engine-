import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import { calculatorToolSchema, calculateLeak } from './calculator'
import { industryDataToolSchema, lookupIndustryFact, listIndustryFacts } from './industryData'
import { webSearchToolSchema, researchCompetitor } from './webSearch'
import { prototypeBuilderToolSchema, buildBotConfigFromModel } from './prototypeBuilder'
import { BusinessModel } from '../types'

export const ALL_TOOL_SCHEMAS: Tool[] = [
  calculatorToolSchema,
  industryDataToolSchema,
  webSearchToolSchema,
  prototypeBuilderToolSchema,
]

export interface ToolResult {
  tool_name: string
  output: unknown
  model_patch?: Partial<BusinessModel>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function executeTool(toolName: string, input: Record<string, any>, currentModel: BusinessModel): Promise<ToolResult> {
  switch (toolName) {
    case 'calculator': {
      const result = calculateLeak({
        description: input.description,
        frequency_per_week: input.frequency_per_week,
        cost_per_instance_inr: input.cost_per_instance_inr,
      })
      return {
        tool_name: toolName,
        output: result,
        model_patch: {
          leaks: [result.leak],
        },
      }
    }

    case 'industry_data': {
      const industry = input.industry as string
      const metric = input.metric as string
      if (metric === 'all') {
        const facts = listIndustryFacts(industry)
        return { tool_name: toolName, output: { industry, facts } }
      }
      const fact = lookupIndustryFact(industry, metric)
      return { tool_name: toolName, output: fact ?? { error: 'Metric not found', industry, metric } }
    }

    case 'web_search': {
      const industry = currentModel.identity.industry ?? input.industry ?? 'general'
      const result = await researchCompetitor(input.competitor_name, industry)
      return {
        tool_name: toolName,
        output: result,
        model_patch: {
          competitors: {
            names: [input.competitor_name],
            xray_findings: [result.finding],
          },
        },
      }
    }

    case 'prototype_builder': {
      const config = buildBotConfigFromModel(currentModel)
      return {
        tool_name: toolName,
        output: { config, message: 'Bot config generated — provision via /api/prototype/provision' },
      }
    }

    default:
      return { tool_name: toolName, output: { error: `Unknown tool: ${toolName}` } }
  }
}
