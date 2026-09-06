import type { Metadata } from 'next'
import { IBM_Plex_Sans, IBM_Plex_Mono, Syne } from 'next/font/google'
import './globals.css'

const ibmPlexSans = IBM_Plex_Sans({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const ibmPlexMono = IBM_Plex_Mono({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

const syne = Syne({
  weight: ['700', '800'],
  subsets: ['latin'],
  variable: '--font-brand',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'NicheSignal — Affiliate Niche Validator',
  description: 'Validate affiliate niches in 60 seconds. Get your GO / INVESTIGATE / SKIP verdict with real data.',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${ibmPlexSans.variable} ${ibmPlexMono.variable} ${syne.variable}`}
    >
      <body>{children}</body>
    </html>
  )
}
