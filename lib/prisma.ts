import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

// Helpful debug in dev: print which DB host/port Prisma will hit
function logDbTarget() {
	try {
		const url = process.env.DATABASE_URL
		if (!url) return
		const u = new URL(url)
		// Sanitize
		u.username = u.username ? '***' : ''
		u.password = u.password ? '***' : ''
		console.log('[prisma] DATABASE_URL ->', `${u.protocol}//${u.host}${u.pathname}`)
	} catch {
		// no-op
	}
}

if (process.env.NODE_ENV !== 'production') {
	logDbTarget()
}

export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({
		log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['error', 'warn'],
	})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
