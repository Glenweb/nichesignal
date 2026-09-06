'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import VerdictBadge from '@/components/analysis/VerdictBadge'
import DimensionBar from '@/components/analysis/DimensionBar'
import CoachPanel from '@/components/analysis/CoachPanel'
import ContentAngles from '@/components/analysis/ContentAngles'
import AffiliateTable from '@/components/analysis/AffiliateTable'
import ScoreRing from '@/components/analysis/ScoreRing'
import Button from '@/components/ui/Button'
import type { Verdict } from '@/lib/scoring/index'

const EXAMPLES = [
  'robot vacuum cleaner',
  'air fryer accessories',
  'dog GPS tracker',
  'weight loss supplements',
  'mechanical keyboard beginner',
]

const LOADING_STEPS = [
  'Checking search demand…',
  'Analysing SERP competition…',
  'Scanning Amazon marketplace…',
  'Detecting affiliate programmes…',
  'Calculating NicheSignal score…',
  'Generating content angles…',
]

interface AnalysisResult {
  keyword:           string
  category:          string
  demandScore:       number
  competitionScore:  number
  moneyScore:        number
  overallScore:      number
  verdict:           Verdict
  trendDirection:    'rising' | 'stable' | 'falling'
  searchVolume:      number
  cpc:               number
  avgDR:             number
  bigBrandPct:       number
  amazonCommission:  number
  hasForumResults:   boolean
  coachText:         string
  contentAngles:     string[]
  affiliateProgrammes: Array<{ name: string; commissionRate: string; network: string; type: string }>
}

const VERDICT_BORDER: Record<string, string> = {
  GO:          'var(--go-b)',
  INVESTIGATE: 'var(--inv-b)',
  SKIP:        'var(--skip-b)',
}

const TREND_STYLE: Record<string, { color: string; label: string }> = {
  rising:  { color: 'var(--go)',   label: '↑ Rising' },
  stable:  { color: 'var(--muted)', label: '→ Stable' },
  falling: { color: 'var(--skip)', label: '↓ Declining' },
}

