'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons'

type Session = {
  id: number
  created_at: string
  categories: { name: string } | null
  users: { name: string } | null
}

type Item = {
  id: number
  products: { id: number; name: string } | null
}

export default function StokOpnameDetailPage() {
  const supabase = createClient()
  const { id } = useParams()
  const router = useRouter()

  const [session, setSession] = useState<Session | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [warehouseCounts, setWarehouseCounts] = useState<Record<number, number>>({})
  const [savedCounts, setSavedCounts] = useState<Record<number, number>>({})
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
        .select('id, products(id, name)')
        .eq('session_id', id)
        .order('id'),
    ]).then(async ([{ data: sessionData }, { data: itemsData }]) => {
      setSession(sessionData as Session | null)
      const itemRows = (itemsData as Item[]) ?? []
      setItems(itemRows)

      const productIds = itemRows.map(i => i.products?.id).filter((v): v is number => v != null)
      const itemIds = itemRows.map(i => i.id)

      const [{ data: links }, { data: counts }] = await Promise.all([
        productIds.length
          ? supabase.from('product_warehouse').select('product_id').in('product_id', productIds)
          : Promise.resolve({ data: [] as { product_id: number }[] }),
        itemIds.length
          ? supabase.from('stock_opname_item_warehouses').select('item_id').in('item_id', itemIds)
          : Promise.resolve({ data: [] as { item_id: number }[] }),
      ])

      const linkTally: Record<number, number> = {}
      for (const l of (links ?? []) as { product_id: number }[]) {
        linkTally[l.product_id] = (linkTally[l.product_id] ?? 0) + 1
      }
      const countTally: Record<number, number> = {}
      for (const c of (counts ?? []) as { item_id: number }[]) {
        countTally[c.item_id] = (countTally[c.item_id] ?? 0) + 1
      }

      setWarehouseCounts(linkTally)
      setSavedCounts(countTally)
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
            {items.map(item => {
              const linked = item.products ? (warehouseCounts[item.products.id] ?? 0) : 0
              const saved = savedCounts[item.id] ?? 0
              const done = linked > 0 && saved >= linked
              return (
                <Link
                  key={item.id}
                  href={`/stok-opname/${id}/${item.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  <p className="text-sm text-gray-700">{item.products?.name ?? '-'}</p>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        done ? 'text-green-600 bg-green-50' : 'text-amber-600 bg-amber-50'
                      }`}
                    >
                      {done ? 'Selesai' : 'Pending'}
                    </span>
                    <FontAwesomeIcon icon={faChevronRight} className="w-3 h-3 text-gray-300" />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
