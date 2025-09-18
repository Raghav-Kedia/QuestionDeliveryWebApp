"use client"
import { usePathname } from 'next/navigation'
import { Navbar } from '@/components/ui/navbar'

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isHome = pathname === '/'

  return (
    <div className={isHome ? 'min-h-screen na-gradient text-white' : 'min-h-screen bg-background text-foreground'}>
      {!isHome && <Navbar />}
      <main className={isHome ? 'flex min-h-[calc(100vh-0px)] items-center justify-center p-6' : 'container mx-auto p-4'}>
        {children}
      </main>
    </div>
  )
}
