import { useEffect, useState, useCallback } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import PrototypeBot from '@/components/PrototypeBot'
import type { ReportPayload } from '@/lib/agent/types'

type PageState = 'loading' | 'ready' | 'error'

export default function InteractiveReportPage() {
  const router = useRouter()
  const { id } = router.query
  const calLink = process.env.NEXT_PUBLIC_CAL_LINK || 'https://cal.com/uday-diyaa'
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '918074228036'

  const [state, setState] = useState<PageState>('loading')
  const [report, setReport] = useState<ReportPayload | null>(null)

  const loadReport = useCallback(
    async (attempt = 0) => {
      try {
        const res = await fetch(`/api/report?report_id=${id}`)
        if (res.status === 400) {
          if (attempt < 15) {
            setTimeout(() => loadReport(attempt + 1), 3000)
          } else {
            setState('error')
          }
          return
        }
        if (!res.ok) throw new Error('Failed to load report')
        const data = await res.json()
        setReport(data.payload)
        setState('ready')
      } catch {
        setState('error')
      }
    },
    [id]
  )

  useEffect(() => {
    if (!id) return
    loadReport()
  }, [id, loadReport])

  useEffect(() => {
    if (!id) return

    void fetch('/api/report-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report_id: id }),
    }).catch(() => null)
  }, [id])

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 border-4 border-zinc-100 border-t-zinc-900 rounded-full animate-spin mb-6" />
        <h1 className="text-xl font-bold text-zinc-900">Loading your interactive report...</h1>
        <p className="text-zinc-500 mt-2">Preparing your AI bot demo.</p>
      </div>
    )
  }

  if (state === 'error' || !report) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-6 text-center">
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

  const business = report.business_model.identity
  const leaks = report.business_model.leaks
  const totalLeak = report.digital_twin.total_annual_leak_inr

  function formatINR(amount: number): string {
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`
    return `₹${amount.toLocaleString('en-IN')}`
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 font-sans">
      <Head>
        <title>{business.name || 'Your Business'} | Interactive AI Report — diyaa.ai</title>
        <meta name="description" content={`Interactive AI audit report for ${business.name || 'your business'}`} />
      </Head>

      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-zinc-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-zinc-900 rounded flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">d</span>
            </div>
            <span className="font-bold tracking-tight">diyaa.ai</span>
            <span className="text-xs text-zinc-400 ml-2">Interactive Report</span>
          </div>
          <div className="hidden md:flex gap-4">
            <a
              href={`/report/${id}`}
              className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              ← Full Report
            </a>
            <a
              href={calLink}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              Book Call
            </a>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12 md:py-16 space-y-16">
        {/* Hero */}
        <section className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 rounded-full mb-6">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Interactive Demo</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-zinc-900 tracking-tight mb-4">
            {business.name || 'Your Business'} — AI Bot Demo
          </h1>
          <p className="text-base md:text-lg text-zinc-500 max-w-2xl mx-auto">
            This is a working prototype of the AI assistant built for your {business.industry || 'business'}.
            Try sending messages below to see how it handles real customer interactions.
          </p>
        </section>

        {/* Revenue Leak Summary — Compact */}
        {leaks.length > 0 && totalLeak > 0 && (
          <section className="bg-white border border-zinc-200 rounded-2xl p-6 md:p-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-1">Your Biggest Revenue Leak</p>
                <p className="text-lg font-semibold text-zinc-900">{leaks[0]?.description}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-red-500">{formatINR(totalLeak)}</p>
                <p className="text-xs text-zinc-400 uppercase tracking-widest">per year</p>
              </div>
            </div>
          </section>
        )}

        {/* Prototype Bot — Main Section */}
        <section>
          <div className="mb-6 flex items-center gap-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 shrink-0">
              🤖 Live Bot Demo
            </h3>
            <div className="h-px flex-1 bg-zinc-200" />
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-start">
            {/* Bot */}
            <div className="flex justify-center">
              <PrototypeBot businessModel={report.business_model} />
            </div>

            {/* Info panel */}
            <div className="space-y-6">
              <div className="bg-white border border-zinc-200 rounded-2xl p-6">
                <h4 className="font-bold text-zinc-900 mb-3">What this bot does</h4>
                <ul className="space-y-2 text-sm text-zinc-600">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">✓</span>
                    <span>Responds to customer inquiries in under 5 seconds</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">✓</span>
                    <span>Qualifies leads automatically based on intent</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">✓</span>
                    <span>Books appointments and sends confirmations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">✓</span>
                    <span>Works 24/7 on WhatsApp — no missed leads</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">✓</span>
                    <span>Sends follow-up reminders to reduce no-shows</span>
                  </li>
                </ul>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
                <h4 className="font-bold text-zinc-900 mb-2">💡 Try these messages</h4>
                <ul className="space-y-1 text-sm text-amber-800">
                  {business.industry === 'real_estate' && (
                    <>
                      <li>&quot;I want to buy a 2BHK apartment&quot;</li>
                      <li>&quot;Tell me about the Indiranagar one&quot;</li>
                      <li>&quot;Do you have any discounts?&quot;</li>
                    </>
                  )}
                  {business.industry === 'coaching' && (
                    <>
                      <li>&quot;What program do you offer?&quot;</li>
                      <li>&quot;Schedule a call for Tuesday&quot;</li>
                      <li>&quot;What if I miss a session?&quot;</li>
                    </>
                  )}
                  {business.industry === 'fnb' && (
                    <>
                      <li>&quot;Book a table for 4 people&quot;</li>
                      <li>&quot;What do you recommend?&quot;</li>
                      <li>&quot;Any vegetarian options?&quot;</li>
                    </>
                  )}
                  {business.industry === 'd2c_fashion' && (
                    <>
                      <li>&quot;I was looking at a dress but left&quot;</li>
                      <li>&quot;How much is shipping?&quot;</li>
                      <li>&quot;Show me similar dresses&quot;</li>
                    </>
                  )}
                  {!['real_estate', 'coaching', 'fnb', 'd2c_fashion'].includes(business.industry || '') && (
                    <>
                      <li>&quot;What services do you offer?&quot;</li>
                      <li>&quot;I want to book an appointment&quot;</li>
                      <li>&quot;How much does it cost?&quot;</li>
                    </>
                  )}
                </ul>
              </div>

              {/* Impact stats */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
                <h4 className="font-bold text-zinc-900 mb-3">Expected Impact</h4>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-black text-emerald-600">&lt;5s</p>
                    <p className="text-xs text-zinc-500">Response time</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-emerald-600">24/7</p>
                    <p className="text-xs text-zinc-500">Availability</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-emerald-600">2-3x</p>
                    <p className="text-xs text-zinc-500">More leads captured</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-emerald-600">30%↓</p>
                    <p className="text-xs text-zinc-500">No-show reduction</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Competitor Findings (if available) */}
        {report.competitor_findings && report.competitor_findings.length > 0 && (
          <section>
            <div className="mb-6 flex items-center gap-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 shrink-0">
                🔍 Competitor Intelligence
              </h3>
              <div className="h-px flex-1 bg-zinc-200" />
            </div>
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 md:p-8">
              {report.competitor_findings.map((comp, i) => (
                <div key={i} className="mb-4 last:mb-0">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-zinc-900">{comp.name}</h4>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      comp.urgency_score >= 7 ? 'bg-red-100 text-red-700' :
                      comp.urgency_score >= 4 ? 'bg-amber-100 text-amber-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      Urgency: {comp.urgency_score}/10
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {comp.findings.map((f, j) => (
                      <li key={j} className="text-sm text-zinc-600 flex items-start gap-2">
                        <span className="text-red-400 mt-0.5">⚠</span>
                        <span>{typeof f === 'string' ? f : (f as any).name || JSON.stringify(f)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 90-Day Roadmap */}
        {report.roadmap.length > 0 && (
          <section>
            <div className="mb-6 flex items-center gap-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 shrink-0">
                🚀 90-Day Roadmap
              </h3>
              <div className="h-px flex-1 bg-zinc-200" />
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {report.roadmap.map((stage) => (
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

        {/* CTA */}
        <section>
          <div className="bg-zinc-900 rounded-3xl p-8 md:p-16 text-white">
            <div className="max-w-2xl">
              <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">Next Step</p>
              <h2 className="text-3xl md:text-4xl font-black mb-4">
                Ready to deploy this bot for your business?
              </h2>
              <p className="text-zinc-400 mb-8">
                What you just tested is a demo. The real bot will use your actual business data,
                branding, pricing, and workflows. It can be live on WhatsApp in 2-4 weeks.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href={calLink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 px-6 py-4 bg-white text-zinc-900 font-bold rounded-2xl hover:bg-zinc-100 transition-colors"
                >
                  📞 Book a Strategy Call
                </a>
                <a
                  href={`https://wa.me/${whatsappNumber}?text=I%20just%20tested%20the%20AI%20bot%20demo.%20Let's%20discuss%20implementation.`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 px-6 py-4 border border-zinc-700 text-white font-bold rounded-2xl hover:bg-zinc-800 transition-colors"
                >
                  💬 Message on WhatsApp
                </a>
              </div>
            </div>
          </div>
        </section>

        <footer className="pt-8 border-t border-zinc-200 text-center">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
            Generated by diyaa.ai
          </p>
        </footer>
      </main>

      {/* Mobile sticky bar */}
      <div className="fixed bottom-4 left-4 right-4 z-50 md:hidden">
        <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 p-2 rounded-2xl shadow-2xl flex gap-2">
          <a
            href={calLink}
            target="_blank"
            rel="noreferrer"
            className="flex-1 bg-white text-zinc-900 font-bold text-xs py-3 rounded-xl text-center"
          >
            Book Call
          </a>
          <a
            href={`https://wa.me/${whatsappNumber}`}
            target="_blank"
            rel="noreferrer"
            className="flex-1 border border-zinc-700 text-white font-bold text-xs py-3 rounded-xl text-center"
          >
            WhatsApp
          </a>
        </div>
      </div>
    </div>
  )
}
