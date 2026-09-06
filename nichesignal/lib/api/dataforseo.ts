// ── DataForSEO API Client ────────────────────────────────────────────────────
// Docs: https://docs.dataforseo.com
// Auth: HTTP Basic — login:password base64-encoded
// Cost: ~$50/mo pay-per-use. SERP task = ~$0.002–0.006 per result.

export interface SERPResult {
  position:    number
  url:         string
  domain:      string
  title:       string
  description: string
  domainRating?: number  // from backlinks endpoint, merged in
}

export interface DataForSEOSERPResponse {
  keyword:  string
  results:  SERPResult[]
  totalResults: number
}

export interface DataForSEODomainRating {
  domain:       string
  domainRating: number   // Ahrefs-style DR 0–100
  backlinks:    number
}

export interface ProcessedSERPData {
  keyword:          string
  avgDR:            number
  affiliateFraction: number  // 0–1
  bigBrandFraction:  number  // 0–1
  hasForumResults:   boolean
  results:           SERPResult[]
}

// Domains we classify as "big brand" — affiliate sites can't outrank these
// without matching domain authority
const BIG_BRAND_DOMAINS = new Set([
  'amazon.com','amazon.co.uk','amazon.de','amazon.fr',
  'walmart.com','target.com','bestbuy.com',
  'currys.co.uk','johnlewis.com','argos.co.uk','wayfair.com',
  'wikipedia.org','nhs.uk','gov.uk','gov.com',
  'youtube.com','facebook.com','instagram.com','twitter.com',
])

const FORUM_DOMAINS = new Set([
  'reddit.com','quora.com','mumsnet.com','trustpilot.com',
  'tripadvisor.com','yelp.com','trustradius.com',
])

// Patterns that suggest affiliate/comparison content
const AFFILIATE_TITLE_PATTERNS = [
  /best\s+/i,
  /top\s+\d+/i,
  /review/i,
  /vs\./i,
  /comparison/i,
  /buying\s+guide/i,
  /alternatives/i,
  /cheap(est)?/i,
  /under\s+\£?\$?\d+/i,
]

function isAffiliatePage(result: SERPResult): boolean {
  return AFFILIATE_TITLE_PATTERNS.some(re => re.test(result.title))
}

function isBigBrand(result: SERPResult): boolean {
  const domain = result.domain.replace(/^www\./, '')
  return BIG_BRAND_DOMAINS.has(domain)
}

function isForumResult(result: SERPResult): boolean {
  const domain = result.domain.replace(/^www\./, '')
  return FORUM_DOMAINS.has(domain)
}

// ── API wrapper ──────────────────────────────────────────────────────────────

function makeAuth(login: string, password: string): string {
  return 'Basic ' + btoa(`${login}:${password}`)
}

interface DataForSEOTask {
  id:           string
  status_code:  number
  status_message: string
  result:       DataForSEOSERPResultItem[] | null
}

interface DataForSEOSERPResultItem {
  keyword:   string
  items:     Array<{
    type:        string
    rank_group:  number
    domain:      string
    url:         string
    title:       string
    description: string
  }>
}

/**
 * Fetch organic SERP results for a keyword (top 10).
 * Uses Live SERP endpoint — instant results, slightly higher cost.
 */
export async function fetchSERPResults(
  keyword: string,
  login: string,
  password: string,
  locationCode = 2826,  // 2826 = United Kingdom
  languageCode = 'en',
): Promise<DataForSEOSERPResponse> {
  const payload = [{
    keyword,
    location_code: locationCode,
    language_code: languageCode,
    depth: 10,
    device: 'desktop',
    os: 'windows',
  }]

  const res = await fetch(
    'https://api.dataforseo.com/v3/serp/google/organic/live/regular',
    {
      method:  'POST',
      headers: {
        'Authorization': makeAuth(login, password),
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(payload),
    },
  )

  if (!res.ok) {
    throw new Error(`DataForSEO HTTP error ${res.status}`)
  }

  const json = await res.json()
  const task: DataForSEOTask = json.tasks?.[0]

  if (!task || task.status_code !== 20000) {
    throw new Error(`DataForSEO task error: ${task?.status_message}`)
  }

  const resultItem = task.result?.[0]
  const items = (resultItem?.items ?? []).filter(i => i.type === 'organic')

  return {
    keyword,
    totalResults: items.length,
    results: items.map(i => ({
      position:    i.rank_group,
      url:         i.url,
      domain:      i.domain,
      title:       i.title,
      description: i.description,
    })),
  }
}

/**
 * Fetch domain ratings for a list of domains via DataForSEO Backlinks.
 * Returns a map of domain → DR.
 */
export async function fetchDomainRatings(
  domains: string[],
  login: string,
  password: string,
): Promise<Map<string, number>> {
  const payload = domains.map(domain => ({ target: domain }))

  const res = await fetch(
    'https://api.dataforseo.com/v3/backlinks/domain_pages_summary/live',
    {
      method:  'POST',
      headers: {
        'Authorization': makeAuth(login, password),
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(payload),
    },
  )

  if (!res.ok) {
    throw new Error(`DataForSEO Backlinks HTTP error ${res.status}`)
  }

  const json = await res.json()
  const ratingMap = new Map<string, number>()

  for (const task of json.tasks ?? []) {
    const result = task.result?.[0]
    if (result?.target) {
      ratingMap.set(result.target, result.domain_rank ?? 0)
    }
  }

  return ratingMap
}

/**
 * Full SERP analysis: fetch results + domain ratings + derive metrics.
 */
export async function analyseSERP(
  keyword: string,
  login: string,
  password: string,
): Promise<ProcessedSERPData> {
  const serpData = await fetchSERPResults(keyword, login, password)
  const top10 = serpData.results.slice(0, 10)

  const domains = [...new Set(top10.map(r => r.domain))]
  const drMap = await fetchDomainRatings(domains, login, password)

  // Merge DR into results
  const resultsWithDR = top10.map(r => ({
    ...r,
    domainRating: drMap.get(r.domain) ?? 0,
  }))

  const avgDR = resultsWithDR.length > 0
    ? Math.round(resultsWithDR.reduce((sum, r) => sum + (r.domainRating ?? 0), 0) / resultsWithDR.length)
    : 0

  const affiliateFraction = resultsWithDR.filter(isAffiliatePage).length / Math.max(1, top10.length)
  const bigBrandFraction  = resultsWithDR.filter(isBigBrand).length / Math.max(1, top10.length)
  const hasForumResults   = resultsWithDR.some(isForumResult)

  return {
    keyword,
    avgDR,
    affiliateFraction,
    bigBrandFraction,
    hasForumResults,
    results: resultsWithDR,
  }
}
