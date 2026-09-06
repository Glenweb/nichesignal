import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
  size?:    'sm' | 'md' | 'lg'
}

const BASE: React.CSSProperties = {
  fontFamily:  'inherit',
  fontWeight:  700,
  borderRadius: '7px',
  border:      'none',
  cursor:      'pointer',
  transition:  'opacity .15s',
  lineHeight:  1,
  display:     'inline-flex',
  alignItems:  'center',
  justifyContent: 'center',
  gap:         '6px',
}

const VARIANTS: Record<string, React.CSSProperties> = {
  primary:   { background: 'var(--go)',   color: '#0D1117' },
  secondary: { background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--text)', fontWeight: 500 },
  danger:    { background: 'var(--skip-bg)', border: '1px solid var(--skip-b)', color: 'var(--skip)', fontWeight: 500 },
}

const SIZES: Record<string, React.CSSProperties> = {
  sm: { fontSize: '12px', padding: '6px 12px' },
  md: { fontSize: '13px', padding: '10px 18px' },
  lg: { fontSize: '14px', padding: '12px 22px' },
}

export default function Button({
  variant = 'primary',
  size = 'md',
  style,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled}
      style={{
        ...BASE,
        ...VARIANTS[variant],
        ...SIZES[size],
        opacity: disabled ? 0.5 : 1,
        cursor:  disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  )
}
