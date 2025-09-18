import StudentDashboard from '@/components/student/StudentDashboard'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

async function getData() {
  const session = await prisma.session.findFirst({ where: { active: true }, orderBy: { createdAt: 'desc' } })
  const questions = session
    ? await prisma.question.findMany({ where: { sessionId: session.id }, orderBy: { number: 'asc' } })
    : []
  return { session, questions }
}

export default async function StudentPage() {
  const me = await requireRole('student')
  if (!me) {
    const { redirect } = await import('next/navigation')
    redirect('/login')
  }
  const { session, questions } = await getData()
  return (
    <StudentDashboard
      sessionId={session?.id ?? null}
      startedAt={session?.startedAt ? (session.startedAt as Date).toISOString() : null}
      target={session?.target ?? 0}
      questions={questions.map((q: any) => ({
        ...q,
        createdAt: (q.createdAt as Date).toISOString(),
        unlockTime: q.unlockTime ? (q.unlockTime as Date).toISOString() : null,
      })) as any}
    />
  )
}
