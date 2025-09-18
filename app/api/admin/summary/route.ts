import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET() {
  const me = await requireRole('admin')
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = await prisma.session.findFirst({ where: { active: true }, orderBy: { createdAt: 'desc' } })
  if (!session) {
    return NextResponse.json({ sessionId: null, questions: [], activity: [] })
  }

  const questions = await prisma.question.findMany({ where: { sessionId: session.id }, orderBy: { number: 'asc' } })
  const activity = await prisma.userActivity.findMany({
    where: { question: { sessionId: session.id } },
    orderBy: { timestamp: 'desc' },
    take: 50,
    include: { question: true },
  })

  const qn = questions.map((q) => ({
    ...q,
    createdAt: (q.createdAt as Date).toISOString(),
    unlockTime: q.unlockTime ? (q.unlockTime as Date).toISOString() : null,
  }))
  const an = activity.map((a) => ({
    ...a,
    timestamp: (a.timestamp as Date).toISOString(),
    question: a.question ? { number: a.question.number } : undefined,
  }))

  return NextResponse.json({ sessionId: session.id, questions: qn, activity: an })
}
