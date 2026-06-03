'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '@/context/AuthContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons'
import { toTitleCase } from '@/lib/utils'

type Category = { id: number; name: string }

export default function EditProductPage() {
  const supabase = createClient()
  const { appUser, loading } = useAuth()
  const router = useRouter()
  const { id } = useParams()

  const isAdmin = appUser?.role === 'admin'

  const [categories, setCategories] = useState<Category[]>([])
  const [form, setForm] = useState({
    code: '',
    name: '',
    category_id: '',
    base_price: '',
    price: '',
    stock: '',
    is_discontinued: false,
  })
  const [fetching, setFetching] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    supabase.from('categories').select('id, name').order('name').then(({ data }: { data: Category[] | null }) => setCategories(data ?? []))

    supabase
      .from('products')
      .select('id, code, name, category_id, base_price, price, stock, is_discontinued')
      .eq('id', id)
      .single()
      .then(({ data }: { data: { code: string | null; name: string; category_id: number; base_price: number; price: number; stock: number; is_discontinued: boolean } | null }) => {
        if (data) {
          setForm({
            code: data.code ?? '',
            name: data.name ?? '',
            category_id: String(data.category_id ?? ''),
            base_price: String(data.base_price ?? ''),
            price: String(data.price ?? ''),
            stock: String(data.stock ?? ''),
            is_discontinued: data.is_discontinued ?? false,
          })
        }
        setFetching(false)
      })
  }, [id])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setSaving(true)

    const { error: updateError } = await supabase
      .from('products')
      .update({
        code: form.code.trim() || null,
        name: toTitleCase(form.name),
        category_id: Number(form.category_id),
        base_price: parseFloat(form.base_price) || 0,
        price: parseFloat(form.price) || 0,
        stock: parseInt(form.stock) || 0,
        is_discontinued: form.is_discontinued,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
    } else {
      setSuccess(true)
      setTimeout(() => router.push('/products/list'), 1000)
    }
  }

  if (loading || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
        Memuat...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
          <FontAwesomeIcon icon={faChevronLeft} className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-base font-bold text-gray-800">Edit Produk</h1>
          <p className="text-xs text-gray-400">Perbarui informasi produk</p>
        </div>
      </div>

      <div className="px-4 py-4 max-w-xl mx-auto space-y-4">
        {success && (
          <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
            ✅ Produk berhasil diperbarui.
          </div>
        )}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSave} className="bg-white rounded-xl shadow-sm p-4 space-y-4">
          {/* Code */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Kode Produk</label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#121358]"
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nama Produk <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#121358]"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Kategori <span className="text-red-500">*</span></label>
            <select
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              required
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#121358]"
            >
              <option value="">-- Pilih Kategori --</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Price + Base Price + Stock */}
          <div className={`grid gap-3 ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {isAdmin && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Harga Modal</label>
                <input
                  type="number"
                  value={form.base_price}
                  onChange={(e) => setForm({ ...form, base_price: e.target.value })}
                  min="0"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#121358]"
                />
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Harga Jual <span className="text-red-500">*</span></label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
                min="0"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#121358]"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Stok</label>
              <input
                type="number"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#121358]"
              />
            </div>
          </div>

          {/* Discontinued toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm text-gray-700 font-medium">Discontinued</p>
              <p className="text-xs text-gray-400">Tandai produk jika tidak restock lagi</p>
            </div>
            <button
              type="button"
              onClick={() => setForm({ ...form, is_discontinued: !form.is_discontinued })}
              className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none ${
                form.is_discontinued ? 'bg-red-400' : 'bg-gray-200'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                form.is_discontinued ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#121358] hover:bg-[#1a1c6e] disabled:bg-[#121358]/40 text-white font-semibold py-3 rounded-xl transition text-sm"
          >
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </form>
      </div>
    </div>
  )
}
