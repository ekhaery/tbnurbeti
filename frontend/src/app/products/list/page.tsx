'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPenToSquare } from '@fortawesome/free-solid-svg-icons'

type Product = {
  id: number
  code: string
  name: string
  base_price: number
  price: number
  stock: number
  categories: { name: string } | null
}

type Category = {
  id: number
  name: string
}

export default function ProductListPage() {
  const supabase = createClient()
  const { appUser, loading, signOut } = useAuth()
  const router = useRouter()

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [fetching, setFetching] = useState(true)

  const isAdmin = appUser?.role === 'admin'

  useEffect(() => {
    supabase
      .from('categories')
      .select('id, name')
      .order('name')
      .then(({ data }) => setCategories(data ?? []))

    supabase
      .from('products')
      .select('id, code, name, base_price, price, stock, categories(name)')
      .order('name')
      .then(({ data }) => {
        setProducts((data as unknown as Product[]) ?? [])
        setFetching(false)
      })
  }, [])

  const filtered = products.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code?.toLowerCase().includes(search.toLowerCase())
    const matchCategory = categoryId === '' || categories.find((c) => c.id === categoryId)?.name === p.categories?.name
    return matchSearch && matchCategory
  })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
        Memuat...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-gray-800">Produk</h1>
          <p className="text-xs text-gray-400 flex items-center gap-1">
            {appUser?.name}
            <span className={`font-semibold px-1.5 py-0.5 rounded-full text-[10px] ${isAdmin ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
              {appUser?.role}
            </span>
          </p>
        </div>
        <button
          onClick={async () => { await signOut(); router.push('/login') }}
          className="text-xs text-gray-400 hover:text-red-500 transition"
        >
          Keluar
        </button>
      </div>

      <div className="px-4 py-4 max-w-2xl mx-auto space-y-4">
        {/* Title + action */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Daftar Produk</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {fetching ? '...' : `${filtered.length} produk ditemukan`}
            </p>
          </div>
          <button
            onClick={() => router.push('/products/bulk-input')}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-2 rounded-lg transition"
          >
            + Tambah
          </button>
        </div>

        {/* Search + Category filter */}
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau kode..."
            className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value === '' ? '' : Number(e.target.value))}
            className="border border-gray-300 rounded-xl px-3 py-3 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Semua</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Product cards */}
        {fetching ? (
          <div className="text-center text-sm text-gray-400 py-10">Memuat produk...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-10">Tidak ada produk.</div>
        ) : (
          <div className="space-y-2">
            {filtered.map((p) => (
              <div key={p.id} className="bg-white rounded-xl shadow-sm p-4 flex items-start justify-between gap-3 relative">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{p.code}</p>
                  <span className="inline-block mt-1 text-[10px] font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                    {p.categories?.name ?? '-'}
                  </span>
                </div>
                <div className="text-right shrink-0 space-y-1 flex flex-col items-end">
                  {isAdmin && (
                    <p className="text-[11px] text-gray-400">
                      Modal: <span className="font-medium text-gray-600">Rp {p.base_price.toLocaleString('id-ID')}</span>
                    </p>
                  )}
                  <p className="text-sm font-bold text-blue-600">
                    Rp {p.price.toLocaleString('id-ID')}
                  </p>
                  <p className={`text-xs font-medium ${p.stock <= 0 ? 'text-red-400' : 'text-green-600'}`}>
                    Stok: {p.stock}
                  </p>
                  <button
                    onClick={() => router.push(`/products/edit/${p.id}`)}
                    className="mt-1 w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition"
                    title="Edit produk"
                  >
                    <FontAwesomeIcon icon={faPenToSquare} className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
