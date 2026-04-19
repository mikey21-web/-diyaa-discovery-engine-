import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, MessageSquare, TrendingUp, Zap, ChevronRight } from 'lucide-react'

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-warm-bg font-sans selection:bg-amber-bg selection:text-charcoal">
      <Head>
        <title>Free AI Implementation Audit for Indian Businesses | diyaa.ai</title>
        <meta
          name="description"
          content="Find out exactly where AI can save you time and money — free 10-minute AI discovery session built for Indian SMBs."
        />
        <meta property="og:title" content="diyaa.ai — AI Discovery Engine" />
        <meta property="og:description" content="Stop guessing where AI fits. Get a data-backed roadmap in 10 minutes." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-warm-bg/80 backdrop-blur-xl border-b border-warm-border">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-charcoal rounded-lg flex items-center justify-center">
              <span className="text-amber font-bold text-sm">d</span>
            </div>
            <span className="font-bold text-base tracking-tight text-charcoal">diyaa.ai</span>
          </div>
          <Link href="/chat">
            <button
              className="px-5 py-2 bg-charcoal text-warm-bg text-sm font-semibold rounded-full
                         hover:bg-charcoal-soft transition-all active:scale-95"
            >
              Start Free Audit
            </button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <span className="inline-block px-4 py-1.5 mb-8 text-xs font-bold tracking-[0.15em] uppercase text-amber bg-amber-bg rounded-full border border-amber/20">
              95.6% of Indian SMBs are planning AI adoption
            </span>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-charcoal leading-[1.1] mb-6 text-balance">
              Find Out Exactly Where AI
              <br />
              <span className="text-amber">Fits in Your Business</span>
            </h1>

            <p className="text-lg text-warm-muted max-w-xl mx-auto mb-10 leading-relaxed">
              Stop guessing. Get a data-backed implementation roadmap
              in 10 minutes — free, branded, and specific to your operations.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/chat">
                <button
                  className="w-full sm:w-auto px-8 py-4 bg-charcoal text-warm-bg font-bold rounded-2xl text-base
                             hover:bg-charcoal-soft transition-all active:scale-[0.98]
                             flex items-center justify-center gap-2 group"
                >
                  Start Discovery Session
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </Link>
              <button
                className="w-full sm:w-auto px-8 py-4 bg-transparent text-charcoal-mid font-semibold rounded-2xl text-base
                           border border-warm-border hover:border-warm-muted transition-all"
              >
                See Sample Report
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.8 }}
        className="pb-20 px-6"
      >
        <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-8 md:gap-16 py-8 border-y border-warm-border">
          {[
            { value: '₹1.8Cr+', label: 'Revenue leaks identified' },
            { value: '450+', label: 'Businesses audited' },
            { value: '95.6%', label: 'Plan AI adoption in 2025' },
          ].map((stat, i) => (
            <div key={i} className="text-center min-w-[120px]">
              <p className="text-2xl md:text-3xl font-bold text-charcoal">{stat.value}</p>
              <p className="text-xs text-warm-muted font-medium mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </motion.section>

      {/* How it Works */}
      <section id="how-it-works" className="py-20 px-6 bg-warm-cream">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-charcoal mb-3">Not a quiz. A real audit.</h2>
            <p className="text-warm-muted max-w-lg mx-auto">
              Our AI consultant, Diyaa, conducts a 10-minute cross-examination of your operations.
              You get a McKinsey-level report — for free.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <MessageSquare className="w-5 h-5" />,
                title: 'Deep Discovery',
                desc: 'A conversational cross-examination — not a form — that uncovers exactly where you are losing time and money.',
              },
              {
                icon: <TrendingUp className="w-5 h-5" />,
                title: 'Revenue Leak Map',
                desc: 'We quantify every revenue leak in rupees. Slow lead response, missed follow-ups, manual processes — all mapped.',
              },
              {
                icon: <Zap className="w-5 h-5" />,
                title: '90-Day Roadmap',
                desc: 'A prioritized month-by-month plan ranked by ROI and complexity. What to build first, second, and third.',
              },
            ].map((card, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -4 }}
                transition={{ type: 'spring', stiffness: 400 }}
                className="bg-white rounded-2xl border border-warm-border p-7"
              >
                <div className="w-10 h-10 bg-amber-bg border border-amber/20 text-amber rounded-xl flex items-center justify-center mb-5">
                  {card.icon}
                </div>
                <h3 className="text-lg font-bold text-charcoal mb-2">{card.title}</h3>
                <p className="text-sm text-warm-muted leading-relaxed">{card.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Verticals */}
      <section id="benchmarks" className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-charcoal mb-3">Built for Indian verticals</h2>
            <p className="text-warm-muted">
              Real benchmarks. Real data. Tailored to your industry.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {[
              'Real Estate', 'Hospitality', 'Fashion D2C', 'Coaching',
              'F&B', 'Healthcare', 'Logistics', 'Retail',
            ].map((vertical, i) => (
              <Link key={i} href="/chat">
                <div className="bg-white rounded-xl border border-warm-border px-5 py-4 text-center
                              hover:border-amber/40 hover:bg-amber-bg transition-all cursor-pointer group">
                  <span className="text-sm font-semibold text-charcoal-mid group-hover:text-charcoal transition-colors">
                    {vertical}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-warm-muted mx-auto mt-1 group-hover:text-amber transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="bg-charcoal rounded-3xl p-10 md:p-14">
            <h2 className="text-2xl md:text-3xl font-bold text-warm-bg mb-4">
              10 minutes. Zero cost. Full clarity.
            </h2>
            <p className="text-warm-muted mb-8 max-w-md mx-auto">
              Join 450+ Indian founders who have mapped their AI opportunity.
              Your personalized report is waiting.
            </p>
            <Link href="/chat">
              <button
                className="px-10 py-4 bg-amber text-charcoal font-bold rounded-2xl text-base
                           hover:bg-amber-hover transition-all active:scale-[0.98]
                           flex items-center justify-center gap-2 mx-auto group"
              >
                Start Free AI Audit
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 border-t border-warm-border px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-charcoal rounded-md flex items-center justify-center">
              <span className="text-amber font-bold text-xs">d</span>
            </div>
            <span className="font-semibold text-sm text-charcoal">diyaa.ai</span>
          </div>
          <p className="text-xs text-warm-muted">
            © 2026 diyaa.ai · Built by Uday · All rights reserved
          </p>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
