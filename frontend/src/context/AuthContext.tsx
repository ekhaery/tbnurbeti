'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createClient } from '@/lib/supabase-browser'
import type { User } from '@supabase/supabase-js'

type AppUser = {
  id: number
  name: string
  role: 'admin' | 'user'
}

type AuthContextType = {
  authUser: User | null
  appUser: AppUser | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  authUser: null,
  appUser: null,
  loading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const [authUser, setAuthUser] = useState<User | null>(null)
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchAppUser = async (authId: string) => {
    const { data } = await supabase
      .from('users')
      .select('id, name, roles(name)')
      .eq('auth_id', authId)
      .single()

    if (data) {
      setAppUser({
        id: data.id,
        name: data.name,
        role: (data.roles as unknown as { name: string }).name as 'admin' | 'user',
      })
    }
  }

  useEffect(() => {
    // getSession reads from local storage/cookie — no network, instant
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null
      setAuthUser(user)
      if (user) fetchAppUser(user.id).finally(() => setLoading(false))
      else setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null
      setAuthUser(user)
      if (user) fetchAppUser(user.id)
      else setAppUser(null)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    setAuthUser(null)
    setAppUser(null)
  }

  return (
    <AuthContext.Provider value={{ authUser, appUser, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
