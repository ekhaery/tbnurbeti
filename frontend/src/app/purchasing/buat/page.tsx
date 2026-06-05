'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '@/context/AuthContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'
import PurchasingTabs from '@/lib/PurchasingTabs'
import { toTitleCase } from '@/lib/utils'
import type { PurchasingStatus } from '@/lib/purchasingStatus'

type Supplier = { id: number; name: string }
type Product = { id: number; name: string; categories: { name: string } | null }
type ItemRow = { product_id: number | ''; query: string; qty: string; base_price: string }
type AutocompleteState = { open: boolean; focused: number }

const emptyItem = (): ItemRow => ({ product_id: '', query: '', qty: '', base_price: '' })

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
  const [autocomplete, setAutocomplete] = useState<AutocompleteState[]>([{ open: false, focused: -1 }])
  const [transformationPhase, setTransformationPhase] = useState(true)
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

  const addItem = () => {
    setItems(prev => [...prev, emptyItem()])
    setAutocomplete(prev => [...prev, { open: false, focused: -1 }])
  }
  const removeItem = (i: number) => {
    setItems(prev => prev.filter((_, idx) => idx !== i))
    setAutocomplete(prev => prev.filter((_, idx) => idx !== i))
  }

  const selectProduct = (i: number, product: Product) => {
    setItems(prev => prev.map((row, idx) => idx === i
      ? { ...row, product_id: product.id, query: product.name }
      : row
    ))
    setAutocomplete(prev => prev.map((s, idx) => idx === i ? { open: false, focused: -1 } : s))
  }

  const filteredProducts = (query: string) =>
    query.trim() === ''
      ? products
      : products.filter(p =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          (p.categories?.name ?? '').toLowerCase().includes(query.toLowerCase())
        )

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
    const totalValue = validItems.reduce((sum, r) => sum + (parseFloat(r.base_price) || 0) * (parseInt(r.qty) || 0), 0)

    const status: PurchasingStatus = transformationPhase ? 'init' : 'created'

    const { data: pur, error: purErr } = await supabase.from('purchasing')
      .insert({ code, supplier_id: supplierId, date, notes: notes.trim() || null, period: parseInt(period) || 0, total: totalValue, created_by: appUser?.id, status })
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

    // 3. Insert stock_batches (only when transformation phase is OFF)
    if (!transformationPhase) {
      const batches = insertedItems.map((item: { id: number; product_id: number; qty: number; base_price: number }) => ({
        purchasing_item_id: item.id,
        product_id: item.product_id,
        qty_remaining: item.qty,
        base_price: item.base_price,
        received_at: date,
        is_available: false,
      }))

      const { error: batchErr } = await supabase.from('stock_batches').insert(batches)
      if (batchErr) { setError(batchErr.message); setSubmitting(false); return }
    }

    // 4. Generate bills if period > 0
    const periodVal = parseInt(period) || 0
    if (periodVal > 0) {
      const installment = Math.round((totalValue / periodVal) * 100) / 100
      const purchaseDate = new Date(date)
      const bills = Array.from({ length: periodVal }, (_, i) => {
        const dueDate = new Date(purchaseDate)
        dueDate.setMonth(dueDate.getMonth() + i + 1)
        const month = dueDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        const dueDateStr = dueDate.toISOString().slice(0, 10)
        return {
          purchasing_id: pur.id,
          supplier_id: Number(supplierId),
          due_date: dueDateStr,
          month,
          installment,
          paid_amount: 0,
          bill_no: `BILL-${code}-${i + 1}/${periodVal}`,
        }
      })

      const { error: billErr } = await supabase.from('bills').insert(bills)
      if (billErr) { setError(billErr.message); setSubmitting(false); return }
    }

    setSubmitting(false)
    setSuccess(`Purchasing ${code} berhasil disimpan.${periodVal > 0 ? ` ${periodVal} tagihan dibuat.` : ''}`)
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

        {/* Transformation Phase Toggle */}
        <div className={`rounded-xl p-3 flex items-center justify-between gap-3 ${transformationPhase ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50 border border-gray-200'}`}>
          <div>
            <p className={`text-xs font-semibold ${transformationPhase ? 'text-amber-700' : 'text-gray-500'}`}>
              Transformation Phase
            </p>
            <p className={`text-xs mt-0.5 ${transformationPhase ? 'text-amber-600' : 'text-gray-400'}`}>
              {transformationPhase
                ? 'ON — hanya mencatat tagihan, stok tidak diupdate.'
                : 'OFF — stok akan diupdate saat barang tiba.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setTransformationPhase(v => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${transformationPhase ? 'bg-amber-400' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${transformationPhase ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

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

                <div className="relative">
                  <label className="block text-xs text-gray-500 mb-1">Produk <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={row.query}
                    onChange={e => {
                      setItems(prev => prev.map((r, idx) => idx === i ? { ...r, product_id: '', query: e.target.value } : r))
                      setAutocomplete(prev => prev.map((s, idx) => idx === i ? { open: true, focused: -1 } : s))
                    }}
                    onFocus={() => setAutocomplete(prev => prev.map((s, idx) => idx === i ? { ...s, open: true } : s))}
                    onBlur={() => setTimeout(() => setAutocomplete(prev => prev.map((s, idx) => idx === i ? { open: false, focused: -1 } : s)), 150)}
                    onKeyDown={e => {
                      const opts = filteredProducts(row.query)
                      const ac = autocomplete[i]
                      if (e.key === 'ArrowDown') {
                        e.preventDefault()
                        setAutocomplete(prev => prev.map((s, idx) => idx === i ? { open: true, focused: Math.min(s.focused + 1, opts.length - 1) } : s))
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault()
                        setAutocomplete(prev => prev.map((s, idx) => idx === i ? { ...s, focused: Math.max(s.focused - 1, 0) } : s))
                      } else if (e.key === 'Enter' && ac.focused >= 0) {
                        e.preventDefault()
                        selectProduct(i, opts[ac.focused])
                      } else if (e.key === 'Escape') {
                        setAutocomplete(prev => prev.map((s, idx) => idx === i ? { open: false, focused: -1 } : s))
                      }
                    }}
                    placeholder="Cari produk..."
                    autoComplete="off"
                    className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358] ${row.product_id ? 'border-[#121358]/40 bg-[#121358]/5' : 'border-gray-300'}`}
                  />
                  {autocomplete[i]?.open && filteredProducts(row.query).length > 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                      {filteredProducts(row.query).map((p, optIdx) => (
                        <button
                          key={p.id}
                          type="button"
                          onMouseDown={() => selectProduct(i, p)}
                          className={`w-full text-left px-4 py-2.5 text-sm transition flex items-center justify-between gap-3 ${
                            autocomplete[i].focused === optIdx ? 'bg-[#121358] text-white' : 'hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <span className="font-medium">{p.name}</span>
                          {p.categories?.name && (
                            <span className={`text-xs shrink-0 ${autocomplete[i].focused === optIdx ? 'text-white/70' : 'text-gray-400'}`}>
                              {p.categories.name}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
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
