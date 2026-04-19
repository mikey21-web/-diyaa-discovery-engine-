import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-warm-bg font-sans flex items-center justify-center px-6">
      <Head>
        <title>Page Not Found | diyaa.ai</title>
      </Head>
      <div className="text-center">
        <p className="text-6xl font-extrabold text-charcoal mb-4">404</p>
        <p className="text-lg text-warm-muted mb-8">
          This page does not exist. But your AI roadmap is waiting.
        </p>
        <Link href="/">
          <button className="px-6 py-3 bg-charcoal text-warm-bg font-semibold rounded-xl hover:bg-charcoal-soft transition-all flex items-center gap-2 mx-auto">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
        </Link>
      </div>
    </div>
  )
}

export default NotFoundPage
