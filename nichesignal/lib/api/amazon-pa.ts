// ── Amazon Product Advertising API Client ────────────────────────────────────
// Docs: https://webservices.amazon.co.uk/paapi5/documentation
// Glen's tag: LFT Associates access (set AMAZON_PA_PARTNER_TAG in env)
// Auth: AWS Signature Version 4

// ── Amazon category commission rates (UK, Sep 2026) ─────────────────────────
// Source: https://affiliate-program.amazon.co.uk/help/node/topic/GRXPHT8U84RAYDXZ
// Update quarterly — keep this table current.
export const AMAZON_COMMISSION_RATES: Record<string, number> = {
  // Electronics
  'Electronics':                 4.0,
  'Computers':                   4.0,
  'Camera & Photo':              4.0,
  'Video Games':                 1.0,
  'Mobile & Accessories':        4.0,
  // Home
  'Kitchen':                     4.5,
  'Home & Garden':               4.5,
  'DIY & Tools':                 4.5,
  'Furniture':                   3.0,
  'Large Appliances':            2.0,
  // Sports
  'Sports & Outdoors':           4.0,
  'Cycling':                     4.0,
  // Clothing
  'Clothing':                    9.0,
  'Shoes':                       9.0,
  'Jewellery':                   4.0,
  // Health
  'Health & Beauty':             4.5,
  'Baby Products':               4.5,
  // Books / Media
  'Books':                       4.5,
  'Music':                       4.5,
  'DVD & Blu-ray':               4.5,
  // Grocery
  'Grocery':                     4.0,
  // Pet
  'Pet Supplies':                8.0,
  // Automotive
  'Automotive':                  4.5,
  // Toys
  'Toys & Games':                4.0,
  // Default
  'Other':                       4.0,
}

// Category slug → Amazon browse node mapping (UK)
const CATEGORY_BROWSE_NODES: Record<string, string> = {
  tech:    '560800',      // Electronics
  health:  '66280031',   // Health & Beauty
  pet:     '340830031',  // Pet Supplies
  sports:  '318949031',  // Sports & Outdoors
  home:    '11052681',   // Home & Garden
  baby:    '11052811',   // Baby Products
  travel:  '2454167031', // Luggage
  beauty:  '66280031',   // Health & Beauty (covers beauty too)
  general: '468292',     // All Departments
}

export interface AmazonSearchResult {
  keyword:         string
  matchedCategory: string
  commissionRate:  number
  productCount:    number
  topProducts: Array<{
    asin:       string
    title:      string
    price?:     number
    bsr?:       number
    imageUrl?:  string
  }>
}

/**
 * Search Amazon for products matching a keyword and return monetisation signals.
 *
 * Implementation note: Amazon PA API requires AWS SigV4 signing.
 * The full implementation is in the edge function (Deno-compatible).
 * This function signature is the contract.
 */
