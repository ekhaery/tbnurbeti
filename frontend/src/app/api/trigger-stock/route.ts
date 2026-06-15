import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: caller } = await adminClient
    .from('users')
    .select('roles(name)')
    .eq('auth_id', user.id)
    .single()

  const role = (caller?.roles as unknown as { name: string } | null)?.name
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await adminClient.rpc('trigger_opening_stock')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result = data as { count: number; names: string[] } ?? { count: 0, names: [] }
  return NextResponse.json({ success: true, count: result.count, names: result.names ?? [] })
}
