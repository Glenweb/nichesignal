// ── NicheSignal Scoring Engine ──────────────────────────────────────────────
// Pure TypeScript functions — no side effects, no I/O.
// Called by the analyse-keyword edge function with real API data,
// and used client-side for preview/mock mode in development.

export type NicheCategory =
  | 'tech' | 'health' | 'pet' | 'sports' | 'home'
  | 'baby' | 'travel' | 'finance' | 'beauty' | 'general'

export type TrendDirection = 'rising' | 'stable' | 'falling'
export type Verdict = 'GO' | 'INVESTIGATE' | 'SKIP'

// ── Weights (user-overridable in Settings) ──────────────────────────────────
export interface ScoringWeights {
  demand:      number  // 0–1, default 0.40
  competition: number  // 0–1, default 0.35
  money:       number  // 0–1, default 0.25
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  demand:      0.40,
  competition: 0.35,
  money:       0.25,
}

// ── API data shapes flowing into the scorer ─────────────────────────────────

export interface KeywordsEverywhereData {
  /** Monthly search volume (global or country-scoped) */
  searchVolume: number
  /** Cost per click in USD */
  cpc: number
  /** KE competition score 0–1 */
  competition: number
}

export interface GoogleTrendsData {
  /** Normalised interest points, ordered oldest→newest, length ≥ 12 */
  timelinePoints: number[]
  /** Direction derived from last 3mo vs prior 3mo */
  direction: TrendDirection
}

export interface DataForSEOData {
  /** Average Domain Rating of top-10 organic results */
  avgDR: number
  /** Fraction (0–1) of top-10 results that are affiliate/comparison pages */
  affiliateFraction: number
  /** Fraction (0–1) of top-10 that are big-brand homepages */
  bigBrandFraction: number
  /** Whether forum/Reddit/Quora results appear in top-10 */
  hasForumResults: boolean
}

export interface AmazonPAData {
  /** Commission rate for the matched category (percentage, e.g. 8.0) */
  commissionRate: number
  /** Number of products found for the keyword */
  productCount: number
  /** Best Seller Rank of the top product (lower = more popular) */
  topBSR?: number
}

// ── Computed sub-scores ──────────────────────────────────────────────────────

export interface DimensionScores {
  demand:      number  // 0–100
  competition: number  // 0–100 (higher = EASIER = better for affiliate)
  money:       number  // 0–100
}

export interface FullAnalysis {
  keyword:       string
  category:      NicheCategory
  scores:        DimensionScores
  overallScore:  number
  verdict:       Verdict
  trendDirection: TrendDirection
  searchVolume:  number
  cpc:           number
  avgDR:         number
  amazonCommission: number
  bigBrandPct:   number  // 0–100
  hasForumResults: boolean
}

// ── Category detection ───────────────────────────────────────────────────────

const CATEGORY_TERMS: Record<NicheCategory, string[]> = {
  tech: [
    'laptop','headphone','phone','tablet','camera','drone','robot','vacuum',
    'smart','gadget','monitor','keyboard','mouse','speaker','earphone','earbud',
    'projector','router','electric','charging','battery','mechanical',
  ],
  health: [
    'supplement','vitamin','weight loss','protein','collagen','probiotic',
    'diet','detox','keto','fat burn','muscle','cbd','sleep','testosterone',
    'hair loss','nootropic',
  ],
  pet: [
    'dog','cat','pet','puppy','kitten','fish','hamster','rabbit',
    'paw','collar','leash','treat',
  ],
  sports: [
    'gym','fitness','yoga','cycling','bike','running','hiking','camping',
    'fishing','golf','tennis','swim','surf','ski','paddle','exercise',
    'workout','treadmill','dumbbell','kettlebell',
  ],
  home: [
    'kitchen','air fryer','coffee','blender','toaster','mattress','pillow',
    'furniture','sofa','desk','lamp','curtain','rug','storage','cleaning',
    'garden','tool','drill',
  ],
  baby: [
    'baby','toddler','infant','newborn','stroller','pram','carseat',
    'nappy','diaper','teether','nursery',
  ],
  travel: [
    'travel','luggage','suitcase','backpack','passport','hotel','flight',
    'vacation','holiday','tour','cruise',
  ],
  finance: [
    'invest','trading','stock','crypto','bitcoin','forex','insurance',
    'loan','mortgage','credit','savings','pension',
  ],
  beauty: [
    'skin','serum','moisturiser','makeup','lipstick','mascara','foundation',
    'concealer','shampoo','conditioner','perfume','fragrance','nail',
  ],
  general: [],
}

