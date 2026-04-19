import React, { useEffect, useState, useCallback } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { motion } from 'framer-motion'
import { 
  Mail,
  ExternalLink,
  CheckCircle2,
  XCircle
} from 'lucide-react'
import type { ExtractedData } from '@/lib/types'

// Helper functions for formatting
function formatINR(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`
  return `₹${amount.toLocaleString('en-IN')}`
}

type ReportState = 'loading' | 'ready' | 'error'

interface ReportData {
  founderName: string
  businessName: string
  industry: string
  city: string | null
  extractedData: ExtractedData
  generatedAt: string
}

export default function ReportPage() {
  const router = useRouter()
  const session_id = router.query.id as string
  const calLink = process.env.NEXT_PUBLIC_CAL_LINK || '#'
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '918074228036'

  const [state, setState] = useState<ReportState>('loading')
  const [reportData, setReportData] = useState<ReportData | null>(null)

  const loadReport = useCallback(async (attempt = 0) => {
    try {
      const response = await fetch('/api/report-poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id }),
      })

      if (!response.ok) throw new Error('Poll failed')
      const data = await response.json()

      if (data.ready && data.report) {
        setReportData(data.report)
        setState('ready')
      } else if (attempt < 15) {
        // Poll every 3 seconds for 45s max
        setTimeout(() => loadReport(attempt + 1), 3000)
      } else {
        setState('error')
      }
    } catch (err) {
      setState('error')
    }
  }, [session_id])

  useEffect(() => {
    if (!session_id) return
    loadReport()
  }, [session_id, loadReport])

  useEffect(() => {
    if (!session_id || state !== 'ready') return
    fetch('/api/report-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id }),
    }).catch(() => {
      // no-op: analytics should not block report rendering
    })
  }, [session_id, state])

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 border-4 border-zinc-100 border-t-zinc-900 rounded-full animate-spin mb-6" />
        <h1 className="text-xl font-bold text-zinc-900">Quantifying your business...</h1>
        <p className="text-zinc-500 mt-2">Our AI is mapping your implementation roadmap.</p>
      </div>
    )
  }

  if (state === 'error' || !reportData) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-xl font-bold text-zinc-900">Something went wrong</h1>
        <p className="text-zinc-500 mt-2">We couldn&apos;t load your report. Please try refreshing.</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-6 px-6 py-2 bg-zinc-900 text-white rounded-lg font-bold"
        >
          Refresh Page
        </button>
      </div>
    )
  }

  return (
    <ReportContentView 
      data={reportData}
      calLink={calLink}
      whatsappLink={`https://wa.me/${whatsappNumber}`}
    />
  )
}

