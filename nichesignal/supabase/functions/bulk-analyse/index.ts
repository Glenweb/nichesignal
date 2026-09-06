import "jsr:@supabase/functions-js/edge-runtime.d.ts"

// Calls analyse-keyword for each keyword with 200ms stagger (rate-limit protection)
// Max 25 keywords per batch

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
    const { keywords: rawKeywords, weights } = await req.json()

    if (!Array.isArray(rawKeywords) || rawKeywords.length === 0) {
      return new Response(JSON.stringify({ error: 'keywords array required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const keywords: string[] = rawKeywords
      .map((k: unknown) => String(k).trim())
      .filter(Boolean)
      .slice(0, 25)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!

    const results: unknown[] = []
    const errors:  Array<{ keyword: string; error: string }> = []

    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i]

      // 200ms stagger between requests (skip on first)
      if (i > 0) {
        await new Promise(r => setTimeout(r, 200))
      }

      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/analyse-keyword`, {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${anonKey}`,
          },
          body: JSON.stringify({ keyword, weights }),
        })

        if (!res.ok) {
          const body = await res.text()
          errors.push({ keyword, error: `HTTP ${res.status}: ${body}` })
          continue
        }

        const data = await res.json()
        results.push(data)
      } catch (err) {
        errors.push({ keyword, error: (err as Error).message })
      }
    }

    return new Response(JSON.stringify({
      results,
      errors,
      processed: results.length,
      total:     keywords.length,
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    console.error('bulk-analyse error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
})
