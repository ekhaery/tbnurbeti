'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { data: userData, error: lookupError } = await supabase
      .from('users')
      .select('email')
      .ilike('name', username.trim())
      .single()

    if (lookupError || !userData?.email) {
      setLoading(false)
      setError('Username tidak ditemukan.')
      return
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: userData.email,
      password,
    })
    setLoading(false)

    if (authError) {
      setError('Password salah.')
    } else {
      router.push('/products/bulk-input')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4 -mt-20">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Selamat datang</h1>
          <p className="text-sm text-gray-500 mt-1">Masuk ke akun Anda</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Masukkan username"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Masukkan password"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358] focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#121358] hover:bg-[#1a1c6e] active:bg-[#0d0e3f] disabled:bg-[#121358]/40 text-white font-semibold py-3 rounded-xl transition text-sm mt-2"
          >
            {loading ? 'Masuk...' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  )
}
