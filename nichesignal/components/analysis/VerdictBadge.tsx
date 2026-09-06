import type { Verdict } from '@/lib/scoring/index'

interface VerdictBadgeProps {
  verdict: Verdict
  size?: 'sm' | 'md' | 'lg'
}

const VERDICT_STYLES: Record<Verdict, { color: string; bg: string; border: string; icon: string }> = {
  GO:          { color: 'var(--go)',   bg: 'var(--go-bg)',   border: 'var(--go-b)',   icon: '●' },
  INVESTIGATE: { color: 'var(--inv)',  bg: 'var(--inv-bg)',  border: 'var(--inv-b)',  icon: '◐' },
  SKIP:        { color: 'var(--skip)', bg: 'var(--skip-bg)', border: 'var(--skip-b)', icon: '○' },
}

const FONT_SIZES = { sm: '11px', md: '13px', lg: '26px' }
const PADDING    = { sm: '2px 7px', md: '4px 10px', lg: '0' }

export default function VerdictBadge({ verdict, size = 'md' }: VerdictBadgeProps) {
  const s = VERDICT_STYLES[verdict]

  if (size === 'lg') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{
          fontSize: '28px',
          color: s.color,
          textShadow: `0 0 16px ${s.color}`,
          lineHeight: 1,
        }}>
          {s.icon}
        </span>
        <span style={{
          fontFamily: 'var(--font-brand)',
          fontSize: '26px',
          fontWeight: 800,
          color: s.color,
          lineHeight: 1,
        }}>
          {verdict}
        </span>
      </div>
    )
  }

  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: FONT_SIZES[size],
      fontWeight: 600,
      color: s.color,
      background: size !== 'sm' ? s.bg : 'transparent',
      border: size !== 'sm' ? `1px solid ${s.border}` : 'none',
      padding: PADDING[size],
      borderRadius: '3px',
      letterSpacing: '.06em',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      whiteSpace: 'nowrap',
    }}>
      {s.icon} {verdict}
    </span>
  )
}
