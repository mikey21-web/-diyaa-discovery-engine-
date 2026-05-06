# diyaa.ai Discovery Engine — Deployment Checklist

## Step 1: Local Environment Setup

Copy `.env.local.example` to `.env.local`:
```bash
cp .env.local.example .env.local
```

Fill in each variable:

### OpenAI
```
OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE
```
Get from: https://platform.openai.com/account/api-keys

### Supabase
```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
Get from: Supabase dashboard → Settings → API

Run migration (one time):
```bash
npm run db:migrate
```

### Gmail (for lead emails + cron follow-ups)
```
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
ADMIN_EMAIL=your-email@gmail.com
```

Steps:
1. Enable 2-factor auth on Gmail account
2. Go to https://myaccount.google.com/apppasswords
3. Select Mail + Windows (or your device)
4. Copy the 16-char password (spaces included)
5. Paste into GMAIL_APP_PASSWORD

### URLs
```
NEXT_PUBLIC_APP_URL=https://diyaa-ai-engine.vercel.app
NEXT_PUBLIC_CAL_LINK=https://cal.com/uday-diyaa
NEXT_PUBLIC_WHATSAPP_NUMBER=918074228036
```

### Cron Secret (local)
```
CRON_SECRET=any-random-string-here
```

## Step 2: Local Testing

Start dev server:
```bash
npm run dev
```

Test flow:
1. Go to http://localhost:3000
2. Start a chat session
3. Complete discovery (6 phases)
4. Verify report generates
5. Verify email sends (check Gmail inbox)

## Step 3: GitHub Push

```bash
git push origin main
```

## Step 4: Vercel Deployment

### Option A: Auto-deploy from GitHub
1. Go to https://vercel.com
2. Import project from GitHub
3. Add environment variables (Step 1 values):
   - OPENAI_API_KEY
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - GMAIL_USER
   - GMAIL_APP_PASSWORD
   - ADMIN_EMAIL
   - NEXT_PUBLIC_APP_URL
   - NEXT_PUBLIC_CAL_LINK
   - CRON_SECRET
4. Click Deploy

### Option B: Manual via CLI
```bash
npm i -g vercel
vercel login
vercel --prod
```

## Step 5: Verify Deployment

1. Visit https://diyaa-ai-engine.vercel.app (or your custom domain)
2. Run a test session
3. Verify report generates
4. Check Vercel dashboard → Crons (shows daily 8 AM UTC run)

## Step 6: Custom Domain (Optional)

If using diyaaaa.in:
1. Vercel dashboard → Settings → Domains
2. Add diyaaaa.in
3. Update DNS records (Vercel shows exact steps)
4. Update NEXT_PUBLIC_APP_URL in Vercel env vars

## Step 7: Monitor

- Vercel dashboard: Crons tab (check daily 8 AM runs)
- Vercel dashboard: Logs (real-time execution)
- Gmail: Check for automated follow-up emails daily

## Cron Follow-up Flow

- Daily 8 AM IST (2:30 AM UTC): `/api/cron/follow-ups` runs
- Finds leads from last 48 hours (status='new')
- For each lead:
  - If report viewed (view_count > 0): Send "book a call" email
  - If NOT viewed: Send "check your roadmap" reminder
- Updates lead status to 'contacted'

## Troubleshooting

**Report not generating:**
- Check Supabase connection (NEXT_PUBLIC_SUPABASE_URL correct?)
- Check logs: `npx vercel logs` (for Vercel) or browser console (local)

**Emails not sending:**
- Verify Gmail app password is correct (16 chars with spaces)
- Check 2-factor auth is enabled on Gmail
- Check GMAIL_USER is the account with 2FA

**Cron not running:**
- Verify CRON_SECRET is set in Vercel env
- Check Vercel dashboard → Crons (shows history)
- Verify endpoint is accessible: visit `/api/cron/follow-ups` (should require auth)

---

**You're live once all steps are done.**
