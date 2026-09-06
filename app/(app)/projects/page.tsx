import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import VerdictBadge from '@/components/analysis/VerdictBadge'
import type { Verdict } from '@/lib/scoring/index'

interface ProjectAnalysis {
  id:         string
  keyword:    string
  starred:    boolean
  created_at: string
  notes:      string | null
  analysis_id: string | null
  keyword_analyses: {
    overall_score:    number
    verdict:          Verdict
    demand_score:     number
    competition_score: number
    money_score:      number
  } | null
}

interface Project {
  id:          string
  name:        string
  description: string | null
  created_at:  string
  project_analyses: ProjectAnalysis[]
}

export default async function ProjectsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: projects } = await supabase
    .from('projects')
    .select(`
      id, name, description, created_at,
      project_analyses (
        id, keyword, starred, created_at, notes, analysis_id,
        keyword_analyses ( overall_score, verdict, demand_score, competition_score, money_score )
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const typedProjects = (projects ?? []) as Project[]

  // Also fetch standalone analyses (saved directly, not in a named project)
  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '28px 32px 60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: '22px', fontWeight: 800, lineHeight: 1.2 }}>
            Projects
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '3px' }}>
            {typedProjects.length} project{typedProjects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/validator"
          style={{
            display:      'inline-flex',
            alignItems:   'center',
            background:   'var(--surface)',
            border:       '1px solid var(--border2)',
            color:        'var(--text)',
            fontSize:     '13px',
            fontWeight:   500,
            padding:      '8px 16px',
            borderRadius: '6px',
            textDecoration: 'none',
          }}
        >
          + New Analysis
        </Link>
      </div>

      {typedProjects.length === 0 ? (
        <div style={{
          fontSize:     '13px',
          color:        'var(--subtle)',
          padding:      '32px',
          textAlign:    'center',
          background:   'var(--surface)',
          border:       '1px solid var(--border)',
          borderRadius: '8px',
        }}>
          No saved projects yet — run an analysis and click Save to Projects.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {typedProjects.map(project => (
            <div key={project.id} style={{
              background:   'var(--surface)',
              border:       '1px solid var(--border)',
              borderRadius: '8px',
              overflow:     'hidden',
            }}>
              {/* Project header */}
              <div style={{
                padding:        '14px 18px',
                borderBottom:   project.project_analyses.length > 0 ? '1px solid var(--border)' : 'none',
                display:        'flex',
                justifyContent: 'space-between',
                alignItems:     'center',
              }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>
                    {project.name}
                  </div>
                  {project.description && (
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                      {project.description}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--subtle)' }}>
                  {project.project_analyses.length} saved
                </div>
              </div>

              {/* Saved analyses */}
              {project.project_analyses.map((pa, i) => {
                const ana = pa.keyword_analyses
                return (
                  <Link
                    key={pa.id}
                    href={`/validator?kw=${encodeURIComponent(pa.keyword)}`}
                    style={{
                      display:       'flex',
                      alignItems:    'center',
                      gap:           '14px',
                      padding:       '10px 18px',
                      borderBottom:  i < project.project_analyses.length - 1 ? '1px solid var(--border)' : 'none',
                      textDecoration: 'none',
                      cursor:        'pointer',
                      transition:    'background .12s',
                    }}
                  >
                    {ana?.verdict && <VerdictBadge verdict={ana.verdict} size="sm" />}
                    <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>
                      {pa.keyword}
                    </span>
                    {ana && (
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize:   '12px',
                        color:      'var(--muted)',
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {ana.overall_score}/100
                      </span>
                    )}
                    <span style={{ fontSize: '11px', color: 'var(--subtle)', minWidth: '80px', textAlign: 'right' }}>
                      {new Date(pa.created_at).toLocaleDateString('en-GB')}
                    </span>
                  </Link>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
