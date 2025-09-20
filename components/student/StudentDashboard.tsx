"use client"
import { useEffect, useMemo, useRef, useState } from 'react'
import { UNLOCK_INTERVAL_MS } from '@/lib/unlock-config'
import { createClient } from '@supabase/supabase-js'
import { markViewed, markCompleted } from '@/app/student/actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { logout } from '@/app/login/actions'

type Question = {
  id: string
  sessionId: string
  number: number
  imageUrl: string
  status: 'locked' | 'unlocked' | 'viewed' | 'completed'
  unlockTime: string | null
  createdAt: string
}

export default function StudentDashboard({ sessionId, startedAt: initialStartedAt, target, questions: initialQuestions }: { sessionId: string | null; startedAt: string | null; target: number; questions: Question[] }) {
  const [questions, setQuestions] = useState<Question[]>(initialQuestions)
  const [startedAt, setStartedAt] = useState<string | null>(initialStartedAt)
  const completed = questions.filter((q) => q.status === 'completed').length

  // Countdown to next unlock: simplistic client-side calculation based on unlockTime cadence (30 min)
  const [nextUnlock, setNextUnlock] = useState<string | null>(null)
  useEffect(() => {
    // If we have any unlocked question, base on its latest unlockTime even if startedAt was null at initial render.
    const unlockedTimes = questions.filter((q) => q.unlockTime).map((q) => new Date(q.unlockTime as string).getTime())
    let base: number | null = null
    if (unlockedTimes.length) {
      base = Math.max(...unlockedTimes)
    } else if (startedAt) {
      base = new Date(startedAt).getTime()
    }
    if (base == null) return // still no reference point
    const next = new Date(base + UNLOCK_INTERVAL_MS)
    setNextUnlock(next.toISOString())
  }, [questions, startedAt])

  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(i)
  }, [])
  const countdown = useMemo(() => {
    if (!nextUnlock) return null
    const delta = new Date(nextUnlock).getTime() - now
    if (delta <= 0) return '00:00'
    const mm = Math.floor(delta / 60000)
    const ss = Math.floor((delta % 60000) / 1000)
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  }, [nextUnlock, now])

  // Auto-unlock logic: attempt server unlock when countdown reaches zero or on mount (in case user arrives late)
  const triggering = useRef(false)
  const attemptUnlock = async () => {
    if (triggering.current) return
    triggering.current = true
    try {
      const res = await fetch('/api/unlock', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        if (data.nextUnlockAt) {
          setNextUnlock(data.nextUnlockAt)
        } else if (data.message === 'Too early' && data.nextUnlockAt) {
          setNextUnlock(data.nextUnlockAt)
        }
        // Force refresh of questions immediately (avoid waiting for realtime/poll)
        try {
          const r = await fetch('/api/student/questions', { cache: 'no-store' })
          if (r.ok) {
            const d = await r.json()
            setQuestions(d.questions as Question[])
            if (d.startedAt && d.startedAt !== startedAt) setStartedAt(d.startedAt as string)
          }
        } catch {}
      }
    } catch {
      // ignore network errors silently
    } finally {
      setTimeout(() => {
        triggering.current = false
      }, 5000)
    }
  }

  // On mount: attempt sync regardless of startedAt (handles case where session starts after initial render)
  useEffect(() => {
    attemptUnlock()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When countdown hits 00:00 trigger unlock (debounced by triggering ref)
  useEffect(() => {
    if (countdown === '00:00') {
      attemptUnlock()
    }
  }, [countdown])

  // Realtime updates
  useEffect(() => {
    if (!sessionId) return
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(url, anon)

    const qSub = supabase
      .channel('student-questions')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'Question' }, (payload) => {
        setQuestions((prev) => {
          const dataNew = payload.new as Question | null
          if (!dataNew) return prev
          const idx = prev.findIndex((q) => q.id === dataNew.id)
          if (idx >= 0) return prev
          return [...prev, dataNew]
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'Question' }, (payload) => {
        setQuestions((prev) => {
          const dataNew = payload.new as Question | null
          if (!dataNew) return prev
          const idx = prev.findIndex((q) => q.id === dataNew.id)
          if (idx >= 0) {
            const next = [...prev]
            next[idx] = dataNew
            return next
          }
          return [...prev, dataNew]
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(qSub)
    }
  }, [sessionId])

  // Polling fallback every 10s to fetch latest questions
  useEffect(() => {
    if (!sessionId) return
    let stopped = false
    const fetchNow = async () => {
      try {
        const res = await fetch('/api/student/questions', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (stopped) return
        setQuestions(data.questions as Question[])
        if (data.startedAt && data.startedAt !== startedAt) {
          setStartedAt(data.startedAt as string)
        }
      } catch {}
    }
    fetchNow()
    const id = setInterval(fetchNow, 10000)
    return () => {
      stopped = true
      clearInterval(id)
    }
  }, [sessionId])

  // Fast polling bootstrap: poll every 2s right after mount / session start until an unlocked (or viewed/completed) question appears,
  // or until timeout (~120s). Useful when realtime delivery of the first unlock is delayed.
  useEffect(() => {
    if (!sessionId) return
    if (questions.some((q) => q.status !== 'locked')) return // already have unlocked content
    let attempts = 0
    let stopped = false
    let intervalId: any

    const fastFetch = async () => {
      attempts++
      if (stopped) return
      try {
        const r = await fetch('/api/student/questions', { cache: 'no-store' })
        if (r.ok) {
          const d = await r.json()
          if (stopped) return
          setQuestions(d.questions as Question[])
          if (d.startedAt && d.startedAt !== startedAt) setStartedAt(d.startedAt as string)
          if ((d.questions as Question[]).some((q: Question) => q.status !== 'locked')) {
            stopped = true
            clearInterval(intervalId)
            return
          }
        }
      } catch {}
      if (attempts >= 60) {
        stopped = true
        clearInterval(intervalId)
      }
    }

    intervalId = setInterval(fastFetch, 2000)
    fastFetch()
    return () => {
      stopped = true
      clearInterval(intervalId)
    }
  }, [sessionId, questions, startedAt])

  // Realtime listen for session start (Session.startedAt update) if we have a sessionId but no startedAt yet
  useEffect(() => {
    if (!sessionId || startedAt) return
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(url, anon)
    const sSub = supabase
      .channel('student-session')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'Session', filter: `id=eq.${sessionId}` }, (payload) => {
        const newStarted = (payload.new as any)?.startedAt
        if (newStarted && !startedAt) {
          setStartedAt(newStarted)
          // Immediately fetch questions/unlocks
          fetch('/api/student/questions', { cache: 'no-store' })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
              if (d?.questions) setQuestions(d.questions as Question[])
              if (d?.startedAt) setStartedAt(d.startedAt as string)
            })
            .catch(() => {})
        }
      })
      .subscribe()
    return () => {
      supabase.removeChannel(sSub)
    }
  }, [sessionId, startedAt])

  const pending = questions.filter((q) => q.status === 'unlocked' || q.status === 'viewed')
  const done = questions.filter((q) => q.status === 'completed')

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Student Panel</h1>
            <p className="text-sm text-muted-foreground">Solve questions as they unlock every {UNLOCK_INTERVAL_MS / 60000} minutes.</p>
          </div>
          <form action={logout}>
            <Button variant="outline" type="submit">Logout</Button>
          </form>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="text-sm text-muted-foreground">Countdown</div>
          </CardHeader>
          <CardContent>
            <div className="na-gradient rounded-na-card p-4 text-center text-2xl font-semibold">
              {countdown ?? '--:--'}
            </div>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
              <span>Progress</span>
              <span>
                {completed} / {target}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-3 w-full overflow-hidden rounded-na-card bg-muted">
              <div
                className="h-3 bg-neo-accent-green na-transition"
                style={{ width: `${target ? (completed / target) * 100 : 0}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-2">
        <h2 className="font-medium">Pending Questions</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending questions.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pending.map((q) => (
              <Card key={q.id} className="p-3">
                <div className="mb-2 text-sm font-medium">Question {q.number}</div>
                <details className="mb-3 cursor-pointer">
                  <summary className="select-none text-sm text-muted-foreground">Show screenshot</summary>
                  <div className="mt-2">
                    <img src={q.imageUrl} alt={`Question ${q.number}`} className="h-auto w-full rounded-na-card" />
                  </div>
                </details>
                <div className="flex gap-2">
                  <form action={markViewed}>
                    <input type="hidden" name="questionId" value={q.id} />
                    <Button variant="secondary" type="submit">Mark Viewed</Button>
                  </form>
                  <form action={markCompleted}>
                    <input type="hidden" name="questionId" value={q.id} />
                    <Button variant="primary" type="submit">Mark Complete</Button>
                  </form>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Completed</h2>
        {done.length === 0 ? (
          <p className="text-sm text-muted-foreground">No completed questions yet.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {done.map((q) => (
              <li key={q.id} className="rounded-na-card border p-2 text-sm">Question {q.number}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
