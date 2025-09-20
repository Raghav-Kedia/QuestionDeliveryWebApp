import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureSystemUser } from '@/lib/system-user'
import { requireRole } from '@/lib/auth'
import { UNLOCK_INTERVAL_MS } from '@/lib/unlock-config'

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]


export async function POST() {
  // Allow either student or admin to trigger (first valid role wins)
  const meStudent = await requireRole('student')
  const meAdmin = meStudent ? null : await requireRole('admin')
  if (!meStudent && !meAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const session = await prisma.session.findFirst({ where: { active: true }, orderBy: { createdAt: 'desc' } })
  if (!session || !session.startedAt) {
    return NextResponse.json({ message: 'No active started session' })
  }

  // Determine last unlock time (max existing unlockTime) else session.startedAt
  const lastUnlocked = await prisma.question.findFirst({
    where: { sessionId: session.id, unlockTime: { not: null } },
    orderBy: { unlockTime: 'desc' },
    select: { unlockTime: true },
  })
  const lastTime = lastUnlocked?.unlockTime ?? session.startedAt
  const now = new Date()
  const nextEligible = new Date(lastTime.getTime() + UNLOCK_INTERVAL_MS)

  if (now.getTime() < nextEligible.getTime()) {
    return NextResponse.json({
      message: 'Too early',
      unlocked: 0,
      nextUnlockAt: nextEligible.toISOString(),
    })
  }

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

  const nextUnlockAt = new Date(now.getTime() + UNLOCK_INTERVAL_MS).toISOString()
  return NextResponse.json({ message: 'Unlocked batch', ...result, nextUnlockAt })
}
