'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons'

type Session = {
  id: number
  created_at: string
  categories: { name: string } | null
  users: { name: string } | null
}

type Item = {
  id: number
  products: { name: string } | null
}

export default function StokOpnameDetailPage() {
  const supabase = createClient()
  const { id } = useParams()
  const router = useRouter()

  const [session, setSession] = useState<Session | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase
        .from('stock_opname_sessions')
        .select('id, created_at, categories(name), users(name)')
        .eq('id', id)
        .single(),
      supabase
        .from('stock_opname_items')
        .select('id, products(name)')
        .eq('session_id', id)
        .order('id'),
    ]).then(([{ data: sessionData }, { data: itemsData }]) => {
      setSession(sessionData as Session | null)
      setItems((itemsData as Item[]) ?? [])
      setLoading(false)
    })
  }, [id])

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
        Memuat...
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
        Sesi tidak ditemukan.
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
          <FontAwesomeIcon icon={faChevronLeft} className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-base font-bold text-gray-800">Detail Stock Opname</h1>
          <p className="text-xs text-gray-400">{session.categories?.name ?? '-'}</p>
        </div>
      </div>

      <div className="px-4 py-4 max-w-xl mx-auto space-y-4">
        <div className="bg-white rounded-xl shadow-sm p-4 grid grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Tanggal</p>
            <p className="text-xs font-medium text-gray-800 mt-0.5">{formatDate(session.created_at)}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Kategori</p>
            <p className="text-xs font-medium text-gray-800 mt-0.5">{session.categories?.name ?? '-'}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Dibuat Oleh</p>
            <p className="text-xs font-medium text-gray-800 mt-0.5">{session.users?.name ?? '-'}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700">Daftar Produk</p>
            <p className="text-xs text-gray-400">{items.length} produk</p>
          </div>
          <div className="divide-y divide-gray-100">
            {items.map(item => (
              <div key={item.id} className="flex items-center justify-between px-4 py-3">
                <p className="text-sm text-gray-700">{item.products?.name ?? '-'}</p>
                <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Pending</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
