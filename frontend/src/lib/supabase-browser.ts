import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null

export const createClient = () => {
  if (!client) {
    const schema = process.env.NEXT_PUBLIC_DB_SCHEMA ?? 'public'
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { db: { schema } }
    )
  }
  return client
}
