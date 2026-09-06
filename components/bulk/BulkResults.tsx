import VerdictBadge from '@/components/analysis/VerdictBadge'
import type { Verdict } from '@/lib/scoring/index'

interface BulkResultRow {
  keyword:         string
  overallScore:    number
  verdict:         Verdict
  demandScore:     number
  competitionScore: number
  moneyScore:      number
}

interface BulkResultsProps {
  results: BulkResultRow[]
}

export default function BulkResults({ results }: BulkResultsProps) {
  if (!results.length) return null

  return (
    <div>
      {results.map((r, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '8px 0',
            borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
            fontSize: '12px',
          }}
        >
          <VerdictBadge verdict={r.verdict} size="sm" />
          <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>
            {r.keyword}
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: 'var(--muted)',
            minWidth: '48px',
            textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {r.overallScore}/100
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            color: 'var(--subtle)',
            minWidth: '100px',
            textAlign: 'right',
          }}>
            D:{r.demandScore} C:{r.competitionScore} M:{r.moneyScore}
          </span>
        </div>
      ))}
    </div>
  )
}
