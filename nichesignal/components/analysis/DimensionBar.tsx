interface FactorRowProps {
  label: string
  value: number
  color?: string
}

function FactorRow({ label, value, color = 'var(--go-b)' }: FactorRowProps) {
  const safe = Math.min(100, Math.max(0, value))
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
      <span style={{
        fontSize: '11px',
        color: 'var(--subtle)',
        flex: 1,
        minWidth: 0,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {label}
      </span>
      <div style={{
        width: '60px',
        background: 'var(--border)',
        borderRadius: '2px',
        height: '3px',
        flexShrink: 0,
      }}>
        <div style={{
          height: '100%',
          borderRadius: '2px',
          background: color,
          width: `${safe}%`,
          transition: 'width .5s ease',
        }} />
      </div>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        color: 'var(--muted)',
        minWidth: '24px',
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {safe}
      </span>
    </div>
  )
}

interface DimensionBarProps {
  title:   string
  score:   number
  variant: 'demand' | 'competition' | 'money'
  factors: Array<{ label: string; value: number }>
}

const VARIANT_COLOR: Record<string, string> = {
  demand:      'var(--go)',
  competition: 'var(--inv)',
  money:       'var(--go)',
}

const VARIANT_BAR_COLOR: Record<string, string> = {
  demand:      'var(--go)',
  competition: 'var(--inv)',
  money:       'var(--go)',
}

const VARIANT_FACTOR_COLOR: Record<string, string> = {
  demand:      'var(--go-b)',
  competition: 'var(--inv-b)',
  money:       'var(--go-b)',
}

export default function DimensionBar({ title, score, variant, factors }: DimensionBarProps) {
  const textColor   = VARIANT_COLOR[variant]
  const barColor    = VARIANT_BAR_COLOR[variant]
  const factorColor = VARIANT_FACTOR_COLOR[variant]
  const safe        = Math.min(100, Math.max(0, score))

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      padding: '18px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          fontWeight: 600,
          letterSpacing: '.10em',
          textTransform: 'uppercase',
          color: 'var(--subtle)',
        }}>
          {title}
        </span>
        <span style={{
          fontFamily: 'var(--font-brand)',
          fontSize: '22px',
          fontWeight: 800,
          color: textColor,
        }}>
          {safe}
        </span>
      </div>

      <div style={{
        background: 'var(--border)',
        borderRadius: '3px',
        height: '4px',
        marginBottom: '14px',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          borderRadius: '3px',
          background: barColor,
          width: `${safe}%`,
          transition: 'width .6s ease',
        }} />
      </div>

      <div>
        {factors.map((f, i) => (
          <FactorRow key={i} label={f.label} value={f.value} color={factorColor} />
        ))}
      </div>
    </div>
  )
}
