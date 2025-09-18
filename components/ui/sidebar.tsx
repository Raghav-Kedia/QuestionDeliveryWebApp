"use client"
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname()
  const item = (href: string, label: string) => (
    <Link
      key={href}
      href={href}
      className={cn(
        'block rounded-na-btn px-3 py-2 text-sm na-transition',
        pathname === href
          ? 'bg-neo-primary-base text-white shadow-na'
          : 'text-neo-text-secondary hover:bg-neo-primary-base/10 hover:text-neo-text-primary'
      )}
    >
      {label}
    </Link>
  )
  return (
    <aside className={cn('w-full md:w-64 rounded-na-card border bg-card na-shadow', className)}>
      <div className="na-gradient rounded-t-na-card p-4 text-white font-semibold">Menu</div>
      <div className="space-y-1 p-3">
        {item('/student', 'Student Dashboard')}
        {item('/admin', 'Admin Panel')}
        {item('/login', 'Login')}
      </div>
    </aside>
  )
}
