'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import BulkResults from '@/components/bulk/BulkResults'
import Button from '@/components/ui/Button'
import type { Verdict } from '@/lib/scoring/index'

interface BulkResultRow {
  keyword:          string
  overallScore:     number
  verdict:          Verdict
  demandScore:      number
  competitionScore: number
  moneyScore:       number
}

export default function BulkPage() {
  const [rawInput, setRawInput] = useState('')
  const [results, setResults]   = useState<BulkResultRow[]>([])
  const [running, setRunning]   = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError]       = useState<string | null>(null)

  async function runBatch() {
    const keywords = rawInput
      .split('\n')
      .map(k => k.trim())
      .filter(Boolean)
      .slice(0, 25)

    if (!keywords.length) return

    setRunning(true)
    setResults([])
    setError(null)
    setProgress({ done: 0, total: keywords.length })

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/bulk-analyse`,
        {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${session?.access_token ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ keywords }),
        },
      )

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }

      const data = await res.json()
      const mapped: BulkResultRow[] = (data.results ?? []).map((r: {
        keyword: string; overallScore: number; verdict: Verdict;
        demandScore: number; competitionScore: number; moneyScore: number
      }) => ({
        keyword:          r.keyword,
        overallScore:     r.overallScore,
        verdict:          r.verdict,
        demandScore:      r.demandScore,
        competitionScore: r.competitionScore,
        moneyScore:       r.moneyScore,
      }))

      setResults(mapped)
      setProgress({ done: data.processed ?? mapped.length, total: keywords.length })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setRunning(false)
    }
  }

  function clearAll() {
    setRawInput('')
    setResults([])
    setError(null)
    setProgress({ done: 0, total: 0 })
  }

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '28px 32px 60px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: '22px', fontWeight: 800, lineHeight: 1.2 }}>
          Bulk Scanner
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '3px' }}>
          Analyse up to 25 niches at once — one per line
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Input panel */}
        <div>
          <textarea
            value={rawInput}
            onChange={e => setRawInput(e.target.value)}
            placeholder={`robot vacuum cleaner\nair fryer accessories\ndog gps tracker\nelectric toothbrush kids\nportable projector 4k\ncamping cookware\nyoga mat thick`}
            style={{
              width:        '100%',
              height:       '280px',
              background:   'var(--surface)',
              border:       '1px solid var(--border2)',
              borderRadius: '8px',
              padding:      '14px',
              fontFamily:   'var(--font-mono)',
              fontSize:     '12px',
              color:        'var(--text)',
              resize:       'vertical',
              outline:      'none',
              lineHeight:   1.7,
            }}
          />
          <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
            <Button onClick={runBatch} disabled={running || !rawInput.trim()}>
              {running ? 'Running…' : 'Run Batch Analysis'}
            </Button>
            <Button variant="secondary" onClick={clearAll}>
              Clear
            </Button>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--subtle)', marginTop: '10px' }}>
            Max 25 keywords. Each is analysed with 200ms stagger to protect rate limits.
          </p>
        </div>

        {/* Results panel */}
        <div>
          {error && (
            <div style={{
              background: 'var(--skip-bg)', border: '1px solid var(--skip-b)',
              borderRadius: '6px', padding: '12px', fontSize: '13px',
              color: 'var(--skip)', marginBottom: '12px',
            }}>
              {error}
            </div>
          )}

          {running && progress.total > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>
                Processing {progress.done}/{progress.total}…
              </div>
              <div style={{ background: 'var(--border)', borderRadius: '3px', height: '3px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', background: 'var(--go)', borderRadius: '3px',
                  width: `${Math.round((progress.done / progress.total) * 100)}%`,
                  transition: 'width .3s ease',
                }} />
              </div>
            </div>
          )}

          {!running && results.length > 0 && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--go)', padding: '8px 0', marginBottom: '8px' }}>
              ✓ Batch complete — {results.length} niches analysed
            </div>
          )}

          <BulkResults results={results} />
        </div>
      </div>
    </div>
  )
}
