import VerticalLandingPage from '@/components/VerticalLanding'

export default function HotelWhatsAppAutomation() {
  return (
    <VerticalLandingPage
      industry="Hotels & Hospitality"
      slug="hotel-whatsapp-automation"
      headline="Your Hotel Is Losing Guests to 2-4 Hour Booking Response Times"
      subheadline="Top hotels respond in under 2 minutes. Yours probably takes hours. We find every gap in your guest experience — free."
      metaTitle="Free AI Audit for Hotels & Hospitality in India | diyaa.ai"
      metaDescription="Reduce no-shows, speed up booking responses, and boost upsells with AI. Free 10-minute audit for hotels and resorts."
      painPoints={[
        "WhatsApp booking inquiries take 2-4 hours to respond — target is under 2 minutes",
        "25-40% of no-shows could be prevented with automated WhatsApp reminders",
        "Repeat guest rate is below 35% with no automated re-engagement",
        "Upsell opportunities (room upgrades, spa, dining) are missed — 15-20% convert via chat",
        "Manual check-in coordination wastes front desk staff hours every day",
      ]}
      stats={[
        { value: '<2 min', label: 'Booking response target' },
        { value: '25-40%', label: 'No-show reduction possible' },
        { value: '15-20%', label: 'Upsell conversion via chat' },
      ]}
    />
  )
}
