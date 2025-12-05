import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MAXARI - Proces de Retur',
  description: 'Inițiază returul în câțiva pași simpli',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ro">
      <body>{children}</body>
    </html>
  )
}

