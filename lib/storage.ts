import { createServiceClient } from './supabase/service'

const BUCKET = 'questions'

export async function ensureBucket() {
  const supabase = createServiceClient()
  const { data: list, error: listErr } = await supabase.storage.listBuckets()
  if (listErr) throw listErr
  const exists = list?.some((b) => b.name === BUCKET)
  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024, // 10MB
    })
    if (error) throw error
  }
}

export async function uploadImage(path: string, file: File | Blob) {
  const supabase = createServiceClient()
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
  })
  if (error) throw error
  return getPublicUrl(path)
}

export function getPublicUrl(path: string) {
  const supabase = createServiceClient()
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export { BUCKET as QUESTIONS_BUCKET }
