import React, { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { motion } from 'framer-motion'
import { 
  Flame, 
  AlertTriangle, 
  TrendingUp, 
  Target, 
  Server, 
  Cpu,
  Layers,
  Activity, 
  Zap,
  ArrowRight,
  ClipboardCheck,
  IndianRupee,
  Clock,
  Sparkles,
  Shield
} from 'lucide-react'
import type { ExtractedData, RevenueLeak, PriorityImplementation, InfraItem } from '@/lib/types'
import { logger } from '@/lib/logger'

// Helper functions for the report content
function formatINR(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`
  return `₹${amount.toLocaleString('en-IN')}`
}

function calculateAnnualLeak(leak: RevenueLeak): number {
  return leak.frequency_per_week * 52 * leak.estimated_cost_inr
}

type ReportState = 'loading' | 'ready' | 'generating' | 'error'

interface ReportContentViewProps {
  businessName: string
  industry: string
  city: string | null
  extractedData: ExtractedData
  benchmarkData: Record<string, string> | null
  readiness: { score: number; tier: string; description: string }
  reportUrl: string
  generatedAt: string
}

type ReportData = ReportContentViewProps & { businessName: string }

export default function ReportPage() {
  const router = useRouter()
  const session_id = router.query.id as string

  const [state, setState] = useState<ReportState>('loading')
  const [reportData, setReportData] = useState<ReportData | null>(null)

  useEffect(() => {
    if (!session_id) return
    trackView()
    loadReport()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session_id])

  const trackView = async () => {
    try {
      await fetch('/api/report-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id }),
      })
    } catch (e) {}
  }

  const loadReport = async (attempt = 0) => {
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
      } else {
        // Not ready -> try to generate it
        setState('generating')
        if (attempt < 5) {
          setTimeout(() => {
            loadReport(attempt + 1)
          }, 3000)
        } else {
          setState('error')
        }
      }
    } catch (error) {
      logger.error('Report load error', { error: String(error) })
      if (attempt < 5) {
        setTimeout(() => {
          loadReport(attempt + 1)
        }, 3000)
      } else {
        setState('error')
      }
    }
  }

  // ── LOADING STATE ──────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div style={styles.container}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={styles.card}
        >
          <div style={styles.spinner} />
          <h2 style={styles.title}>Loading your report...</h2>
        </motion.div>
      </div>
    )
  }

  // ── GENERATING STATE ───────────────────────────────────────
  if (state === 'generating') {
    return (
      <div style={styles.container}>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={styles.card}
        >
          <div style={styles.spinner} />
          <h2 style={styles.title}>Analyzing Business Diagnostics</h2>
          <p style={styles.subtitle}>
            Structuring AI Implementation Roadmap... Please wait.
          </p>
        </motion.div>
      </div>
    )
  }

  // ── ERROR STATE ────────────────────────────────────────────
  if (state === 'error' || !reportData) {
    return (
      <div style={styles.container}>
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={styles.card}
        >
          <h2 style={styles.title}>Report taking longer than expected</h2>
          <p style={styles.subtitle}>
            The report is still being generated. Try refreshing in a moment.
          </p>
          <button
            style={styles.button}
            onClick={() => {
              setState('loading')
              loadReport()
            }}
          >
            Try Again
          </button>
          <p style={styles.hint}>
            If this persists, reach out on{' '}
            <a
              href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '918074228036'}`}
              style={styles.link}
            >
              WhatsApp
            </a>
          </p>
        </motion.div>
      </div>
    )
  }

  // ── READY STATE ────────────────────────────────────────────
  return (
    <ReportContentView
      businessName={reportData.businessName}
      industry={reportData.industry}
      city={reportData.city}
      extractedData={reportData.extractedData}
      benchmarkData={reportData.benchmarkData}
      readiness={reportData.readiness}
      reportUrl={reportData.reportUrl}
      generatedAt={reportData.generatedAt}
    />
  )
}

