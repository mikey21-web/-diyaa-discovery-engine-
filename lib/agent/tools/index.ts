import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import { calculatorToolSchema, calculateLeak } from './calculator'
import { industryDataToolSchema, lookupIndustryFact, listIndustryFacts } from './industryData'
import { webSearchToolSchema, researchCompetitor } from './webSearch'
import { prototypeBuilderToolSchema, buildBotConfigFromModel } from './prototypeBuilder'
import { competitorDeepScanToolSchema, runDeepScan } from './competitorDeepScan'
import { BusinessModel } from '../types'

export const ALL_TOOL_SCHEMAS: Tool[] = [
  calculatorToolSchema,
  industryDataToolSchema,
  competitorDeepScanToolSchema, // Firecrawl-powered — preferred over web_search
  webSearchToolSchema,
  prototypeBuilderToolSchema,
]

export interface ToolResult {
  tool_name: string
  output: unknown
  model_patch?: Partial<BusinessModel>
}

export async function executeTool(toolName: string, input: Record<string, unknown>, currentModel: BusinessModel): Promise<ToolResult> {
  const inp = input as Record<string, any>
  switch (toolName) {
    case 'calculator': {
      const result = calculateLeak({
        description: String(inp.description),
        frequency_per_week: Number(inp.frequency_per_week),
        cost_per_instance_inr: Number(inp.cost_per_instance_inr),
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

    case 'competitor_deep_scan': {
      const industry = (input.industry as string) ?? currentModel.identity.industry ?? 'general'
      const city = (input.city as string | undefined) ?? currentModel.identity.city ?? undefined
      const benchmark = (input.benchmark_metric as string | undefined) ?? undefined
      const result = await runDeepScan(input.competitor_name as string, industry, city, benchmark)
      return {
        tool_name: toolName,
        output: result,
        model_patch: {
          competitors: {
            names: [input.competitor_name as string],
            xray_findings: [result.finding],
          },
        },
      }
    }

    case 'web_search': {
      const industry = currentModel.identity.industry ?? (inp.industry as string) ?? 'general'
      const result = await researchCompetitor(inp.competitor_name as string, industry)
      return {
        tool_name: toolName,
        output: result,
        model_patch: {
          competitors: {
            names: [inp.competitor_name as string],
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
