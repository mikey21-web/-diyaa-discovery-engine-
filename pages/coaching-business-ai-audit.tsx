import VerticalLandingPage from '@/components/VerticalLanding'

export default function CoachingAIAudit() {
  return (
    <VerticalLandingPage
      industry="Coaching & Consulting"
      slug="coaching-business-ai-audit"
      headline="Your Coaching Business Is Losing 30-40% of Booked Calls to No-Shows"
      subheadline="Without WhatsApp reminders, leads forget. Without a bot, they never book. We map the entire funnel leak — free in 10 minutes."
      metaTitle="Free AI Audit for Coaching Businesses in India | diyaa.ai"
      metaDescription="Stop losing booked calls to no-shows and leads to slow follow-up. Free AI audit for coaching and consulting businesses."
      painPoints={[
        "30-40% of booked calls are no-shows — WhatsApp reminders cut this to 10-15%",
        "Lead-to-call conversion is 15-20% without a bot — with one it jumps to 35-45%",
        "You manually qualify leads over DMs instead of letting a bot pre-qualify 24/7",
        "No follow-up sequence for leads who show interest but don't book",
        "Course/program launch engagement drops off because there's no automated nurture",
      ]}
      stats={[
        { value: '35-45%', label: 'Lead-to-call with AI' },
        { value: '10-15%', label: 'No-show rate' },
        { value: '24/7', label: 'Availability' },
      ]}
      industryKey="coaching"
    />
  )
}
