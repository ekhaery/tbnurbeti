import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  // Verify the caller is a logged-in admin
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

  // Create the new user
  const { name, password, role_id } = await req.json()
  if (!name || !password || !role_id) {
    return NextResponse.json({ error: 'Data tidak lengkap.' }, { status: 400 })
  }

  const email = `${name.trim().toLowerCase().replace(/\s+/g, '_')}@tbnurbeti.com`

  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message ?? 'Gagal membuat auth user.' }, { status: 500 })
  }

  const { error: insertError } = await adminClient.from('users').insert({
    name: name.trim(),
    email,
    role_id,
    auth_id: authData.user.id,
  })

  if (insertError) {
    await adminClient.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
