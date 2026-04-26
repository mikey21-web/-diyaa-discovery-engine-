import { CompetitorXRayData, CompetitorFinding } from '@/lib/agent/types'

interface Props {
  data: CompetitorXRayData
}

const THREAT_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-gray-100 text-gray-600 border-gray-200',
}

const THREAT_LABEL: Record<string, string> = {
  high: 'High threat',
  medium: 'Medium threat',
  low: 'Low threat',
}

export default function CompetitorXRay({ data }: Props) {
  if (!data.competitors.length) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <span className="text-xl">🔍</span>
          <div>
            <h3 className="font-semibold text-gray-900">Competitor X-Ray</h3>
            <p className="text-sm text-gray-500 mt-0.5">Live research on your named competitors</p>
          </div>
        </div>

        {data.urgency_narrative && (
          <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-800 font-medium">
            {data.urgency_narrative}
          </div>
        )}
      </div>

      <div className="divide-y divide-gray-100">
        {data.competitors.map((c) => (
          <CompetitorCard key={c.name} competitor={c} />
        ))}
      </div>
    </div>
  )
}

function CompetitorCard({ competitor: c }: { competitor: CompetitorFinding }) {
  const threatClass = THREAT_COLORS[c.threat_level] ?? THREAT_COLORS.medium

  return (
    <div className="px-6 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-gray-900">{c.name}</h4>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${threatClass}`}>
              {THREAT_LABEL[c.threat_level]}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">AI usage: {c.ai_usage}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-red-50 rounded-xl p-3">
          <p className="text-xs font-semibold text-red-600 mb-1.5">Their advantages</p>
          <ul className="space-y-1">
            {c.strengths.map((s, i) => (
              <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                <span className="text-red-400 mt-0.5 flex-shrink-0">▲</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-emerald-50 rounded-xl p-3">
          <p className="text-xs font-semibold text-emerald-600 mb-1.5">Their gaps (your opportunity)</p>
          <ul className="space-y-1">
            {c.weaknesses.map((w, i) => (
              <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                <span className="text-emerald-500 mt-0.5 flex-shrink-0">▼</span>
                {w}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
