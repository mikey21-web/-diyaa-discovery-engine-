import VerticalLandingPage from '@/components/VerticalLanding'

export default function RealEstateAIAudit() {
  return (
    <VerticalLandingPage
      industry="Real Estate"
      slug="real-estate-ai-audit"
      headline="Your Real Estate Business Is Losing ₹1Cr+ to Slow Lead Response"
      subheadline="Indian property buyers expect a response in under 5 minutes. Most teams take 4+ hours. We map exactly where AI closes that gap — free."
      metaTitle="Free AI Audit for Real Estate Businesses in India | diyaa.ai"
      metaDescription="Discover where AI can save your real estate business time and money. Free 10-minute discovery session with a branded implementation roadmap."
      painPoints={[
        "Leads go cold because your team takes 3-4 hours to respond — top performers respond in 5 minutes",
        "Your sales team does 2 follow-ups per lead instead of the 7 that close deals",
        "60-70% of property inquiries come via WhatsApp but you have no automation",
        "Manual site visit scheduling wastes 2-3 hours per agent per day",
        "No system tracks which leads need follow-up — they fall through the cracks",
      ]}
      stats={[
        { value: '50x', label: 'Response time gap vs top performers' },
        { value: '₹4.8Cr', label: 'Potential monthly uplift (200 leads)' },
        { value: '2-3%', label: 'Industry avg conversion without AI' },
      ]}
      industryKey="real_estate"
    />
  )
}
