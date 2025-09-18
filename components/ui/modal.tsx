"use client"
import * as React from 'react'
import { cn } from '@/lib/utils'

type ModalProps = {
  open: boolean
  onClose: () => void
  title?: string
  children?: React.ReactNode
  className?: string
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  React.useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 w-full max-w-lg rounded-na-card border bg-background p-4 na-shadow na-transition',
          className
        )}
      >
        {title && <h2 className="mb-2 text-lg font-semibold">{title}</h2>}
        {children}
        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="rounded-na-btn border px-4 py-2 text-sm">Close</button>
        </div>
      </div>
    </div>
  )
}
