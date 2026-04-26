'use client'
import { useState } from 'react'
import { DigitalTwinData, DigitalTwinNode } from '@/lib/agent/types'

interface Props {
  data: DigitalTwinData
}

export default function DigitalTwin({ data }: Props) {
  const [view, setView] = useState<'today' | 'future'>('today')
  const nodes = view === 'today' ? data.today_nodes : data.future_nodes
  const totalLeak = data.total_annual_leak_inr
  const totalSave = data.projected_annual_save_inr

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Your Business — Digital Twin</h3>
            <p className="text-sm text-gray-500 mt-0.5">See how AI transforms each step of your workflow</p>
          </div>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium">
            <button
              onClick={() => setView('today')}
              className={`px-4 py-2 transition-colors ${
                view === 'today'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setView('future')}
              className={`px-4 py-2 transition-colors ${
                view === 'future'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              90 Days with AI
            </button>
          </div>
        </div>

        {/* Summary bar */}
        {view === 'today' && totalLeak > 0 && (
          <div className="mt-4 bg-red-50 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-2xl">🔴</span>
            <div>
              <p className="text-sm font-semibold text-red-700">
                ₹{formatInr(totalLeak)}/year leaking from manual operations
              </p>
              <p className="text-xs text-red-500 mt-0.5">Calculated from your workflow above</p>
            </div>
          </div>
        )}
        {view === 'future' && totalSave > 0 && (
          <div className="mt-4 bg-emerald-50 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-2xl">🟢</span>
            <div>
              <p className="text-sm font-semibold text-emerald-700">
                ₹{formatInr(totalSave)}/year recovered with AI agents
              </p>
              <p className="text-xs text-emerald-600 mt-0.5">Conservative estimate based on your industry benchmarks</p>
            </div>
          </div>
        )}
      </div>

      {/* Flow SVG */}
      <div className="p-6 overflow-x-auto">
        {nodes.length > 0 ? (
          <WorkflowSVG nodes={nodes} mode={view} />
        ) : (
          <EmptyFlowPlaceholder mode={view} />
        )}
      </div>
    </div>
  )
}

function WorkflowSVG({ nodes, mode }: { nodes: DigitalTwinNode[]; mode: 'today' | 'future' }) {
  const nodeW = 160
  const nodeH = 64
  const gapX = 40
  const gapY = 80
  const cols = 3
  const rows = Math.ceil(nodes.length / cols)
  const svgW = cols * nodeW + (cols - 1) * gapX + 40
  const svgH = rows * nodeH + (rows - 1) * gapY + 40

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      width="100%"
      style={{ maxHeight: 480 }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#6b7280" />
        </marker>
        <marker id="arrow-green" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#059669" />
        </marker>
      </defs>
      {nodes.map((node, i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        const x = 20 + col * (nodeW + gapX)
        const y = 20 + row * (nodeH + gapY)

        // Arrow to next node in same row
        const hasNext = i + 1 < nodes.length
        const nextCol = (i + 1) % cols
        const nextRow = Math.floor((i + 1) / cols)
        const arrowSameRow = hasNext && nextRow === row
        const arrowNextRow = hasNext && nextRow !== row && col === cols - 1

        return (
          <g key={node.id}>
            <FlowNode node={node} x={x} y={y} w={nodeW} h={nodeH} mode={mode} />
            {arrowSameRow && (
              <Arrow
                x1={x + nodeW}
                y1={y + nodeH / 2}
                x2={x + nodeW + gapX}
                y2={y + nodeH / 2}
                color={mode === 'future' ? '#059669' : '#6b7280'}
              />
            )}
            {arrowNextRow && (
              <Arrow
                x1={x + nodeW / 2}
                y1={y + nodeH}
                x2={20 + nodeW / 2}
                y2={y + nodeH + gapY}
                color={mode === 'future' ? '#059669' : '#6b7280'}
                curved
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}

function FlowNode({
  node, x, y, w, h, mode,
}: {
  node: DigitalTwinNode; x: number; y: number; w: number; h: number; mode: 'today' | 'future'
}) {
  const isLeak = node.type === 'leak'
  const isAI = node.type === 'ai_agent'

  const fill = isAI
    ? '#d1fae5'
    : isLeak && mode === 'today'
    ? '#fee2e2'
    : '#f9fafb'

  const stroke = isAI ? '#059669' : isLeak && mode === 'today' ? '#ef4444' : '#e5e7eb'
  const textColor = isAI ? '#065f46' : isLeak && mode === 'today' ? '#991b1b' : '#1f2937'

  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={10} fill={fill} stroke={stroke} strokeWidth={1.5} />
      <text
        x={x + w / 2}
        y={y + (node.leak_inr_monthly ? h / 3 : h / 2)}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={11}
        fontWeight={500}
        fill={textColor}
      >
        {truncate(node.label, 22)}
      </text>
      {node.leak_inr_monthly && mode === 'today' && (
        <text
          x={x + w / 2}
          y={y + (h * 2) / 3}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={10}
          fill="#dc2626"
          fontWeight={600}
        >
          −₹{formatInr(node.leak_inr_monthly * 12)}/yr
        </text>
      )}
      {node.ai_replacement && mode === 'future' && (
        <text
          x={x + w / 2}
          y={y + (h * 2) / 3}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={9}
          fill="#059669"
        >
          {truncate(node.ai_replacement, 24)}
        </text>
      )}
    </g>
  )
}

function Arrow({
  x1, y1, x2, y2, color, curved,
}: {
  x1: number; y1: number; x2: number; y2: number; color: string; curved?: boolean
}) {
  const d = curved
    ? `M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`
    : `M ${x1} ${y1} L ${x2} ${y2}`
  return (
    <path d={d} stroke={color} strokeWidth={1.5} fill="none" markerEnd={color === '#059669' ? 'url(#arrow-green)' : 'url(#arrow)'} />
  )
}

function EmptyFlowPlaceholder({ mode }: { mode: 'today' | 'future' }) {
  return (
    <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
      {mode === 'today'
        ? 'Workflow map will appear here after your session'
        : 'AI-enhanced workflow will appear here after your session'}
    </div>
  )
}

function formatInr(n: number): string {
  if (n >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`
  return n.toLocaleString('en-IN')
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}
