// ── Keywords Everywhere API Client ──────────────────────────────────────────
// Docs: https://api.keywordseverywhere.com/docs
// Credits: ~$10 / 100k credits. One keyword lookup = 1 credit.

export interface KEKeywordData {
  keyword:    string
  vol:        number   // monthly search volume
  cpc:        { currency: string; value: string }
  competition: number  // 0–1
  trend:      Array<{ month: string; year: string; value: number }>
}

export interface KEResponse {
  data:   KEKeywordData[]
  credits: number
  time:   string
}

export interface KeywordsEverywhereResult {
  keyword:     string
  searchVolume: number
  cpc:         number
  competition: number
  trend:       number[]  // last 12 monthly values, oldest first
}

export async function fetchKeywordsEverywhere(
  keywords: string[],
  apiKey: string,
  country = 'GB',
  currency = 'GBP',
): Promise<KeywordsEverywhereResult[]> {
  const params = new URLSearchParams()
  keywords.forEach(kw => params.append('kw[]', kw))
  params.append('metrics_location[]', country === 'GB' ? '2826' : '2840')  // 2826=UK, 2840=US
  params.append('metrics_language[]', 'en')
  params.append('metrics_currency', currency)
  params.append('dataSource', 'gkp')  // Google Keyword Planner

  const res = await fetch('https://api.keywordseverywhere.com/v1/get_keyword_data', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
    },
    body: params,
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Keywords Everywhere API error ${res.status}: ${body}`)
  }

  const json: KEResponse = await res.json()

  return json.data.map(item => ({
    keyword:      item.keyword,
    searchVolume: item.vol,
    cpc:          parseFloat(item.cpc.value),
    competition:  item.competition,
    trend:        (item.trend ?? []).map(t => t.value),
  }))
}

export async function fetchSingleKeyword(
  keyword: string,
  apiKey: string,
  country = 'GB',
): Promise<KeywordsEverywhereResult> {
  const results = await fetchKeywordsEverywhere([keyword], apiKey, country)
  if (!results.length) {
    throw new Error(`No data returned for keyword: ${keyword}`)
  }
  return results[0]
}
