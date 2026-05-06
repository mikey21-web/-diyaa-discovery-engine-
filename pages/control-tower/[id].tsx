import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import type { ReportPayload } from '@/lib/agent/types'

interface WeeklySummary {
  recovered_revenue_inr: number
  actions_executed: number
  metrics: {
    leads: number
    response_sla_minutes: number | null
    no_show_rate: number | null
    payment_completion_rate: number | null
  }
  summary: string
}

export default function ControlTowerPage() {
  const router = useRouter()
  const id = router.query.id as string
  const [report, setReport] = useState<ReportPayload | null>(null)
  const [weekly, setWeekly] = useState<WeeklySummary | null>(null)

  useEffect(() => {
    if (!id) return
    void fetch(`/api/report?report_id=${id}`).then((r) => r.json()).then((d) => setReport(d.payload)).catch(() => null)
    void fetch(`/api/summary/weekly?session_id=${id}`).then((r) => r.json()).then(setWeekly).catch(() => null)
  }, [id])

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 p-6">
      <Head><title>Control Tower</title></Head>
      <main className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-3xl font-black">AI Profit Control Tower</h1>
        <section className="grid md:grid-cols-4 gap-4">
          <Card label="Detected Leak" value={formatINR(report?.digital_twin.total_annual_leak_inr || 0)} />
          <Card label="Recovered (7d)" value={formatINR(weekly?.recovered_revenue_inr || 0)} />
          <Card label="Actions Executed" value={String(weekly?.actions_executed || 0)} />
          <Card label="Lead Response SLA" value={weekly?.metrics.response_sla_minutes ? `${weekly.metrics.response_sla_minutes} min` : '-'} />
        </section>
        <section className="bg-white border border-zinc-200 rounded-xl p-5">
          <h2 className="font-bold mb-2">Diagnosis</h2>
          <ul className="text-sm text-zinc-700 space-y-1">
            {(report?.business_model.diagnoses || []).map((d, i) => (
              <li key={i}>{d.hypothesis} - confidence {Math.round(d.confidence * 100)}%</li>
            ))}
          </ul>
        </section>
        <section className="bg-white border border-zinc-200 rounded-xl p-5">
          <h2 className="font-bold mb-2">This Week</h2>
          <p className="text-sm text-zinc-700">{weekly?.summary || 'No weekly summary yet.'}</p>
        </section>
      </main>
    </div>
  )
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-4">
      <p className="text-xs text-zinc-500 uppercase">{label}</p>
      <p className="text-xl font-black mt-1">{value}</p>
    </div>
  )
}

function formatINR(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`
  return `₹${amount.toLocaleString('en-IN')}`
}

