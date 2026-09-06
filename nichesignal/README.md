# NicheSignal

Affiliate niche validation SaaS. Enter a keyword, get a GO / INVESTIGATE / SKIP verdict backed by real search volume, SERP competition, and monetisation data.

---

## Stack

| Layer       | Tech                                        |
|-------------|---------------------------------------------|
| Framework   | Next.js 14 (App Router, TypeScript)         |
| Database    | Supabase (Postgres + Auth + Edge Functions) |
| Cache       | Upstash Redis (24hr TTL per keyword)        |
| Billing     | Stripe (infra in, no gates at launch)       |
| AI          | Anthropic Claude Haiku (NicheCoach)         |
| Deploy      | Vercel                                      |

---

## Local Setup

```bash
# 1. Clone and install
git clone <repo-url> nichesignal
cd nichesignal
npm install

# 2. Copy env template
cp .env.local.example .env.local
# Fill in the values — see Environment Variables section below

# 3. Run dev server
npm run dev
# → http://localhost:3000
```

The app runs in **mock mode** without API keys. All five modules are fully navigable.
Scoring uses deterministic hash-based values (same keyword = same scores) until live API keys are configured.

---

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

### Supabase (required)
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```
Get these from: Supabase Dashboard → Settings → API

### Stripe (optional at launch — infra wired, no gates active)
```
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Upstash Redis (optional — graceful fallback to DB cache only)
```
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```
Create a free Redis database at https://console.upstash.com

### Data APIs (optional at launch — mock mode used when absent)
```
KEYWORDS_EVERYWHERE_API_KEY=ke-...
DATAFORSEO_LOGIN=your@email.com
DATAFORSEO_PASSWORD=...
AMAZON_PA_ACCESS_KEY=AKIA...
AMAZON_PA_SECRET_KEY=...
AMAZON_PA_PARTNER_TAG=lftassoc-21     # Glen's LFT Associates tag
```

### AI
```
ANTHROPIC_API_KEY=sk-ant-...
```
NicheCoach falls back to template-generated narratives if this key is absent.

---

## Supabase Project Setup

### 1. Create a new project
- Go to https://supabase.com/dashboard
- Create new project: `nichesignal` in `eu-west-2` (London)
- Wait for provisioning (~2 min)

### 2. Apply the schema migration
Option A — Supabase Dashboard SQL editor:
- Paste contents of `supabase/migrations/20260905000000_initial_schema.sql`
- Run

Option B — Supabase CLI:
```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

### 3. Deploy Edge Functions

**Set Edge Function secrets first** (Supabase Dashboard → Edge Functions → Manage secrets):
```
KEYWORDS_EVERYWHERE_API_KEY
DATAFORSEO_LOGIN
DATAFORSEO_PASSWORD
AMAZON_PA_ACCESS_KEY
AMAZON_PA_SECRET_KEY
AMAZON_PA_PARTNER_TAG
ANTHROPIC_API_KEY
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

**Deploy functions:**
```bash
npx supabase functions deploy analyse-keyword --no-verify-jwt
npx supabase functions deploy bulk-analyse --no-verify-jwt
npx supabase functions deploy generate-coach --no-verify-jwt
npx supabase functions deploy check-watches --no-verify-jwt
```

Note: `--no-verify-jwt` is used here for simplicity. In production, the edge functions validate the Supabase auth token internally.

### 4. Schedule check-watches (weekly cron)
Supabase Dashboard → Edge Functions → check-watches → Add Schedule:
- Cron expression: `0 8 * * 1` (every Monday 08:00 UTC)

---

## Vercel Deploy

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
# ... add all other vars
```

Or use the Vercel dashboard: Settings → Environment Variables → paste from `.env.local`.

**Stripe webhook URL** (after deploy): `https://nichesignal.vercel.app/api/webhooks/stripe`

---

## API Keys — Where to Get Them