function ReportContentView({
  data,
  calLink,
  whatsappLink,
}: {
  data: ReportData
  calLink: string
  whatsappLink: string
}) {
  const { founderName, businessName, extractedData } = data
  const annualLeak = extractedData.revenue_leak_inr_per_year || 0
  const breakdown = extractedData.revenue_leak_breakdown || []
  const roadmap = extractedData.roadmap || []
  const beforeAfter = extractedData.before_after || null
  const udayBriefing = extractedData.uday_briefing || ""

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 font-sans selection:bg-zinc-900 selection:text-white">
      <Head>
        <title>{businessName} | AI Diagnostic Report</title>
      </Head>

      {/* Navigation / Top Bar */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-zinc-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-zinc-900 rounded flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">d</span>
            </div>
            <span className="font-bold tracking-tight">diyaa.ai</span>
          </div>
          <div className="hidden md:flex gap-4">
            <a href={calLink} target="_blank" rel="noreferrer" className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors">Book Call</a>
            <a href={whatsappLink} target="_blank" rel="noreferrer" className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors">WhatsApp</a>
          </div>
          <div className="md:hidden">
             <span className="px-2 py-1 bg-zinc-100 text-zinc-500 text-[10px] font-bold uppercase rounded">Report v5.0</span>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-12 md:py-20">
        
        {/* FIX 1: HERO */}
        <section className="mb-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-100 rounded-full mb-8">
              <span className="w-1 h-1 bg-zinc-400 rounded-full" />
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Powered by diyaa.ai</span>
            </div>
            
            <p className="text-xs md:text-sm font-medium text-zinc-400 mb-2">Prepared for {founderName || 'Founder'}</p>
            <h1 className="text-3xl sm:text-4xl md:text-7xl font-black text-zinc-900 tracking-tight mb-6 break-words">
              {businessName}
            </h1>
            <p className="text-base md:text-xl text-zinc-500 max-w-2xl mx-auto mb-12 md:mb-16 leading-relaxed">
              Here&apos;s exactly where AI fits in your business — and what it costs you not to act.
            </p>

            <div className="relative inline-block group max-w-full">
              <div className="absolute inset-0 bg-red-600/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <h2 className="text-5xl sm:text-6xl md:text-9xl font-black text-[#E11D48] tracking-tighter mb-2 tabular-nums break-words">
                {formatINR(annualLeak)}
              </h2>
              <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs md:text-sm">
                walking out of your business every year
              </p>
            </div>
          </motion.div>
        </section>

        {/* FIX 2: REVENUE LEAK CALCULATION (Clean Table) */}
        <section className="mb-20 md:mb-32">
          <div className="mb-6 md:mb-8 flex items-center gap-4">
             <h3 className="text-[10px] md:text-xs font-black uppercase tracking-widest text-zinc-400 shrink-0">01. Efficiency Audit</h3>
             <div className="h-[1px] flex-1 bg-zinc-200" />
          </div>
          
          <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200">
                    <th className="px-8 py-5 text-sm font-bold text-zinc-500 uppercase tracking-wider">Factor</th>
                    <th className="px-8 py-5 text-sm font-bold text-zinc-500 uppercase tracking-wider text-right">Calculation / Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {breakdown.length > 0 ? breakdown.map((item, i) => (
                    <tr key={i} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-8 py-6 text-zinc-900 font-medium">{item.label}</td>
                      <td className="px-8 py-6 text-zinc-500 text-right">{item.value}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td className="px-8 py-6 text-zinc-900 font-medium">Estimated Annual Overhead</td>
                      <td className="px-8 py-6 text-zinc-500 text-right">{formatINR(annualLeak)}</td>
                    </tr>
                  )}
                  <tr className="bg-red-50/30">
                    <td className="px-8 py-6 text-zinc-900 font-bold">TOTAL ANNUAL LEAK</td>
                    <td className="px-8 py-6 text-[#E11D48] font-black text-xl text-right">{formatINR(annualLeak)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <p className="mt-4 text-center text-sm font-medium text-zinc-400 italic">
            This is your business, calculated. Not an estimate.
          </p>
        </section>

        {/* FIX 3: BEFORE / AFTER */}
        <section className="mb-20 md:mb-32">
          <div className="mb-8 flex items-center gap-4">
             <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">02. Transformation</h3>
             <div className="h-[1px] flex-1 bg-zinc-200" />
          </div>

          <div className="grid md:grid-cols-2 gap-0 rounded-3xl overflow-hidden border border-zinc-200 shadow-xl">
            {/* TODAY */}
            <div className="bg-zinc-900 p-8 md:p-12 text-white">
              <div className="flex items-center gap-2 mb-8">
                <XCircle className="w-5 h-5 text-[#E11D48]" />
                <span className="text-xs font-black uppercase tracking-[0.2em] text-red-500">Today</span>
              </div>
              <p className="text-xl md:text-2xl font-medium leading-relaxed text-zinc-300">
                {beforeAfter?.today || "High manual overhead, lead leakage, and sub-optimal conversion causing consistent revenue drain."}
              </p>
            </div>
            
            {/* 90 DAYS */}
            <div className="bg-white p-8 md:p-12 text-zinc-900">
              <div className="flex items-center gap-2 mb-8">
                <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
                <span className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">90 Days After AI</span>
              </div>
              <p className="text-xl md:text-2xl font-medium leading-relaxed text-zinc-700">
                {beforeAfter?.in_90_days || "Automated systems capturing 100% of leads, autonomous sales follow-ups, and streamlined infrastructure."}
              </p>
            </div>
          </div>
        </section>

        {/* FIX 4: IMPLEMENTATION ROADMAP */}
        <section className="mb-20 md:mb-32">
          <div className="mb-6 md:mb-8 flex items-center gap-4">
             <h3 className="text-[10px] md:text-xs font-black uppercase tracking-widest text-zinc-400 shrink-0">03. Roadmap</h3>
             <div className="h-[1px] flex-1 bg-zinc-200" />
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {roadmap.length > 0 ? roadmap.map((item, i) => (
              <div key={i} className="bg-white p-8 border border-zinc-200 rounded-2xl flex flex-col hover:border-zinc-400 transition-all group">
                <div className="flex justify-between items-center mb-6">
                   <span className="text-4xl font-black text-zinc-100 group-hover:text-zinc-200 transition-colors">{item.stage}</span>
                   <div className="px-3 py-1 bg-zinc-100 rounded text-[10px] font-black uppercase text-zinc-500">Build: {item.build_time}</div>
                </div>
                
                <h4 className="text-xs font-black uppercase tracking-widest text-[#F59E0B] mb-2">{item.title}</h4>
                <h5 className="text-xl font-bold text-zinc-900 mb-4">{item.agent}</h5>
                <p className="text-sm text-zinc-500 leading-relaxed mb-8 flex-1">
                  {item.what_it_does}
                </p>
                
                <div className="space-y-4">
                   <div className="flex justify-between items-end">
                      <span className="text-[10px] font-black uppercase text-zinc-400">Monthly Value</span>
                      <span className="text-lg font-black text-zinc-900">+{formatINR(item.monthly_value_inr)}</span>
                   </div>
                   
                   <div>
                      <div className="flex justify-between items-center mb-1.5">
                         <span className="text-[10px] font-black uppercase text-zinc-400">Confidence</span>
                         <span className="text-[10px] font-bold text-zinc-900">{item.confidence_score}%</span>
                      </div>
                      <div className="h-1 bg-zinc-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-zinc-900 rounded-full" 
                          style={{ width: `${item.confidence_score}%` }}
                        />
                      </div>
                   </div>
                </div>
              </div>
            )) : (
              <div className="col-span-3 py-20 text-center text-zinc-400">
                AI Roadmap unavailable for this session.
              </div>
            )}
          </div>
        </section>

        {/* FIX 5: CONTACT SECTION */}
        <section className="mb-20 md:mb-32">
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center bg-zinc-900 rounded-3xl md:rounded-[3rem] p-8 md:p-16 text-white relative overflow-hidden">
             {/* Decorative glow */}
             <div className="absolute top-0 right-0 w-64 h-64 bg-zinc-100/5 rounded-full blur-[100px] -mr-32 -mt-32" />
             
             <div className="relative z-10">
                <div className="flex items-center gap-3 mb-8">
                   <div className="w-10 h-10 rounded-xl bg-zinc-100/10 flex items-center justify-center font-black text-zinc-100">U</div>
                   <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Direct From</span>
                      <span className="text-sm font-bold text-zinc-100">Uday Kiran Tumma</span>
                   </div>
                </div>
                
                <blockquote className="text-2xl md:text-3xl font-medium leading-relaxed italic text-zinc-300">
                  &quot;{udayBriefing || `Your business is prime for AI integration. The ${formatINR(annualLeak)} leak is just the beginning of what we can recover.`}&quot;
                </blockquote>
             </div>
             
             <div className="relative z-10 flex flex-col gap-4">
                <a 
                  href={calLink}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-between px-8 py-5 border border-zinc-700 rounded-2xl hover:bg-zinc-800 transition-all font-bold"
                >
                  <span>Book 30-min Call</span>
                  <Mail className="w-5 h-5 text-zinc-500" />
                </a>
                <a 
                  href={whatsappLink}
                  target="_blank" 
                  rel="noreferrer"
                  className="w-full flex items-center justify-between px-8 py-5 border border-zinc-700 rounded-2xl hover:bg-zinc-800 transition-all font-bold"
                >
                  <span>Message on WhatsApp</span>
                  <ExternalLink className="w-5 h-5 text-zinc-500" />
                </a>
                <p className="text-center text-xs text-zinc-500 font-medium">
                  Usually responds within a few hours
                </p>
             </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-20 border-t border-zinc-200 text-center">
           <p className="text-xs font-bold text-zinc-400 uppercase tracking-[0.4em]">Generated by diyaa.ai</p>
        </footer>

      </main>

      {/* FIX 6: MOBILE STICKY BOTTOM BAR */}
      <div className="fixed bottom-6 left-6 right-6 z-50 md:hidden">
         <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl flex gap-3">
            <a 
              href={calLink}
              target="_blank"
              rel="noreferrer"
              className="flex-1 bg-white text-zinc-900 font-bold text-sm py-4 rounded-xl text-center"
            >
              Book Call
            </a>
            <a 
              href={whatsappLink}
              target="_blank"
              rel="noreferrer"
              className="flex-1 border border-zinc-700 text-white font-bold text-sm py-4 rounded-xl text-center"
            >
              WhatsApp
            </a>
          </div>
      </div>

    </div>
  )
}
