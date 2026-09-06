'use client'

import { useState } from 'react'

interface ContentAnglesProps {
  angles: string[]
}

export default function ContentAngles({ angles }: ContentAnglesProps) {
  const [copied, setCopied] = useState<number | null>(null)

  async function copyAngle(text: string, index: number) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(index)
      setTimeout(() => setCopied(null), 1800)
    } catch {
      // clipboard not available
    }
  }

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
        Content Angles — Ready to Brief
      </div>

      {angles.map((angle, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 0',
            borderBottom: i < angles.length - 1 ? '1px solid var(--border)' : 'none',
          }}
        >
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--subtle)',
            minWidth: '22px',
          }}>
            0{i + 1}
          </span>
          <span style={{ flex: 1, fontSize: '13px', color: 'var(--text)' }}>
            {angle}
          </span>
          <button
            onClick={() => copyAngle(angle, i)}
            style={{
              fontSize: '11px',
              color: copied === i ? 'var(--go)' : 'var(--muted)',
              border: `1px solid ${copied === i ? 'var(--go-b)' : 'var(--border2)'}`,
              borderRadius: '4px',
              padding: '3px 8px',
              background: 'none',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all .12s',
            }}
          >
            {copied === i ? 'Copied' : 'Copy'}
          </button>
        </div>
      ))}
    </div>
  )
}
