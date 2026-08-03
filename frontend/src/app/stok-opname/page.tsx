'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '@/context/AuthContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faChevronRight } from '@fortawesome/free-solid-svg-icons'

type Session = {
  id: number
  created_at: string
  categories: { name: string } | null
  users: { name: string } | null
}

type Category = { id: number; name: string }
type Product = { id: number; name: string }

export default function StokOpnamePage() {
  const supabase = createClient()
  const { appUser, loading } = useAuth()

  const [sessions, setSessions] = useState<Session[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [showPopup, setShowPopup] = useState(false)

  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSessions()
    supabase.from('categories').select('id, name').order('name')
      .then(({ data }: { data: Category[] | null }) => setCategories(data ?? []))
  }, [])

  const fetchSessions = async () => {
    const { data } = await supabase
      .from('stock_opname_sessions')
      .select('id, created_at, categories(name), users(name)')
      .order('created_at', { ascending: false })
      .limit(100)
    setSessions((data as Session[]) ?? [])
  }

  useEffect(() => {
    if (!selectedCategoryId) {
      setProducts([])
      setSelectedProductIds([])
      return
    }
    setLoadingProducts(true)
    supabase
      .from('products')
      .select('id, name')
      .eq('category_id', Number(selectedCategoryId))
      .eq('is_deleted', false)
      .eq('is_discontinued', false)
      .order('name')
      .then(({ data }: { data: Product[] | null }) => {
        setProducts(data ?? [])
        setSelectedProductIds([])
        setLoadingProducts(false)
      })
  }, [selectedCategoryId])

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  )

  const handleCreate = async () => {
    setError(null)
    if (!selectedCategoryId) { setError('Please select a category.'); return }
    if (selectedProductIds.length === 0) { setError('Please select at least one product.'); return }
    setCreating(true)

    const { data: session, error: sessionErr } = await supabase
      .from('stock_opname_sessions')
      .insert({ category_id: Number(selectedCategoryId), created_by: appUser!.id })
      .select('id')
      .single()

    if (sessionErr || !session) {
      setError(sessionErr?.message ?? 'Gagal membuat sesi.')
      setCreating(false)
      return
    }

    await supabase.from('stock_opname_items').insert(
      selectedProductIds.map(pid => ({ session_id: (session as { id: number }).id, product_id: pid }))
    )

    setCreating(false)
    setShowPopup(false)
    resetPopup()
    fetchSessions()
  }

  const resetPopup = () => {
    setSelectedCategoryId('')
    setProducts([])
    setSelectedProductIds([])
    setProductSearch('')
    setError(null)
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-gray-800">Stock Opname</h1>
          <p className="text-xs text-gray-400">Riwayat sesi stock opname</p>
        </div>
        <button
          onClick={() => setShowPopup(true)}
          className="flex items-center gap-1.5 bg-[#121358] text-white text-xs font-semibold px-3 py-2 rounded-xl"
        >
          <FontAwesomeIcon icon={faPlus} className="w-3 h-3" />
          Tambah
        </button>
      </div>

      <div className="px-4 py-4 max-w-xl mx-auto">
        {sessions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center mt-12">Belum ada sesi stock opname.</p>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden divide-y divide-gray-100">
            <div className="grid grid-cols-3 px-4 py-2 bg-gray-50 border-b border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Tanggal</p>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Kategori</p>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">User</p>
            </div>
            {sessions.map(s => (
              <Link key={s.id} href={`/stok-opname/${s.id}`} className="grid grid-cols-3 items-center px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors">
                <p className="text-xs text-gray-600">{formatDate(s.created_at)}</p>
                <p className="text-xs font-medium text-gray-800">{s.categories?.name ?? '-'}</p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-600">{s.users?.name ?? '-'}</p>
                  <FontAwesomeIcon icon={faChevronRight} className="w-3 h-3 text-gray-300" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {showPopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => { setShowPopup(false); resetPopup() }}
        >
          <div
            className="bg-white w-full max-w-xl rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-800">Buat Stock Opname</h2>
              <button onClick={() => { setShowPopup(false); resetPopup() }} className="text-xs text-gray-400">Batal</button>
            </div>

            {error && (
              <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>
            )}

            <div>
              <label className="block text-xs text-gray-500 mb-1">Kategori <span className="text-red-500">*</span></label>
              <select
                value={selectedCategoryId}
                onChange={e => { setSelectedCategoryId(e.target.value); setError(null) }}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#121358]"
              >
                <option value="">-- Pilih Kategori --</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {selectedCategoryId && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-gray-500">Produk <span className="text-red-500">*</span></label>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setSelectedProductIds(products.map(p => p.id))} className="text-[10px] text-[#121358] font-semibold">Pilih Semua</button>
                    <button type="button" onClick={() => setSelectedProductIds([])} className="text-[10px] text-gray-400">Hapus Semua</button>
                  </div>
                </div>

                <input
                  type="text"
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  placeholder="Cari produk..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#121358] mb-2"
                />

                {loadingProducts ? (
                  <p className="text-xs text-gray-400 text-center py-6">Memuat produk...</p>
                ) : filteredProducts.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">Tidak ada produk ditemukan.</p>
                ) : (
                  <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 max-h-52 overflow-y-auto">
                    {filteredProducts.map(p => (
                      <label key={p.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={selectedProductIds.includes(p.id)}
                          onChange={e => {
                            if (e.target.checked) setSelectedProductIds(prev => [...prev, p.id])
                            else setSelectedProductIds(prev => prev.filter(id => id !== p.id))
                          }}
                          className="w-4 h-4 accent-[#121358] flex-shrink-0"
                        />
                        <span className="text-sm text-gray-700">{p.name}</span>
                      </label>
                    ))}
                  </div>
                )}

                <p className="text-[10px] text-gray-400 mt-1.5">{selectedProductIds.length} produk dipilih</p>
              </div>
            )}

            <button
              onClick={handleCreate}
              disabled={creating}
              className="w-full bg-[#121358] text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-40 transition"
            >
              {creating ? 'Membuat...' : 'Buat Stock Opname'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
