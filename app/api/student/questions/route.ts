import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET() {
  const me = await requireRole('student')
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = await prisma.session.findFirst({ where: { active: true }, orderBy: { createdAt: 'desc' } })
  if (!session) return NextResponse.json({ sessionId: null, questions: [] })
  const questions = await prisma.question.findMany({ where: { sessionId: session.id }, orderBy: { number: 'asc' } })
  const qn = questions.map((q) => ({
    ...q,
    createdAt: (q.createdAt as Date).toISOString(),
    unlockTime: q.unlockTime ? (q.unlockTime as Date).toISOString() : null,
  }))
  return NextResponse.json({ sessionId: session.id, questions: qn })
}
