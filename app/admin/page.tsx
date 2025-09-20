import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { setTarget, uploadQuestion, startDay, endDay, unlockNow } from './actions'
import UploadQuestionForm from '@/components/admin/UploadQuestionForm'
import Updates from '@/components/admin/Updates'
import Stats from '@/components/admin/Stats'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { logout } from '@/app/login/actions'

async function getData() {
  const session = await prisma.session.findFirst({
    where: { active: true },
    orderBy: { createdAt: 'desc' },
  })

  const questions = session
    ? await prisma.question.findMany({
        where: { sessionId: session.id },
        orderBy: { number: 'asc' },
      })
    : []

  const activity = session
    ? await prisma.userActivity.findMany({
        where: { question: { sessionId: session.id } },
        orderBy: { timestamp: 'desc' },
        take: 50,
        include: { question: true },
      })
    : []

  return { session, questions, activity }
}

export default async function AdminPage() {
  const me = await requireRole('admin')
  if (!me) {
    // Not authenticated as admin
    // Using dynamic import to avoid importing redirect at top-level in case of edge/runtime differences
    const { redirect } = await import('next/navigation')
    redirect('/login')
  }
  const { session, questions, activity } = await getData()
  const uploaded = session?.uploaded ?? 0
  const target = session?.target ?? 0
  const started = Boolean(session?.startedAt)
  const ended = Boolean(session?.endedAt)

  type Q = { status: string }
  const locked = questions.filter((q: Q) => q.status === 'locked').length
  const unlocked = questions.filter((q: Q) => q.status === 'unlocked').length
  const viewed = questions.filter((q: Q) => q.status === 'viewed').length
  const completed = questions.filter((q: Q) => q.status === 'completed').length
  // counts rendered client-side by Stats component

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Admin Panel</h1>
            <p className="text-sm text-muted-foreground">Manage today’s session, uploads, and monitor updates.</p>
          </div>
          <form action={logout}>
            <Button variant="outline" type="submit">Logout</Button>
          </form>
        </div>
      </div>

      <section className="grid gap-6 md:grid-cols-2">
        <Card className="p-4 space-y-4">
          <h2 className="font-medium">Target Setter</h2>
          <p className="text-sm text-muted-foreground">Set the daily question target. Disabled after first upload.</p>
          <form action={setTarget} className="flex items-center gap-2">
            <Input
              type="number"
              name="target"
              min={1}
              defaultValue={target || ''}
              className="w-40"
              disabled={uploaded > 0}
              required
            />
            <Button type="submit" variant="primary" disabled={uploaded > 0}>Save Target</Button>
          </form>

          <div className="text-sm text-muted-foreground">
            <div>
              <span className="font-medium">Uploaded:</span> {uploaded} / {target}
            </div>
            <div>
              <span className="font-medium">Session:</span>{' '}
              {session ? (started ? (ended ? 'Ended' : 'Started') : 'Not started') : 'Not created'}
            </div>
          </div>
        </Card>

        <Card className="p-4 space-y-4">
          <h2 className="font-medium">Upload Question</h2>
          <p className="text-sm text-muted-foreground">Upload screenshots one-by-one. Auto-numbered. Images are compressed client-side.</p>
          {/* New client-side compression + upload component (still calls legacy server action). */}
          <UploadQuestionForm disabled={!session || uploaded >= target} />
          <p className="text-xs text-muted-foreground">Allowed up to target count. Large images downscaled to 1600px & WebP.</p>
        </Card>
      </section>

      <Stats initialQuestions={questions as any} sessionId={session?.id ?? null} />

      <section className="flex items-center gap-4">
        <form action={startDay}>
          <Button type="submit" variant="accent" disabled={!session || started || uploaded < target}>
            Start Day
          </Button>
        </form>
        <form action={unlockNow}>
          <Button
            type="submit"
            variant="secondary"
            disabled={!session || !started || ended || locked === 0}
          >
            Unlock Now (3)
          </Button>
        </form>
        <form action={endDay}>
          <Button type="submit" variant="default" disabled={!session || !started || ended}>
            End Day
          </Button>
        </form>
      </section>

      <Card className="p-4">
        <h2 className="mb-4 font-medium">Updates</h2>
        <Updates
          initialQuestions={questions.map((q: any) => ({
            ...q,
            createdAt: (q.createdAt as Date).toISOString(),
            unlockTime: q.unlockTime ? (q.unlockTime as Date).toISOString() : null,
          })) as any}
          initialActivity={activity.map((a: any) => ({
            ...a,
            timestamp: (a.timestamp as Date).toISOString(),
            question: a.question ? { number: a.question.number } : undefined,
          })) as any}
          sessionId={session?.id ?? null}
        />
      </Card>
    </div>
  )
}
