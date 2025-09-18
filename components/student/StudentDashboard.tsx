"use client"
import { useEffect, useMemo, useState } from 'react'
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

export default function StudentDashboard({ sessionId, startedAt, target, questions: initialQuestions }: { sessionId: string | null; startedAt: string | null; target: number; questions: Question[] }) {
  const [questions, setQuestions] = useState<Question[]>(initialQuestions)
  const completed = questions.filter((q) => q.status === 'completed').length

  // Countdown to next unlock: simplistic client-side calculation based on unlockTime cadence (30 min)
  const [nextUnlock, setNextUnlock] = useState<string | null>(null)
  useEffect(() => {
    if (!startedAt) return
    // Estimate next unlock as last unlock + 30min or start + 30min if none
    const unlockedTimes = questions.filter((q) => q.unlockTime).map((q) => new Date(q.unlockTime as string).getTime())
    const base = unlockedTimes.length ? Math.max(...unlockedTimes) : new Date(startedAt).getTime()
    const next = new Date(base + 30 * 60 * 1000)
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

  // Realtime updates
  useEffect(() => {
    if (!sessionId) return
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(url, anon)

    const qSub = supabase
      .channel('student-questions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Question' }, (payload) => {
        const data = payload.new as Question
        setQuestions((prev) => {
          const idx = prev.findIndex((q) => q.id === data.id)
          if (idx >= 0) {
            const next = [...prev]
            next[idx] = data
            return next
          } else {
            return [...prev, data]
          }
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
      } catch {}
    }
    fetchNow()
    const id = setInterval(fetchNow, 10000)
    return () => {
      stopped = true
      clearInterval(id)
    }
  }, [sessionId])

  const pending = questions.filter((q) => q.status === 'unlocked' || q.status === 'viewed')
  const done = questions.filter((q) => q.status === 'completed')

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Student Panel</h1>
            <p className="text-sm text-muted-foreground">Solve questions as they unlock every 30 minutes.</p>
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
