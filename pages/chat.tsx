import React, { useState, useEffect, useRef, useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, ChevronLeft, Loader2, Shield, ArrowRight } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface LeadFormData {
  name: string
  email: string
}

const ChatPage: React.FC = () => {
  const router = useRouter()
  const { industry } = router.query
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionLoading, setSessionLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [initFailed, setInitFailed] = useState(false)
  const [phase, setPhase] = useState(1)
  const [reportReady, setReportReady] = useState(false)
  const [reportId, setReportId] = useState<string | null>(null)
  const [showLeadForm, setShowLeadForm] = useState(false)
  const [leadForm, setLeadForm] = useState<LeadFormData>({ name: '', email: '' })
  const [leadSubmitting, setLeadSubmitting] = useState(false)
  const [leadSubmitted, setLeadSubmitted] = useState(false)
  const [seedSent, setSeedSent] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const safeId = () => Math.random().toString(36).substring(2, 15)

  const getSeedMessage = useCallback((): string | null => {
    const industryKey = typeof industry === 'string' ? industry : null
    if (!industryKey) return null

    const labelMap: Record<string, string> = {
      real_estate: 'real estate',
      hospitality: 'hospitality',
      d2c_fashion: 'fashion D2C',
      coaching: 'coaching',
      fnb: 'F&B',
      healthcare: 'healthcare',
      logistics: 'logistics',
      retail: 'retail',
    }

    const label = labelMap[industryKey] ?? industryKey.replace(/_/g, ' ')
    return `I run a ${label} business and want to audit where AI can help us first.`
  }, [industry])

  const sendMessage = useCallback(async (userMessage: string, activeSessionId: string) => {
    setMessages(prev => [...prev, { id: safeId(), role: 'user', content: userMessage }])
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: activeSessionId, message: userMessage }),
      })

      const data = await res.json()

      if (data.report_id) {
        setReportId(data.report_id)
      }

      if (data.report_ready) {
        setReportReady(true)
        setPhase(6)
        const reply = data.reply || "Got it. I'm analyzing your data and building your implementation roadmap right now..."
        setMessages(prev => [
          ...prev,
          {
            id: safeId(),
            role: 'assistant',
            content: reply,
          },
        ])
        setIsLoading(false)
        setTimeout(() => setShowLeadForm(true), 1500)
        return
      }

      if (data.error) {
        setMessages(prev => [
          ...prev,
          {
            id: safeId(),
            role: 'assistant',
            content: data.code === 'UPSTREAM_BUSY'
              ? 'Server is busy right now due to high traffic. Please try again in about 30 seconds.'
              : `Error: ${data.error}. Please try again.`,
          },
        ])
      } else {
        const cleanReply = (data.reply as string || '').replace(/\[?SALES_PHASE\]?/g, '').replace(/\[?REPORT_READY\]?/g, '').trim()
      setMessages(prev => [...prev, { id: safeId(), role: 'assistant', content: cleanReply }])
        setPhase(data.phase)
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { id: safeId(), role: 'assistant', content: 'Connection issue. Please try again in a moment.' },
      ])
    }

    setIsLoading(false)
  }, [])

  const initSession = useCallback(async (): Promise<string | null> => {
    if (sessionLoading || sessionId || !router.isReady) return sessionId

    setSessionLoading(true)
    setInitFailed(false)
    try {
      const industryToSend = typeof industry === 'string' ? industry : undefined
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry: industryToSend })
      })
      const data = await res.json() as { session_id?: string; opening_message?: string; error?: string; code?: string }

      if (!res.ok || data.error) {
        const error = new Error(data.error || 'Failed to start session') as Error & { code?: string }
        error.code = data.code
        throw error
      }

      if (!data.session_id || !data.opening_message) {
        throw new Error('Invalid session response')
      }

      setSessionId(data.session_id)
      setMessages([
        {
          id: safeId(),
          role: 'assistant',
          content: data.opening_message,
        },
      ])
      setSessionLoading(false)
      return data.session_id as string
    } catch (err) {
      const error = err as Error & { code?: string }
      const message = error.message.includes('Invalid session')
        ? 'Session failed. Please refresh and try again.'
        : 'Something went wrong. Please refresh the page and try again.'

      setInitFailed(true)
      setMessages([
        {
          id: safeId(),
          role: 'assistant',
          content: message,
        },
      ])
      setSessionLoading(false)
      return null
    }
  }, [sessionLoading, sessionId, router.isReady, industry])

  // Create session on mount
  useEffect(() => {
    if (!sessionId && router.isReady) {
      initSession()
    }
  }, [router.isReady, sessionId, initSession])

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading])

  // Focus input
  useEffect(() => {
    if (!isLoading && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isLoading])

  useEffect(() => {
    const seedMessage = getSeedMessage()
    if (!sessionId || !seedMessage || seedSent || messages.length !== 1 || isLoading) return

    setSeedSent(true)
    // Small delay to show typing indicator and make interaction feel natural
    const timer = setTimeout(() => {
      void sendMessage(seedMessage, sessionId)
    }, 800)
    return () => clearTimeout(timer)
  }, [getSeedMessage, isLoading, messages.length, seedSent, sendMessage, sessionId])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    let activeSessionId = sessionId
    if (!activeSessionId) {
      activeSessionId = await initSession()
    }

    if (!activeSessionId) {
      setMessages(prev => [
        ...prev,
        {
          id: safeId(),
          role: 'assistant',
          content: 'Session is still starting. Please wait a moment and try again.',
        },
      ])
      return
    }

    const userMessage = input.trim()

    setInput('')
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }
    await sendMessage(userMessage, activeSessionId)
  }

  const handleLeadSubmit = async () => {
    if (!leadForm.name || !leadForm.email || !sessionId) return
    setLeadSubmitting(true)

    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          name: leadForm.name,
          email: leadForm.email.trim(),
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to submit lead')
      }
      const data = await res.json()
      setReportId(data.report_id || sessionId)
      setLeadSubmitted(true)
    } catch {
      alert("Failed to submit details. Please try again.")
    }

    setLeadSubmitting(false)
  }

  return (
    <div className="flex flex-col h-screen bg-warm-bg font-sans text-charcoal">
      <Head>
        <title>Discovery Session | Diyaa from diyaa.ai</title>
      </Head>

      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-5 h-12 sm:h-14 bg-warm-bg border-b border-warm-border shrink-0">
        <Link
          href="/"
          className="p-2 -ml-2 hover:bg-warm-cream rounded-lg transition-colors inline-block"
          aria-label="Go back"
        >
          <ChevronLeft className="w-4 h-4 text-warm-muted" />
        </Link>
        <div className="flex flex-col items-center gap-0.5">
          <span className="font-bold text-xs sm:text-sm tracking-tight text-charcoal truncate px-2">Discovery Session</span>
          <span className="text-[8px] sm:text-[10px] uppercase tracking-[0.12em] text-amber font-bold">
            Phase {phase}/6
          </span>
        </div>
        <div className="w-8 h-8 bg-amber-bg border border-amber/20 rounded-full flex items-center justify-center shrink-0">
          <span className="text-amber font-bold text-xs">D</span>
        </div>
      </header>

      {/* Chat Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 sm:p-5 scroll-smooth">
        <div className="max-w-2xl mx-auto space-y-3 sm:space-y-5 pb-16">
          {/* Diyaa intro badge */}
          <div className="text-center pb-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-warm-cream rounded-full border border-warm-border">
              <div className="w-5 h-5 bg-charcoal rounded-full flex items-center justify-center">
                <span className="text-amber text-[9px] font-bold">D</span>
              </div>
              <span className="text-xs font-medium text-warm-muted">Diyaa from diyaa.ai</span>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[75%] p-3 sm:p-4 text-sm sm:text-[15px] leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-charcoal text-warm-bg rounded-xl sm:rounded-2xl rounded-br-none sm:rounded-br-md'
                      : 'bg-white text-charcoal-mid border border-warm-border rounded-xl sm:rounded-2xl rounded-bl-none sm:rounded-bl-md'
                  }`}
                >
                  {msg.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="flex items-center gap-2 px-4 py-3 bg-white border border-warm-border rounded-2xl">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-amber rounded-full animate-pulse-soft" />
                  <span className="w-1.5 h-1.5 bg-amber rounded-full animate-pulse-soft [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 bg-amber rounded-full animate-pulse-soft [animation-delay:0.4s]" />
                </div>
                <span className="text-[11px] text-warm-muted font-medium ml-1">diyaa is thinking</span>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* W5: Retry button on session init failure */}
      {initFailed && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-warm-bg border-t border-warm-border shrink-0 text-center"
        >
          <button
            onClick={initSession}
            className="px-6 py-3 bg-amber text-charcoal font-bold rounded-xl hover:bg-amber-hover transition-all active:scale-[0.98] text-sm"
          >
            Connection failed — tap to retry
          </button>
        </motion.div>
      )}

      {/* Input Area */}
      {!reportReady && (
        <div className="p-3 sm:p-4 bg-warm-bg border-t border-warm-border shrink-0">
          <div className="max-w-2xl mx-auto">
            <div
              className="flex items-end gap-2 bg-white border border-warm-border rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2 sm:py-3
                        focus-within:border-amber/50 focus-within:ring-2 focus-within:ring-amber-bg transition-all"
            >
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="Type your answer..."
                disabled={isLoading}
                className="w-full bg-transparent outline-none resize-none text-sm sm:text-[15px] text-charcoal
                           placeholder:text-warm-muted disabled:opacity-50 leading-relaxed max-h-[120px] sm:max-h-[200px] overflow-y-auto py-1"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                aria-label="Send message"
                className="p-2 text-amber disabled:text-warm-border transition-colors shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-center gap-1.5 mt-3">
              <Shield className="w-3 h-3 text-warm-muted" />
              <p className="text-[10px] text-warm-muted font-medium tracking-wide">
                YOUR SESSION IS SECURE AND PRIVATE
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Lead Capture Modal */}
      <AnimatePresence>
        {showLeadForm && !leadSubmitted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            role="presentation"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl sm:rounded-3xl border border-warm-border p-6 sm:p-8 max-w-md w-full"
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
              aria-describedby="modal-description"
            >
              <div className="text-center mb-4 sm:mb-6">
                <div className="w-12 sm:w-14 h-12 sm:h-14 bg-amber-bg border border-amber/20 rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <span className="text-xl sm:text-2xl">✦</span>
                </div>
                <h3 id="modal-title" className="text-lg sm:text-xl font-bold text-charcoal mb-1">Your AI Report is Ready</h3>
                <p id="modal-description" className="text-xs sm:text-sm text-warm-muted">
                  Where should we send your personalized AI implementation roadmap?
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-charcoal-mid uppercase tracking-wide mb-1 block">
                    Name *
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={leadForm.name}
                    onChange={(e) => setLeadForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Your name"
                    className="w-full px-4 py-3 bg-warm-bg border border-warm-border rounded-xl text-sm
                              text-charcoal placeholder:text-warm-muted outline-none
                              focus:border-amber/50 focus:ring-2 focus:ring-amber-bg transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-charcoal-mid uppercase tracking-wide mb-1 block">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={leadForm.email}
                    onChange={(e) => setLeadForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="you@company.com"
                    className="w-full px-4 py-3 bg-warm-bg border border-warm-border rounded-xl text-sm
                              text-charcoal placeholder:text-warm-muted outline-none
                              focus:border-amber/50 focus:ring-2 focus:ring-amber-bg transition-all"
                  />
                </div>
              </div>

              <button
                onClick={handleLeadSubmit}
                disabled={!leadForm.name || !leadForm.email || leadSubmitting}
                className="w-full mt-5 px-6 py-4 bg-amber text-charcoal font-bold rounded-xl
                           hover:bg-amber-hover transition-all active:scale-[0.98]
                           disabled:opacity-50 disabled:cursor-not-allowed
                           flex items-center justify-center gap-2"
              >
                {leadSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Send My Report'
                )}
              </button>
              <p className="text-[10px] text-warm-muted text-center mt-3">
                We will never share your info. This is between you and diyaa.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Post-lead: show report button */}
      {leadSubmitted && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-warm-bg border-t border-warm-border shrink-0"
        >
          <div className="max-w-2xl mx-auto text-center">
            <Link 
              href={`/report/${reportId || sessionId}`}
              className="px-8 py-4 bg-amber text-charcoal font-bold rounded-2xl
                         hover:bg-amber-hover transition-all active:scale-[0.98]
                         inline-flex items-center justify-center gap-2 mx-auto"
            >
              View Your AI Report
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>
      )}
    </div>
  )
}

export default ChatPage
