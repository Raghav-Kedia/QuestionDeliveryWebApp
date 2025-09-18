import './globals.css'
import type { Metadata } from 'next'
import { ReactNode } from 'react'
import { Shell } from '@/components/ui/shell'

export const metadata: Metadata = {
  title: 'Daily Question Delivery',
  description: 'Deliver daily questions with scheduled unlocks',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Inter:wght@400;600&family=Roboto:wght@400;500;700&family=Fira+Code:wght@400;500&family=Emilys+Candy&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  )
}
