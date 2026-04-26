import { useState, useRef, useEffect } from 'react'
import type { BusinessModel } from '@/lib/agent/types'

interface PrototypeBotProps {
  businessModel: BusinessModel
}

interface Message {
  role: 'user' | 'bot'
  content: string
  timestamp: Date
}

interface ResponseMapping {
  trigger: string[]
  response: string
}

interface BotConfig {
  name: string
  openingMessage: string
  responses: ResponseMapping[]
}

const PROTOTYPE_RESPONSES: Record<string, BotConfig> = {
  real_estate: {
    name: 'Real Estate - Property Inquiry Bot',
    openingMessage: 'Hi! 👋 Looking for a property? I can help you find the perfect one.',
    responses: [
      { trigger: ['buy', '2bhk', 'apartment', 'bhk', 'flat', 'house'], response: 'Great! I found 12 available 2BHK apartments. Here are the top 3:\n\n1️⃣ Whitefield - ₹48L - 850 sq ft\n2️⃣ Indiranagar - ₹52L - 900 sq ft\n3️⃣ Koramangala - ₹55L - 950 sq ft\n\nWhich area interests you?' },
      { trigger: ['indiranagar', 'indira nagar', '52'], response: '📍 Indiranagar 2BHK\nPrice: ₹52L\nSize: 900 sq ft\nAge: 3 years\nAmenities: Pool, Gym, 24/7 Security\n\nWant to schedule a site visit? I can book you in for tomorrow at 2 PM or 4 PM.' },
      { trigger: ['2 pm', '2pm', 'tomorrow', 'visit', 'schedule'], response: '✅ Site visit confirmed!\nDate: Tomorrow\nTime: 2:00 PM\nLocation: Indiranagar 2BHK\nAgent: Rajesh Kumar (9876543210)\n\nYou\'ll receive a reminder at 1 PM. See you soon! 🏡' },
      { trigger: ['discount', 'offer', 'price', 'deal'], response: 'Great question! We have special offers this month:\n\n🎁 Early bird discount: 2% off if you close by month-end\n🎁 Referral bonus: ₹50K if you refer a friend who buys\n\nThe Indiranagar property qualifies for both! Want to know more?' },
      { trigger: ['how long', 'timeline', 'process', 'time', 'buying'], response: 'The typical timeline:\n\n📋 Documentation: 1-2 weeks\n🏦 Bank approval: 2-3 weeks\n✍️ Registration: 1 week\n\nTotal: 4-6 weeks from site visit to ownership. We handle everything!\n\nAny other questions?' },
    ],
  },
  coaching: {
    name: 'Coaching Business - Lead Qualification Bot',
    openingMessage: 'Hi! 👋 Interested in our coaching program? I can answer your questions!',
    responses: [
      { trigger: ['program', 'course', 'what do you', 'offer'], response: 'We offer 3 programs:\n\n1️⃣ Fundamentals (8 weeks) - ₹15,000\n2️⃣ Advanced (12 weeks) - ₹30,000\n3️⃣ Master (16 weeks) - ₹50,000\n\nEach includes 2 live sessions/week + monthly 1-on-1.\n\nWhich interests you?' },
      { trigger: ['fundamentals', 'questions', 'schedule', 'call'], response: 'Perfect! I\'m scheduling you a 15-min call with our coach to answer everything.\n\n📅 Available slots this week:\nTuesday 3 PM\nWednesday 6 PM\nThursday 2 PM\nFriday 7 PM\n\nWhich works for you?' },
      { trigger: ['tuesday', 'wednesday', 'thursday', 'friday'], response: '✅ Call scheduled!\nCoach: Priya Sharma\nWe\'ll call you on this number. Have your questions ready! 🎯' },
      { trigger: ['miss', 'session', 'can\'t', 'available', 'busy'], response: 'Great question! We offer:\n\n⏱️ Recorded sessions: Access all classes anytime\n📱 Mobile app: Watch at your pace\n💬 Async support: Chat with coaches 24/7\n\nSo even if you miss a live session, you\'re covered!' },
      { trigger: ['price', 'cost', 'expensive', 'afford', 'emi'], response: 'Flexible payment plans:\n\n💳 Full upfront: Get 10% discount\n📅 Monthly installments: 3-month plan available\n🎁 Group discount: 20% off if you bring 2+ friends\n\nLet\'s find an option that works for you!' },
    ],
  },
  fnb: {
    name: 'F&B Restaurant - Table Booking Bot',
    openingMessage: 'Welcome! 🍽️ Reserve a table or order food. I\'m here to help!',
    responses: [
      { trigger: ['book', 'table', 'reservation', 'people', 'seat'], response: 'Great! When would you like to dine?\n\n🕕 Available times:\nTonight at 7:00 PM (6 tables)\nTonight at 8:30 PM (8 tables)\nTomorrow at 7:00 PM (12 tables)\n\nWhich slot works?' },
      { trigger: ['7 pm', '7pm', 'tonight', '8:30'], response: '✅ Table reserved!\nTime: 7:00 PM\nParty size: 4 people\nTable: Near window\n\nWe\'ll hold your table for 15 mins. See you soon! 🎉' },
      { trigger: ['specialty', 'recommend', 'best', 'good', 'menu'], response: 'Our bestsellers 👨‍🍳:\n\n1. Tandoori crab - ₹550 (must-try!)\n2. Butter chicken - ₹350\n3. Grilled salmon - ₹650\n\nWant me to add these to your reservation so they\'re ready when you arrive?' },
      { trigger: ['add', 'yes', 'crab', 'salmon'], response: '✅ Pre-ordered!\nTandoori crab (1) - ₹550\nGrilled salmon (1) - ₹650\nTotal: ₹1,200\n\nYour dishes will be fresh and ready at 7:15 PM! 🍽️' },
      { trigger: ['veg', 'vegetarian', 'vegan'], response: 'Our vegetarian specialties:\n\n🥘 Dal makhani - ₹300\n🥬 Paneer tikka - ₹400\n🍄 Mushroom biryani - ₹350\n\nAll are 5-star rated! Want to reserve these?' },
    ],
  },
  d2c_fashion: {
    name: 'Fashion Brand - Cart Recovery & Upsell Bot',
    openingMessage: 'Hey! 👗 Browse our latest collection or continue with your cart.',
    responses: [
      { trigger: ['dress', 'browse', 'looking', 'cart', 'left'], response: '👗 I remember! You were viewing our Summer Collection.\n\nThe blue summer dress (₹1,299) is still in stock!\n\nWant to add it back to your cart? (Free shipping on orders above ₹1,500)' },
      { trigger: ['ship', 'shipping', 'cost', 'delivery'], response: '📦 Shipping info:\n\nOrders < ₹1,500: ₹99\nOrders ₹1,500 - ₹5,000: FREE\nOrders > ₹5,000: FREE + 5% discount\n\nAdd just ₹200 more items to get FREE shipping! 🚚' },
      { trigger: ['show', 'similar', 'other', 'dresses', 'more'], response: '👗 Similar dresses you might like:\n\n1. Floral print dress - ₹1,399\n2. Striped summer dress - ₹1,199\n3. Casual cotton dress - ₹899\n\nWant to bundle? Buy 2, get 15% off!' },
      { trigger: ['floral', 'buy', 'add', 'take'], response: '🎉 Great choice!\n\nCart:\n- Blue summer dress - ₹1,299\n- Floral print dress - ₹1,399\nSubtotal: ₹2,698\n\n🎁 Bundle discount (15%): -₹405\n📦 Free shipping: -₹99\nFinal total: ₹2,194\n\nReady to checkout?' },
      { trigger: ['checkout', 'yes', 'proceed', 'pay'], response: '✅ Order confirmed!\nOrder ID: #DH82734\nTotal: ₹2,194\nDelivery: 3-5 business days\n\nTrack your order: [link]\nNeed help? Reply here anytime 💬' },
    ],
  },
  healthcare: {
    name: 'Healthcare - Appointment Bot',
    openingMessage: 'Hi! 🏥 Need to book an appointment or have a health query? I\'m here to help.',
    responses: [
      { trigger: ['appointment', 'book', 'doctor', 'consult'], response: 'I can help with that! Which department?\n\n1️⃣ General Medicine\n2️⃣ Dental\n3️⃣ Dermatology\n4️⃣ Orthopedics\n\nOr describe your concern and I\'ll suggest the right specialist.' },
      { trigger: ['general', 'fever', 'cold', 'flu'], response: '🩺 General Medicine appointments:\n\nDr. Sharma - Tomorrow 10:00 AM\nDr. Reddy - Tomorrow 2:30 PM\nDr. Patel - Wednesday 11:00 AM\n\nWhich works best for you?' },
      { trigger: ['tomorrow', 'sharma', '10'], response: '✅ Appointment confirmed!\nDoctor: Dr. Sharma\nDate: Tomorrow\nTime: 10:00 AM\n\nPlease bring your ID and any previous reports. See you soon! 🏥' },
    ],
  },
  education: {
    name: 'Education - Enrollment Bot',
    openingMessage: 'Hello! 📚 Looking for courses or admission info? I can help.',
    responses: [
      { trigger: ['course', 'admission', 'enroll', 'program'], response: 'We offer:\n\n1️⃣ BBA (3 years) - ₹2.5L/year\n2️⃣ MBA (2 years) - ₹4L/year\n3️⃣ B.Tech (4 years) - ₹3L/year\n\nAdmission is open till June 30. Would you like to apply?' },
      { trigger: ['apply', 'how', 'form'], response: '📝 Application process:\n\n1. Fill online form (10 min)\n2. Upload documents\n3. Entrance exam/interview\n4. Admission letter in 48 hours\n\nWant me to send you the link?' },
    ],
  },
}

