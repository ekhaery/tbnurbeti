'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { toTitleCase } from '@/lib/utils'

type Category = {
  id: number
  name: string
}

type ProductRow = {
  name: string
  base_price: string
  price: string
  stock: string
}

type Payload = {
  name: string
  category_id: number | ''
  base_price: number
  price: number
  stock: number
}

const emptyRow = (): ProductRow => ({
  name: '',
  base_price: '',
  price: '',
  stock: '0',
})

const fmt = (n: number) => n.toLocaleString('id-ID')

export default function BulkInputPage() {
  const supabase = createClient()
  const { appUser, loading, signOut } = useAuth()
  const router = useRouter()

  const [categories, setCategories] = useState<Category[]>([])
  const [existingNames, setExistingNames] = useState<string[]>([])
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [rows, setRows] = useState<ProductRow[]>([emptyRow()])
  const [submitting, setSubmitting] = useState(false)
  const [successCount, setSuccessCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // confirmation modal
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingPayload, setPendingPayload] = useState<Payload[]>([])

  const isAdmin = appUser?.role === 'admin'

  useEffect(() => {
    supabase
      .from('categories')
      .select('id, name')
      .order('name')
      .then(({ data }) => setCategories(data ?? []))

    supabase
      .from('products')
      .select('name')
      .then(({ data }) => setExistingNames((data ?? []).map((p: { name: string }) => p.name.toLowerCase())))
  }, [])

  const updateRow = (index: number, field: keyof ProductRow, value: string) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    )
  }

  const addRow = () => setRows((prev) => [...prev, emptyRow()])

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessCount(null)

    if (!categoryId) {
      setError('Pilih kategori terlebih dahulu.')
      return
    }

    const validRows = rows.filter((r) => r.name.trim() && r.price)
    if (validRows.length === 0) {
      setError('Isi minimal satu produk.')
      return
    }

    const duplicates = validRows.filter((r) =>
      existingNames.includes(toTitleCase(r.name.trim()).toLowerCase())
    )
    if (duplicates.length > 0) {
      setError(`Produk sudah ada: ${duplicates.map((r) => toTitleCase(r.name.trim())).join(', ')}`)
      return
    }

    const payload: Payload[] = validRows.map((r) => ({
      name: toTitleCase(r.name.trim()),
      category_id: categoryId,
      base_price: parseFloat(r.base_price) || 0,
      price: parseFloat(r.price),
      stock: parseInt(r.stock) || 0,
    }))

    setPendingPayload(payload)
    setShowConfirm(true)
  }

  const confirmSave = async () => {
    setShowConfirm(false)
    setSubmitting(true)

    const { error: insertError } = await supabase.from('products').insert(pendingPayload)
    setSubmitting(false)

    if (insertError) {
      setError(insertError.message)
    } else {
      setSuccessCount(pendingPayload.length)
      setRows([emptyRow()])
      setCategoryId('')
      setPendingPayload([])
    }
  }

  const categoryName = categories.find((c) => c.id === categoryId)?.name ?? '-'

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
          <h1 className="text-base font-bold text-gray-800">Input Produk</h1>
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

      <div className="px-4 py-4 max-w-xl mx-auto space-y-4">
        {/* Title */}
        <div>
          <h2 className="text-lg font-bold text-gray-800">Buat Produk</h2>
          <p className="text-xs text-gray-400 mt-0.5">Membuat banyak produk dalam satu kategori yang sama.</p>
        </div>

        {/* Feedback */}
        {successCount !== null && (
          <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
            ✅ {successCount} produk berhasil disimpan.
          </div>
        )}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category selector */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Kategori <span className="text-red-500">*</span>
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
              required
            >
              <option value="">-- Pilih Kategori --</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Product rows as cards */}
          <div className="space-y-3">
            {rows.map((row, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400">Produk {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    disabled={rows.length === 1}
                    className="w-6 h-6 flex items-center justify-center rounded-full bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 disabled:opacity-20 disabled:cursor-not-allowed transition text-xs leading-none"
                    title="Hapus baris"
                  >
                    ✕
                  </button>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Nama Produk <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) => updateRow(i, 'name', e.target.value)}
                    placeholder="Ketik nama produk baru..."
                    list={`products-list-${i}`}
                    className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 bg-gray-50 ${
                      row.name.trim() && existingNames.includes(toTitleCase(row.name.trim()).toLowerCase())
                        ? 'border-red-300 focus:ring-red-300'
                        : 'border-gray-200 focus:ring-blue-400'
                    }`}
                  />
                  <datalist id={`products-list-${i}`}>
                    {existingNames.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                  {row.name.trim() && existingNames.includes(toTitleCase(row.name.trim()).toLowerCase()) && (
                    <p className="text-xs text-red-500 mt-1">⚠ Produk ini sudah ada.</p>
                  )}
                </div>

                <div className={`grid gap-3 ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  {isAdmin && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Harga Modal</label>
                      <input
                        type="number"
                        value={row.base_price}
                        onChange={(e) => updateRow(i, 'base_price', e.target.value)}
                        placeholder="0"
                        min="0"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Harga Jual <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={row.price}
                      onChange={(e) => updateRow(i, 'price', e.target.value)}
                      placeholder="0"
                      min="0"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Stok</label>
                    <input
                      type="number"
                      value={row.stock}
                      onChange={(e) => updateRow(i, 'stock', e.target.value)}
                      placeholder="0"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addRow}
            className="w-full border-2 border-dashed border-gray-200 rounded-xl py-3 text-sm text-blue-500 hover:border-blue-300 hover:bg-blue-50 transition font-medium"
          >
            + Tambah Produk
          </button>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-3 rounded-xl transition text-sm"
          >
            {submitting ? 'Menyimpan...' : 'Simpan Produk'}
          </button>
        </form>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            {/* Modal header */}
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-800">Konfirmasi Simpan</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Kategori: <span className="font-medium text-gray-600">{categoryName}</span>
                {' · '}
                <span className="font-medium text-gray-600">{pendingPayload.length} produk</span>
              </p>
            </div>

            {/* Product summary list */}
            <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
              {pendingPayload.map((p, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{p.name}</p>
                    <p className="text-xs text-gray-400">Stok: {p.stock}</p>
                  </div>
                  <div className="text-right">
                    {isAdmin && (
                      <p className="text-[11px] text-gray-400">Modal: Rp {fmt(p.base_price)}</p>
                    )}
                    <p className="text-sm font-semibold text-blue-600">Rp {fmt(p.price)}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition"
              >
                Kembali
              </button>
              <button
                onClick={confirmSave}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition"
              >
                Ya, Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
