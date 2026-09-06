import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { Redis } from "npm:@upstash/redis"

// ── Types (inlined — edge functions are isolated bundles) ───────────────────

type NicheCategory = 'tech'|'health'|'pet'|'sports'|'home'|'baby'|'travel'|'finance'|'beauty'|'general'
type TrendDirection = 'rising'|'stable'|'falling'
type Verdict = 'GO'|'INVESTIGATE'|'SKIP'

interface AnalysisResult {
  keyword:           string
  keywordHash:       string
  category:          NicheCategory
  demandScore:       number
  competitionScore:  number
  moneyScore:        number
  overallScore:      number
  verdict:           Verdict
  trendDirection:    TrendDirection
  searchVolume:      number
  cpc:               number
  avgDR:             number
  bigBrandPct:       number
  amazonCommission:  number
  hasForumResults:   boolean
  coachText:         string
  contentAngles:     string[]
  affiliateProgrammes: AffiliateRow[]
  cachedAt:          string
  fromCache:         boolean
}

interface AffiliateRow {
  name:           string
  commissionRate: string
  network:        string
  type:           string
}

// ── Category detection ───────────────────────────────────────────────────────

const CATEGORY_TERMS: Record<NicheCategory, string[]> = {
  tech:    ['laptop','headphone','phone','tablet','camera','drone','robot','vacuum','smart','gadget','monitor','keyboard','mouse','speaker','earphone','earbud','projector','router','electric','charging','battery','mechanical'],
  health:  ['supplement','vitamin','weight loss','protein','collagen','probiotic','diet','detox','keto','fat burn','muscle','cbd','sleep','testosterone','hair loss','nootropic'],
  pet:     ['dog','cat','pet','puppy','kitten','fish','hamster','rabbit','paw','collar','leash','treat'],
  sports:  ['gym','fitness','yoga','cycling','bike','running','hiking','camping','fishing','golf','tennis','swim','surf','ski','paddle','exercise','workout','treadmill','dumbbell','kettlebell'],
  home:    ['kitchen','air fryer','coffee','blender','toaster','mattress','pillow','furniture','sofa','desk','lamp','curtain','rug','storage','cleaning','garden','tool','drill'],
  baby:    ['baby','toddler','infant','newborn','stroller','pram','carseat','nappy','diaper','teether','nursery'],
  travel:  ['travel','luggage','suitcase','backpack','passport','hotel','flight','vacation','holiday','tour','cruise'],
  finance: ['invest','trading','stock','crypto','bitcoin','forex','insurance','loan','mortgage','credit','savings','pension'],
  beauty:  ['skin','serum','moisturiser','makeup','lipstick','mascara','foundation','concealer','shampoo','conditioner','perfume','fragrance','nail'],
  general: [],
}

function detectCategory(kw: string): NicheCategory {
  const k = kw.toLowerCase()
  for (const [cat, terms] of Object.entries(CATEGORY_TERMS) as [NicheCategory, string[]][]) {
    if (cat === 'general') continue
    if (terms.some(t => k.includes(t))) return cat
  }
  return 'general'
}

// ── Scoring (deterministic fallback when APIs unavailable) ───────────────────

const PROFILES: Record<NicheCategory, { d:[number,number]; c:[number,number]; m:[number,number] }> = {
  tech:    { d:[70,92], c:[38,68], m:[72,92] },
  health:  { d:[75,95], c:[5,22],  m:[55,76] },
  pet:     { d:[60,84], c:[46,72], m:[68,88] },
  sports:  { d:[50,78], c:[46,72], m:[52,76] },
  home:    { d:[62,88], c:[42,68], m:[65,85] },
  baby:    { d:[55,74], c:[44,66], m:[60,78] },
  travel:  { d:[65,88], c:[15,36], m:[42,66] },
  finance: { d:[80,96], c:[4,16],  m:[70,90] },
  beauty:  { d:[65,88], c:[28,52], m:[60,82] },
  general: { d:[46,78], c:[36,68], m:[48,74] },
}

function fnv32(kw: string, salt: string): number {
  let h = 2166136261
  const str = (kw + salt).toLowerCase()
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h / 4294967295
}

function mockScore(kw: string, salts: [string,string], range: [number,number]): number {
  const v = (fnv32(kw, salts[0]) + fnv32(kw, salts[1])) / 2
  return Math.round(range[0] + v * (range[1] - range[0]))
}

