import React, { useEffect, useState, useCallback } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { motion } from 'framer-motion'
import { Mail, ExternalLink, Download } from 'lucide-react'
import type { ReportPayload } from '@/lib/agent/types'
import DigitalTwin from '@/components/Report/DigitalTwin'
import CompetitorXRay from '@/components/Report/CompetitorXRay'
import LivePrototype from '@/components/Report/LivePrototype'

function formatINR(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`
  return `₹${amount.toLocaleString('en-IN')}`
}

type PageState = 'loading' | 'ready' | 'error'

export default function ReportPage() {
  const router = useRouter()
  const reportRouteId = router.query.id as string
  const calLink = process.env.NEXT_PUBLIC_CAL_LINK || 'https://cal.com/uday-diyaa'
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '918074228036'

  const [state, setState] = useState<PageState>('loading')
  const [payload, setPayload] = useState<ReportPayload | null>(null)
  const [reportId, setReportId] = useState<string>('')
  const [isDownloading, setIsDownloading] = useState(false)
  const [actionStatus, setActionStatus] = useState<string>('')

  const loadReport = useCallback(
    async (attempt = 0) => {
      try {
        const res = await fetch(`/api/report?report_id=${reportRouteId}`)
        if (res.status === 400) {
          // Not ready yet — poll
          if (attempt < 15) {
            setTimeout(() => loadReport(attempt + 1), 3000)
          } else {
            setState('error')
          }
          return
        }
        if (!res.ok) throw new Error('Failed')
        const data = await res.json()
        setPayload(data.payload)
        setReportId(data.report_id)
        setState('ready')
      } catch {
        setState('error')
      }
    },
    [reportRouteId]
  )

  const downloadPDF = useCallback(async () => {
    try {
      setIsDownloading(true)
        const res = await fetch('/api/report-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ report_id: reportId || reportRouteId }),
        })

      if (!res.ok) throw new Error('PDF generation failed')

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
        a.download = `AI_Implementation_Report_${(reportId || reportRouteId).slice(0, 8)}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('PDF download failed:', err)
      alert('Failed to download PDF. Please try again.')
    } finally {
      setIsDownloading(false)
    }
  }, [reportId, reportRouteId])

  useEffect(() => {
    if (!reportRouteId) return
    loadReport()
  }, [reportRouteId, loadReport])

  useEffect(() => {
    if (!reportId) return

    void fetch('/api/report-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report_id: reportId }),
    }).catch(() => null)
  }, [reportId])

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 border-4 border-zinc-100 border-t-zinc-900 rounded-full animate-spin mb-6" />
        <h1 className="text-xl font-bold text-zinc-900">Building your AI report...</h1>
        <p className="text-zinc-500 mt-2">Our AI is mapping your implementation roadmap.</p>
      </div>
    )
  }

  if (state === 'error' || !payload) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-xl font-bold text-zinc-900">Something went wrong</h1>
        <p className="text-zinc-500 mt-2">We couldn&apos;t load your report. Please try refreshing.</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 px-6 py-2 bg-zinc-900 text-white rounded-lg font-bold"
        >
          Refresh
        </button>
      </div>
    )
  }

  const { business_model, digital_twin, competitor_xray, roadmap, sales_narrative, ai_readiness_score } = payload
  const businessName = business_model.identity.name ?? 'Your Business'
  const totalLeak = digital_twin.total_annual_leak_inr
  const whatsappLink = `https://wa.me/${whatsappNumber}`
  const primaryAction = business_model.actions?.[0]

  const runPrimaryAction = async (mode: 'preview' | 'execute') => {
    if (!primaryAction) return
    setActionStatus(mode === 'preview' ? 'Previewing action...' : 'Executing action...')
    try {
      const res = await fetch('/api/actions/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: payload.session_id,
          action_id: primaryAction.action_id,
          mode,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Action failed')
      setActionStatus(`${mode === 'preview' ? 'Preview' : 'Execution'} complete: ${data.run?.status}`)
    } catch {
      setActionStatus('Action failed. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 font-sans">
      <Head>
        <title>{businessName} | AI Diagnostic Report — diyaa.ai</title>
        <meta name="description" content={`AI implementation audit for ${businessName}`} />
      </Head>

      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-zinc-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-zinc-900 rounded flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">d</span>
            </div>
            <span className="font-bold tracking-tight">diyaa.ai</span>
          </div>
          <div className="hidden md:flex gap-4">
            <button
              onClick={downloadPDF}
              disabled={isDownloading}
              className="flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors disabled:opacity-50"
              title="Download as PDF"
            >
              <Download className="w-4 h-4" />
              {isDownloading ? 'Generating...' : 'Download PDF'}
            </button>
            <a href={calLink} target="_blank" rel="noreferrer" className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors">
              Book Call
            </a>
            <a href={whatsappLink} target="_blank" rel="noreferrer" className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors">
              WhatsApp
            </a>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12 md:py-20 space-y-20">

        {/* Hero */}
        <section className="text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-100 rounded-full mb-6">
              <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full" />
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">AI Diagnostic Report — diyaa.ai</span>
            </div>
            <h1 className="text-4xl md:text-7xl font-black text-zinc-900 tracking-tight mb-6">{businessName}</h1>
            <p className="text-base md:text-xl text-zinc-500 max-w-2xl mx-auto mb-12">
              {sales_narrative.restatement}
            </p>
            {totalLeak > 0 && (
              <div>
                <h2 className="text-6xl md:text-9xl font-black text-[#E11D48] tracking-tighter mb-2 tabular-nums">
                  {formatINR(totalLeak)}
                </h2>
                <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs md:text-sm">
                  annual revenue leak identified
                </p>
              </div>
            )}
          </motion.div>
        </section>

        {/* Revenue Leaks Table */}
        {business_model.leaks.length > 0 && (
          <section>
            <SectionHeader n="01" label="Revenue Leak Analysis" />
            <div className="space-y-4">
              <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200">
                      <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">Problem</th>
                      <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase text-right">Annual Leak</th>
                      <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase hidden sm:table-cell">Confidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {business_model.leaks.map((leak, i) => (
                      <tr key={i} className="hover:bg-zinc-50/50">
                        <td className="px-6 py-5 text-zinc-900 font-medium text-sm">{leak.description}</td>
                        <td className="px-6 py-5 text-[#E11D48] font-black text-right">{formatINR(leak.annual_leak_inr)}</td>
                        <td className="px-6 py-5 text-zinc-400 text-xs capitalize hidden sm:table-cell">{leak.confidence}</td>
                      </tr>
                    ))}
                    <tr className="bg-red-50/40">
                      <td className="px-6 py-5 font-bold text-zinc-900">Total Annual Leak</td>
                      <td className="px-6 py-5 text-[#E11D48] font-black text-xl text-right">{formatINR(totalLeak)}</td>
                      <td className="hidden sm:table-cell" />
                    </tr>
                  </tbody>
                </table>
              </div>
              {business_model.leaks.some(l => l.source_quote) && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Evidence Trail</p>
                  {business_model.leaks.filter(l => l.source_quote).map((leak, i) => (
                    <div key={i} className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                      <p className="text-xs font-bold text-blue-900 mb-2">{leak.description}</p>
                      <p className="text-sm text-blue-900 italic">"{leak.source_quote}"</p>
                      {leak.evidence_summary && <p className="text-xs text-blue-700 mt-2">→ {leak.evidence_summary}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Diagnosis */}
        {(business_model.diagnoses?.length || 0) > 0 && (
          <section>
            <SectionHeader n="02" label="Diagnosis & Evidence" />
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
              {business_model.diagnoses.map((d, i) => (
                <div key={i} className="border border-zinc-100 rounded-xl p-4">
                  <p className="text-sm font-bold text-zinc-900">{d.hypothesis} · {Math.round(d.confidence * 100)}% confidence</p>
                  {d.source_quote && (
                    <div className="mt-3 pl-4 border-l-2 border-amber-300 bg-amber-50 py-2">
                      <p className="text-sm italic text-amber-900">"{d.source_quote}"</p>
                      {d.quote_context && <p className="text-xs text-amber-700 mt-1">Context: {d.quote_context}</p>}
                    </div>
                  )}
                  <ul className="mt-2 text-xs text-zinc-600 list-disc list-inside">
                    {d.evidence.map((e, j) => <li key={j}>{e.fact}</li>)}
                  </ul>
                  {d.unknowns.length > 0 && <p className="text-xs text-amber-700 mt-2">Unknowns: {d.unknowns.join(', ')}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Digital Twin */}
        {digital_twin.today_nodes.length > 0 && (
          <section>
            <SectionHeader n="03" label="Workflow Digital Twin" />
            <DigitalTwin data={digital_twin} />
          </section>
        )}

        {/* Competitor X-Ray */}
        {competitor_xray.competitors.length > 0 && (
          <section>
            <SectionHeader n="04" label="Competitor X-Ray" />
            <CompetitorXRay data={competitor_xray} />
          </section>
        )}

        {/* Live Prototype */}
        <section>
          <SectionHeader n="05" label="Your AI — Live Demo" />
          <LivePrototype sessionId={payload.session_id} prototypeId={payload.prototype_id} />
        </section>

        {/* Benchmark Comparison */}
        {business_model.identity.industry && (
          <section>
            <SectionHeader n="05" label="How You Compare" />
            <div className="space-y-4">
              {business_model.stage_metrics && Object.keys(business_model.stage_metrics).length > 0 && (
                <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
                  <div className="bg-zinc-50 px-6 py-4 border-b border-zinc-200">
                    <p className="text-sm font-bold text-zinc-900">Your Metrics vs Industry Leaders</p>
                  </div>
                  <div className="divide-y divide-zinc-100">
                    {business_model.stage_metrics.response_time_minutes && (
                      <div className="px-6 py-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-zinc-900">Lead Response Time</p>
                          <p className="text-xs text-zinc-500">How fast you reply to leads</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-zinc-900">{business_model.stage_metrics.response_time_minutes}m</p>
                          <p className="text-xs text-zinc-400">Top performers: 5-15m</p>
                        </div>
                      </div>
                    )}
                    {business_model.stage_metrics.weekly_leads && (
                      <div className="px-6 py-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-zinc-900">Weekly Lead Volume</p>
                          <p className="text-xs text-zinc-500">Inquiries your team handles</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-zinc-900">{business_model.stage_metrics.weekly_leads}</p>
                          <p className="text-xs text-zinc-400">Industry avg: 20-50/week</p>
                        </div>
                      </div>
                    )}
                    {business_model.stage_metrics.stage_conversion_pct && (
                      <div className="px-6 py-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-zinc-900">Lead-to-Sale Conversion</p>
                          <p className="text-xs text-zinc-500">% of leads who become customers</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-zinc-900">{business_model.stage_metrics.stage_conversion_pct}%</p>
                          <p className="text-xs text-zinc-400">Top performers: 8-15%</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-xs font-bold text-blue-900 uppercase">Key Insight</p>
                <p className="text-sm text-blue-900 mt-2">The biggest leverage point for {business_model.identity.industry} teams like yours is cutting response time by 50-70%. This alone lifts conversion 2-3x.</p>
              </div>
            </div>
          </section>
        )}

        {/* Roadmap */}
        {roadmap.length > 0 && (
          <section>
            <SectionHeader n="06" label="90-Day AI Roadmap" />
            <div className="grid md:grid-cols-3 gap-6">
              {roadmap.map((stage) => (
                <div key={stage.month} className="bg-white border border-zinc-200 rounded-2xl p-6 hover:border-zinc-400 transition-all">
                  <p className="text-xs font-black uppercase tracking-widest text-amber-500 mb-1">Month {stage.month}</p>
                  <h4 className="font-bold text-zinc-900 mb-3">{stage.label}</h4>
                  <ul className="space-y-2">
                    {stage.initiatives.map((init, i) => (
                      <li key={i} className="text-sm text-zinc-600">
                        <span className="font-semibold text-zinc-800">{init.title}</span>
                        {init.impact_inr > 0 && (
                          <span className="ml-1 text-emerald-600 font-bold text-xs">+{formatINR(init.impact_inr)}</span>
                        )}
                        <p className="text-xs text-zinc-400 mt-0.5">{init.description}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* AI Readiness */}
        <section>
          <SectionHeader n="07" label="AI Readiness Score" />
          <div className="bg-white border border-zinc-200 rounded-2xl p-8 flex flex-col sm:flex-row gap-6 items-center">
            <div className="w-28 h-28 rounded-full border-8 border-zinc-100 flex items-center justify-center flex-shrink-0">
              <span className="text-4xl font-black text-zinc-900">{ai_readiness_score}<span className="text-lg text-zinc-400">/10</span></span>
            </div>
            <div>
              <p className="font-semibold text-zinc-900 text-lg">{readinessLabel(ai_readiness_score)}</p>
              <p className="text-sm text-zinc-500 mt-1">Most Indian SMBs score 3-5. Your score means {readinessDetail(ai_readiness_score)}</p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section>
          <div className="bg-zinc-900 rounded-3xl p-8 md:p-16 text-white">
            <div className="max-w-2xl">
              <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">Next Step</p>
              <h2 className="text-3xl md:text-4xl font-black mb-4">{sales_narrative.urgency}</h2>
              <p className="text-zinc-400 mb-8">{sales_narrative.social_proof}</p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href={calLink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-4 px-6 py-4 bg-white text-zinc-900 font-bold rounded-2xl hover:bg-zinc-100 transition-colors"
                >
                  <span>Book 30-min Call</span>
                  <Mail className="w-4 h-4" />
                </a>
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-4 px-6 py-4 border border-zinc-700 text-white font-bold rounded-2xl hover:bg-zinc-800 transition-colors"
                >
                  <span>WhatsApp Uday</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {primaryAction && (
          <section>
            <SectionHeader n="08" label="Action Engine" />
            <div className="bg-white border border-zinc-200 rounded-2xl p-6">
              <p className="text-sm text-zinc-700 mb-4">
                Recommended first action: <span className="font-semibold">{primaryAction.action_id}</span> · expected impact {formatINR(primaryAction.expected_impact_inr)}
              </p>
              <div className="flex flex-wrap gap-3">
                <button onClick={() => runPrimaryAction('preview')} className="px-4 py-2 rounded-xl border border-zinc-300 text-sm font-semibold">Preview Action</button>
                <button onClick={() => runPrimaryAction('execute')} className="px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm font-semibold">Approve & Execute</button>
                <a href={`/control-tower/${payload.session_id}`} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold">Open Control Tower</a>
              </div>
              {actionStatus && <p className="text-xs text-zinc-500 mt-3">{actionStatus}</p>}
            </div>
          </section>
        )}

        <footer className="pt-8 border-t border-zinc-200 text-center">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Generated by diyaa.ai · Report {reportId.slice(0, 8)}</p>
        </footer>
      </main>

      {/* Mobile sticky bar */}
      <div className="fixed bottom-4 left-4 right-4 z-50 md:hidden">
        <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 p-2 rounded-2xl shadow-2xl space-y-2">
          <button
            onClick={downloadPDF}
            disabled={isDownloading}
            className="w-full flex items-center justify-center gap-2 bg-white text-zinc-900 font-bold text-sm py-3 rounded-xl disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {isDownloading ? 'Generating...' : 'Download PDF'}
          </button>
          <div className="flex gap-2">
            <a href={calLink} target="_blank" rel="noreferrer" className="flex-1 bg-white text-zinc-900 font-bold text-sm py-2 rounded-xl text-center text-xs">
              Book Call
            </a>
            <a href={whatsappLink} target="_blank" rel="noreferrer" className="flex-1 border border-zinc-700 text-white font-bold text-sm py-2 rounded-xl text-center text-xs">
              WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ n, label }: { n: string; label: string }) {
  return (
    <div className="mb-6 flex items-center gap-4">
      <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 shrink-0">
        {n}. {label}
      </h3>
      <div className="h-px flex-1 bg-zinc-200" />
    </div>
  )
}

function readinessLabel(score: number): string {
  if (score >= 8) return 'Advanced — Ready for complex multi-agent systems'
  if (score >= 6) return 'Operational — Ready for AI agents and multi-channel automation'
  if (score >= 4) return 'Transitional — Strong foundation, quick wins available'
  return 'Foundational — Basic automation has highest ROI right now'
}

function readinessDetail(score: number): string {
  if (score >= 8) return 'you are already ahead of 90% of Indian SMBs. The opportunity is differentiation, not adoption.'
  if (score >= 6) return 'you can deploy working AI systems in weeks, not months.'
  if (score >= 4) return 'quick wins are available immediately, and you can build from there.'
  return 'starting with high-ROI, low-complexity automation will deliver the fastest returns.'
}
