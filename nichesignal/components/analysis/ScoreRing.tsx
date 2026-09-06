interface ScoreRingProps {
  score:   number
  verdict: 'GO' | 'INVESTIGATE' | 'SKIP'
}

const VERDICT_COLOR: Record<string, string> = {
  GO:          'var(--go)',
  INVESTIGATE: 'var(--inv)',
  SKIP:        'var(--skip)',
}

export default function ScoreRing({ score, verdict }: ScoreRingProps) {
  const color = VERDICT_COLOR[verdict] ?? 'var(--go)'

  return (
    <div style={{
      fontFamily: 'var(--font-brand)',
      fontSize: '44px',
      fontWeight: 800,
      color: 'var(--text)',
      lineHeight: 1,
      marginLeft: 'auto',
    }}>
      {score}
      <span style={{ fontSize: '18px', color: 'var(--subtle)', fontWeight: 700 }}>/100</span>
    </div>
  )
}