function clamp(n: number): number { return Math.max(0, Math.min(100, n)) }

function mockAnalyse(keyword: string) {
  const cat = detectCategory(keyword)
  const p   = PROFILES[cat]
  const d   = mockScore(keyword, ['d1','d2'], p.d)
  const c   = mockScore(keyword, ['c1','c2'], p.c)
  const m   = mockScore(keyword, ['m1','m2'], p.m)
  const score = clamp(Math.round(d * 0.40 + c * 0.35 + m * 0.25))
  const verdict: Verdict = score >= 70 ? 'GO' : score >= 40 ? 'INVESTIGATE' : 'SKIP'
  const sv  = Math.round(800 + fnv32(keyword,'sv') * 94200)
  const cpc = parseFloat((0.25 + fnv32(keyword,'cpc') * 4.75).toFixed(2))
  const avgDR = Math.round(100 - c * 0.85)
  const bigBrandPct = Math.round((1 - c / 100) * 65 + 12)
  const hasForumResults = c > 55
  const tr = fnv32(keyword,'tr')
  const trend: TrendDirection = d > 75 ? (tr > 0.5 ? 'rising' : 'stable') : (tr > 0.7 ? 'stable' : 'falling')
  return { cat, d, c, m, score, verdict, sv, cpc, avgDR, bigBrandPct, hasForumResults, trend }
}

// ── sha256 keyword hash ──────────────────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('')
}

// ── Live API calls ───────────────────────────────────────────────────────────

async function fetchKeywordsEverywhere(keyword: string, apiKey: string) {
  const params = new URLSearchParams()
  params.append('kw[]', keyword)
  params.append('metrics_location[]', '2826')  // UK
  params.append('metrics_language[]', 'en')
  params.append('metrics_currency', 'GBP')
  params.append('dataSource', 'gkp')

  const res = await fetch('https://api.keywordseverywhere.com/v1/get_keyword_data', {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' },
    body:    params,
  })
  if (!res.ok) throw new Error(`KE API ${res.status}`)
  const json = await res.json()
  return json.data?.[0] ?? null
}

async function fetchDataForSEO(keyword: string, login: string, password: string) {
  const auth = 'Basic ' + btoa(`${login}:${password}`)
  const res = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
    method:  'POST',
    headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
    body: JSON.stringify([{
      keyword,
      location_code: 2826,
      language_code: 'en',
      depth: 10,
      device: 'desktop',
    }]),
  })
  if (!res.ok) throw new Error(`DataForSEO ${res.status}`)
  const json = await res.json()
  return json.tasks?.[0]?.result?.[0]?.items?.filter((i: {type:string}) => i.type === 'organic') ?? []
}

// ── Affiliate programmes from DB ─────────────────────────────────────────────

