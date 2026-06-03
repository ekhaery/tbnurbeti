'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGear, faChevronDown, faRightFromBracket } from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'

const navLinks = [
  { label: '+', href: '/products/bulk-input' },
  { label: 'Produk', href: '/products/list' },
]

const settingsLinks = [
  { label: 'Category', href: '/settings/categories' },
]

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { appUser, signOut } = useAuth()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const isAdmin = appUser?.role === 'admin'

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSettingsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close on route change
  useEffect(() => {
    setSettingsOpen(false)
  }, [pathname])

  const linkClass = (active: boolean) =>
    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      active ? 'bg-white/20 text-white' : 'text-white/90 hover:bg-white/10 hover:text-white'
    }`

  const isSettingsActive = pathname.startsWith('/settings')

  return (
    <nav className="bg-[#121358] fixed top-0 left-0 right-0 z-50 h-14">
      <div className="max-w-4xl mx-auto px-4 h-full flex items-center">
        {/* Brand */}
        <div className="shrink-0 flex flex-col leading-tight">
          <Link
            href="/products/list"
            className="font-bold text-white text-base tracking-wide hover:opacity-75 transition-opacity"
          >
            TB NURBETI
          </Link>
          {appUser && (
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-white/60 text-[10px]">{appUser.name}</span>
              <span className={`text-[9px] font-semibold px-1 py-0.5 rounded-full ${isAdmin ? 'bg-blue-400/30 text-blue-200' : 'bg-white/10 text-white/60'}`}>
                {appUser.role}
              </span>
            </div>
          )}
        </div>

        {/* Nav links — right aligned */}
        <div className="flex flex-1 items-center justify-end gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={linkClass(pathname === link.href)}
            >
              {link.label}
            </Link>
          ))}

          {/* Settings dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setSettingsOpen((o) => !o)}
              className={`${linkClass(isSettingsActive)} flex items-center gap-1.5`}
            >
              <FontAwesomeIcon icon={faGear} className="w-3.5 h-3.5" />
              <FontAwesomeIcon
                icon={faChevronDown}
                className={`w-3 h-3 transition-transform duration-200 ${settingsOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {settingsOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg border border-gray-200 shadow-lg py-1 z-50">
                {settingsLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-4 py-2 text-sm ${
                      pathname === item.href
                        ? 'text-[#121358] bg-[#121358]/10'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
                <div className="border-t border-gray-100 mt-1 pt-1">
                  <button
                    onClick={async () => { await signOut(); router.push('/login') }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <FontAwesomeIcon icon={faRightFromBracket} className="w-3.5 h-3.5" />
                    Keluar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
