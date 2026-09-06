import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export default function Input({ label, style, ...props }: InputProps) {
  const inputStyle: React.CSSProperties = {
    width:        '100%',
    background:   'var(--surface)',
    border:       '1px solid var(--border2)',
    borderRadius: '8px',
    padding:      '12px 16px',
    fontSize:     '14px',
    color:        'var(--text)',
    outline:      'none',
    fontFamily:   'inherit',
    ...style,
  }

  if (!label) return <input style={inputStyle} {...props} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{
        fontSize:      '12px',
        color:         'var(--muted)',
        fontFamily:    'var(--font-mono)',
        letterSpacing: '.06em',
        textTransform: 'uppercase',
      }}>
        {label}
      </label>
      <input style={inputStyle} {...props} />
    </div>
  )
}
