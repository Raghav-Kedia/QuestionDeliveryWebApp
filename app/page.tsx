import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function HomePage() {
  return (
    <div className="w-full px-4">
      <Card className="mx-auto max-w-xl backdrop-blur-md bg-white/10 text-white border-white/20 na-shadow">
        <CardContent className="p-8 text-center space-y-6">
          <h1 className="text-3xl md:text-4xl font-semibold">Daily Question Delivery</h1>
          <p className="text-white/90">Unlock and complete questions throughout the day.</p>
          <div className="flex justify-center">
            <Link href="/login">
              <Button variant="primary" className="text-white">Login</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
