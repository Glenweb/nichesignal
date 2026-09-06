interface CoachPanelProps {
  coachText: string
}

export default function CoachPanel({ coachText }: CoachPanelProps) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      padding: '20px',
      gridColumn: '1 / -1',
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        fontWeight: 600,
        letterSpacing: '.10em',
        textTransform: 'uppercase',
        color: 'var(--subtle)',
        marginBottom: '12px',
      }}>
        NicheCoach Analysis
      </div>
      <div
        style={{
          fontSize: '13px',
          lineHeight: 1.75,
          color: 'var(--muted)',
        }}
        dangerouslySetInnerHTML={{ __html: coachText }}
      />
    </div>
  )
}