export default function ValidatorPage() {
  const [keyword, setKeyword]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [step, setStep]         = useState(0)
  const [progress, setProgress] = useState(0)
  const [result, setResult]     = useState<AnalysisResult | null>(null)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function runAnalysis(kw: string) {
    if (!kw.trim() || loading) return
    setLoading(true)
    setResult(null)
    setSaved(false)
    setError(null)
    setStep(0)
    setProgress(0)

    // Animate loading steps
    const STEP_TIMES = [600, 900, 700, 500, 400, 400]
    const totalTime  = STEP_TIMES.reduce((a, b) => a + b, 0)
    let elapsed = 0
    const stepTimers: ReturnType<typeof setTimeout>[] = []

    STEP_TIMES.forEach((dur, i) => {
      elapsed += dur
      stepTimers.push(setTimeout(() => setStep(i + 1), elapsed - dur + 60))
    })

    const progressStart = Date.now()
    const tickProgress = () => {
      const pct = Math.min(94, ((Date.now() - progressStart) / totalTime) * 100)
      setProgress(pct)
      if (pct < 94) requestAnimationFrame(tickProgress)
    }
    requestAnimationFrame(tickProgress)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/analyse-keyword`,
        {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${session?.access_token ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ keyword: kw.trim() }),
        },
      )

      stepTimers.forEach(clearTimeout)
      setProgress(100)

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }

      const data: AnalysisResult = await res.json()
      setTimeout(() => { setResult(data); setLoading(false) }, 200)
    } catch (err) {
      stepTimers.forEach(clearTimeout)
      setError((err as Error).message)
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!result) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Save as a project_analysis under user's default project
    // If no project exists, create a "Saved Niches" default project first
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    let projectId = project?.id
    if (!projectId) {
      const { data: newProj } = await supabase.from('projects').insert({
        user_id:     user.id,
        name:        'Saved Niches',
        description: 'Default project — auto-created',
      }).select('id').single()
      projectId = newProj?.id
    }

    if (!projectId) return

    await supabase.from('project_analyses').insert({
      project_id: projectId,
      user_id:    user.id,
      keyword:    result.keyword,
    })

    setSaved(true)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') runAnalysis(keyword)
  }

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '28px 32px 60px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: '22px', fontWeight: 800, lineHeight: 1.2 }}>
            Niche Validator
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '3px' }}>
            Enter a niche keyword — get your GO / INVESTIGATE / SKIP verdict in 60 seconds
          </p>
        </div>
      </div>

      {/* Search box */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
        <input
          ref={inputRef}
          type="text"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. robot vacuum cleaner, dog GPS tracker, air fryer accessories…"
          autoComplete="off"
          style={{
            flex:         1,
            background:   'var(--surface)',
            border:       '1px solid var(--border2)',
            borderRadius: '8px',
            padding:      '12px 16px',
            fontSize:     '14px',
            color:        'var(--text)',
            outline:      'none',
          }}
        />
        <Button
          onClick={() => runAnalysis(keyword)}
          disabled={loading || !keyword.trim()}
          size="lg"
        >
          Analyse Niche
        </Button>
      </div>

      {/* Examples */}
      <div style={{ fontSize: '12px', color: 'var(--subtle)', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
        Try:
        {EXAMPLES.map(ex => (
          <button
            key={ex}
            onClick={() => { setKeyword(ex); runAnalysis(ex) }}
            style={{
              background: 'var(--surface2)',
              border:     '1px solid var(--border)',
              color:      'var(--muted)',
              fontSize:   '11px',
              padding:    '3px 9px',
              borderRadius: '12px',
              cursor:     'pointer',
              transition: 'all .12s',
            }}
          >
            {ex}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: 'var(--skip-bg)', border: '1px solid var(--skip-b)',
          borderRadius: '8px', padding: '14px 18px', marginBottom: '16px',
          fontSize: '13px', color: 'var(--skip)',
        }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '10px', padding: '28px 32px',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            {LOADING_STEPS.map((s, i) => (
              <div
                key={i}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize:   '12px',
                  color:      i < step ? 'var(--muted)' : i === step ? 'var(--go)' : 'var(--subtle)',
                  transition: 'color .2s',
                }}
              >
                {i < step ? '✓' : i === step ? '●' : '○'} {s}
              </div>
            ))}
          </div>
          <div style={{ background: 'var(--border)', borderRadius: '4px', height: '3px', overflow: 'hidden', marginTop: '20px' }}>
            <div style={{
              height: '100%', background: 'var(--go)',
              width: `${progress}%`, transition: 'width .3s ease', borderRadius: '4px',
            }} />
          </div>
          <div style={{ fontSize: '11px', color: 'var(--subtle)', marginTop: '10px', fontStyle: 'italic' }}>
            Pulling live data from 5 sources
          </div>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <>
          {/* Result header */}
          <div style={{
            background: 'var(--surface)',
            border: `1px solid ${VERDICT_BORDER[result.verdict] ?? 'var(--border)'}`,
            borderRadius: '10px',
            padding: '24px 28px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div>
                <VerdictBadge verdict={result.verdict} size="lg" />
                <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>
                  {result.keyword}
                </div>
              </div>
            </div>

            <ScoreRing score={result.overallScore} verdict={result.verdict} />

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600,
                letterSpacing: '.06em', textTransform: 'uppercase',
                padding: '3px 8px', borderRadius: '3px',
                border: '1px solid var(--border2)', color: 'var(--muted)',
              }}>
                {result.category}
              </span>
              <span style={{
                fontFamily:    'var(--font-mono)',
                fontSize:      '10px',
                fontWeight:    600,
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                padding:       '3px 8px',
                borderRadius:  '3px',
                border:        `1px solid ${TREND_STYLE[result.trendDirection]?.color ?? 'var(--border2)'}`,
                color:         TREND_STYLE[result.trendDirection]?.color ?? 'var(--muted)',
              }}>
                {TREND_STYLE[result.trendDirection]?.label ?? result.trendDirection}
              </span>
            </div>

            <button
              onClick={handleSave}
              disabled={saved}
              style={{
                marginLeft:   'auto',
                background:   'transparent',
                border:       '1px solid var(--border2)',
                color:        saved ? 'var(--go)' : 'var(--muted)',
                fontSize:     '12px',
                fontWeight:   600,
                padding:      '7px 14px',
                borderRadius: '6px',
                cursor:       saved ? 'default' : 'pointer',
                transition:   'all .12s',
              }}
            >
              {saved ? '✓ Saved' : '+ Save to Projects'}
            </button>
          </div>

          {/* Score panels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '16px' }}>
            <DimensionBar
              title="DEMAND"
              score={result.demandScore}
              variant="demand"
              factors={[
                { label: 'Monthly search volume',    value: Math.round(result.demandScore * 0.95) },
                { label: 'Google Trends 12-mo',      value: result.trendDirection === 'rising' ? Math.min(99, result.demandScore + 8) : result.trendDirection === 'stable' ? result.demandScore - 5 : result.demandScore - 18 },
                { label: 'Amazon product depth',     value: Math.round(result.demandScore * 0.88) },
                { label: 'Rising related queries',   value: Math.round(result.demandScore * 0.76) },
              ]}
            />
            <DimensionBar
              title="COMPETITION"
              score={result.competitionScore}
              variant="competition"
              factors={[
                { label: 'Competitor avg DR (inv.)',  value: result.competitionScore },
                { label: 'Content gap opportunity',  value: Math.min(99, Math.round(result.competitionScore * 1.08)) },
                { label: 'Big-brand share (inv.)',    value: 100 - result.bigBrandPct },
                { label: 'Forum results present',    value: result.hasForumResults ? 74 : 32 },
              ]}
            />
            <DimensionBar
              title="MONEY"
              score={result.moneyScore}
              variant="money"
              factors={[
                { label: 'CPC signal',               value: Math.min(99, Math.round(result.cpc * 13)) },
                { label: 'Amazon commission rate',   value: Math.round(result.moneyScore * 0.9) },
                { label: 'Affiliate programmes',     value: (result.affiliateProgrammes?.length ?? 0) * 18 },
                { label: 'Advertiser competition',   value: Math.round(result.moneyScore * 0.82) },
              ]}
            />
          </div>

          {/* Result grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <CoachPanel coachText={result.coachText} />

            {/* Key numbers */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '20px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--subtle)', marginBottom: '12px' }}>
                Key Numbers
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {[
                  { val: (result.searchVolume > 10000 ? Math.round(result.searchVolume / 1000) * 1000 : Math.round(result.searchVolume / 100) * 100).toLocaleString(), label: 'monthly searches' },
                  { val: `DR ${result.avgDR}`, label: 'avg competitor DR' },
                  { val: `£${result.cpc.toFixed(2)}`, label: 'avg CPC' },
                  { val: `${result.amazonCommission}%`, label: 'Amazon commission' },
                ].map((kpi, i) => (
                  <div key={i}>
                    <div style={{ fontFamily: 'var(--font-brand)', fontSize: '20px', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                      {kpi.val}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--subtle)', marginTop: '2px' }}>
                      {kpi.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Affiliate signal */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '20px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--subtle)', marginBottom: '12px' }}>
                Affiliate Signal
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {[
                  { val: String(result.affiliateProgrammes?.length ?? 0), label: 'programmes found' },
                  { val: `${result.bigBrandPct}%`, label: 'big brand SERP share' },
                  { val: result.hasForumResults ? 'Yes' : 'No', label: 'forum results' },
                  { val: result.trendDirection, label: 'trend direction' },
                ].map((kpi, i) => (
                  <div key={i}>
                    <div style={{ fontFamily: 'var(--font-brand)', fontSize: '20px', fontWeight: 800 }}>
                      {kpi.val}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--subtle)', marginTop: '2px' }}>
                      {kpi.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Affiliate programmes + content angles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {result.affiliateProgrammes?.length > 0 && (
              <AffiliateTable programmes={result.affiliateProgrammes} />
            )}
            {result.contentAngles?.length > 0 && (
              <ContentAngles angles={result.contentAngles} />
            )}
          </div>
        </>
      )}
    </div>
  )
}
