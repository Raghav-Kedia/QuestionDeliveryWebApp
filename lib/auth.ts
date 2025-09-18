import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { createHmac } from 'crypto'

type Payload = { sub: string; role: 'admin' | 'student'; exp: number }

function b64url(input: Buffer | string) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input)
  return b.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function sign(data: string, secret: string) {
  return b64url(createHmac('sha256', secret).update(data).digest())
}

function getSecret() {
  return process.env.AUTH_SECRET || 'dev-secret'
}

export async function setSession(userId: string, role: 'admin' | 'student') {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7
  const payload: Payload = { sub: userId, role, exp }
  const payloadStr = b64url(JSON.stringify(payload))
  const toSign = `${header}.${payloadStr}`
  const sig = sign(toSign, getSecret())
  const token = `${toSign}.${sig}`
  cookies().set('session', token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 })
}

export function clearSession() {
  cookies().delete('session')
}

export async function getSession(): Promise<{ user: { id: string; role: 'admin' | 'student'; email: string | null; username: string | null } } | null> {
  const token = cookies().get('session')?.value
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, payload, signature] = parts
  const expected = sign(`${header}.${payload}`, getSecret())
  if (expected !== signature) return null
  try {
    const data = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()) as Payload
    if (!data.exp || Date.now() / 1000 > data.exp) return null
    const user = await prisma.user.findUnique({ where: { id: data.sub } })
    if (!user || user.role !== data.role) return null
    return { user: { id: user.id, role: data.role, email: (user as any).email ?? null, username: (user as any).username ?? null } }
  } catch {
    return null
  }
}

export async function requireRole(role: 'admin' | 'student') {
  const session = await getSession()
  if (!session || session.user.role !== role) return null
  return session.user
}
