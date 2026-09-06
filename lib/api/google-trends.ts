// ── Google Trends Client ─────────────────────────────────────────────────────
// Uses the pytrends-compatible /trends/api/explore endpoint via a public proxy,
// or optionally via a self-hosted pytrends service.
// Free — no API key required.
//
// NOTE: Google Trends rate-limits aggressive polling.
// The edge function caches results in Redis for 24h to stay safe.

export interface TrendTimelinePoint {
  date:  string  // "YYYY-MM"
  value: number  // 0–100 normalised interest
}

export interface GoogleTrendsResult {
  keyword:     string
  timeline:    TrendTimelinePoint[]
  direction:   'rising' | 'stable' | 'falling'
  peakValue:   number
  currentValue: number
}

// ── pytrends-compatible request shape ───────────────────────────────────────
// When running via a self-hosted pytrends wrapper (recommended for production),
// POST to your PYTRENDS_API_URL with this body.

interface PyTrendsRequest {
  keywords: string[]
  timeframe: string    // e.g. "today 12-m"
  geo:       string    // e.g. "GB"
}

interface PyTrendsResponse {
  interest_over_time: Record<string, number[]>  // keyword → monthly values
  dates: string[]
}

/**
 * Fetch trends via a self-hosted pytrends REST wrapper.
 * Point PYTRENDS_API_URL at your Cloud Run / Railway service.
 */
export async function fetchGoogleTrends(
  keyword: string,
  options: {
    pyTrendsApiUrl: string
    geo?: string
    timeframe?: string
  },
): Promise<GoogleTrendsResult> {
  const { pyTrendsApiUrl, geo = 'GB', timeframe = 'today 12-m' } = options

  const req: PyTrendsRequest = {
    keywords: [keyword],
    timeframe,
    geo,
  }

  const res = await fetch(`${pyTrendsApiUrl}/interest_over_time`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`pytrends API error ${res.status}: ${body}`)
  }

  const data: PyTrendsResponse = await res.json()
  const values = data.interest_over_time[keyword] ?? []

  const timeline: TrendTimelinePoint[] = values.map((v, i) => ({
    date:  data.dates[i] ?? '',
    value: v,
  }))

  return {
    keyword,
    timeline,
    direction:    deriveTrend(values),
    peakValue:    Math.max(...values, 0),
    currentValue: values[values.length - 1] ?? 0,
  }
}

/**
 * Fallback when pytrends service is unavailable.
 * Returns a neutral stable trend so scoring can continue.
 */
export function makeFallbackTrend(keyword: string): GoogleTrendsResult {
  const stable = Array.from({ length: 12 }, (_, i) => 50 + (i % 3))
  return {
    keyword,
    timeline:     stable.map((v, i) => ({ date: `month-${i}`, value: v })),
    direction:    'stable',
    peakValue:    53,
    currentValue: 52,
  }
}

function deriveTrend(points: number[]): 'rising' | 'stable' | 'falling' {
  if (points.length < 6) return 'stable'
  const recent = points.slice(-3)
  const prior  = points.slice(-6, -3)
  const recentAvg = avg(recent)
  const priorAvg  = avg(prior)
  if (priorAvg === 0) return 'stable'
  const change = (recentAvg - priorAvg) / priorAvg
  if (change >  0.10) return 'rising'
  if (change < -0.10) return 'falling'
  return 'stable'
}

function avg(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length
}
