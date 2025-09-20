// Augment process.env types for public Supabase variables
// This file ensures TypeScript recognizes the public env vars used in client components.

declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_SUPABASE_URL: string
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string
    NEXT_PUBLIC_UNLOCK_INTERVAL_MINUTES?: string
    UNLOCK_INTERVAL_MINUTES?: string
  }
}
