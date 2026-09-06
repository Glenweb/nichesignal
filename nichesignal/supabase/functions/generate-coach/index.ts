import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import Anthropic from "npm:@anthropic-ai/sdk"

const SYSTEM_PROMPT = `You are NicheCoach, an expert affiliate marketing strategist for NicheSignal.
Your job is to give affiliate marketers a clear, direct, actionable verdict on whether a niche is worth pursuing.

Writing style:
- Blunt and data-driven. No filler. No hype.
- Use UK English spelling.
- Lead with the strongest signal, positive or negative.
- Reference specific numbers from the analysis (score, DR, CPC, trend).
- End with a concrete next step.
- 150–200 words for the narrative. Not a word over.

Format: Return a JSON object with two keys:
- "coachText": the narrative (HTML allowed: <strong> for emphasis, no other tags)
- "contentAngles": array of exactly 5 content angle strings (article titles/ideas)`

function fallbackAngles(keyword: string): string[] {
  const K = keyword.charAt(0).toUpperCase() + keyword.slice(1)
  return [
    `Best ${K} in 2026: We Tested 12, Here's What We Found`,
    `${K} for Beginners: The Complete Buying Guide (No Fluff)`,
    `${K}: What the Top-Ranking Articles Always Get Wrong`,
    `How to Choose the Right ${K}: 5 Things Nobody Mentions`,
    `Are Cheap ${K} Worth It? Budget vs Premium Compared`,
  ]
}

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
    const {
      keyword, category,
      demandScore, competitionScore, moneyScore, overallScore,
      verdict, trendDirection, searchVolume, cpc, avgDR, bigBrandPct,
    } = await req.json()

    if (!keyword) {
      return new Response(JSON.stringify({ error: 'keyword required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      // Return deterministic fallback — don't hard-fail
      return new Response(JSON.stringify({
        coachText: `<strong>${keyword.charAt(0).toUpperCase() + keyword.slice(1)}</strong> — NicheCoach analysis requires an Anthropic API key. Configure ANTHROPIC_API_KEY in Supabase Edge Function secrets.`,
        contentAngles: fallbackAngles(keyword),
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    const client = new Anthropic({ apiKey })

    const userPrompt = `Niche: "${keyword}"
Category: ${category ?? 'general'}
NicheSignal Score: ${overallScore}/100 → ${verdict}
Demand: ${demandScore}/100 | Competition: ${competitionScore}/100 | Money: ${moneyScore}/100

Key data:
- Monthly searches: ${Number(searchVolume).toLocaleString()}
- Trend: ${trendDirection}
- Avg competitor DR: ${avgDR}
- Big-brand SERP share: ${bigBrandPct}%
- Average CPC: £${Number(cpc).toFixed(2)}

Write the NicheCoach analysis and 5 content angles.`

    const message = await client.messages.create({
      model:      'claude-haiku-4-5',
      max_tokens: 600,
      system:     SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Unexpected Claude response type')

    const raw = content.text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim()

    let result: { coachText: string; contentAngles: string[] }
    try {
      result = JSON.parse(raw)
    } catch {
      result = {
        coachText:     raw,
        contentAngles: fallbackAngles(keyword),
      }
    }

    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    console.error('generate-coach error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
})
