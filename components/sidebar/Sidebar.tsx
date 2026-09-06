'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV_ITEMS = [
  { href: '/validator', label: 'Validator',    icon: '⊕' },
  { href: '/projects',  label: 'Projects',     icon: '▤' },
  { href: '/bulk',      label: 'Bulk Scanner', icon: '≡' },
  { href: '/watch',     label: 'Niche Watch',  icon: '◉' },
]

interface SidebarProps {
  userEmail?: string
  plan?: string
}

export default function Sidebar({ userEmail, plan = 'agency' }: SidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const displayName = userEmail ? userEmail.split('@')[0] : 'User'

  return (
    <aside style={{
      width: 'var(--sidebar-w)',
      minWidth: 'var(--sidebar-w)',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{
        padding: '20px 16px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          width: '28px', height: '28px',
          background: 'var(--go)',
          borderRadius: '6px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-brand)', fontWeight: 800, fontSize: '14px', color: '#0D1117',
          flexShrink: 0,
        }}>N</div>
        <span style={{ fontFamily: 'var(--font-brand)', fontSize: '15px', fontWeight: 700 }}>
          Niche<strong style={{ color: 'var(--go)' }}>Signal</strong>
        </span>
      </div>

      {/* Nav */}
      <nav style={{
        flex: 1,
        padding: '12px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        overflowY: 'auto',
      }}>
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
                padding: '8px 10px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                textDecoration: 'none',
                color: active ? 'var(--go)' : 'var(--muted)',
                background: active ? 'var(--go-bg)' : 'transparent',
                transition: 'background .12s, color .12s',
              }}
            >
              <span style={{ fontSize: '14px', width: '16px', textAlign: 'center', flexShrink: 0 }}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div style={{
        padding: '12px 8px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
      }}>
        <Link
          href="/settings"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '9px',
            padding: '8px 10px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 500,
            textDecoration: 'none',
            color: pathname === '/settings' ? 'var(--go)' : 'var(--muted)',
            background: pathname === '/settings' ? 'var(--go-bg)' : 'transparent',
          }}
        >
          <span style={{ fontSize: '14px', width: '16px', textAlign: 'center' }}>⚙</span>
          Settings
        </Link>

        {/* User info */}
        <div style={{ padding: '10px 10px 4px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
            {displayName}
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            color: 'var(--go)',
            letterSpacing: '.06em',
            textTransform: 'uppercase',
            marginBottom: '6px',
          }}>
            {plan} plan
          </div>
          <button
            onClick={handleSignOut}
            style={{
              fontSize: '11px',
              color: 'var(--muted)',
              background: 'none',
              border: 'none',
              padding: '0',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  )
}
