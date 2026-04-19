# diyaa.ai — AI Discovery Engine

An AI-powered implementation consultant for Indian and UAE SMB founders. Conducts a conversational discovery session and generates a branded, data-backed AI implementation roadmap.

## Quick Start

```bash
# Install dependencies
npm install

# Add your keys to .env.local
# GROQ_API_KEY, SUPABASE URL, SUPABASE keys

# Run the Supabase schema (paste supabase/schema.sql into the SQL Editor)

# Start dev server
npm run dev
```

## Project Structure

```
├── pages/
│   ├── index.tsx                    # Landing page
│   ├── chat.tsx                     # Discovery session UI
│   ├── 404.tsx                      # Custom 404
│   ├── _app.tsx                     # App wrapper
│   ├── _document.tsx                # HTML document head
│   ├── real-estate-ai-audit.tsx     # SEO vertical page
│   ├── restaurant-ai-audit.tsx      # SEO vertical page
│   ├── coaching-business-ai-audit.tsx # SEO vertical page
│   ├── fashion-brand-ai-audit.tsx   # SEO vertical page
│   ├── hotel-whatsapp-automation.tsx # SEO vertical page
│   ├── report/
│   │   └── [id].tsx                 # Shareable report page
│   └── api/
│       ├── session.ts               # POST — create session
│       ├── chat.ts                  # POST — conversation turn
│       ├── report.ts                # POST/GET — fetch report data
│       ├── report-html.ts           # GET — full HTML report for PDF
│       └── lead.ts                  # POST — capture lead + trigger n8n
├── components/
│   └── VerticalLanding.tsx          # Reusable vertical landing template
├── lib/
│   ├── claude.ts                    # Groq API wrapper + system prompt
│   ├── supabase.ts                  # Supabase clients (public + service)
│   ├── benchmarks.ts                # Industry benchmark data
│   ├── scoring.ts                   # AI readiness score calculator
│   ├── pdf.ts                       # HTML report generator
│   ├── logger.ts                    # Production-safe logger
│   └── types.ts                     # All TypeScript types
├── styles/
│   └── globals.css                  # Design system CSS
├── supabase/
│   └── schema.sql                   # Database migration
├── public/
│   ├── sitemap.xml                  # SEO sitemap
│   └── robots.txt                   # Crawler config
├── .env.local                       # Environment variables
├── claude.md                        # Full product spec
├── tailwind.config.ts
├── tsconfig.json
├── next.config.js
└── package.json
```

## Environment Variables

```env
GROQ_API_KEY=               # Get from console.groq.com
NEXT_PUBLIC_SUPABASE_URL=   # Your Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY= # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY=  # Supabase service role key
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WHATSAPP_NUMBER=918074228036
NEXT_PUBLIC_CAL_LINK=       # Cal.com booking link
N8N_WEBHOOK_SECRET=         # n8n webhook auth
N8N_LEAD_WEBHOOK_URL=       # n8n lead webhook endpoint
```

## Supabase Setup

1. Create a new Supabase project
2. Go to SQL Editor
3. Paste the contents of `supabase/schema.sql`
4. Run it
5. Copy your project URL, anon key, and service role key into `.env.local`

## Deploy to Vercel

```bash
npx vercel
```

Set all environment variables in the Vercel dashboard.

## Tech Stack

- **Frontend:** Next.js 14 (Pages Router) + Tailwind CSS + TypeScript
- **AI Engine:** Groq (llama-3.3-70b-versatile)
- **Database:** Supabase (Postgres)
- **Automation:** n8n (WhatsApp follow-ups via Evolution API)
- **Design:** Charcoal/amber palette — no purple gradients

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Main landing page |
| `/chat` | Discovery session with Diyaa |
| `/report/[id]` | Shareable AI implementation report |
| `/real-estate-ai-audit` | SEO vertical page |
| `/restaurant-ai-audit` | SEO vertical page |
| `/coaching-business-ai-audit` | SEO vertical page |
| `/fashion-brand-ai-audit` | SEO vertical page |
| `/hotel-whatsapp-automation` | SEO vertical page |

## API Routes

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/session` | Create new discovery session |
| POST | `/api/chat` | Send message, get AI response |
| POST/GET | `/api/report` | Fetch report data |
| GET | `/api/report-html` | Get full HTML report (for PDF) |
| POST | `/api/lead` | Capture lead + trigger n8n webhook |
