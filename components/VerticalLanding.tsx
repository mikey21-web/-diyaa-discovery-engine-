// ========================================
// diyaa.ai — Vertical Landing Page Template
// Reusable component for industry-specific SEO pages.
// ========================================

import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle } from 'lucide-react'

interface VerticalPageProps {
  industry: string
  headline: string
  subheadline: string
  painPoints: string[]
  stats: Array<{ value: string; label: string }>
  metaTitle: string
  metaDescription: string
  slug: string
  industryKey?: string
}

const VerticalLandingPage: React.FC<VerticalPageProps> = ({
  industry,
  headline,
  subheadline,
  painPoints,
  stats,
  metaTitle,
  metaDescription,
  slug,
  industryKey,
}) => {
  const chatUrl = industryKey ? `/chat?industry=${industryKey}` : '/chat'

  return (
    <div className="min-h-screen bg-warm-bg font-sans">
      <Head>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDescription} />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDescription} />
        <link rel="canonical" href={`https://diyaaaa.in/${slug}`} />
      </Head>

      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-warm-bg/80 backdrop-blur-xl border-b border-warm-border">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-charcoal rounded-lg flex items-center justify-center">
                <span className="text-amber font-bold text-sm">d</span>
              </div>
              <span className="font-bold text-base tracking-tight text-charcoal">diyaa.ai</span>
            </div>
          </Link>
          <Link href={chatUrl} className="px-5 py-2 bg-charcoal text-warm-bg text-sm font-semibold rounded-full hover:bg-charcoal-soft transition-all">
            Start Free Audit
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-block px-4 py-1.5 mb-6 text-xs font-bold tracking-[0.12em] uppercase text-amber bg-amber-bg rounded-full border border-amber/20">
              AI Audit for {industry}
            </span>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-charcoal leading-[1.1] mb-6 text-balance">
              {headline}
            </h1>
            <p className="text-lg text-warm-muted max-w-xl mx-auto mb-8 leading-relaxed">
              {subheadline}
            </p>
            <Link href={chatUrl} className="px-8 py-4 bg-charcoal text-warm-bg font-bold rounded-2xl hover:bg-charcoal-soft transition-all inline-flex items-center gap-2 mx-auto group">
              Get Your Free AI Audit
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="pb-16 px-6">
        <div className="max-w-3xl mx-auto flex flex-wrap justify-center gap-10 py-6 border-y border-warm-border">
          {stats.map((stat, i) => (
            <div key={i} className="text-center">
              <p className="text-2xl font-bold text-charcoal">{stat.value}</p>
              <p className="text-xs text-warm-muted font-medium mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pain Points */}
      <section className="py-16 px-6 bg-warm-cream">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-charcoal mb-8 text-center">
            Common revenue leaks in {industry}
          </h2>
          <div className="space-y-3">
            {painPoints.map((point, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex items-start gap-3 bg-white rounded-xl border border-warm-border p-5"
              >
                <CheckCircle className="w-5 h-5 text-amber shrink-0 mt-0.5" />
                <p className="text-charcoal-mid text-sm leading-relaxed">{point}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="bg-charcoal rounded-3xl p-10 text-center">
            <h2 className="text-2xl font-bold text-warm-bg mb-4">
              Find out exactly what AI can fix in your {industry.toLowerCase()} business
            </h2>
            <p className="text-warm-muted mb-8 max-w-md mx-auto text-sm">
              10 minutes. Free. No signup required. Get a branded implementation roadmap.
            </p>
            <Link href={chatUrl} className="px-10 py-4 bg-amber text-charcoal font-bold rounded-2xl hover:bg-amber-hover transition-all inline-flex">
              Start Free AI Audit
            </Link>
          </div>
        </div>
      </section>

      <footer className="py-8 border-t border-warm-border px-6 text-center">
        <p className="text-xs text-warm-muted">© 2026 diyaa.ai · Built by Uday</p>
      </footer>
    </div>
  )
}

export default VerticalLandingPage
