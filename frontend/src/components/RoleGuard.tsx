'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { canAccessPath } from '@/lib/roles'

// Blocks pages a role isn't allowed to open (see OWNER_ONLY_PATHS), including
// when the URL is typed directly. Menu links are hidden separately in Navbar.
export default function RoleGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { appUser, loading } = useAuth()
  const blocked = !loading && !!appUser && !canAccessPath(appUser.role, pathname)

  useEffect(() => {
    if (blocked) router.replace('/')
  }, [blocked, router])

  if (blocked) return null
  return <>{children}</>
}
