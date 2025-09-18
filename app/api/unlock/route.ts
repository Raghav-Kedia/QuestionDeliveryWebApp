import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureSystemUser } from '@/lib/system-user'

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const session = await prisma.session.findFirst({ where: { active: true }, orderBy: { createdAt: 'desc' } })
  if (!session) return NextResponse.json({ message: 'No active session' })

  const now = new Date()
  const system = await ensureSystemUser()

  const result = await prisma.$transaction(async (tx: Tx) => {
    const locked = await tx.question.findMany({
      where: { sessionId: session.id, status: 'locked' },
      orderBy: { number: 'asc' },
      take: 3,
    })
    if (locked.length === 0) return { unlocked: 0 }

  const ids = locked.map((q: { id: string }) => q.id)
    await tx.question.updateMany({ where: { id: { in: ids } }, data: { status: 'unlocked', unlockTime: now } })
    await tx.userActivity.createMany({
  data: locked.map((q: { id: string }) => ({ questionId: q.id, studentId: system.id, action: 'unlocked', timestamp: now })),
    })
    return { unlocked: locked.length }
  })

  return NextResponse.json({ message: 'batch processed', ...result })
}
