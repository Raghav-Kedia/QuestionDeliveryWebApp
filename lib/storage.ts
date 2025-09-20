import { createServiceClient } from './supabase/service'

// Single bucket name used for question images
const BUCKET = 'questions'

// Reuse one service client instance (service key) per server runtime
const serviceClient = createServiceClient()

// Memoized promise so that concurrent / subsequent uploads don't all list/create bucket
let ensureBucketPromise: Promise<void> | null = null

export function ensureBucket(): Promise<void> {
  if (ensureBucketPromise) return ensureBucketPromise
  ensureBucketPromise = (async () => {
    const { data: list, error: listErr } = await serviceClient.storage.listBuckets()
    if (listErr) throw listErr
    const exists = list?.some((b) => b.name === BUCKET)
    if (!exists) {
      const { error } = await serviceClient.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: 10 * 1024 * 1024, // 10MB limit (adjust as needed)
      })
      if (error) throw error
    }
  })()
  return ensureBucketPromise
}

export async function uploadImage(path: string, file: File | Blob) {
  // Assumes ensureBucket() already called somewhere earlier in flow (but safe if not)
  const { error } = await serviceClient.storage.from(BUCKET).upload(path, file, {
    upsert: false,
  })
  if (error) throw error
  return getPublicUrl(path)
}

export function getPublicUrl(path: string) {
  const { data } = serviceClient.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export { BUCKET as QUESTIONS_BUCKET }
