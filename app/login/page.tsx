import { login, logout } from './actions'
import { getSession } from '@/lib/auth'

export default async function LoginPage({ searchParams }: { searchParams: { error?: string, t?: string } }) {
  const session = await getSession()
  const errorParam = searchParams?.error
  const ts = searchParams?.t || ''
  return (
    <div className="mx-auto max-w-sm space-y-6 p-4" key={ts || (errorParam ? 'err' : 'ok')}>
      <h1 className="text-xl font-semibold">Login</h1>
      {errorParam && !session && (
        <div
          className="animate-fade-in animate-shake rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 shadow-sm"
          role="alert"
          aria-live="assertive"
        >
          {errorParam}
        </div>
      )}
      {session ? (
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">Logged in as {session.user.username || session.user.email} ({session.user.role})</div>
          <form action={logout}>
            <button type="submit" className="rounded-md border px-3 py-2">Logout</button>
          </form>
        </div>
      ) : (
        <form action={login} className="space-y-3" noValidate>
          <div className="space-y-1">
            <label className="text-sm">Username or Email</label>
            <input
              name="username"
              className={`w-full rounded-md border px-3 py-2 ${errorParam ? 'animate-shake border-red-500 focus-visible:outline-red-500' : ''}`}
              placeholder="admin or admin@example.com"
              required
              autoComplete="username"
              aria-invalid={Boolean(errorParam) || undefined}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm">Password</label>
            <input
              type="password"
              name="password"
              className={`w-full rounded-md border px-3 py-2 ${errorParam ? 'animate-shake border-red-500 focus-visible:outline-red-500' : ''}`}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              aria-invalid={Boolean(errorParam) || undefined}
            />
          </div>
          <button type="submit" className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground">Login</button>
        </form>
      )}
    </div>
  )
}
