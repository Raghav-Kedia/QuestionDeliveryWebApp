import { login, logout } from './actions'
import { getSession } from '@/lib/auth'

export default async function LoginPage() {
  const session = await getSession()
  return (
    <div className="mx-auto max-w-sm space-y-6 p-4">
      <h1 className="text-xl font-semibold">Login</h1>
      {session ? (
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">Logged in as {session.user.username || session.user.email} ({session.user.role})</div>
          <form action={logout}>
            <button type="submit" className="rounded-md border px-3 py-2">Logout</button>
          </form>
        </div>
      ) : (
        <form action={login} className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm">Username or Email</label>
            <input name="username" className="w-full rounded-md border px-3 py-2" placeholder="admin or admin@example.com" required />
          </div>
          <div className="space-y-1">
            <label className="text-sm">Password</label>
            <input type="password" name="password" className="w-full rounded-md border px-3 py-2" placeholder="••••••••" required />
          </div>
          <button type="submit" className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground">Login</button>
        </form>
      )}
    </div>
  )
}
