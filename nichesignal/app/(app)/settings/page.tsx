'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ScoringWeights {
  demand:      number
  competition: number
  money:       number
}

export default function SettingsPage() {
  const [email, setEmail]           = useState('')
  const [plan, setPlan]             = useState('agency')
  const [weights, setWeights]       = useState<ScoringWeights>({ demand: 40, competition: 35, money: 25 })
  const [saved, setSaved]           = useState(false)
  const [loading, setLoading]       = useState(true)

  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setEmail(user.email ?? '')

      const { data: profile } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', user.id)
        .maybeSingle()

      if (profile?.plan) setPlan(profile.plan)

      // Load saved weights from localStorage
      try {
        const stored = localStorage.getItem('ns_weights')
        if (stored) setWeights(JSON.parse(stored))
      } catch {}

      setLoading(false)
    }
    load()
  }, [])

  function updateWeight(key: keyof ScoringWeights, value: number) {
    setWeights(prev => ({ ...prev, [key]: value }))
  }

  function saveWeights() {
    try {
      localStorage.setItem('ns_weights', JSON.stringify(weights))
    } catch {}
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const totalWeight = weights.demand + weights.competition + weights.money

  const sectionStyle: React.CSSProperties = {
    background:   'var(--surface)',
    border:       '1px solid var(--border)',
    borderRadius: '8px',
    padding:      '20px',
  }

  const titleStyle: React.CSSProperties = {
    fontFamily:    'var(--font-mono)',
    fontSize:      '10px',
    fontWeight:    600,
    letterSpacing: '.10em',
    textTransform: 'uppercase',
    color:         'var(--subtle)',
    marginBottom:  '14px',
  }

  const rowStyle: React.CSSProperties = {
    display:       'flex',
    alignItems:    'center',
    gap:           '14px',
    padding:       '8px 0',
    borderBottom:  '1px solid var(--border)',
  }

  const labelStyle: React.CSSProperties = {
    fontSize:  '13px',
    color:     'var(--muted)',
    minWidth:  '160px',
    flexShrink: 0,
  }

  if (loading) return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '28px 32px 60px' }}>
      <div style={{ fontSize: '13px', color: 'var(--muted)', padding: '20px 0' }}>Loading…</div>
    </div>
  )

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '28px 32px 60px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: '22px', fontWeight: 800, lineHeight: 1.2 }}>
          Settings
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '3px' }}>
          Account details and scoring weight customisation
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Account */}
        <div style={sectionStyle}>
          <div style={titleStyle}>Account</div>
          <div style={rowStyle}>
            <div style={labelStyle}>Plan</div>
            <div>
              <span style={{
                fontFamily:    'var(--font-mono)',
                fontSize:      '12px',
                fontWeight:    600,
                color:         'var(--go)',
                border:        '1px solid var(--go-b)',
                background:    'var(--go-bg)',
                padding:       '4px 12px',
                borderRadius:  '4px',
                letterSpacing: '.06em',
                textTransform: 'uppercase',
              }}>
                {plan}
              </span>
            </div>
          </div>
          <div style={{ ...rowStyle, borderBottom: 'none' }}>
            <div style={labelStyle}>Email</div>
            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>
              {email}
            </div>
          </div>
        </div>

        {/* API Keys info */}
        <div style={sectionStyle}>
          <div style={titleStyle}>API Keys</div>
          <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
            API keys are stored as Supabase Edge Function secrets — never in the browser.
            To update them, use the Supabase Dashboard:{' '}
            <strong style={{ color: 'var(--text)' }}>
              Edge Functions → Secrets
            </strong>
          </p>
          <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { key: 'KEYWORDS_EVERYWHERE_API_KEY', label: 'Keywords Everywhere' },
              { key: 'DATAFORSEO_LOGIN',            label: 'DataForSEO Login' },
              { key: 'DATAFORSEO_PASSWORD',         label: 'DataForSEO Password' },
              { key: 'AMAZON_PA_ACCESS_KEY',        label: 'Amazon PA API Key' },
              { key: 'ANTHROPIC_API_KEY',           label: 'Anthropic (NicheCoach)' },
              { key: 'UPSTASH_REDIS_REST_URL',      label: 'Upstash Redis URL' },
              { key: 'UPSTASH_REDIS_REST_TOKEN',    label: 'Upstash Redis Token' },
            ].map(s => (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--subtle)', minWidth: '280px' }}>
                  {s.key}
                </span>
                <span style={{ color: 'var(--muted)' }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Scoring weights */}
        <div style={sectionStyle}>
          <div style={titleStyle}>Scoring Weights</div>

          {(['demand', 'competition', 'money'] as (keyof ScoringWeights)[]).map(key => (
            <div key={key} style={{ ...rowStyle, borderBottom: key !== 'money' ? '1px solid var(--border)' : 'none' }}>
              <div style={labelStyle}>
                {key.charAt(0).toUpperCase() + key.slice(1)} weight
              </div>
              <input
                type="range"
                min={10}
                max={60}
                value={weights[key]}
                onChange={e => updateWeight(key, parseInt(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--go)', cursor: 'pointer' }}
              />
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize:   '12px',
                color:      'var(--go)',
                minWidth:   '36px',
                textAlign:  'right',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {weights[key]}%
              </span>
            </div>
          ))}

          <div style={{
            marginTop:    '12px',
            background:   'var(--surface2)',
            border:       '1px solid var(--border)',
            borderRadius: '5px',
            padding:      '10px 14px',
            fontFamily:   'var(--font-mono)',
            fontSize:     '11px',
            color:        'var(--muted)',
            lineHeight:   1.6,
          }}>
            NicheScore = (Demand × {weights.demand}%) + (Competition × {weights.competition}%) + (Money × {weights.money}%)
            {totalWeight !== 100 && (
              <div style={{ color: 'var(--inv)', marginTop: '4px' }}>
                Warning: weights sum to {totalWeight}% (should be 100%)
              </div>
            )}
          </div>

          <button
            onClick={saveWeights}
            style={{
              marginTop:    '14px',
              background:   'var(--surface)',
              border:       '1px solid var(--border2)',
              color:        saved ? 'var(--go)' : 'var(--text)',
              fontSize:     '13px',
              fontWeight:   500,
              padding:      '8px 16px',
              borderRadius: '6px',
              cursor:       'pointer',
              transition:   'all .12s',
            }}
          >
            {saved ? '✓ Saved' : 'Save Weights'}
          </button>
        </div>
      </div>
    </div>
  )
}
