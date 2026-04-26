// ========================================
// diyaa.ai — PDF Report Generator
// Uses HTML template rendered to PDF.
// For Vercel deployment, uses html-pdf-node or
// falls back to returning HTML for client-side print.
// ========================================

import { logger } from './logger'
import type { ExtractedData, RevenueLeak, VerticalKey } from './types'
import { getBenchmarksForVertical } from './benchmarks'
import { getScoreInterpretation } from './scoring'

function formatINR(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`
  return `₹${amount.toLocaleString('en-IN')}`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function calculateAnnualLeak(leak: RevenueLeak): number {
  return leak.frequency_per_week * 52 * leak.estimated_cost_inr
}

export function generateReportHTML(
  extractedData: ExtractedData,
  readinessScore: number
): string {
  const vertical = (extractedData.industry || 'other') as VerticalKey
  const benchmarks = getBenchmarksForVertical(vertical)
  const interpretation = getScoreInterpretation(readinessScore)
  const totalLeak = (extractedData.revenue_leaks || []).reduce(
    (sum, leak) => sum + calculateAnnualLeak(leak),
    0
  )
  const dateStr = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://diyaaaa.in'
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '918074228036'
  const calLink = process.env.NEXT_PUBLIC_CAL_LINK || '#'

  const businessName = escapeHtml(extractedData.business_name || extractedData.business || 'Your Business')
  const city = extractedData.city ? escapeHtml(String(extractedData.city)) : ''
  const industryLabel = escapeHtml((extractedData.industry || 'other').replace(/_/g, ' '))
  const toolsLabel = (extractedData.tools_used || []).slice(0, 4).map((t) => escapeHtml(t)).join(', ')
  const painPointsLabel = (extractedData.top_pain_points || []).slice(0, 2).map((p) => escapeHtml(p)).join(' and ')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${businessName} — AI Implementation Report | diyaa.ai</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: #FAFAF8;
      color: #3D3D3D;
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }
    .container { max-width: 800px; margin: 0 auto; padding: 48px 32px; }
    .header {
      display: flex; justify-content: space-between; align-items: flex-start;
      padding-bottom: 32px; border-bottom: 1px solid #E5E2DB; margin-bottom: 40px;
    }
    .logo { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .logo-icon {
      width: 28px; height: 28px; background: #1A1A1A; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      color: #D4A843; font-weight: 700; font-size: 13px;
    }
    .logo-text { font-weight: 700; font-size: 16px; color: #1A1A1A; }
    h1 { font-size: 28px; font-weight: 800; color: #0F0F0F; margin-bottom: 4px; }
    .subtitle { color: #8A8578; font-size: 14px; }
    .subtitle strong { color: #1A1A1A; }
    .meta { text-align: right; font-size: 13px; color: #8A8578; }
    .section { margin-bottom: 40px; }
    .section-title {
      display: flex; align-items: center; gap: 10px;
      font-size: 18px; font-weight: 700; color: #0F0F0F; margin-bottom: 16px;
    }
    .section-num {
      width: 26px; height: 26px; background: #D4A843; color: #fff;
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700;
    }
    .card {
      background: #fff; border: 1px solid #E5E2DB; border-radius: 16px; padding: 24px;
    }
    .card p { line-height: 1.7; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    thead { background: #F5F2EB; }
    th { text-align: left; padding: 12px 16px; font-weight: 600; color: #3D3D3D; }
    th:last-child { color: #D4A843; }
    td { padding: 12px 16px; border-top: 1px solid #E5E2DB; }
    .leak-row {
      display: flex; justify-content: space-between; align-items: center;
      background: #fff; border: 1px solid #E5E2DB; border-radius: 16px;
      padding: 20px 24px; margin-bottom: 12px;
    }
    .leak-desc { font-weight: 500; color: #1A1A1A; }
    .leak-detail { font-size: 13px; color: #8A8578; margin-top: 4px; }
    .leak-amount { font-size: 22px; font-weight: 700; color: #D4A843; }
    .total-leak {
      background: #1A1A1A; border-radius: 16px; padding: 24px; text-align: center;
      margin-top: 16px;
    }
    .total-leak-label { font-size: 13px; color: #8A8578; margin-bottom: 4px; }
    .total-leak-value { font-size: 36px; font-weight: 800; color: #D4A843; }
    .roadmap-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .roadmap-card {
      background: #fff; border: 1px solid #E5E2DB; border-radius: 16px; padding: 24px;
    }
    .roadmap-month { font-size: 11px; font-weight: 700; color: #D4A843; text-transform: uppercase; letter-spacing: 0.1em; }
    .roadmap-title { font-size: 17px; font-weight: 700; color: #0F0F0F; margin: 6px 0 8px; }
    .roadmap-desc { font-size: 13px; color: #3D3D3D; line-height: 1.5; }
    .roadmap-tag {
      display: inline-block; margin-top: 12px; padding: 4px 12px;
      background: #F5F2EB; color: #8A8578; font-size: 11px; border-radius: 20px; font-weight: 500;
    }
    .score-card { text-align: center; }
    .score-value { font-size: 56px; font-weight: 800; color: #0F0F0F; }
    .score-suffix { font-size: 20px; color: #8A8578; }
    .score-tier { font-size: 13px; font-weight: 600; color: #D4A843; text-transform: uppercase; letter-spacing: 0.1em; margin: 8px 0; }
    .score-desc { color: #3D3D3D; max-width: 480px; margin: 0 auto; }
    .score-note { font-size: 12px; color: #8A8578; margin-top: 16px; }
    .cta-section {
      background: #1A1A1A; border-radius: 16px; padding: 32px; text-align: center;
    }
    .cta-text { color: #E5E2DB; margin-bottom: 24px; line-height: 1.7; }
    .cta-buttons { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
    .cta-btn-primary {
      padding: 12px 32px; background: #D4A843; color: #0F0F0F;
      font-weight: 700; border-radius: 12px; text-decoration: none; font-size: 14px;
    }
    .cta-btn-secondary {
      padding: 12px 32px; background: transparent; color: #D4A843;
      font-weight: 700; border-radius: 12px; text-decoration: none; font-size: 14px;
      border: 1px solid #D4A843;
    }
    .footer {
      text-align: center; padding: 32px 0; border-top: 1px solid #E5E2DB;
      font-size: 12px; color: #8A8578;
    }
    @media print {
      body { background: white; }
      .container { padding: 0; }
      .cta-section { break-inside: avoid; }
    }
  </style>
</head>
<body>
<div class="container">
  <!-- Header -->
  <div class="header">
    <div>
      <div class="logo">
        <div class="logo-icon">d</div>
        <span class="logo-text">diyaa.ai</span>
      </div>
      <h1>AI Implementation Report</h1>
      <p class="subtitle">Prepared for <strong>${businessName}</strong>${city ? `, ${city}` : ''}</p>
    </div>
    <div class="meta">
      <p>${dateStr}</p>
      <p style="text-transform:capitalize">${industryLabel}</p>
    </div>
  </div>

  <!-- Section 1: Business Snapshot -->
  <div class="section">
    <div class="section-title"><span class="section-num">1</span> Business Snapshot</div>
    <div class="card">
      <p>${businessName} is a ${industryLabel} business${city ? ` based in ${city}` : ''} with a team of ${extractedData.team_size || 'N/A'}. ${(extractedData.tools_used?.length ?? 0) > 0 ? `They currently use ${toolsLabel} in their daily operations.` : ''} ${(extractedData.top_pain_points?.length ?? 0) > 0 ? `Their primary challenges include ${painPointsLabel}.` : ''}</p>
    </div>
  </div>

  <!-- Section 2: Benchmarks -->
  <div class="section">
    <div class="section-title"><span class="section-num">2</span> Where You Stand vs Top Performers</div>
    <div class="card" style="padding:0; overflow:hidden;">
      <table>
        <thead>
          <tr><th>Metric</th><th>Your Estimate</th><th>Top Performers</th><th>Gap</th></tr>
        </thead>
        <tbody>
          ${benchmarks.lead_response_time_average_india ? `<tr><td>Lead Response Time</td><td>${benchmarks.lead_response_time_average_india}</td><td>${benchmarks.lead_response_time_top}</td><td>${benchmarks.lead_response_time_gap_multiplier} slower</td></tr>` : ''}
          ${benchmarks.conversion_rate_without_automation ? `<tr><td>Conversion Rate</td><td>${benchmarks.conversion_rate_without_automation}</td><td>${benchmarks.conversion_rate_with_automation}</td><td>2-3x lower</td></tr>` : ''}
          ${benchmarks.follow_up_attempts_needed ? `<tr><td>Follow-up Attempts</td><td>${benchmarks.follow_up_attempts_average_team || 2}</td><td>${benchmarks.follow_up_attempts_needed}</td><td>Missing ${(benchmarks.follow_up_attempts_needed || 7) - (benchmarks.follow_up_attempts_average_team || 2)} touches</td></tr>` : ''}
        </tbody>
      </table>
    </div>
    ${benchmarks.stat_source ? `<p style="margin-top:8px; font-size:11px; color:#8A8578;">Sources: ${benchmarks.stat_source}</p>` : ''}
  </div>

  <!-- Section 3: Revenue Leaks -->
  <div class="section">
    <div class="section-title"><span class="section-num">3</span> Revenue Leak Analysis</div>
    ${(extractedData.revenue_leaks || []).map(leak => {
      const annual = calculateAnnualLeak(leak)
      return `<div class="leak-row">
        <div>
          <div class="leak-desc">${escapeHtml(leak.description)}</div>
          <div class="leak-detail">~${leak.frequency_per_week}x/week × ${formatINR(leak.estimated_cost_inr)}/instance</div>
        </div>
        <div class="leak-amount">${formatINR(annual)}/yr</div>
      </div>`
    }).join('')}
    ${totalLeak > 0 ? `<div class="total-leak"><div class="total-leak-label">Total Estimated Annual Revenue Leak</div><div class="total-leak-value">${formatINR(totalLeak)}</div></div>` : ''}
  </div>

  <!-- Section 4: AI Implementation Priorities -->
  <div class="section">
    <div class="section-title"><span class="section-num">4</span> AI Implementation Priorities</div>
    <div style="background:#fff; border:1px solid #E5E2DB; border-radius:16px; overflow:hidden;">
      ${(extractedData.roadmap || []).slice(0, 6).map((item, idx) => `
        <div style="padding:24px; border-bottom:${idx === (extractedData.roadmap?.length || 0) - 1 || idx === 5 ? 'none' : '1px solid #E5E2DB'}; display:flex; justify-content:space-between; align-items:flex-start;">
          <div style="flex:1;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
              <span style="font-weight:700; color:#D4A843; font-size:13px;">#${idx + 1}</span>
              <span style="font-size:16px; font-weight:700; color:#0F0F0F;">${escapeHtml(item.title || '')}</span>
            </div>
            <p style="font-size:13px; color:#3D3D3D; line-height:1.5; margin-bottom:8px;">${escapeHtml(item.what_it_does || '')}</p>
            <div style="display:flex; gap:16px; font-size:12px; color:#8A8578;">
              <span><strong>Build:</strong> ${item.build_time || '2-3 weeks'}</span>
              <span><strong>Impact:</strong> ₹${item.monthly_value_inr ? (item.monthly_value_inr * 12 / 100000).toFixed(0) : '0'}L/year</span>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  </div>

  <!-- Section 5: 90-Day Roadmap -->
  <div class="section">
    <div class="section-title"><span class="section-num">5</span> 90-Day Implementation Timeline</div>
    <div class="roadmap-grid">
      <div class="roadmap-card">
        <div class="roadmap-month">Month 1</div>
        <div class="roadmap-title">Quick Wins</div>
        <div class="roadmap-desc">WhatsApp bot for instant lead response + basic CRM integration</div>
        <span class="roadmap-tag">High ROI, Low Complexity</span>
      </div>
      <div class="roadmap-card">
        <div class="roadmap-month">Month 2</div>
        <div class="roadmap-title">Core Systems</div>
        <div class="roadmap-desc">Voice agent for inbound calls + automated follow-up sequences</div>
        <span class="roadmap-tag">Medium Complexity</span>
      </div>
      <div class="roadmap-card">
        <div class="roadmap-month">Month 3</div>
        <div class="roadmap-title">Intelligence Layer</div>
        <div class="roadmap-desc">Lead scoring, analytics dashboard, AI-generated follow-ups</div>
        <span class="roadmap-tag">Strategic Advantage</span>
      </div>
    </div>
  </div>

  <!-- Section 6: AI Readiness Score -->
  <div class="section">
    <div class="section-title"><span class="section-num">6</span> AI Readiness Score</div>
    <div class="card score-card">
      <span class="score-value">${readinessScore}</span><span class="score-suffix">/10</span>
      <div class="score-tier">${interpretation.tier}</div>
      <p class="score-desc">${interpretation.description}</p>
      <p class="score-note">Most Indian SMBs score between 3-5. You scored ${readinessScore}, which places you in the ${interpretation.tier} tier.</p>
    </div>
  </div>

  <!-- Section 7: Next Steps -->
  <div class="section">
    <div class="section-title"><span class="section-num">7</span> Next Steps</div>
    <div class="cta-section">
      <p class="cta-text">Based on what you have shared, the fastest ROI is automating your lead response and follow-up system. diyaa.ai has built this for multiple ${industryLabel} clients. Book a 30-minute call to see a live demo.</p>
      <div class="cta-buttons">
        <a href="${escapeHtml(calLink)}" class="cta-btn-primary">Book a Call</a>
        <a href="https://wa.me/${escapeHtml(whatsappNumber)}" class="cta-btn-secondary">WhatsApp Uday</a>
      </div>
    </div>
  </div>

  <div class="footer">Generated by diyaa.ai — Get your free AI audit at ${escapeHtml(appUrl.replace(/^https?:\/\//, ''))}</div>
</div>
</body>
</html>`
}
