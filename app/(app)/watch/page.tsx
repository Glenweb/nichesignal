'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import VerdictBadge from '@/components/analysis/VerdictBadge'
import Button from '@/components/ui/Button'
import type { Verdict } from '@/lib/scoring/index'

interface WatchRow {
  id:              string
  keyword:         string
  last_score:      number | null
  last_verdict:    Verdict | null
  alert_threshold: number
  last_checked_at: string | null
  created_at:      string
}

const TREND_LABEL: Record<string, string> = {
  rising:  '↑ Rising',
  stable:  '→ Stable',
  falling: '↓ Declining',
}

export default function WatchPage() {
  const [watches, setWatches]   = useState<WatchRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [newKeyword, setNewKeyword] = useState('')
  const [adding, setAdding]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    loadWatches()
  }, [])

  async function loadWatches() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data } = await supabase
      .from('watches')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    setWatches((data ?? []) as WatchRow[])
    setLoading(false)
  }

  async function addWatch() {
    const kw = newKeyword.trim()
    if (!kw || adding) return
    setAdding(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setAdding(false); return }

    const { error: err } = await supabase.from('watches').insert({
      user_id: user.id,
      keyword: kw.toLowerCase(),
    })

    if (err) {
      setError(err.message)
    } else {
      setNewKeyword('')
      await loadWatches()
    }
    setAdding(false)
  }

  async function removeWatch(id: string) {
    await supabase.from('watches').delete().eq('id', id)
    setWatches(prev => prev.filter(w => w.id !== id))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') addWatch()
  }

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '28px 32px 60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: '22px', fontWeight: 800, lineHeight: 1.2 }}>
            Niche Watch
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '3px' }}>
            Monitoring {watches.length} niche{watches.length !== 1 ? 's' : ''} for signal changes
          </p>
        </div>
      </div>

      {/* Add watch */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <input
          type="text"
          value={newKeyword}
          onChange={e => setNewKeyword(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a niche to monitor…"
          style={{
            flex:         1,
            background:   'var(--surface)',
            border:       '1px solid var(--border2)',
            borderRadius: '7px',
            padding:      '10px 14px',
            fontSize:     '13px',
            color:        'var(--text)',
            outline:      'none',
            fontFamily:   'inherit',
          }}
        />
        <Button variant="secondary" onClick={addWatch} disabled={adding || !newKeyword.trim()}>
          {adding ? 'Adding…' : '+ Watch'}
        </Button>
      </div>

      {error && (
        <div style={{
          background: 'var(--skip-bg)', border: '1px solid var(--skip-b)',
          borderRadius: '6px', padding: '10px 14px', fontSize: '13px',
          color: 'var(--skip)', marginBottom: '14px',
        }}>
          {error}
        </div>
      )}

      {/* Watch list */}
      {loading ? (
        <div style={{ fontSize: '13px', color: 'var(--muted)', padding: '20px 0' }}>Loading…</div>
      ) : watches.length === 0 ? (
        <div style={{
          fontSize: '13px', color: 'var(--subtle)', padding: '32px',
          textAlign: 'center', background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: '8px',
        }}>
          No monitored niches. Add one above — NicheSignal will check weekly and alert you to score changes.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {watches.map(w => (
            <div
              key={w.id}
              style={{
                background:   'var(--surface)',
                border:       '1px solid var(--border)',
                borderRadius: '8px',
                padding:      '14px 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                {w.last_verdict && <VerdictBadge verdict={w.last_verdict} size="sm" />}
                <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>
                  {w.keyword}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--muted)' }}>
                {w.last_score !== null && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                    {w.last_score}/100
                  </span>
                )}
                {!w.last_score && (
                  <span style={{ fontSize: '11px', color: 'var(--subtle)', fontStyle: 'italic' }}>
                    Not yet checked — runs weekly
                  </span>
                )}
                <span style={{ fontSize: '11px', color: 'var(--subtle)', marginLeft: 'auto' }}>
                  Added {new Date(w.created_at).toLocaleDateString('en-GB')}
                </span>
                {w.last_checked_at && (
                  <span style={{ fontSize: '11px', color: 'var(--subtle)' }}>
                    Last checked {new Date(w.last_checked_at).toLocaleDateString('en-GB')}
                  </span>
                )}
                <button
                  onClick={() => removeWatch(w.id)}
                  style={{
                    fontSize: '13px', color: 'var(--subtle)', padding: '2px 6px',
                    borderRadius: '4px', background: 'none', border: 'none',
                    cursor: 'pointer', transition: 'color .12s',
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p style={{ marginTop: '20px', fontSize: '12px', color: 'var(--subtle)' }}>
        Watches are polled every Monday at 08:00 UTC. You will be notified when a score changes by more than the threshold (default: 10 points).
      </p>
    </div>
  )
}
