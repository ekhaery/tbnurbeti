'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '@/context/AuthContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'
import PurchasingTabs from '@/lib/PurchasingTabs'
import { toTitleCase } from '@/lib/utils'

type Supplier = { id: number; name: string }
type Product = { id: number; name: string; categories: { name: string } | null }
type ItemRow = { product_id: number | ''; qty: string; base_price: string }

const emptyItem = (): ItemRow => ({ product_id: '', qty: '', base_price: '' })

const fmt = (n: number) => n.toLocaleString('id-ID')

function generateCode(supplierName: string, date: string) {
  const d = date.replace(/-/g, '')
  const s = supplierName.toUpperCase().replace(/\s+/g, '').slice(0, 8)
  return `PUR-${s}-${d}`
}

export default function BuatPurchasingPage() {
  const supabase = createClient()
  const { appUser } = useAuth()

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [supplierId, setSupplierId] = useState<number | ''>('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [period, setPeriod] = useState('')
  const [items, setItems] = useState<ItemRow[]>([emptyItem()])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // New supplier inline
  const [newSupplierName, setNewSupplierName] = useState('')
  const [addingSupplier, setAddingSupplier] = useState(false)
  const [showNewSupplier, setShowNewSupplier] = useState(false)

  useEffect(() => {
    supabase.from('suppliers').select('id, name').order('name')
      .then(({ data }: { data: Supplier[] | null }) => setSuppliers(data ?? []))
    supabase.from('products').select('id, name, categories(name)').order('name')
      .then(({ data }: { data: Product[] | null }) => setProducts(data ?? []))
  }, [])

  const updateItem = (i: number, field: keyof ItemRow, value: string | number) => {
    setItems(prev => prev.map((row, idx) => idx === i ? { ...row, [field]: value } : row))
  }

  const addItem = () => setItems(prev => [...prev, emptyItem()])
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i))

  const handleAddSupplier = async () => {
    if (!newSupplierName.trim()) return
    setAddingSupplier(true)
    const { data, error } = await supabase.from('suppliers')
      .insert({ name: toTitleCase(newSupplierName.trim()) })
      .select('id, name').single()
    setAddingSupplier(false)
    if (error) { setError(error.message); return }
    setSuppliers(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    setSupplierId(data.id)
    setNewSupplierName('')
    setShowNewSupplier(false)
  }

  const selectedSupplier = suppliers.find(s => s.id === supplierId)
  const previewCode = selectedSupplier ? generateCode(selectedSupplier.name, date) : 'PUR-...'

  const validItems = items.filter(r => r.product_id && r.qty && r.base_price)
  const total = validItems.reduce((sum, r) => sum + (parseFloat(r.base_price) || 0) * (parseInt(r.qty) || 0), 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!supplierId) { setError('Pilih supplier terlebih dahulu.'); return }
    if (validItems.length === 0) { setError('Isi minimal satu produk.'); return }

    setSubmitting(true)

    const code = generateCode(selectedSupplier!.name, date)

    // 1. Insert purchasing header
    const { data: pur, error: purErr } = await supabase.from('purchasing')
      .insert({ code, supplier_id: supplierId, date, notes: notes.trim() || null, period: parseInt(period) || 0, created_by: appUser?.id })
      .select('id').single()

    if (purErr || !pur) { setError(purErr?.message ?? 'Gagal menyimpan.'); setSubmitting(false); return }

    // 2. Insert purchasing_items
    const purItems = validItems.map(r => ({
      purchasing_id: pur.id,
      product_id: Number(r.product_id),
      qty: parseInt(r.qty),
      base_price: parseFloat(r.base_price),
    }))

    const { data: insertedItems, error: itemsErr } = await supabase
      .from('purchasing_items').insert(purItems).select('id, product_id, qty, base_price')

    if (itemsErr || !insertedItems) { setError(itemsErr?.message ?? 'Gagal menyimpan items.'); setSubmitting(false); return }

    // 3. Insert stock_batches
    const batches = insertedItems.map((item: { id: number; product_id: number; qty: number; base_price: number }) => ({
      purchasing_item_id: item.id,
      product_id: item.product_id,
      qty_remaining: item.qty,
      base_price: item.base_price,
      received_at: date,
    }))

    const { error: batchErr } = await supabase.from('stock_batches').insert(batches)
    if (batchErr) { setError(batchErr.message); setSubmitting(false); return }

    setSubmitting(false)
    setSuccess(`Purchasing ${code} berhasil disimpan.`)
    setSupplierId('')
    setNotes('')
    setPeriod('')
    setItems([emptyItem()])
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-xl mx-auto space-y-4">
        <PurchasingTabs />

        <div>
          <h2 className="text-lg font-bold text-gray-800">Buat Purchasing</h2>
          <p className="text-xs text-gray-400 mt-0.5">Catat pembelian stok dari supplier.</p>
        </div>

        {success && (
          <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">✅ {success}</div>
        )}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">⚠️ {error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Header card */}
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Info Purchasing</p>

            {/* Supplier */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Supplier <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <select
                  value={supplierId}
                  onChange={e => setSupplierId(Number(e.target.value))}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]"
                  required
                >
                  <option value="">-- Pilih Supplier --</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => setShowNewSupplier(v => !v)}
                  className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm transition"
                  title="Tambah supplier baru"
                >
                  <FontAwesomeIcon icon={faPlus} className="w-3.5 h-3.5" />
                </button>
              </div>
              {showNewSupplier && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={newSupplierName}
                    onChange={e => setNewSupplierName(e.target.value)}
                    placeholder="Nama supplier baru"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]"
                  />
                  <button
                    type="button"
                    onClick={handleAddSupplier}
                    disabled={addingSupplier || !newSupplierName.trim()}
                    className="px-3 py-2 bg-[#121358] text-white rounded-lg text-sm disabled:opacity-50 transition"
                  >
                    {addingSupplier ? '...' : 'Simpan'}
                  </button>
                </div>
              )}
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tanggal <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]"
                required
              />
            </div>

            {/* Period */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Jangka Bayar <span className="text-gray-400">(bulan)</span></label>
              <input
                type="number"
                value={period}
                onChange={e => setPeriod(e.target.value)}
                placeholder="0 = lunas saat beli"
                min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]"
              />
              {period && parseInt(period) > 0 && (
                <p className="text-xs text-amber-600 mt-1">Pembayaran dalam {period} bulan.</p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Catatan</label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Opsional"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]"
              />
            </div>

            {/* Preview code */}
            <div className="pt-1 border-t border-gray-100">
              <p className="text-xs text-gray-400">Kode: <span className="font-mono font-semibold text-gray-700">{previewCode}</span></p>
            </div>
          </div>

          {/* Product rows */}
          <div className="space-y-3">
            {items.map((row, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400">Produk {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    disabled={items.length === 1}
                    className="w-6 h-6 flex items-center justify-center rounded-full bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 disabled:opacity-20 transition"
                  >
                    <FontAwesomeIcon icon={faTrash} className="w-3 h-3" />
                  </button>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Produk <span className="text-red-500">*</span></label>
                  <select
                    value={row.product_id}
                    onChange={e => updateItem(i, 'product_id', Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]"
                    required
                  >
                    <option value="">-- Pilih Produk --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}{p.categories?.name ? ` (${p.categories.name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Qty <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      value={row.qty}
                      onChange={e => updateItem(i, 'qty', e.target.value)}
                      placeholder="0"
                      min="1"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Harga Beli <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      value={row.base_price}
                      onChange={e => updateItem(i, 'base_price', e.target.value)}
                      placeholder="0"
                      min="0"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]"
                    />
                  </div>
                </div>

                {row.qty && row.base_price && (
                  <p className="text-xs text-gray-400 text-right">
                    Subtotal: <span className="font-semibold text-gray-700">Rp {fmt((parseInt(row.qty) || 0) * (parseFloat(row.base_price) || 0))}</span>
                  </p>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addItem}
            className="w-full border-2 border-dashed border-gray-200 rounded-xl py-3 text-sm text-[#121358] hover:border-[#121358]/30 hover:bg-[#121358]/5 transition font-medium"
          >
            + Tambah Produk
          </button>

          {/* Total */}
          {total > 0 && (
            <div className="bg-white rounded-xl shadow-sm px-4 py-3 flex justify-between items-center">
              <span className="text-sm text-gray-500">Total Pembelian</span>
              <span className="text-base font-bold text-[#121358]">Rp {fmt(total)}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#121358] hover:bg-[#1a1c6e] disabled:bg-[#121358]/40 text-white font-semibold py-3 rounded-xl transition text-sm"
          >
            {submitting ? 'Menyimpan...' : 'Simpan Purchasing'}
          </button>
        </form>
      </div>
    </div>
  )
}