export async function searchAmazonProducts(
  keyword:    string,
  category:   string,  // NicheCategory from scoring/index.ts
  credentials: {
    accessKey:  string
    secretKey:  string
    partnerTag: string
    region?:    string  // default 'eu-west-1' for .co.uk
    marketplace?: string  // default 'www.amazon.co.uk'
  },
): Promise<AmazonSearchResult> {
  const {
    accessKey,
    secretKey,
    partnerTag,
    region     = 'eu-west-1',
    marketplace = 'www.amazon.co.uk',
  } = credentials

  const browseNode = CATEGORY_BROWSE_NODES[category] ?? CATEGORY_BROWSE_NODES.general

  // PA API v5 SearchItems endpoint
  const endpoint  = `https://webservices.amazon.co.uk/paapi5/searchitems`
  const host      = 'webservices.amazon.co.uk'
  const timestamp = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z'
  const date      = timestamp.slice(0, 8)

  const requestBody = JSON.stringify({
    PartnerTag:   partnerTag,
    PartnerType:  'Associates',
    Marketplace:  marketplace,
    Keywords:     keyword,
    SearchIndex:  'All',
    BrowseNodeId: browseNode,
    Resources: [
      'ItemInfo.Title',
      'Offers.Listings.Price',
      'BrowseNodeInfo.BrowseNodes',
      'SearchRefinements',
    ],
    ItemCount: 10,
  })

  const headers = await signAmazonRequest({
    method:      'POST',
    host,
    path:        '/paapi5/searchitems',
    region,
    service:     'ProductAdvertisingAPI',
    accessKey,
    secretKey,
    timestamp,
    date,
    body:        requestBody,
    contentType: 'application/json; charset=utf-8',
    target:      'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems',
  })

  const res = await fetch(endpoint, {
    method:  'POST',
    headers,
    body:    requestBody,
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Amazon PA API error ${res.status}: ${body}`)
  }

  const json = await res.json()
  const items = json.SearchResult?.Items ?? []
  const productCount = json.SearchResult?.TotalResultCount ?? items.length

  // Detect commission rate from browse node
  const matchedNode = items[0]?.BrowseNodeInfo?.BrowseNodes?.[0]?.DisplayName ?? 'Other'
  const commissionRate = AMAZON_COMMISSION_RATES[matchedNode] ?? AMAZON_COMMISSION_RATES['Other']

  return {
    keyword,
    matchedCategory: matchedNode,
    commissionRate,
    productCount,
    topProducts: items.slice(0, 5).map((item: Record<string, unknown>) => {
      const info = item.ItemInfo as Record<string, unknown> | undefined
      const title = (info?.Title as { DisplayValue?: string } | undefined)?.DisplayValue ?? ''
      const offers = item.Offers as Record<string, unknown> | undefined
      const listings = offers?.Listings as Array<Record<string, unknown>> | undefined
      const price = (listings?.[0]?.Price as { Amount?: number } | undefined)?.Amount
      return {
        asin:  (item.ASIN as string | undefined) ?? '',
        title,
        price,
      }
    }),
  }
}

// ── AWS SigV4 signing (Deno / Edge Function compatible) ─────────────────────
// Minimal implementation — covers POST to PA API.

async function signAmazonRequest(params: {
  method:      string
  host:        string
  path:        string
  region:      string
  service:     string
  accessKey:   string
  secretKey:   string
  timestamp:   string
  date:        string
  body:        string
  contentType: string
  target:      string
}): Promise<Record<string, string>> {
  const { method, host, path, region, service, accessKey, secretKey,
          timestamp, date, body, contentType, target } = params

  const bodyHash = await sha256Hex(body)

  const canonicalHeaders = [
    `content-encoding:amz-1.0`,
    `content-type:${contentType}`,
    `host:${host}`,
    `x-amz-date:${timestamp}`,
    `x-amz-target:${target}`,
  ].join('\n')

  const signedHeaders = 'content-encoding;content-type;host;x-amz-date;x-amz-target'

  const canonicalRequest = [
    method,
    path,
    '',
    canonicalHeaders,
    '',
    signedHeaders,
    bodyHash,
  ].join('\n')

  const credentialScope = `${date}/${region}/${service}/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    timestamp,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n')

  const signingKey = await getSigningKey(secretKey, date, region, service)
  const signature  = await hmacHex(signingKey, stringToSign)

  return {
    'content-encoding': 'amz-1.0',
    'content-type':     contentType,
    'host':             host,
    'x-amz-date':       timestamp,
    'x-amz-target':     target,
    'authorization':    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  }
}

async function sha256Hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function hmacHex(key: CryptoKey, data: string): Promise<string> {
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function hmacKey(key: ArrayBuffer | string, data: string): Promise<CryptoKey> {
  const rawKey = typeof key === 'string' ? new TextEncoder().encode(key) : key
  const cryptoKey = await crypto.subtle.importKey('raw', rawKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data))
  return crypto.subtle.importKey('raw', sig, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
}

async function getSigningKey(secretKey: string, date: string, region: string, service: string): Promise<CryptoKey> {
  const k1 = await hmacKey(`AWS4${secretKey}`, date)
  const k2 = await hmacKeyFromKey(k1, region)
  const k3 = await hmacKeyFromKey(k2, service)
  return hmacKeyFromKey(k3, 'aws4_request')
}

async function hmacKeyFromKey(key: CryptoKey, data: string): Promise<CryptoKey> {
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return crypto.subtle.importKey('raw', sig, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
}
