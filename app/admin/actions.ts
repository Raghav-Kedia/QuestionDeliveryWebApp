"use server"
import { prisma } from '@/lib/prisma'

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
import { revalidatePath } from 'next/cache'
import { ensureBucket, uploadImage } from '@/lib/storage'
import { randomUUID } from 'crypto'
import { ensureSystemUser } from '@/lib/system-user'
import { requireRole } from '@/lib/auth'

async function getActiveSession() {
  return prisma.session.findFirst({ where: { active: true }, orderBy: { createdAt: 'desc' } })
}

export async function setTarget(formData: FormData) {
  const me = await requireRole('admin')
  if (!me) throw new Error('Unauthorized')
  const target = Number(formData.get('target'))
  if (!Number.isInteger(target) || target <= 0) {
    throw new Error('Target must be a positive integer')
  }
  const active = await getActiveSession()
  if (active) {
    if (active.uploaded > 0) {
      throw new Error('Cannot change target after first upload')
    }
    await prisma.session.update({ where: { id: active.id }, data: { target } })
  } else {
    await prisma.session.create({ data: { target, active: true } })
  }
  revalidatePath('/admin')
}

export async function startDay() {
  const me = await requireRole('admin')
  if (!me) throw new Error('Unauthorized')
  const active = await getActiveSession()
  if (!active) throw new Error('No active session')
  if (active.startedAt) return revalidatePath('/admin')
  const now = new Date()
  const system = await ensureSystemUser()
  // Mark session started
  await prisma.session.update({ where: { id: active.id }, data: { startedAt: now } })
  // Immediately unlock an initial batch (up to 3)
  await prisma.$transaction(async (tx: Tx) => {
    const locked = await tx.question.findMany({
      where: { sessionId: active.id, status: 'locked' },
      orderBy: { number: 'asc' },
      take: 3,
    })
    if (locked.length === 0) return
    const ids = locked.map((q: { id: string }) => q.id)
    await tx.question.updateMany({ where: { id: { in: ids } }, data: { status: 'unlocked', unlockTime: now } })
    await tx.userActivity.createMany({
      data: locked.map((q: { id: string }) => ({ questionId: q.id, studentId: system.id, action: 'unlocked', timestamp: now })),
    })
  })
  revalidatePath('/admin')
  revalidatePath('/student')
}

export async function endDay() {
  const me = await requireRole('admin')
  if (!me) throw new Error('Unauthorized')
  const active = await getActiveSession()
  if (!active) throw new Error('No active session')
  await prisma.$transaction(async (tx: Tx) => {
    // Purge activity
    await tx.userActivity.deleteMany({ where: { question: { sessionId: active.id } } })
    // Delete completed questions
    await tx.question.deleteMany({ where: { sessionId: active.id, status: 'completed' } })
    // Mark session inactive and ended
    await tx.session.update({ where: { id: active.id }, data: { active: false, endedAt: new Date() } })
  })
  revalidatePath('/admin')
}

export async function unlockNow() {
  const me = await requireRole('admin')
  if (!me) throw new Error('Unauthorized')
  const active = await getActiveSession()
  if (!active) throw new Error('No active session')
  if (!active.startedAt) throw new Error('Session has not started')
  const now = new Date()
  const system = await ensureSystemUser()

  await prisma.$transaction(async (tx: Tx) => {
    const locked = await tx.question.findMany({
      where: { sessionId: active.id, status: 'locked' },
      orderBy: { number: 'asc' },
      take: 3,
    })
    if (locked.length === 0) return
    const ids = locked.map((q: { id: string }) => q.id)
    await tx.question.updateMany({ where: { id: { in: ids } }, data: { status: 'unlocked', unlockTime: now } })
    await tx.userActivity.createMany({
      data: locked.map((q: { id: string }) => ({ questionId: q.id, studentId: system.id, action: 'unlocked', timestamp: now })),
    })
  })

  revalidatePath('/admin')
  revalidatePath('/student')
}

export async function uploadQuestion(formData: FormData): Promise<void> {
  const me = await requireRole('admin')
  if (!me) throw new Error('Unauthorized')
  const file = formData.get('file') as File | null
  if (!file) throw new Error('No file provided')
  const active = await getActiveSession()
  if (!active) throw new Error('No active session')
  if (active.uploaded >= active.target) throw new Error('Upload target reached')

  await ensureBucket()

  // Generate path and upload outside the DB transaction to keep the tx short
  const ext = (file.type && file.type.split('/')[1]) || 'png'
  // We'll compute number inside the transaction, but we need a stable unique filename; include UUID
  const basePath = `${active.id}/${randomUUID()}.${ext}`
  let imageUrl: string | null = null
  try {
    imageUrl = await uploadImage(basePath, file)
  } catch (e) {
    throw new Error('Failed to upload image to storage')
  }

  // Short transaction: compute next number, create question, increment uploaded
  // Add a small retry loop to avoid conflicts under concurrency
  const maxRetries = 3
  let lastErr: unknown = null
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await prisma.$transaction(async (tx: Tx) => {
        const max = await tx.question.aggregate({ where: { sessionId: active.id }, _max: { number: true } })
        const number = (max._max.number ?? 0) + 1
        await tx.question.create({
          data: {
            sessionId: active.id,
            number,
            imageUrl: imageUrl!,
            status: 'locked',
          },
        })
        await tx.session.update({ where: { id: active.id }, data: { uploaded: { increment: 1 } } })
      })
      lastErr = null
      break
    } catch (e) {
      lastErr = e
      // Backoff a bit before retrying
      await new Promise((r) => setTimeout(r, 100 * attempt))
    }
  }

  if (lastErr) {
    // Best-effort cleanup: we cannot easily delete by path from storage.ts, implement here if needed in future
    // For now, we leave the uploaded asset to avoid cascading errors during admin flow
    throw new Error('Failed to save question to database. Please retry.')
  }

  revalidatePath('/admin')
}
