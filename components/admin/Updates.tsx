"use client"
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type Question = {
  id: string
  sessionId: string
  number: number
  imageUrl: string
  status: string
  unlockTime: string | null
  createdAt: string
}

type Activity = {
  id: string
  questionId: string
  studentId: string
  action: string
  timestamp: string
  question?: { number: number }
}

export default function Updates({ initialQuestions, initialActivity, sessionId }: { initialQuestions: Question[]; initialActivity: Activity[]; sessionId: string | null }) {
  const [tab, setTab] = useState<'unopened' | 'viewed' | 'completed'>('unopened')
  const [questions, setQuestions] = useState<Question[]>(initialQuestions)
  const [activity, setActivity] = useState<Activity[]>(initialActivity)

  useEffect(() => {
    if (!sessionId) return
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(url, anon)

    const qSub = supabase
      .channel('questions-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Question' }, (payload) => {
        setQuestions((prev) => {
          const data = payload.new as Question
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

    const aSub = supabase
      .channel('activity-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'UserActivity' }, (payload) => {
        const data = payload.new as Activity
        setActivity((prev) => [{ ...data }, ...prev].slice(0, 100))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(qSub)
      supabase.removeChannel(aSub)
    }
  }, [sessionId])

  // Polling fallback every 10s to keep UI in sync even if Realtime is disabled
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
        setActivity(data.activity as Activity[])
      } catch {}
    }
    fetchNow()
    const id = setInterval(fetchNow, 10000)
    return () => {
      stopped = true
      clearInterval(id)
    }
  }, [sessionId])

  const unopened = useMemo(() => questions.filter((q) => q.status === 'locked'), [questions])
  const viewed = useMemo(() => questions.filter((q) => q.status === 'viewed'), [questions])
  const completed = useMemo(() => questions.filter((q) => q.status === 'completed'), [questions])

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant={tab === 'unopened' ? 'primary' : 'outline'} onClick={() => setTab('unopened')}>
          Unopened ({unopened.length})
        </Button>
        <Button variant={tab === 'viewed' ? 'secondary' : 'outline'} onClick={() => setTab('viewed')}>
          Viewed ({viewed.length})
        </Button>
        <Button variant={tab === 'completed' ? 'accent' : 'outline'} onClick={() => setTab('completed')}>
          Completed ({completed.length})
        </Button>
      </div>

      {tab === 'unopened' && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {unopened.map((q) => (
            <Card key={q.id} className="p-2 text-sm">Question {q.number}</Card>
          ))}
        </div>
      )}
      {tab === 'viewed' && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {viewed.map((q) => (
            <Card key={q.id} className="p-2 text-sm">Question {q.number}</Card>
          ))}
        </div>
      )}
      {tab === 'completed' && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {completed.map((q) => (
            <Card key={q.id} className="p-2 text-sm">Question {q.number}</Card>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <div className="font-medium">Activity Log</div>
        <ul className="space-y-1 text-sm">
          {activity.map((a) => {
            const action = a.action?.toLowerCase() ?? ''
            const color = action.includes('complete')
              ? 'text-neo-status-success'
              : action.includes('view')
              ? 'text-neo-status-info'
              : action.includes('unlock')
              ? 'text-neo-secondary-base'
              : 'text-neo-text-secondary'
            return (
              <li key={a.id} className="rounded-na-card border p-2">
                <span className="font-medium">Q{a.question?.number ?? ''}:</span>{' '}
                <span className={color}>{a.action}</span>{' '}
                <span className="text-muted-foreground">— {new Date(a.timestamp).toLocaleTimeString()}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