| Key | Where |
|-----|-------|
| Keywords Everywhere | https://keywordseverywhere.com → Account → API |
| DataForSEO | https://dataforseo.com → Register → Dashboard |
| Amazon PA API | https://affiliate-program.amazon.co.uk → Tools → Product Advertising API |
| Anthropic | https://console.anthropic.com → API Keys |
| Upstash Redis | https://console.upstash.com → Create Database → REST API |
| Stripe | https://dashboard.stripe.com → Developers → API keys |

**Glen's Amazon PA setup:** LFT Associates account — use `AMAZON_PA_PARTNER_TAG=lftassoc-21` (verify the actual tag in the Associates dashboard).

---

## Architecture Notes

### Scoring (mock vs live)
- **Mock mode** (no API keys): deterministic FNV-32 hash of keyword → scores. Same keyword always returns same scores. All 5 modules work.
- **Live mode** (API keys set as Edge Function secrets): real search volume (Keywords Everywhere), real SERP DR (DataForSEO), real Amazon commission lookup.
- Transition: set the three API key secrets in Supabase Edge Functions. No code changes needed.

### Caching
Results cached at two layers:
1. Upstash Redis — 24hr TTL, key: `ns:kw:<sha256(keyword)>`
2. Supabase `keyword_analyses` table — 24hr TTL, same hash key

Cache is shared across all authenticated users — one analysis per keyword per 24h period.

### NicheCoach
`analyse-keyword` edge function calls `generate-coach` as a sub-request. Claude Haiku returns JSON with `coachText` (HTML-safe narrative) and `contentAngles` (5 article ideas). Falls back to template angles if Claude is unavailable.

### Scoring algorithm
```
NicheSignal Score = (Demand × 0.40) + (Competition × 0.35) + (Money × 0.25)
```
User can adjust weights in Settings (stored in localStorage). Custom weights are passed with each analyse request.

Competition score is **inverted**: high DR = hard competition = low score. A score of 80 means the SERP is beatable, not tough.

### Google Trends
Requires a self-hosted pytrends wrapper. The `google-trends.ts` client calls `PYTRENDS_API_URL/interest_over_time`. Simplest option: deploy a one-file FastAPI service to Railway or Fly.io:
```python
from fastapi import FastAPI
from pytrends.request import TrendReq
app = FastAPI()

@app.post("/interest_over_time")
def interest(req: dict):
    pt = TrendReq(hl='en-GB', tz=0)
    pt.build_payload(req['keywords'], timeframe=req.get('timeframe','today 12-m'), geo=req.get('geo','GB'))
    df = pt.interest_over_time()
    return {"dates": df.index.strftime('%Y-%m').tolist(), "interest_over_time": {k: df[k].tolist() for k in req['keywords']}}
```
Without this, the edge function falls back to stable trend (no score degradation).

---

## Project Structure

```
nichesignal/
├── app/
│   ├── (auth)/login|signup         # Auth pages
│   ├── (app)/                      # Protected shell
│   │   ├── layout.tsx              # Auth guard + sidebar
│   │   ├── validator/              # Main niche analysis
│   │   ├── projects/[id]/          # Saved analysis management
│   │   ├── bulk/                   # Batch 25-keyword scanner
│   │   ├── watch/                  # Weekly monitoring
│   │   └── settings/               # Weights + API key info
│   └── api/(webhooks)/stripe/      # Stripe webhook receiver
├── components/
│   ├── analysis/                   # Score panels, verdict, coach, angles
│   ├── sidebar/                    # App navigation
│   └── ui/                         # Button, Input primitives
├── lib/
│   ├── scoring/index.ts            # Pure scoring functions
│   ├── supabase/client|server.ts   # Supabase client helpers
│   └── api/                        # API client stubs (ready for keys)
├── supabase/
│   ├── migrations/                 # Schema SQL
│   └── functions/                  # 4 Edge Functions
└── middleware.ts                   # Auth redirect
```
