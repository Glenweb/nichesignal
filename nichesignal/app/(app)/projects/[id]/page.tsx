import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import VerdictBadge from '@/components/analysis/VerdictBadge'
import type { Verdict } from '@/lib/scoring/index'

export default async function ProjectDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: project } = await supabase
    .from('projects')
    .select(`
      id, name, description, created_at,
      project_analyses (
        id, keyword, starred, notes, created_at, analysis_id,
        keyword_analyses ( overall_score, verdict, demand_score, competition_score, money_score, trend_direction )
      )
    `)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!project) notFound()

  const analyses = (project.project_analyses ?? []) as Array<{
    id: string
    keyword: string
    starred: boolean
    notes: string | null
    created_at: string
    keyword_analyses: { overall_score: number; verdict: Verdict; demand_score: number; competition_score: number; money_score: number; trend_direction: string } | null
  }>

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '28px 32px 60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>
            <Link href="/projects" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
              Projects
            </Link>
            {' / '}
            <span style={{ color: 'var(--text)' }}>{project.name}</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: '22px', fontWeight: 800, lineHeight: 1.2 }}>
            {project.name}
          </h1>
          {project.description && (
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '3px' }}>{project.description}</p>
          )}
        </div>
        <Link href="/validator" style={{
          display: 'inline-flex', alignItems: 'center',
          background: 'var(--surface)', border: '1px solid var(--border2)',
          color: 'var(--text)', fontSize: '13px', fontWeight: 500,
          padding: '8px 16px', borderRadius: '6px', textDecoration: 'none',
        }}>
          + New Analysis
        </Link>
      </div>

      {analyses.length === 0 ? (
        <div style={{
          fontSize: '13px', color: 'var(--subtle)', padding: '32px',
          textAlign: 'center', background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: '8px',
        }}>
          No analyses saved to this project yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {analyses.map((pa, i) => {
            const ana = pa.keyword_analyses
            return (
              <Link
                key={pa.id}
                href={`/validator?kw=${encodeURIComponent(pa.keyword)}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: '7px', padding: '12px 16px',
                  textDecoration: 'none', transition: 'border-color .12s',
                }}
              >
                {ana?.verdict && <VerdictBadge verdict={ana.verdict} size="sm" />}
                <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>
                  {pa.keyword}
                </span>
                {ana && (
                  <>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {ana.overall_score}/100
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--subtle)' }}>
                      D:{ana.demand_score} C:{ana.competition_score} M:{ana.money_score}
                    </span>
                  </>
                )}
                <span style={{ fontSize: '11px', color: 'var(--subtle)', minWidth: '80px', textAlign: 'right' }}>
                  {new Date(pa.created_at).toLocaleDateString('en-GB')}
                </span>
                {pa.starred && <span style={{ color: 'var(--inv)' }}>★</span>}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
