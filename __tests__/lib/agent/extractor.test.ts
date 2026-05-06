import { extractBusinessModelPatchFromMessage } from '@/lib/agent/extractor'
import { EMPTY_BUSINESS_MODEL } from '@/lib/agent/types'

describe('extractBusinessModelPatchFromMessage', () => {
  it('extracts business shape, tools, metrics, owner, and constraints from founder answers', () => {
    const patch = extractBusinessModelPatchFromMessage(
      'We run a real estate business in Hyderabad with a team of 12. Our average deal value is 80 lakh and we do around 25 lakh a month. Most leads come from WhatsApp and referrals. Response time is about 3 hours and no-show rate is 25%. Sales manager handles follow-up in Zoho CRM and Google Sheets. Budget is tight and we are a small team.',
      EMPTY_BUSINESS_MODEL
    )

    expect(patch.identity).toMatchObject({
      industry: 'real_estate',
      city: 'Hyderabad',
      team_size: 12,
    })
    expect(patch.revenue).toMatchObject({
      avg_ticket_inr: 8000000,
      monthly_inr: 2500000,
    })
    expect(patch.workflow?.lead_source).toEqual(expect.arrayContaining(['WhatsApp', 'Referrals']))
    expect(patch.ai_readiness?.tools).toEqual(expect.arrayContaining(['WhatsApp', 'Zoho', 'Google Sheets']))
    expect(patch.stage_metrics).toMatchObject({
      response_time_minutes: 180,
      no_show_rate_pct: 25,
    })
    expect(patch.owner_by_step).toMatchObject({
      follow_up: 'sales manager',
    })
    expect(patch.constraints).toEqual(expect.arrayContaining(['Budget sensitivity', 'Small team bandwidth']))
    expect(patch.ai_readiness?.budget_signal).toBe('low')
  })

  it('extracts conversion and payment metrics with moderate budget and tech signals', () => {
    const patch = extractBusinessModelPatchFromMessage(
      'We are a coaching company in Bangalore. Lead to call conversion rate is 18% and payment completion is 72%. We use Calendly, Gmail and WhatsApp. I handle bookings. If ROI is clear we can invest, and the team is somewhat comfortable with software.',
      EMPTY_BUSINESS_MODEL
    )

    expect(patch.identity).toMatchObject({
      industry: 'coaching',
      city: 'Bengaluru',
    })
    expect(patch.stage_metrics).toMatchObject({
      stage_conversion_pct: 18,
      payment_completion_rate_pct: 72,
    })
    expect(patch.ai_readiness?.tools).toEqual(expect.arrayContaining(['Calendly', 'Gmail', 'WhatsApp']))
    expect(patch.owner_by_step).toMatchObject({
      booking: 'founder',
    })
    expect(patch.ai_readiness?.budget_signal).toBe('medium')
    expect(patch.ai_readiness?.tech_comfort).toBe('medium')
  })
})
