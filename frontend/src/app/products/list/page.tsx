'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPenToSquare, faArrowUpAZ } from '@fortawesome/free-solid-svg-icons'
import ProductTabs from '@/lib/ProductTabs'

type Product = {
  id: number
  code: string
  name: string
  base_price: number
  price: number
  stock: number
  updated_at: string
  categories: { name: string } | null
}

type Category = {
  id: number
  name: string
}

type SortOption = 'updated_desc' | 'name_asc' | 'stock_asc'

const sortLabels: Record<SortOption, string> = {
  updated_desc: 'Terbaru Diupdate',
  name_asc: 'Nama A→Z',
  stock_asc: 'Stok Terendah',
}

function sortProducts(products: Product[], sort: SortOption): Product[] {
  const arr = [...products]
  if (sort === 'updated_desc') return arr.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  if (sort === 'name_asc') return arr.sort((a, b) => a.name.localeCompare(b.name))
  if (sort === 'stock_asc') return arr.sort((a, b) => a.stock - b.stock)
  return arr
}

export default function ProductListPage() {
  const supabase = createClient()
  const { appUser, loading } = useAuth()
  const router = useRouter()

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [sort, setSort] = useState<SortOption>('updated_desc')
  const [sortOpen, setSortOpen] = useState(false)
  const [fetching, setFetching] = useState(true)
  const sortRef = useRef<HTMLDivElement>(null)

  const isAdmin = appUser?.role === 'admin'

  useEffect(() => {
    supabase
      .from('categories')
      .select('id, name')
      .order('name')
      .then(({ data }: { data: Category[] | null }) => setCategories(data ?? []))

    supabase
      .from('products')
      .select('id, code, name, base_price, price, stock, updated_at, categories(name)')
      .then(({ data }: { data: Product[] | null }) => {
        setProducts(data ?? [])
        setFetching(false)
      })
  }, [])

  // Close sort dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = sortProducts(
    products.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.code?.toLowerCase().includes(search.toLowerCase())
      const matchCategory = categoryId === '' || categories.find((c) => c.id === categoryId)?.name === p.categories?.name
      return matchSearch && matchCategory
    }),
    sort
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
        Memuat...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-4 max-w-2xl mx-auto space-y-4">
        {/* Tabs */}
        <ProductTabs />

        {/* Title + sort */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Daftar Produk</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {fetching ? '...' : `${filtered.length} produk ditemukan`}
            </p>
          </div>

          {/* Sort button */}
          <div className="relative" ref={sortRef}>
            <button
              onClick={() => setSortOpen((o) => !o)}
              className={`w-9 h-9 flex items-center justify-center rounded-xl transition ${
                sortOpen ? 'bg-[#121358] text-white' : 'bg-white shadow-sm text-gray-500 hover:text-[#121358]'
              }`}
              title="Urutkan"
            >
              <FontAwesomeIcon icon={faArrowUpAZ} className="w-4 h-4" />
            </button>

            {sortOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl border border-gray-200 shadow-lg py-1 z-50">
                {(Object.entries(sortLabels) as [SortOption, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => { setSort(key); setSortOpen(false) }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition ${
                      sort === key
                        ? 'text-[#121358] bg-[#121358]/8 font-semibold'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {label}
                    {sort === key && <span className="float-right text-[#121358]">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Search + Category filter */}
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau kode..."
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#121358]"
          />
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#121358]"
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
                  <p className="text-xs text-gray-500 mt-0.5">{p.code}</p>
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
                  <p className="text-sm font-bold text-[#121358]">
                    Rp {p.price.toLocaleString('id-ID')}
                  </p>
                  <p className={`text-xs font-medium ${p.stock <= 0 ? 'text-red-400' : 'text-green-600'}`}>
                    Stok: {p.stock}
                  </p>
                  <button
                    onClick={() => router.push(`/products/edit/${p.id}`)}
                    className="mt-1 w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-[#121358]/10 text-gray-400 hover:text-[#121358] transition"
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
