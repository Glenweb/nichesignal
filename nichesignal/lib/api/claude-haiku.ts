// ── Claude Haiku API Client ──────────────────────────────────────────────────
// Used for NicheCoach narrative generation.
// Model: claude-haiku-4-5 — cheapest Anthropic model, fast, ~$10-20/mo at volume.
// Called from the generate-coach edge function.

import Anthropic from '@anthropic-ai/sdk'
import type { NicheCategory, Verdict } from '@/lib/scoring/index'

export interface CoachInput {
  keyword:          string
  category:         NicheCategory
  demandScore:      number
  competitionScore: number
  moneyScore:       number
  overallScore:     number
  verdict:          Verdict
  trendDirection:   'rising' | 'stable' | 'falling'
  searchVolume:     number
  cpc:              number
  avgDR:            number
  bigBrandPct:      number
}

export interface CoachOutput {
  coachText:     string    // 150–200 word narrative
  contentAngles: string[]  // 5 article/content ideas
}

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

function buildUserPrompt(input: CoachInput): string {
  const {
    keyword, category, demandScore, competitionScore, moneyScore,
    overallScore, verdict, trendDirection, searchVolume, cpc, avgDR, bigBrandPct,
  } = input

  return `Niche: "${keyword}"
Category: ${category}
NicheSignal Score: ${overallScore}/100 → ${verdict}
Demand: ${demandScore}/100 | Competition: ${competitionScore}/100 | Money: ${moneyScore}/100

Key data:
- Monthly searches: ${searchVolume.toLocaleString()}
- Trend: ${trendDirection}
- Avg competitor DR: ${avgDR}
- Big-brand SERP share: ${bigBrandPct}%
- Average CPC: £${cpc.toFixed(2)}

Write the NicheCoach analysis and 5 content angles.`
}

export async function generateCoachNarrative(
  input: CoachInput,
  apiKey: string,
): Promise<CoachOutput> {
  const client = new Anthropic({ apiKey })

  const message = await client.messages.create({
    model:      'claude-haiku-4-5',
    max_tokens: 600,
    system:     SYSTEM_PROMPT,
    messages: [{
      role:    'user',
      content: buildUserPrompt(input),
    }],
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude')
  }

  // Strip markdown fences if present
  const raw = content.text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim()

  try {
    const parsed = JSON.parse(raw) as { coachText: string; contentAngles: string[] }
    return {
      coachText:     parsed.coachText ?? '',
      contentAngles: Array.isArray(parsed.contentAngles) ? parsed.contentAngles.slice(0, 5) : [],
    }
  } catch {
    // If JSON parse fails, return the raw text as coach narrative
    return {
      coachText:     raw,
      contentAngles: generateFallbackAngles(input.keyword),
    }
  }
}

/** Deterministic fallback angles when Claude call fails */
export function generateFallbackAngles(keyword: string): string[] {
  const K = keyword.charAt(0).toUpperCase() + keyword.slice(1)
  return [
    `Best ${K} in 2026: We Tested 12, Here's What We Found`,
    `${K} for Beginners: The Complete Buying Guide (No Fluff)`,
    `${K}: What the Top-Ranking Articles Always Get Wrong`,
    `How to Choose the Right ${K}: 5 Things Nobody Mentions`,
    `Are Cheap ${K} Worth It? Budget vs Premium Compared`,
  ]
}
