import { prisma } from '@/lib/prisma'

export async function ensureSystemUser() {
  const email = 'system@dq.local'
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return existing
  return prisma.user.create({ data: { email, role: 'system' } })
}
