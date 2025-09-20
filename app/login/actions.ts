"use server"
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/password'
import { clearSession, setSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const username = String(formData.get('username') || '').trim()
  const password = String(formData.get('password') || '')
  if (!username || !password) throw new Error('Missing credentials')
  const uLower = username.toLowerCase()

  // Support login by username or email only
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        // Match by email lowercased
        { email: uLower },
        // Match by username lowercased
        { /* @ts-ignore */ username: uLower as any },
      ],
    } as any,
  })
  const pwdHash = (user as any)?.passwordHash as string | undefined
  if (!user || !pwdHash) {
    const ts = Date.now()
    redirect('/login?error=' + encodeURIComponent('Invalid username or password') + '&t=' + ts)
  }
  const ok = verifyPassword(password, pwdHash)
  if (!ok) {
    const ts = Date.now()
    redirect('/login?error=' + encodeURIComponent('Invalid username or password') + '&t=' + ts)
  }
  const role = (user.role === 'admin' ? 'admin' : 'student') as 'admin' | 'student'
  await setSession(user.id, role)
  redirect(role === 'admin' ? '/admin' : '/student')
}

export async function logout() {
  clearSession()
  redirect('/login')
}