async function getAffiliateProgs(
  supabase: ReturnType<typeof createClient>,
  category: string,
): Promise<AffiliateRow[]> {
  const { data } = await supabase
    .from('affiliate_programmes')
    .select('name, commission_rate, network, type')
    .eq('category', category)
    .eq('active', true)
    .limit(5)

  return (data ?? []).map((r: Record<string,string>) => ({
    name:           r.name,
    commissionRate: r.commission_rate,
    network:        r.network,
    type:           r.type,
  }))
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const { keyword: rawKeyword, weights } = await req.json()
    if (!rawKeyword?.trim()) {
      return new Response(JSON.stringify({ error: 'keyword required' }), { status: 400 })
    }

    const keyword     = rawKeyword.trim().toLowerCase()
    const keywordHash = await sha256(keyword)

    // ── Supabase client (service role for cache writes) ──────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ── Redis cache check ────────────────────────────────────────────────────
    const redisUrl   = Deno.env.get('UPSTASH_REDIS_REST_URL')
    const redisToken = Deno.env.get('UPSTASH_REDIS_REST_TOKEN')

    let redis: Redis | null = null
    if (redisUrl && redisToken) {
      redis = new Redis({ url: redisUrl, token: redisToken })
      const cached = await redis.get<AnalysisResult>(`ns:kw:${keywordHash}`)
      if (cached) {
        return new Response(JSON.stringify({ ...cached, fromCache: true }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        })
      }
    }

    // ── DB cache check (24h) ─────────────────────────────────────────────────
    const { data: dbCached } = await supabase
      .from('keyword_analyses')
      .select('*')
      .eq('keyword_hash', keywordHash)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (dbCached) {
      const result: AnalysisResult = {
        keyword:           dbCached.keyword,
        keywordHash,
        category:          dbCached.category,
        demandScore:       dbCached.demand_score,
        competitionScore:  dbCached.competition_score,
        moneyScore:        dbCached.money_score,
        overallScore:      dbCached.overall_score,
        verdict:           dbCached.verdict,
        trendDirection:    dbCached.trend_direction,
        searchVolume:      dbCached.search_volume,
        cpc:               dbCached.cpc,
        avgDR:             dbCached.avg_dr,
        bigBrandPct:       0,
        amazonCommission:  dbCached.amazon_commission,
        hasForumResults:   false,
        coachText:         dbCached.coach_text,
        contentAngles:     dbCached.content_angles ?? [],
        affiliateProgrammes: dbCached.affiliate_programmes ?? [],
        cachedAt:          dbCached.cached_at,
        fromCache:         true,
      }
      if (redis) await redis.setex(`ns:kw:${keywordHash}`, 86400, result)
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    // ── Live scoring ─────────────────────────────────────────────────────────
    const keKey     = Deno.env.get('KEYWORDS_EVERYWHERE_API_KEY')
    const dfsLogin  = Deno.env.get('DATAFORSEO_LOGIN')
    const dfsPass   = Deno.env.get('DATAFORSEO_PASSWORD')

    let demandScore: number, competitionScore: number, moneyScore: number
    let searchVolume: number, cpc: number, avgDR: number
    let bigBrandPct: number, hasForumResults: boolean, trendDirection: TrendDirection
    let category: NicheCategory
    let amazonCommission = 4.0  // default

    if (keKey && dfsLogin && dfsPass) {
      // ── Live API path ───────────────────────────────────────────────────
      const [keData, serpItems] = await Promise.allSettled([
        fetchKeywordsEverywhere(keyword, keKey),
        fetchDataForSEO(keyword, dfsLogin, dfsPass),
      ])

      const ke   = keData.status === 'fulfilled' ? keData.value : null
      const serp = serpItems.status === 'fulfilled' ? serpItems.value : []

      searchVolume = ke?.vol ?? 0
      cpc          = parseFloat(ke?.cpc?.value ?? '0')
      category     = detectCategory(keyword)

      // Compute DR from SERP
      const drValues = (serp as Array<{domain_rank?: number}>)
        .slice(0,10)
        .map(i => i.domain_rank ?? 0)
        .filter((dr: number) => dr > 0)
      avgDR = drValues.length > 0
        ? Math.round(drValues.reduce((a: number,b: number) => a+b, 0) / drValues.length)
        : 30

      const bigBrandDomains = new Set(['amazon.co.uk','amazon.com','walmart.com','currys.co.uk','johnlewis.com','wikipedia.org'])
      const bigBrands = (serp as Array<{domain?: string}>).slice(0,10).filter(i => bigBrandDomains.has((i.domain||'').replace(/^www\./,''))).length
      bigBrandPct = Math.round((bigBrands / Math.max(1, serp.length)) * 100)

      const forumDomains = new Set(['reddit.com','quora.com','mumsnet.com'])
      hasForumResults = (serp as Array<{domain?: string}>).some(i => forumDomains.has((i.domain||'').replace(/^www\./,'')))

      // Trend direction from KE trend data
      const trend = (ke?.trend ?? []) as Array<{value: number}>
      const tValues = trend.map((t) => t.value)
      const recentAvg = tValues.slice(-3).reduce((a:number,b:number)=>a+b,0)/3
      const priorAvg  = tValues.slice(-6,-3).reduce((a:number,b:number)=>a+b,0)/3
      const change = priorAvg > 0 ? (recentAvg - priorAvg) / priorAvg : 0
      trendDirection = change > 0.1 ? 'rising' : change < -0.1 ? 'falling' : 'stable'

      // Score computation
      const logVol  = Math.log10(Math.max(1, searchVolume))
      const volPart = Math.min(100, Math.round((logVol / Math.log10(500000)) * 100))
      const dirBonus = trendDirection === 'rising' ? 15 : trendDirection === 'falling' ? -15 : 0
      demandScore   = clamp(volPart + dirBonus)

      const brandPenalty = Math.round((bigBrandPct / 100) * 40)
      const drScore      = clamp(100 - avgDR)
      competitionScore   = clamp(drScore - brandPenalty + (hasForumResults ? 8 : 0))

      const cpcScore   = Math.min(100, Math.round((cpc / 5) * 100))
      const commScore  = Math.min(100, Math.round((amazonCommission / 15) * 100))
      moneyScore       = clamp(Math.round(cpcScore * 0.55 + commScore * 0.45))
    } else {
      // ── Mock/dev fallback ───────────────────────────────────────────────
      const mock = mockAnalyse(keyword)
      category         = mock.cat
      demandScore      = mock.d
      competitionScore = mock.c
      moneyScore       = mock.m
      searchVolume     = mock.sv
      cpc              = mock.cpc
      avgDR            = mock.avgDR
      bigBrandPct      = mock.bigBrandPct
      hasForumResults  = mock.hasForumResults
      trendDirection   = mock.trend
      amazonCommission = 4.0
    }

    // Apply custom weights if provided
    const w = weights ?? { demand: 0.40, competition: 0.35, money: 0.25 }
    const overallScore: number = clamp(Math.round(
      demandScore * w.demand + competitionScore * w.competition + moneyScore * w.money
    ))
    const verdict: Verdict = overallScore >= 70 ? 'GO' : overallScore >= 40 ? 'INVESTIGATE' : 'SKIP'

    // ── Generate NicheCoach via sub-call ─────────────────────────────────────
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!
    let coachText     = ''
    let contentAngles: string[] = []

    try {
      const coachRes = await fetch(`${supabaseUrl}/functions/v1/generate-coach`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          keyword, category, demandScore, competitionScore, moneyScore,
          overallScore, verdict, trendDirection, searchVolume, cpc, avgDR, bigBrandPct,
        }),
      })
      if (coachRes.ok) {
        const coachData = await coachRes.json()
        coachText     = coachData.coachText ?? ''
        contentAngles = coachData.contentAngles ?? []
      }
    } catch (e) {
      console.error('generate-coach call failed:', e)
    }

    // Fallback angles if coach failed
    if (!contentAngles.length) {
      const K = keyword.charAt(0).toUpperCase() + keyword.slice(1)
      contentAngles = [
        `Best ${K} in 2026: We Tested 12, Here's What We Found`,
        `${K} for Beginners: The Complete Buying Guide (No Fluff)`,
        `${K}: What the Top-Ranking Articles Always Get Wrong`,
        `How to Choose the Right ${K}: 5 Things Nobody Mentions`,
        `Are Cheap ${K} Worth It? Budget vs Premium Compared`,
      ]
    }

    // ── Affiliate programmes from DB ──────────────────────────────────────────
    const affiliateProgrammes = await getAffiliateProgs(supabase, category)
    // Fallback to general if category has no programmes
    const finalProgrammes = affiliateProgrammes.length > 0
      ? affiliateProgrammes
      : await getAffiliateProgs(supabase, 'general')

    // ── Persist to DB ─────────────────────────────────────────────────────────
    const now     = new Date().toISOString()
    const expires = new Date(Date.now() + 86400000).toISOString()

    await supabase.from('keyword_analyses').upsert({
      keyword,
      keyword_hash:       keywordHash,
      category,
      demand_score:       demandScore,
      competition_score:  competitionScore,
      money_score:        moneyScore,
      overall_score:      overallScore,
      verdict,
      trend_direction:    trendDirection,
      search_volume:      searchVolume,
      cpc,
      avg_dr:             avgDR,
      amazon_commission:  amazonCommission,
      coach_text:         coachText,
      content_angles:     contentAngles,
      affiliate_programmes: finalProgrammes,
      cached_at:          now,
      expires_at:         expires,
    }, { onConflict: 'keyword_hash' })

    // ── Cache in Redis ────────────────────────────────────────────────────────
    const result: AnalysisResult = {
      keyword,
      keywordHash,
      category,
      demandScore,
      competitionScore,
      moneyScore,
      overallScore,
      verdict,
      trendDirection,
      searchVolume,
      cpc,
      avgDR,
      bigBrandPct,
      amazonCommission,
      hasForumResults,
      coachText,
      contentAngles,
      affiliateProgrammes: finalProgrammes,
      cachedAt:   now,
      fromCache:  false,
    }

    if (redis) await redis.setex(`ns:kw:${keywordHash}`, 86400, result)

    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    console.error('analyse-keyword error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
})
