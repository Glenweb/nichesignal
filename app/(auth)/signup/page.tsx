'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/validator` },
    })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--surface2)',
    border: '1px solid var(--border2)',
    borderRadius: '6px',
    padding: '10px 12px',
    fontSize: '14px',
    color: 'var(--text)',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    color: 'var(--muted)',
    marginBottom: '6px',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '.06em',
    textTransform: 'uppercase',
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '380px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        padding: '32px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px' }}>
          <div style={{
            width: '32px', height: '32px',
            background: 'var(--go)', borderRadius: '6px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-brand)', fontWeight: 800, fontSize: '16px', color: '#0D1117',
          }}>N</div>
          <span style={{ fontFamily: 'var(--font-brand)', fontSize: '17px', fontWeight: 700 }}>
            Niche<strong style={{ color: 'var(--go)' }}>Signal</strong>
          </span>
        </div>

        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>●</div>
            <h2 style={{ fontFamily: 'var(--font-brand)', fontSize: '18px', fontWeight: 800, marginBottom: '8px' }}>
              Check your email
            </h2>
            <p style={{ color: 'var(--muted)', fontSize: '13px' }}>
              We sent a confirmation link to <strong style={{ color: 'var(--text)' }}>{email}</strong>.
              Click it to activate your account.
            </p>
          </div>
        ) : (
          <>
            <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: '20px', fontWeight: 800, marginBottom: '6px' }}>
              Create account
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '24px' }}>
              Start validating affiliate niches in 60 seconds.
            </p>

            <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Email</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  required autoComplete="email" placeholder="you@example.com"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Password</label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  required autoComplete="new-password" placeholder="Min 8 characters"
                  minLength={8} style={inputStyle}
                />
              </div>

              {error && (
                <div style={{
                  background: 'var(--skip-bg)', border: '1px solid var(--skip-b)',
                  borderRadius: '6px', padding: '10px 12px', fontSize: '13px', color: 'var(--skip)',
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit" disabled={loading}
                style={{
                  background: 'var(--go)', color: '#0D1117',
                  fontWeight: 700, fontSize: '14px', padding: '11px',
                  borderRadius: '7px', border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1, marginTop: '4px',
                }}
              >
                {loading ? 'Creating account…' : 'Create account'}
              </button>
            </form>

            <p style={{ marginTop: '20px', fontSize: '13px', color: 'var(--muted)', textAlign: 'center' }}>
              Already have an account?{' '}
              <Link href="/login" style={{ color: 'var(--go)', textDecoration: 'none' }}>Sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
