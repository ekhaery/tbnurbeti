import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { name, password, role_id } = await req.json()

  if (!name || !password || !role_id) {
    return NextResponse.json({ error: 'Data tidak lengkap.' }, { status: 400 })
  }

  const email = `${name.trim().toLowerCase().replace(/\s+/g, '_')}@tbnurbeti.com`

  // Create auth user via admin API (no email confirmation, no session hijack)
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message ?? 'Gagal membuat auth user.' }, { status: 500 })
  }

  // Insert into public.users
  const { error: insertError } = await adminClient.from('users').insert({
    name: name.trim(),
    email,
    role_id,
    auth_id: authData.user.id,
  })

  if (insertError) {
    // Rollback: delete the auth user we just created
    await adminClient.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
