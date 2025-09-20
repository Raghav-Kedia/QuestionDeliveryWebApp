"use client"
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Card, CardContent } from '@/components/ui/card'

type Question = {
  id: string
  status: string
}

export default function Stats({ initialQuestions, sessionId }: { initialQuestions: Question[]; sessionId: string | null }) {
  const [questions, setQuestions] = useState<Question[]>(initialQuestions)

  // Keep local state in sync with incoming server props (e.g., after endDay).
  useEffect(() => {
    const incomingSig = initialQuestions.map((q) => q.id + ':' + q.status).join('|')
    const currentSig = questions.map((q) => q.id + ':' + q.status).join('|')
    if (incomingSig !== currentSig) {
      setQuestions(initialQuestions)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestions])

  // Supabase Realtime for question changes
  useEffect(() => {
    if (!sessionId) return
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(url, anon)

    const qSub = supabase
      .channel('admin-stats-questions')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'Question' }, (payload) => {
        const data = payload.new as Question | null
        if (!data) return
        setQuestions((prev) => {
          if (prev.some((q) => q.id === data.id)) return prev
          return [...prev, data]
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'Question' }, (payload) => {
        const data = payload.new as Question | null
        if (!data) return
        setQuestions((prev) => {
          const idx = prev.findIndex((q) => q.id === data.id)
          if (idx >= 0) {
            const next = [...prev]
            next[idx] = { ...next[idx], ...data }
            return next
          }
          return [...prev, data]
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(qSub)
    }
  }, [sessionId])

  // Polling fallback
  useEffect(() => {
    if (!sessionId) return
    let stopped = false
    const fetchNow = async () => {
      try {
        const res = await fetch('/api/admin/summary', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (stopped) return
        setQuestions(data.questions as Question[])
      } catch {}
    }
    fetchNow()
    const id = setInterval(fetchNow, 10000)
    return () => {
      stopped = true
      clearInterval(id)
    }
  }, [sessionId])

  const locked = useMemo(() => questions.filter((q) => q.status === 'locked').length, [questions])
  const unlocked = useMemo(() => questions.filter((q) => q.status === 'unlocked').length, [questions])
  const viewed = useMemo(() => questions.filter((q) => q.status === 'viewed').length, [questions])
  const completed = useMemo(() => questions.filter((q) => q.status === 'completed').length, [questions])

  return (
    <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground">Locked</div>
          <div className="text-2xl font-semibold text-neo-status-warning">{locked}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground">Unlocked</div>
          <div className="text-2xl font-semibold text-neo-secondary-base">{unlocked}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground">Viewed</div>
          <div className="text-2xl font-semibold text-neo-status-info">{viewed}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground">Completed</div>
          <div className="text-2xl font-semibold text-neo-status-success">{completed}</div>
        </CardContent>
      </Card>
    </section>
  )
}
