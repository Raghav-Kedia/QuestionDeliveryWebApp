import { scryptSync, randomBytes, timingSafeEqual } from 'crypto'

// Hash password with random salt using Node's scrypt
export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, 64)
  return `${salt.toString('hex')}:${hash.toString('hex')}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const salt = Buffer.from(saltHex, 'hex')
  const hash = Buffer.from(hashHex, 'hex')
  const test = scryptSync(password, salt, 64)
  return timingSafeEqual(hash, test)
}
