import VerticalLandingPage from '@/components/VerticalLanding'

export default function RestaurantAIAudit() {
  return (
    <VerticalLandingPage
      industry="Restaurants & F&B"
      slug="restaurant-ai-audit"
      headline="Your Restaurant Is Losing Repeat Customers to Slow Response"
      subheadline="WhatsApp order inquiries go unanswered for hours. Review requests never get sent. We show you exactly where AI changes that — free."
      metaTitle="Free AI Audit for Restaurants & F&B in India | diyaa.ai"
      metaDescription="Find out where AI can save your restaurant time and boost repeat orders. Free 10-minute AI audit with a branded roadmap."
      painPoints={[
        "Order inquiries on WhatsApp take 30+ minutes to answer — target is under 3 minutes",
        "No automated review requests after orders — leaving 40% more reviews on the table",
        "Repeat order rate is 1x when it could be 3x with WhatsApp engagement",
        "Manual reservation and order tracking wastes hours of staff time daily",
        "No system to re-engage customers who haven't ordered in 30+ days",
      ]}
      stats={[
        { value: '3x', label: 'Repeat order rate with WhatsApp' },
        { value: '40%', label: 'More reviews via WhatsApp' },
        { value: '<3 min', label: 'Target order inquiry response' },
      ]}
      industryKey="fnb"
    />
  )
}
