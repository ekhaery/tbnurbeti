'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPenToSquare, faArrowUpAZ, faTrash, faXmark } from '@fortawesome/free-solid-svg-icons'
import ProductTabs from '@/lib/ProductTabs'

type Product = {
  id: number
  code: string
  name: string
  base_price: number
  price: number
  stock: number
  updated_at: string
  is_deleted: boolean
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
  const [categoryQuery, setCategoryQuery] = useState('')
  const [categoryDropdown, setCategoryDropdown] = useState(false)
  const [sort, setSort] = useState<SortOption>('updated_desc')
  const [sortOpen, setSortOpen] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 25
  const sortRef = useRef<HTMLDivElement>(null)

  const isAdmin = appUser?.role === 'admin'

  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting] = useState(false)


  const handleDelete = async () => {
    if (!deleteTarget || deleteInput !== 'delete') return
    setDeleting(true)
    await supabase.from('products').update({ is_deleted: true }).eq('id', deleteTarget.id)
    setProducts(prev => prev.filter(p => p.id !== deleteTarget.id))
    setDeleteTarget(null)
    setDeleteInput('')
    setDeleting(false)
  }

  useEffect(() => {
    supabase
      .from('categories')
      .select('id, name')
      .order('name')
      .then(({ data }: { data: Category[] | null }) => setCategories(data ?? []))

    // Fetch all products + stock_batches in chunks
    const fetchAll = async () => {
      const chunkSize = 1000

      // Fetch products
      let from = 0
      let allProducts: Product[] = []
      while (true) {
        const { data, error } = await supabase
          .from('products')
          .select('id, code, name, base_price, price, updated_at, is_deleted, categories(name)')
          .eq('is_deleted', false)
          .range(from, from + chunkSize - 1)
        if (error || !data || data.length === 0) break
        allProducts = [...allProducts, ...(data as Product[])]
        if (data.length < chunkSize) break
        from += chunkSize
      }

      // Fetch stock_batches and sum qty_remaining per product
      from = 0
      const stockMap: Record<number, number> = {}
      while (true) {
        const { data, error } = await supabase
          .from('stock_batches')
          .select('product_id, qty_remaining')
          .eq('is_available', true)
          .range(from, from + chunkSize - 1)
        if (error || !data || data.length === 0) break
        for (const row of data as { product_id: number; qty_remaining: number }[]) {
          stockMap[row.product_id] = (stockMap[row.product_id] ?? 0) + row.qty_remaining
        }
        if (data.length < chunkSize) break
        from += chunkSize
      }

      // Override stock with sum from stock_batches
      setProducts(allProducts.map(p => ({ ...p, stock: stockMap[p.id] ?? 0 })))
      setFetching(false)
    }
    fetchAll()
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

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [search, categoryId, sort])

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
          <div className="relative">
            <input
              type="text"
              value={categoryQuery}
              onChange={e => { setCategoryQuery(e.target.value); setCategoryId(''); setCategoryDropdown(true) }}
              onFocus={() => setCategoryDropdown(true)}
              onBlur={() => setTimeout(() => setCategoryDropdown(false), 150)}
              placeholder="Semua kategori..."
              autoComplete="off"
              className={`w-full border rounded-xl px-4 py-3 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#121358] ${categoryId !== '' ? 'border-[#121358]/40 bg-[#121358]/5' : 'border-gray-300'}`}
            />
            {categoryDropdown && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                <button onMouseDown={() => { setCategoryId(''); setCategoryQuery(''); setCategoryDropdown(false) }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition ${categoryId === '' ? 'bg-[#121358] text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                  Semua
                </button>
                {categories
                  .filter(c => c.name.toLowerCase().includes(categoryQuery.toLowerCase()))
                  .map(cat => (
                    <button key={cat.id} onMouseDown={() => { setCategoryId(cat.id); setCategoryQuery(cat.name); setCategoryDropdown(false) }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition ${categoryId === cat.id ? 'bg-[#121358] text-white' : 'text-gray-700 hover:bg-gray-50'}`}>
                      {cat.name}
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Product cards */}
        {fetching ? (
          <div className="text-center text-sm text-gray-400 py-10">Memuat produk...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-10">Tidak ada produk.</div>
        ) : (
          <div className="space-y-2">
            {paginated.map((p) => (
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
                  <div className="flex items-center gap-1 mt-1">
                    <button
                      onClick={() => router.push(`/products/edit/${p.id}`)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-[#121358]/10 text-gray-400 hover:text-[#121358] transition"
                      title="Edit produk"
                    >
                      <FontAwesomeIcon icon={faPenToSquare} className="w-3.5 h-3.5" />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => { setDeleteTarget(p); setDeleteInput('') }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-red-100 text-gray-400 hover:text-red-500 transition"
                        title="Hapus produk"
                      >
                        <FontAwesomeIcon icon={faTrash} className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-gray-400">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} dari {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition"
              >‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce<(number | string)[]>((acc, p, i, arr) => {
                  if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('…')
                  acc.push(p)
                  return acc
                }, [])
                .map((p, i) => p === '…' ? (
                  <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-gray-400">…</span>
                ) : (
                  <button key={p} onClick={() => setPage(p as number)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition ${page === p ? 'bg-[#121358] text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    {p}
                  </button>
                ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition"
              >›</button>
            </div>
          </div>
        )}
      </div>


      {/* Delete confirmation popup */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="px-5 py-4 bg-red-600 flex items-center justify-between">
              <p className="text-sm font-bold text-white">Hapus Produk</p>
              <button onClick={() => setDeleteTarget(null)} className="w-7 h-7 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition">
                <FontAwesomeIcon icon={faXmark} className="w-3 h-3" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-gray-700">Anda akan menghapus produk <span className="font-semibold">{deleteTarget.name}</span>.</p>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Tulis kata <span className="font-semibold text-red-500">&quot;delete&quot;</span> untuk menghapus produk</label>
                <input
                  type="text"
                  value={deleteInput}
                  onChange={e => setDeleteInput(e.target.value)}
                  placeholder="delete"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition">Batal</button>
              <button
                onClick={handleDelete}
                disabled={deleteInput !== 'delete' || deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-semibold transition"
              >
                {deleting ? 'Menghapus...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