// Default fallback for unknown industries
const DEFAULT_CONFIG: BotConfig = {
  name: 'AI Business Assistant',
  openingMessage: 'Hi! 👋 I\'m your AI assistant. How can I help you today?',
  responses: [
    { trigger: ['help', 'what', 'how', 'hi', 'hello'], response: 'I can help you with:\n\n📋 Scheduling appointments\n❓ Answering common questions\n🔔 Setting up reminders\n📊 Checking order/booking status\n\nWhat would you like to do?' },
    { trigger: ['schedule', 'book', 'appointment', 'call'], response: '📅 Here are available slots:\n\nTomorrow at 10:00 AM\nTomorrow at 2:00 PM\nWednesday at 11:00 AM\n\nWhich works for you?' },
    { trigger: ['price', 'cost', 'how much'], response: 'I can get you the exact pricing! Let me connect you with our team.\n\n📞 Call: 9876543210\n💬 Or continue chatting here for quick answers.' },
  ],
}

function findBotConfig(industry?: string): BotConfig {
  if (!industry) return DEFAULT_CONFIG
  const key = industry.toLowerCase().replace(/[\s-]+/g, '_')
  return PROTOTYPE_RESPONSES[key] || DEFAULT_CONFIG
}

export default function PrototypeBot({ businessModel }: PrototypeBotProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const botConfig = findBotConfig(businessModel.identity.industry)

  useEffect(() => {
    // Initialize with opening message
    if (messages.length === 0) {
      setMessages([
        {
          role: 'bot',
          content: botConfig.openingMessage,
          timestamp: new Date(),
        },
      ])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    if (!input.trim() || isTyping) return

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setIsTyping(true)

    // Find matching bot response
    const matchedResponse = botConfig.responses.find(r =>
      r.trigger.some(t => input.toLowerCase().includes(t.toLowerCase()))
    )

    const botResponse: Message = {
      role: 'bot',
      content:
        matchedResponse?.response ||
        'That\'s a great question! Let me connect you with our team for more details. In the meantime, is there anything else I can help with?',
      timestamp: new Date(),
    }

    // Simulate typing delay (300-800ms)
    const delay = 300 + Math.random() * 500
    setTimeout(() => {
      setMessages(prev => [...prev, botResponse])
      setIsTyping(false)
    }, delay)

    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="w-full max-w-md mx-auto rounded-2xl shadow-xl overflow-hidden flex flex-col" style={{ height: '520px' }}>
      {/* WhatsApp-style header */}
      <div className="bg-[#075E54] text-white px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-lg">
          🤖
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{botConfig.name}</p>
          <p className="text-xs text-green-200">
            {isTyping ? 'typing...' : 'online'}
          </p>
        </div>
        <div className="flex gap-2 opacity-70">
          <span className="text-sm">📹</span>
          <span className="text-sm">📞</span>
        </div>
      </div>

      {/* Chat messages */}
      <div
        className="flex-1 overflow-y-auto px-3 py-4 space-y-2"
        style={{ background: '#ECE5DD' }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap shadow-sm ${
                msg.role === 'user'
                  ? 'bg-[#DCF8C6] text-gray-900 rounded-tr-none'
                  : 'bg-white text-gray-900 rounded-tl-none'
              }`}
            >
              {msg.content}
              <div className={`text-[10px] mt-1 text-right ${msg.role === 'user' ? 'text-gray-500' : 'text-gray-400'}`}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {msg.role === 'user' && ' ✓✓'}
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white px-4 py-3 rounded-lg rounded-tl-none shadow-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="bg-[#F0F0F0] px-2 py-2 flex items-center gap-2">
        <div className="flex-1 bg-white rounded-full px-4 py-2 flex items-center">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!input.trim() || isTyping}
          className="w-10 h-10 bg-[#075E54] text-white rounded-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#064E46] transition-colors flex-shrink-0"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>

      {/* Demo banner */}
      <div className="bg-blue-50 border-t border-blue-200 px-3 py-2 text-center">
        <p className="text-[11px] text-blue-700">
          ⚡ Live demo — your real bot will use your business data, branding, and workflows
        </p>
      </div>
    </div>
  )
}