export function detectCategory(keyword: string): NicheCategory {
  const k = keyword.toLowerCase()
  for (const [cat, terms] of Object.entries(CATEGORY_TERMS) as [NicheCategory, string[]][]) {
    if (cat === 'general') continue
    if (terms.some(t => k.includes(t))) return cat
  }
  return 'general'
}

// ── Demand score (0–100) ─────────────────────────────────────────────────────
// Inputs: search volume, trend direction, trend acceleration
// Higher search volume + positive trend = higher score

export function computeDemandScore(
  ke: KeywordsEverywhereData,
  trends: GoogleTrendsData,
): number {
  const { searchVolume } = ke
  const { timelinePoints, direction } = trends

  // Volume component — log-normalised to 0–100
  // Assumes meaningful range: 100 → 0, 500k+ → 100
  const logVol = Math.log10(Math.max(1, searchVolume))
  const volScore = Math.min(100, Math.round((logVol / Math.log10(500_000)) * 100))

  // Trend direction bonus/penalty
  const directionBonus = direction === 'rising' ? 15 : direction === 'falling' ? -15 : 0

  // Trend acceleration: compare last 3 points vs prior 3 points
  let accelBonus = 0
  if (timelinePoints.length >= 6) {
    const recent = timelinePoints.slice(-3)
    const prior  = timelinePoints.slice(-6, -3)
    const recentAvg = recent.reduce((a, b) => a + b, 0) / 3
    const priorAvg  = prior.reduce((a, b) => a + b, 0) / 3
    if (priorAvg > 0) {
      const pctChange = (recentAvg - priorAvg) / priorAvg
      accelBonus = Math.round(Math.max(-10, Math.min(10, pctChange * 20)))
    }
  }

  return clamp(volScore + directionBonus + accelBonus)
}

// ── Competition score (0–100) ────────────────────────────────────────────────
// INVERTED: lower DR / fewer big brands / more forum results = higher score
// A score of 80 means easy competition (good for affiliate entrants)

export function computeCompetitionScore(serp: DataForSEOData): number {
  // DR component: DR 0→100 maps to competition score 100→0
  const drScore = clamp(100 - serp.avgDR)

  // Big-brand penalty: if 80% of SERP is big brands, this niche is nearly impossible
  const brandPenalty = Math.round(serp.bigBrandFraction * 40)

  // Forum bonus: forum results = content gap = affiliate opportunity
  const forumBonus = serp.hasForumResults ? 8 : 0

  // Affiliate fraction — more affiliate pages already = more established = slight positive
  // (market validated, not yet saturated)
  const affBonus = serp.affiliateFraction < 0.3 ? 0 : Math.round(serp.affiliateFraction * 10)

  return clamp(drScore - brandPenalty + forumBonus + affBonus)
}

// ── Money score (0–100) ──────────────────────────────────────────────────────
// Inputs: Amazon commission %, CPC, affiliate programme availability

export function computeMoneyScore(
  ke: KeywordsEverywhereData,
  amazon: AmazonPAData,
  programmeCount: number,
): number {
  // CPC signal: £0→0, £5+→100
  const cpcScore = Math.min(100, Math.round((ke.cpc / 5) * 100))

  // Amazon commission: 0%→0, 15%→100
  const commScore = Math.min(100, Math.round((amazon.commissionRate / 15) * 100))

  // Programme availability: 1 prog→20, 5+→100
  const progScore = Math.min(100, programmeCount * 20)

  // Product density: more Amazon products = active market
  const logProducts = Math.log10(Math.max(1, amazon.productCount))
  const densityScore = Math.min(100, Math.round((logProducts / Math.log10(10_000)) * 100))

  // Weighted combination
  return clamp(
    Math.round(cpcScore * 0.30 + commScore * 0.35 + progScore * 0.25 + densityScore * 0.10)
  )
}

// ── Overall NicheSignal score ────────────────────────────────────────────────

export function computeOverallScore(
  scores: DimensionScores,
  weights: ScoringWeights = DEFAULT_WEIGHTS,
): number {
  return clamp(
    Math.round(
      scores.demand      * weights.demand +
      scores.competition * weights.competition +
      scores.money       * weights.money,
    )
  )
}

// ── Verdict ──────────────────────────────────────────────────────────────────

export function scoreToVerdict(score: number): Verdict {
  if (score >= 70) return 'GO'
  if (score >= 40) return 'INVESTIGATE'
  return 'SKIP'
}

// ── Trend direction from timeline ────────────────────────────────────────────

