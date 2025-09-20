import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET() {
  const me = await requireRole('admin')
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const session = await prisma.session.findFirst({ where: { active: true }, orderBy: { createdAt: 'desc' } })
    if (!session) {
      return NextResponse.json({ sessionId: null, questions: [], activity: [] })
    }

    const questions = await prisma.question.findMany({ where: { sessionId: session.id }, orderBy: { number: 'asc' } })

    let activity: any[] = []
    let degraded = false
    try {
      activity = await prisma.userActivity.findMany({
        where: { question: { sessionId: session.id } },
        orderBy: { timestamp: 'desc' },
        take: 50,
        include: { question: true },
      })
    } catch (e: any) {
      // Prisma inconsistent query result (question missing) fallback: fetch without include
      if (typeof e?.message === 'string' && e.message.includes('Inconsistent query result')) {
        degraded = true
        activity = await prisma.userActivity.findMany({
          where: { questionId: { in: questions.map((q) => q.id) } },
          orderBy: { timestamp: 'desc' },
          take: 50,
        })
      } else {
        throw e
      }
    }

    const qn = questions.map((q) => ({
      ...q,
      createdAt: (q.createdAt as Date).toISOString(),
      unlockTime: q.unlockTime ? (q.unlockTime as Date).toISOString() : null,
    }))
    const an = activity.map((a: any) => ({
      ...a,
      timestamp: (a.timestamp as Date).toISOString(),
      // If degraded mode, we may not have a joined question; attempt to look up locally
      question: (a as any).question
        ? { number: (a as any).question.number }
        : (() => {
            const q = questions.find((qq) => qq.id === a.questionId)
            return q ? { number: q.number } : undefined
          })(),
    }))

    return NextResponse.json({ sessionId: session.id, questions: qn, activity: an, degraded })
  } catch (err: any) {
    console.error('admin.summary.error', err)
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 })
  }
}
