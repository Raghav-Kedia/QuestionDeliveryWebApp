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
    if (active.target === target) {
      // No change, return early without triggering revalidation
      return
    }
    await prisma.session.update({ where: { id: active.id }, data: { target }, select: { id: true } })
  } else {
    await prisma.session.create({ data: { target, active: true }, select: { id: true } })
  }
  // Fire-and-forget to reduce perceived latency
  ;(async () => { try { revalidatePath('/admin') } catch {} })()
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
    // Delete all questions for the session (regardless of status)
    await tx.question.deleteMany({ where: { sessionId: active.id } })
    // Mark session inactive and ended
    await tx.session.update({ where: { id: active.id }, data: { active: false, endedAt: new Date() } })
  })
  revalidatePath('/admin')
  // Ensure students see updated state promptly
  revalidatePath('/student')
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

  // Start bucket ensure early (memoized) so we can in parallel prep metadata
  const bucketPromise = ensureBucket()

  // Generate path and upload outside the DB transaction to keep the tx short
  const ext = (file.type && file.type.split('/')[1]) || 'png'
  // We'll compute number inside the transaction, but we need a stable unique filename; include UUID
  const basePath = `${active.id}/${randomUUID()}.${ext}`
  let imageUrl: string | null = null
  try {
    // Ensure bucket ready before actual upload (fast no-op on subsequent calls)
    await bucketPromise
    imageUrl = await uploadImage(basePath, file)
  } catch (e) {
    throw new Error('Failed to upload image to storage')
  }

  // New approach: treat Session.uploaded as counter. We increment first (with optimistic concurrency) and use the incremented value as question number.
  // This avoids scanning the Question table (aggregate max) each upload.
  const maxRetries = 3
  let lastErr: unknown = null
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await prisma.$transaction(async (tx: Tx) => {
        // Re-fetch session row FOR UPDATE equivalent via update returning (Prisma doesn't expose FOR UPDATE directly)
        // Approach: increment uploaded, then use resulting value as number.
        const updatedSession = await tx.session.update({
          where: { id: active.id },
          data: { uploaded: { increment: 1 } },
        })
        if (updatedSession.uploaded > updatedSession.target) {
          // Rollback by throwing; target exceeded (race condition)
          throw new Error('Upload target reached')
        }
        const number = updatedSession.uploaded // The newly assigned sequential number
        await tx.question.create({
          data: {
            sessionId: active.id,
            number,
            imageUrl: imageUrl!,
            status: 'locked',
          },
        })
      })
      lastErr = null
      break
    } catch (e: any) {
      lastErr = e
      if (e?.message === 'Upload target reached') break
      await new Promise((r) => setTimeout(r, 50 * attempt))
    }
  }
  if (lastErr) {
    if ((lastErr as any)?.message === 'Upload target reached') {
      throw lastErr
    }
    throw new Error('Failed to save question to database. Please retry.')
  }

  // Fire-and-forget revalidation to reduce tail latency
  ;(async () => {
    try { revalidatePath('/admin'); } catch {}
  })()
}