export function deriveTrendDirection(timelinePoints: number[]): TrendDirection {
  if (timelinePoints.length < 6) return 'stable'
  const recent = timelinePoints.slice(-3)
  const prior  = timelinePoints.slice(-6, -3)
  const recentAvg = recent.reduce((a, b) => a + b, 0) / 3
  const priorAvg  = prior.reduce((a, b) => a + b, 0) / 3
  if (priorAvg === 0) return 'stable'
  const change = (recentAvg - priorAvg) / priorAvg
  if (change > 0.10) return 'rising'
  if (change < -0.10) return 'falling'
  return 'stable'
}

// ── Full analysis assembler ──────────────────────────────────────────────────

export function assembleAnalysis(
  keyword:       string,
  ke:            KeywordsEverywhereData,
  trends:        GoogleTrendsData,
  serp:          DataForSEOData,
  amazon:        AmazonPAData,
  programmeCount: number,
  weights:       ScoringWeights = DEFAULT_WEIGHTS,
): FullAnalysis {
  const category = detectCategory(keyword)

  const scores: DimensionScores = {
    demand:      computeDemandScore(ke, trends),
    competition: computeCompetitionScore(serp),
    money:       computeMoneyScore(ke, amazon, programmeCount),
  }

  const overallScore = computeOverallScore(scores, weights)
  const verdict      = scoreToVerdict(overallScore)

  return {
    keyword,
    category,
    scores,
    overallScore,
    verdict,
    trendDirection:   trends.direction,
    searchVolume:     ke.searchVolume,
    cpc:              ke.cpc,
    avgDR:            serp.avgDR,
    amazonCommission: amazon.commissionRate,
    bigBrandPct:      Math.round(serp.bigBrandFraction * 100),
    hasForumResults:  serp.hasForumResults,
  }
}

// ── Mock/dev mode (no API keys required) ─────────────────────────────────────
// Deterministic from keyword string — same keyword always returns same scores.
// Used when KEYWORDS_EVERYWHERE_API_KEY is not set.

const CATEGORY_SCORE_PROFILES: Record<NicheCategory, { d: [number,number]; c: [number,number]; m: [number,number] }> = {
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

/** FNV-1a 32-bit hash → [0,1) */
function deterministicRng(keyword: string, salt: string): number {
  let h = 2166136261
  const str = (keyword + salt).toLowerCase()
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = (Math.imul(h, 16777619)) >>> 0
  }
  return h / 4294967295
}

function mockScore(kw: string, salts: [string, string], range: [number, number]): number {
  const v = (deterministicRng(kw, salts[0]) + deterministicRng(kw, salts[1])) / 2
  return Math.round(range[0] + v * (range[1] - range[0]))
}

export interface MockAnalysisResult {
  keyword:          string
  category:         NicheCategory
  demandScore:      number
  competitionScore: number
  moneyScore:       number
  overallScore:     number
  verdict:          Verdict
  trendDirection:   TrendDirection
  searchVolume:     number
  cpc:              number
  avgDR:            number
  bigBrandPct:      number
  hasForumResults:  boolean
}

export function mockAnalyse(keyword: string, weights: ScoringWeights = DEFAULT_WEIGHTS): MockAnalysisResult {
  const category = detectCategory(keyword)
  const profile  = CATEGORY_SCORE_PROFILES[category]

  const demandScore      = mockScore(keyword, ['d1','d2'], profile.d)
  const competitionScore = mockScore(keyword, ['c1','c2'], profile.c)
  const moneyScore       = mockScore(keyword, ['m1','m2'], profile.m)

  const overallScore = clamp(Math.round(
    demandScore      * weights.demand +
    competitionScore * weights.competition +
    moneyScore       * weights.money,
  ))

  const verdict = scoreToVerdict(overallScore)

  const svRaw = deterministicRng(keyword, 'sv')
  const searchVolume = Math.round(800 + svRaw * (95000 - 800))
  const cpc = parseFloat((0.25 + deterministicRng(keyword, 'cpc') * 4.75).toFixed(2))
  const avgDR = Math.round(100 - competitionScore * 0.85)
  const bigBrandPct = Math.round((1 - competitionScore / 100) * 65 + 12)
  const hasForumResults = competitionScore > 55

  const trendRng = deterministicRng(keyword, 'tr')
  let trendDirection: TrendDirection
  if (demandScore > 75) {
    trendDirection = trendRng > 0.5 ? 'rising' : 'stable'
  } else {
    trendDirection = trendRng > 0.7 ? 'stable' : 'falling'
  }

  return {
    keyword,
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
    hasForumResults,
  }
}

// ── Utility ──────────────────────────────────────────────────────────────────

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n))
}
