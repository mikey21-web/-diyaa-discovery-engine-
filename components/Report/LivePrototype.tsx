'use client'
import { useState } from 'react'

interface Props {
  sessionId: string
  prototypeId?: string
}

interface ProvisionResult {
  prototype_id: string
  sandbox_url: string
  whatsapp_qr?: string
  status: string
}

export default function LivePrototype({ sessionId, prototypeId }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'live' | 'error'>('idle')
  const [result, setResult] = useState<ProvisionResult | null>(null)

  async function provision() {
    setState('loading')
    try {
      const res = await fetch('/api/prototype/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      })
      if (!res.ok) throw new Error('Provision failed')
      const data = await res.json() as ProvisionResult
      setResult(data)
      setState('live')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl border border-emerald-100 p-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0 text-xl">
          📱
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900">Try Your Lead Responder AI</h3>
          <p className="text-sm text-gray-500 mt-1">
            We built a WhatsApp bot from your session — configured for your industry, your voice, your workflow. Try it live right now.
          </p>

          {state === 'idle' && (
            <button
              onClick={provision}
              className="mt-4 px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors"
            >
              Launch My AI Assistant →
            </button>
          )}

          {state === 'loading' && (
            <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
              <Spinner />
              Setting up your bot instance...
            </div>
          )}

          {state === 'live' && result && (
            <div className="mt-4 space-y-4">
              {result.whatsapp_qr ? (
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Scan to chat with your AI</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={result.whatsapp_qr}
                      alt="WhatsApp QR code"
                      className="w-40 h-40 rounded-xl border border-gray-200"
                    />
                  </div>
                  <div className="text-sm text-gray-500 pt-2">
                    <p className="font-medium text-gray-700">Your bot is live for 24 hours.</p>
                    <p className="mt-1">Send a message as if you were a lead and see how it responds.</p>
                    <p className="mt-3 text-xs text-gray-400">Powered by diyaa.ai + Evolution API</p>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 rounded-xl p-4 text-sm text-emerald-800">
                  <p className="font-semibold">Your bot is provisioned!</p>
                  <p className="mt-1 text-emerald-700">
                    Connect your WhatsApp to deploy it live. Our team will set this up on your call.
                  </p>
                </div>
              )}

              <button
                onClick={() => window.open(`${process.env.NEXT_PUBLIC_CAL_LINK || 'https://cal.com/uday-diyaa'}`, '_blank')}
                className="px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors"
              >
                Deploy This Live — Book a Call
              </button>
            </div>
          )}

          {state === 'error' && (
            <div className="mt-4">
              <p className="text-sm text-red-600">Could not launch prototype right now. Book a call and we&apos;ll demo it live.</p>
              <button
                onClick={provision}
                className="mt-2 text-sm text-emerald-600 underline"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>

      {prototypeId && state === 'idle' && (
        <p className="mt-4 text-xs text-gray-400">Prototype ID: {prototypeId}</p>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-emerald-600" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}
