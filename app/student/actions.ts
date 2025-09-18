"use server"
import { prisma } from '@/lib/prisma'

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'

export async function markViewed(formData: FormData) {
  const questionId = String(formData.get('questionId') || '')
  if (!questionId) throw new Error('Missing questionId')
  const student = await requireRole('student')
  if (!student) throw new Error('Unauthorized')

  const question = await prisma.question.findUnique({ where: { id: questionId } })
  if (!question) throw new Error('Question not found')
  if (question.status === 'locked') throw new Error('Question is locked')

  if (question.status !== 'viewed' && question.status !== 'completed') {
  await prisma.$transaction(async (tx: Tx) => {
      await tx.question.update({ where: { id: questionId }, data: { status: 'viewed' } })
      await tx.userActivity.create({ data: { questionId, studentId: student.id, action: 'viewed' } })
    })
  }
  revalidatePath('/student')
}

export async function markCompleted(formData: FormData) {
  const questionId = String(formData.get('questionId') || '')
  if (!questionId) throw new Error('Missing questionId')
  const student = await requireRole('student')
  if (!student) throw new Error('Unauthorized')

  const question = await prisma.question.findUnique({ where: { id: questionId } })
  if (!question) throw new Error('Question not found')
  if (question.status === 'locked') throw new Error('Question is locked')

  if (question.status !== 'completed') {
  await prisma.$transaction(async (tx: Tx) => {
      await tx.question.update({ where: { id: questionId }, data: { status: 'completed' } })
      await tx.userActivity.create({ data: { questionId, studentId: student.id, action: 'completed' } })
    })
  }
  revalidatePath('/student')
}
