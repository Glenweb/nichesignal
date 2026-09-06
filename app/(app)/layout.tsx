import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/sidebar/Sidebar'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch profile for plan info
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      background: 'var(--bg)',
    }}>
      <Sidebar
        userEmail={user.email}
        plan={profile?.plan ?? 'agency'}
      />
      <main style={{
        flex: 1,
        overflowY: 'auto',
        background: 'var(--bg)',
      }}>
        {children}
      </main>
    </div>
  )
}
