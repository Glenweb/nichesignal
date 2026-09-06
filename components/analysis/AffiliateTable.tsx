interface AffiliateProgramme {
  name:           string
  commissionRate: string
  network:        string
  type:           string
}

interface AffiliateTableProps {
  programmes: AffiliateProgramme[]
}

export default function AffiliateTable({ programmes }: AffiliateTableProps) {
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
        Affiliate Programmes Detected
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr>
              {['Programme', 'Commission', 'Network', 'Type'].map(h => (
                <th key={h} style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                  color: 'var(--subtle)',
                  textAlign: 'left',
                  padding: '6px 10px',
                  borderBottom: '1px solid var(--border2)',
                  fontWeight: 500,
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {programmes.map((p, i) => (
              <tr key={i}>
                <td style={{
                  padding: '9px 10px',
                  color: 'var(--text)',
                  fontWeight: 500,
                  borderBottom: i < programmes.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  {p.name}
                </td>
                <td style={{
                  padding: '9px 10px',
                  color: 'var(--muted)',
                  borderBottom: i < programmes.length - 1 ? '1px solid var(--border)' : 'none',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {p.commissionRate}
                </td>
                <td style={{
                  padding: '9px 10px',
                  borderBottom: i < programmes.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border2)',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    color: 'var(--muted)',
                  }}>
                    {p.network}
                  </span>
                </td>
                <td style={{
                  padding: '9px 10px',
                  borderBottom: i < programmes.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border2)',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    color: 'var(--muted)',
                  }}>
                    {p.type}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