// ── STYLES ─────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAF8',
    fontFamily: "'Inter', -apple-system, sans-serif",
    padding: '20px',
  },
  card: {
    textAlign: 'center' as const,
    maxWidth: '420px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #E5E2DB',
    borderTopColor: '#D4A843',
    borderRadius: '50%',
    margin: '0 auto 24px auto',
    animation: 'spin 1s linear infinite',
  },
  title: {
    fontSize: '20px',
    fontWeight: 700 as const,
    color: '#0F0F0F',
    marginBottom: '8px',
  },
  subtitle: {
    color: '#8A8578',
    fontSize: '14px',
    lineHeight: '1.6',
    marginBottom: '24px',
  },
  button: {
    padding: '12px 32px',
    background: '#D4A843',
    color: '#0F0F0F',
    fontWeight: 700 as const,
    borderRadius: '12px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    marginBottom: '16px',
    transition: 'transform 0.1s',
  },
  hint: {
    color: '#555',
    fontSize: '13px',
  },
  link: {
    color: '#D4A843',
    textDecoration: 'none',
  },
}

// ── ANIMATION VARIANTS ──────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } }
}

// ── REPORT UI ──────────────────────────────────────────────
function ReportContentView({
  businessName,
  industry,
  city,
  extractedData,
  benchmarkData,
  readiness,
  reportUrl,
  generatedAt,
}: ReportContentViewProps) {
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '918074228036'
  const calLink = process.env.NEXT_PUBLIC_CAL_LINK || '#'

  // v5 fields with v4 fallbacks
  const totalAnnualLeak = extractedData.revenue_leak_inr_per_year
    || (extractedData.revenue_leaks || []).reduce(
      (sum: number, leak: RevenueLeak) => sum + calculateAnnualLeak(leak),
      0
    )

  const hoursWasted = extractedData.hours_wasted_per_week || 0
  const currentFire = extractedData.current_fire || ''
  const comingFire = extractedData.coming_fire || ''
  const topPainPoint = extractedData.top_pain_point || ''
  const priority1 = extractedData.priority_1_implementation || null
  const agents = extractedData.layer_1_agents || []
  const automations = extractedData.layer_2_automations || []
  const infra = extractedData.layer_3_infra || null
  const beforeAfter = extractedData.before_after || null
  const painPoints = extractedData.top_pain_points || (topPainPoint ? [topPainPoint] : [])
  const toolsUsed = extractedData.tools_used || infra?.key_integrations || []
  const udayBriefing = extractedData.uday_briefing || ''
  const chatSummary = extractedData.conversation_summary || ''

  const router = useRouter()
  const isAdmin = router.query.admin === 'true'

  const whatsappMessage = encodeURIComponent(
    `Hi Uday, I just finished the AI discovery for ${businessName}. ` +
    `My projected annual leak of ${formatINR(totalAnnualLeak)} caught my attention. ` +
    `Specifically, the ${priority1?.title || 'implementation roadmap'} looks interesting. Let's talk.`
  )

  return (
    <div className="min-h-screen bg-[#FAFAF8] font-sans selection:bg-[#D4A843] selection:text-white pb-20">
      <Head>
        <title>{businessName} — Diagnostic Report | diyaa.ai</title>
        <meta name="description" content={`AI Implementation Report for ${businessName} by diyaa.ai`} />
      </Head>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="max-w-4xl mx-auto px-6 pt-12"
      >
        {/* Header */}
        <motion.header variants={itemVariants} className="mb-14 pb-8 border-b border-[#E5E2DB]/60">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-[#1A1A1A] rounded flex items-center justify-center shadow-lg shadow-black/10">
                  <span className="text-[#D4A843] font-bold text-sm">d</span>
                </div>
                <span className="font-bold tracking-tight text-[#1A1A1A]">diyaa.ai</span>
                <span className="text-[#E5E2DB] mx-2">|</span>
                <span className="text-xs uppercase tracking-widest font-semibold text-[#8A8578]">Diagnostic</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-[#0F0F0F] tracking-tight mb-2">
                Consultation Report
              </h1>
              <p className="text-[#8A8578] text-lg font-medium">
                Prepared exclusively for <span className="text-[#D4A843] font-bold">{businessName}</span>
                {city ? `, ${city}` : ''}
              </p>
            </div>
            <div className="text-left md:text-right text-sm font-medium text-[#8A8578]">
              <p className="flex items-center gap-2 md:justify-end">
                <Clock className="w-4 h-4" /> 
                {new Date(generatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <p className="capitalize mt-1 flex items-center gap-2 md:justify-end">
                <Layers className="w-4 h-4" />
                {industry?.replace(/_/g, ' ')} / Operations
              </p>
            </div>
          </div>
        </motion.header>

        {/* Section 1: Business Snapshot */}
        <motion.section variants={itemVariants} className="mb-14">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-[#F5F2EB] rounded-lg">
              <Target className="w-5 h-5 text-[#D4A843]" />
            </div>
            <h2 className="text-2xl font-bold text-[#0F0F0F]">Business Snapshot</h2>
          </div>
          <div className="bg-white rounded-3xl border border-[#E5E2DB]/60 p-8 shadow-sm">
            <p className="text-[#3D3D3D] text-lg leading-relaxed font-medium">
              {businessName} is a <span className="font-bold">{extractedData.industry?.replace(/_/g, ' ')}</span> business
              {city ? ` based in ${city}` : ''}{extractedData.team_size ? ` with a team of ${extractedData.team_size}` : ''}.
              {toolsUsed?.length > 0
                ? ` Operations are currently running on ${toolsUsed.slice(0, 3).join(', ')}.`
                : ''}
              {painPoints?.length > 0
                ? ` The primary operational bottlenecks identified are ${painPoints.slice(0, 2).join(' and ')}.`
                : ''}
            </p>
          </div>
        </motion.section>

        {/* Section 2: The Diagnosis (v5.0) */}
        {(currentFire || comingFire) && (
          <motion.section variants={itemVariants} className="mb-14">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 bg-[#F5F2EB] rounded-lg">
                <Activity className="w-5 h-5 text-[#D4A843]" />
              </div>
              <h2 className="text-2xl font-bold text-[#0F0F0F]">The Diagnosis</h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              {currentFire && (
                <div className="bg-white rounded-3xl border border-[#E5E2DB]/60 p-8 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full blur-3xl -mr-16 -mt-16 transition-opacity group-hover:opacity-100 opacity-50" />
                  <div className="flex items-center gap-2 mb-4 relative z-10">
                    <Flame className="w-5 h-5 text-red-500" />
                    <h3 className="text-sm font-bold text-red-500 uppercase tracking-widest">Current Fire</h3>
                  </div>
                  <p className="text-[#3D3D3D] leading-relaxed relative z-10 text-base">{currentFire}</p>
                </div>
              )}
              
              {comingFire && (
                <div className="bg-white rounded-3xl border border-[#E5E2DB]/60 p-8 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-50 rounded-full blur-3xl -mr-16 -mt-16 transition-opacity group-hover:opacity-100 opacity-50" />
                  <div className="flex items-center gap-2 mb-4 relative z-10">
                    <AlertTriangle className="w-5 h-5 text-[#D4A843]" />
                    <h3 className="text-sm font-bold text-[#D4A843] uppercase tracking-widest">Coming in 6 Months</h3>
                  </div>
                  <p className="text-[#3D3D3D] leading-relaxed relative z-10 text-base">{comingFire}</p>
                </div>
              )}
            </div>
          </motion.section>
        )}

        {/* Section 3: Revenue Leak Analysis */}
        {((extractedData.revenue_leaks?.length ?? 0) > 0 || totalAnnualLeak > 0) && (
          <motion.section variants={itemVariants} className="mb-14">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 bg-[#F5F2EB] rounded-lg">
                <TrendingUp className="w-5 h-5 text-[#D4A843] rotate-180" /> {/* Arrow pointing down for leak */}
              </div>
              <h2 className="text-2xl font-bold text-[#0F0F0F]">Revenue Extraction Failures</h2>
            </div>
            
            <div className="space-y-3">
              {(extractedData.revenue_leaks || []).map((leak: RevenueLeak, i: number) => {
                const annual = calculateAnnualLeak(leak)
                return (
                  <div key={i} className="bg-white rounded-2xl border border-[#E5E2DB]/60 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 group">
                    <div className="flex-1">
                      <p className="text-lg font-bold text-[#1A1A1A] group-hover:text-[#D4A843] transition-colors">{leak.description}</p>
                      <p className="text-sm font-medium text-[#8A8578] mt-1 flex items-center gap-2">
                        <IndianRupee className="w-3 h-3" />
                        ~{leak.frequency_per_week}x/week × {formatINR(leak.estimated_cost_inr)}
                      </p>
                    </div>
                    <div className="bg-[#FEF2F2] px-6 py-3 rounded-xl border border-red-100 text-right shrink-0">
                      <p className="text-2xl font-black text-red-600 tracking-tight">-{formatINR(annual)}</p>
                      <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Annual Leak</p>
                    </div>
                  </div>
                )
              })}
            </div>
            
            {totalAnnualLeak > 0 && (
              <div className="mt-6 bg-[#1A1A1A] rounded-3xl p-10 text-center relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#D4A843] rounded-full blur-[100px] opacity-10 animate-pulse" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-500 rounded-full blur-[100px] opacity-10" />
                
                {/* Live Pulse Indicator */}
                <div className="absolute top-6 right-8 flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                  <span className="text-[10px] font-black text-red-500 uppercase tracking-tighter">Live Calculation</span>
                </div>

                <p className="text-[#E5E2DB] text-sm uppercase tracking-widest font-semibold mb-2 relative z-10">Total Projected Annual Revenue Leak</p>
                <div className="flex items-center justify-center gap-2 relative z-10">
                  <span className="text-[#D4A843] text-5xl md:text-7xl font-black tracking-tighter transition-transform group-hover:scale-110 duration-500">
                    {formatINR(totalAnnualLeak)}
                  </span>
                </div>
                {hoursWasted > 0 && (
                  <p className="text-[#8A8578] font-medium mt-4 flex items-center justify-center gap-2 relative z-10">
                    <Clock className="w-4 h-4 text-[#D4A843]" />
                    +{hoursWasted} hours/week of manual overhead
                  </p>
                )}
              </div>
            )}
          </motion.section>
        )}

        {/* Section: Priority #1 Implementation (v5.0) */}
        {priority1 && (
          <motion.section variants={itemVariants} className="mb-14">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 bg-[#F5F2EB] rounded-lg">
                <Zap className="w-5 h-5 text-[#D4A843]" />
              </div>
              <h2 className="text-2xl font-bold text-[#0F0F0F]">
                <span className="text-[#D4A843] mr-2">04</span> Priority #1 Implementation
              </h2>
            </div>
            
            <div className="bg-gradient-to-br from-white to-[#FAFAF8] rounded-3xl border border-[#D4A843]/30 p-8 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-[#0F0F0F] mb-3">{priority1.title}</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1 bg-[#1A1A1A] text-white text-xs rounded-md font-bold uppercase tracking-wider">
                      {priority1.layer}
                    </span>
                    <span className="px-3 py-1 bg-[#F5F2EB] text-[#8A8578] text-xs rounded-md font-bold uppercase tracking-wider">
                      {priority1.build_complexity} Build
                    </span>
                    <span className="px-3 py-1 bg-green-50 text-green-700 border border-green-200 text-xs rounded-md font-bold uppercase tracking-wider">
                      {priority1.time_to_value} to value
                    </span>
                  </div>
                </div>
                {priority1.revenue_impact_inr_per_year > 0 && (
                  <div className="text-left md:text-right">
                    <p className="text-3xl font-black text-[#D4A843] tracking-tight">+{formatINR(priority1.revenue_impact_inr_per_year)}</p>
                    <p className="text-xs text-[#8A8578] font-bold uppercase tracking-wider mt-1">Projected Annual Lift</p>
                  </div>
                )}
              </div>
              
              <p className="text-[#3D3D3D] text-lg font-medium leading-relaxed mb-8">{priority1.description}</p>
              
              <div className="grid md:grid-cols-2 gap-6 relative">
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full border border-[#E5E2DB] shadow-md items-center justify-center z-10 hidden md:flex">
                  <ArrowRight className="w-5 h-5 text-[#8A8578]" />
                </div>
                
                <div className="bg-[#FEF2F2] rounded-2xl p-6 border border-red-100 relative">
                  <p className="flex items-center gap-2 text-xs font-black text-red-500 uppercase tracking-widest mb-3">
                    <AlertTriangle className="w-4 h-4" /> Before
                  </p>
                  <p className="text-[#3D3D3D] font-medium leading-relaxed">{priority1.before}</p>
                </div>
                
                <div className="bg-[#F0FDF4] rounded-2xl p-6 border border-green-200 relative">
                  <p className="flex items-center gap-2 text-xs font-black text-green-600 uppercase tracking-widest mb-3">
                    <Sparkles className="w-4 h-4" /> After
                  </p>
                  <p className="text-[#1A1A1A] font-medium leading-relaxed">{priority1.after}</p>
                </div>
              </div>
              
              {priority1.hours_saved_per_week > 0 && (
                <div className="mt-6 flex items-center gap-2 text-sm font-bold text-[#8A8578] bg-white w-fit px-4 py-2 rounded-lg border border-[#E5E2DB]/60">
                  <Clock className="w-4 h-4 text-[#D4A843]" />
                  Recaptures {priority1.hours_saved_per_week} hours per week
                </div>
              )}
            </div>
          </motion.section>
        )}

        {/* Section: Full AI Infrastructure (v5.0) */}
        {(agents.length > 0 || automations.length > 0) && (
          <motion.section variants={itemVariants} className="mb-14">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 bg-[#F5F2EB] rounded-lg">
                <Server className="w-5 h-5 text-[#D4A843]" />
              </div>
              <h2 className="text-2xl font-bold text-[#0F0F0F]">
                <span className="text-[#D4A843] mr-2">05</span> Target Architecture
              </h2>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              {/* Layer 1: Agents */}
              <div className="bg-white rounded-3xl border border-[#E5E2DB]/60 p-6 flex flex-col hover:border-[#D4A843]/50 transition-colors shadow-sm">
                <div className="flex items-center gap-2 mb-6 pb-4 border-b border-[#E5E2DB]/50">
                  <div className="p-2 bg-[#1A1A1A] rounded-md">
                    <Cpu className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-xs font-black text-[#1A1A1A] uppercase tracking-widest">L1: AI Agents</h3>
                </div>
                <div className="space-y-6 flex-1">
                  {agents.length > 0 ? agents.map((a: any, i: number) => (
                    <div key={i} className="relative">
                      <p className="text-sm font-bold text-[#1A1A1A] mb-1">{a.title}</p>
                      <p className="text-sm text-[#8A8578] leading-relaxed">{a.what_it_does}</p>
                    </div>
                  )) : (
                    <p className="text-sm text-[#8A8578] italic">No frontier agents required for Phase 1.</p>
                  )}
                </div>
              </div>
              
              {/* Layer 2: Automations */}
              <div className="bg-white rounded-3xl border border-[#E5E2DB]/60 p-6 flex flex-col hover:border-[#D4A843]/50 transition-colors shadow-sm">
                <div className="flex items-center gap-2 mb-6 pb-4 border-b border-[#E5E2DB]/50">
                  <div className="p-2 bg-[#1A1A1A] rounded-md">
                    <Zap className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-xs font-black text-[#1A1A1A] uppercase tracking-widest">L2: Automations</h3>
                </div>
                <div className="space-y-6 flex-1">
                  {automations.map((a: any, i: number) => (
                    <div key={i}>
                      <p className="text-sm font-bold text-[#1A1A1A] mb-1">{a.title}</p>
                      <p className="text-sm text-[#8A8578] leading-relaxed">{a.what_it_does}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Layer 3: Infra */}
              {infra && (
                <div className="bg-[#1A1A1A] rounded-3xl p-6 flex flex-col shadow-lg shadow-black/5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4A843]/10 rounded-full blur-2xl" />
                  <div className="flex items-center gap-2 mb-6 pb-4 border-b border-[#E5E2DB]/10 relative z-10">
                    <div className="p-2 bg-[#D4A843] rounded-md">
                      <Server className="w-4 h-4 text-[#1A1A1A]" />
                    </div>
                    <h3 className="text-xs font-black text-white uppercase tracking-widest">L3: Core Infra</h3>
                  </div>
                  <div className="flex-1 relative z-10">
                    <p className="text-xs font-bold text-[#D4A843] uppercase tracking-wider mb-2">Command Center</p>
                    <p className="text-sm text-[#E5E2DB] leading-relaxed mb-6">{infra.command_center}</p>
                    
                    {(infra.key_integrations?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-xs font-bold text-[#8A8578] uppercase tracking-wider mb-3">Key Integrations</p>
                        <div className="flex flex-wrap gap-2">
                          {(infra.key_integrations ?? []).map((t: string, i: number) => (
                            <span key={i} className="px-3 py-1.5 bg-white/10 border border-white/10 text-[#E5E2DB] text-xs rounded-md font-medium">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.section>
        )}

        {/* Section: Before/After (v5.0) */}
        {beforeAfter && (beforeAfter.today || beforeAfter.in_90_days) && (
          <motion.section variants={itemVariants} className="mb-14">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 bg-[#F5F2EB] rounded-lg">
                <ClipboardCheck className="w-5 h-5 text-[#D4A843]" />
              </div>
              <h2 className="text-2xl font-bold text-[#0F0F0F]">Operational Timeline</h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              {beforeAfter.today && (
                <div className="bg-white rounded-3xl border border-[#E5E2DB]/60 p-8 shadow-sm">
                  <p className="text-xs font-black text-[#8A8578] uppercase tracking-widest mb-4">State: Today</p>
                  <p className="text-[#3D3D3D] leading-relaxed text-lg font-medium">{beforeAfter.today}</p>
                </div>
              )}
              {beforeAfter.in_90_days && (
                <div className="bg-[#D4A843] rounded-3xl p-8 relative overflow-hidden text-[#0F0F0F]">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full blur-2xl -mr-10 -mt-10" />
                  <p className="text-xs font-black uppercase tracking-widest mb-4 relative z-10 text-white drop-shadow-sm">State: +90 Days</p>
                  <p className="font-bold leading-relaxed text-lg relative z-10">{beforeAfter.in_90_days}</p>
                </div>
              )}
            </div>
          </motion.section>
        )}

        {/* Fallback: 90-Day Roadmap (legacy v4) */}
        {agents.length === 0 && automations.length === 0 && (
          <motion.section variants={itemVariants} className="mb-14">
             {/* Maintained for backwards compatibility */}
            <h2 className="text-2xl font-bold text-[#0F0F0F] mb-5">90-Day Roadmap</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { month: 'Month 1', title: 'Quick Wins', desc: 'WhatsApp bot for instant lead response + basic CRM integration', label: 'High ROI, Low Complexity' },
                { month: 'Month 2', title: 'Core Systems', desc: 'Voice agent for inbound calls + automated follow-up sequences', label: 'Medium Complexity' },
                { month: 'Month 3', title: 'Intelligence Layer', desc: 'Lead scoring, analytics dashboard, AI-generated follow-ups', label: 'Strategic Advantage' },
              ].map((phase, i) => (
                <div key={i} className="bg-white rounded-2xl border border-[#E5E2DB]/60 p-6 shadow-sm">
                  <span className="text-xs font-black text-[#D4A843] uppercase tracking-widest">{phase.month}</span>
                  <h3 className="text-xl font-bold text-[#0F0F0F] mt-2 mb-3">{phase.title}</h3>
                  <p className="text-sm text-[#3D3D3D] leading-relaxed mb-4">{phase.desc}</p>
                  <span className="inline-block px-3 py-1 bg-[#F5F2EB] text-[#8A8578] text-xs rounded-md font-bold">
                    {phase.label}
                  </span>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Section: Benchmark Comparison */}
        {benchmarkData?.lead_response_time_average_india && (
          <motion.section variants={itemVariants} className="mb-14">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 bg-[#F5F2EB] rounded-lg">
                <Target className="w-5 h-5 text-[#D4A843]" />
              </div>
              <h2 className="text-2xl font-bold text-[#0F0F0F]">Market Benchmarks</h2>
            </div>
            
            <div className="bg-white rounded-3xl border border-[#E5E2DB]/60 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#FAFAF8] border-b border-[#E5E2DB]">
                      <th className="p-5 text-sm font-bold text-[#1A1A1A] uppercase tracking-wider">Metric</th>
                      <th className="p-5 text-sm font-bold text-[#1A1A1A] uppercase tracking-wider">Your Baseline</th>
                      <th className="p-5 text-sm font-bold text-[#1A1A1A] uppercase tracking-wider">Top Tier (AI)</th>
                      <th className="p-5 text-sm font-bold text-[#D4A843] uppercase tracking-wider">Gap</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E2DB]/60">
                    {benchmarkData?.lead_response_time_average_india && (
                      <tr className="hover:bg-[#FAFAF8] transition-colors">
                        <td className="p-5 text-sm font-medium text-[#3D3D3D]">Lead Response Time</td>
                        <td className="p-5 text-sm text-[#8A8578]">{benchmarkData.lead_response_time_average_india}</td>
                        <td className="p-5 text-sm text-[#1A1A1A] font-bold">{benchmarkData.lead_response_time_top}</td>
                        <td className="p-5 text-sm text-[#D4A843] font-black">{benchmarkData.lead_response_time_gap_multiplier} slower</td>
                      </tr>
                    )}
                    {benchmarkData?.conversion_rate_without_automation && (
                      <tr className="hover:bg-[#FAFAF8] transition-colors">
                        <td className="p-5 text-sm font-medium text-[#3D3D3D]">Conversion Rate</td>
                        <td className="p-5 text-sm text-[#8A8578]">{benchmarkData.conversion_rate_without_automation}</td>
                        <td className="p-5 text-sm text-[#1A1A1A] font-bold">{benchmarkData.conversion_rate_with_automation}</td>
                        <td className="p-5 text-sm text-[#D4A843] font-black">Sub-optimal</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {benchmarkData?.stat_source && (
              <p className="mt-3 text-xs font-medium text-[#8A8578] flex items-center justify-end gap-1">
                Data Sources: {benchmarkData.stat_source}
              </p>
            )}
          </motion.section>
        )}

        {/* AI Readiness Score */}
        {readiness && (
          <motion.section variants={itemVariants} className="mb-14">
            <div className="bg-[#1A1A1A] rounded-3xl border border-white/10 p-10 text-center relative overflow-hidden">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#D4A843]/20 via-transparent to-transparent opacity-50" />
              
              <div className="relative z-10">
                <p className="text-xs font-black text-[#8A8578] uppercase tracking-widest mb-4">Enterprise AI Readiness Score</p>
                <div className="inline-flex items-baseline gap-1 mb-4">
                  <span className="text-7xl font-black text-white tracking-tighter">{readiness.score}</span>
                  <span className="text-3xl text-[#8A8578] font-bold">/10</span>
                </div>
                <div className="mb-6 flex justify-center">
                  <span className="px-4 py-1.5 bg-[#D4A843] text-[#0F0F0F] rounded-md font-black uppercase tracking-wider text-sm">
                    {readiness.tier}
                  </span>
                </div>
                <p className="text-[#E5E2DB] text-lg font-medium max-w-2xl mx-auto leading-relaxed">{readiness.description}</p>
              </div>
            </div>
          </motion.section>
        )}

        {/* CTA */}
        <motion.section variants={itemVariants} className="mb-14">
          <div className="bg-white rounded-3xl border border-[#D4A843]/30 p-10 text-center shadow-lg shadow-[#D4A843]/5">
            <div className="w-16 h-16 bg-[#F5F2EB] rounded-full flex items-center justify-center mx-auto mb-6">
              <ArrowRight className="w-8 h-8 text-[#D4A843]" />
            </div>
            <h2 className="text-3xl font-black text-[#0F0F0F] tracking-tight mb-4">Ready to architect this?</h2>
            <p className="text-[#3D3D3D] text-lg mb-8 leading-relaxed max-w-2xl mx-auto font-medium">
              We build intelligent systems that eliminate operational bottlenecks. Book a strategic consultation to see how this architecture translates into actual software.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <a
                href={calLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-10 py-4 bg-[#D4A843] text-[#0F0F0F] font-black uppercase tracking-wide rounded-xl hover:bg-[#E5B954] transition-all hover:scale-105"
              >
                Schedule Consultation
              </a>
              <a
                href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-10 py-4 bg-transparent text-[#1A1A1A] font-black uppercase tracking-wide rounded-xl border-2 border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white transition-all"
              >
                Discuss via WhatsApp
              </a>
            </div>
          </div>
        </motion.section>

        {/* Section: Advisor Briefing (Hidden, Admin Only) */}
        {isAdmin && (udayBriefing || chatSummary) && (
          <motion.section 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-14 p-10 bg-[#0F0F0F] rounded-[40px] border-4 border-[#D4A843]/40 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-6">
              <Shield className="w-8 h-8 text-[#D4A843] opacity-20" />
            </div>
            
            <div className="flex items-center gap-3 mb-8">
              <div className="px-3 py-1 bg-[#D4A843] text-[#0F0F0F] text-[10px] font-black uppercase tracking-[0.2em] rounded-full">
                Internal Briefing
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">Advisor Strategy Notes</h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-10">
              {udayBriefing && (
                <div>
                  <h4 className="text-[#D4A843] text-xs font-black uppercase tracking-widest mb-4">Colleague Briefing</h4>
                  <p className="text-[#E5E2DB] leading-relaxed font-medium italic">"{udayBriefing}"</p>
                </div>
              )}
              {chatSummary && (
                <div>
                  <h4 className="text-[#8A8578] text-xs font-black uppercase tracking-widest mb-4">Executive Summary</h4>
                  <p className="text-[#8A8578] leading-relaxed text-sm">{chatSummary}</p>
                </div>
              )}
            </div>
          </motion.section>
        )}

        {/* Footer */}
        <motion.footer variants={itemVariants} className="text-center py-8">
          <p className="text-xs font-bold text-[#8A8578] uppercase tracking-[0.3em] opacity-50">
            Powered by diyaa.ai Executive Engine
          </p>
        </motion.footer>
      </motion.div>
    </div>
  )
}
