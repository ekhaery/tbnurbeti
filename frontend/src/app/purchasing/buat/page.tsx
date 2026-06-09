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
type Category = { id: number; name: string }
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
  const [categories, setCategories] = useState<Category[]>([])
  // New product inline
  const [newProductIdx, setNewProductIdx] = useState<number | null>(null)
  const [newProductName, setNewProductName] = useState('')
  const [newProductCategoryId, setNewProductCategoryId] = useState<number | ''>('')
  const [newProductPrice, setNewProductPrice] = useState('')
  const [addingProduct, setAddingProduct] = useState(false)
  const [supplierId, setSupplierId] = useState<number | ''>('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [jatuhTempo, setJatuhTempo] = useState('')
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
  // Supplier autocomplete
  const [supplierQuery, setSupplierQuery] = useState('')
  const [supplierDropdown, setSupplierDropdown] = useState(false)

  useEffect(() => {
    supabase.from('suppliers').select('id, name').order('name')
      .then(({ data }: { data: Supplier[] | null }) => setSuppliers(data ?? []))
    supabase.from('products').select('id, name, categories(name)').order('name')
      .then(({ data }: { data: Product[] | null }) => setProducts(data ?? []))
    supabase.from('categories').select('id, name').order('name')
      .then(({ data }: { data: Category[] | null }) => setCategories(data ?? []))
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

  const handleAddNewProduct = async (i: number) => {
    const name = items[i]?.query?.trim()
    if (!name) return
    setAddingProduct(true)
    const { data, error } = await supabase.from('products').insert({
      name: toTitleCase(name),
      category_id: newProductCategoryId || null,
      base_price: 0,
      price: parseFloat(newProductPrice) || 0,
    }).select('id, name, categories(name)').single()
    setAddingProduct(false)
    if (error || !data) return
    const newProduct = data as Product
    setProducts(prev => [...prev, newProduct].sort((a, b) => a.name.localeCompare(b.name)))
    selectProduct(i, newProduct)
    setNewProductIdx(null)
    setNewProductName('')
    setNewProductCategoryId('')
    setNewProductPrice('')
  }

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

  // Calculate period from date → jatuhTempo
  const calcPeriod = (): { weeks: number; months: number } | null => {
    if (!date || !jatuhTempo) return null
    const start = new Date(date)
    const end = new Date(jatuhTempo)
    if (end <= start) return null
    const diffMs = end.getTime() - start.getTime()
    const weeks = Math.round(diffMs / (1000 * 60 * 60 * 24 * 7))
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
    return { weeks, months }
  }
  const periodCalc = calcPeriod()
  const periodWeeks = periodCalc?.weeks ?? 0

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
      .insert({ code, supplier_id: supplierId, date, notes: notes.trim() || null, total: totalValue, created_by: appUser?.id, status, due_date: jatuhTempo || null })
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

    // 4. Generate bills if period > 0 (period = weeks)
    const periodVal = periodWeeks
    if (periodVal > 0 && jatuhTempo) {
      const installment = Math.round((totalValue / periodVal) * 100) / 100
      const purchaseDate = new Date(date)
      const finalDueDateStr = jatuhTempo
      const finalMonth = new Date(jatuhTempo).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      const bills = Array.from({ length: periodVal }, (_, i) => {
        const installmentDue = new Date(purchaseDate)
        installmentDue.setDate(installmentDue.getDate() + (i + 1) * 7)
        return {
          purchasing_id: pur.id,
          supplier_id: Number(supplierId),
          due_date: finalDueDateStr,
          installment_due_date: installmentDue.toISOString().slice(0, 10),
          month: finalMonth,
          installment,
          paid_amount: 0,
          bill_no: `BILL-${code}-${i + 1}/${periodVal}`,
        }
      })

      const { error: billErr } = await supabase.from('bills').insert(bills)
      if (billErr) { setError(billErr.message); setSubmitting(false); return }
    }

    setSubmitting(false)
    setSuccess(`Purchasing ${code} berhasil disimpan.${periodVal > 0 ? ` ${periodVal} tagihan dibuat.` : ''} `)
    setSupplierId('')
    setNotes('')
    setJatuhTempo('')
    setItems([emptyItem()])
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-xl mx-auto space-y-4">
        <PurchasingTabs />

        <div>
          <h2 className="text-lg font-bold text-gray-800">Buat Purchasing</h2>
          <p className="text-xs text-gray-500 mt-0.5">Catat pembelian stok dari supplier.</p>
        </div>

        {success && (
          <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">✅ {success}</div>
        )}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">⚠️ {error}</div>
        )}

        {/* Transformation Phase Toggle */}
        <div className="rounded-xl p-3 flex items-center justify-between gap-3 border-2" style={{ backgroundColor: '#B5BAFF', borderColor: '#9FA1FF' }}>
          <div>
            <p className={`text-xs font-semibold ${transformationPhase ? 'text-[#121358]' : 'text-gray-500'}`}>
              Transformation Phase
            </p>
            <p className={`text-xs mt-0.5 ${transformationPhase ? 'text-[#121358]/70' : 'text-gray-400'}`}>
              {transformationPhase
                ? 'ON — hanya mencatat tagihan, stok tidak diupdate.'
                : 'OFF — stok akan diupdate saat barang tiba.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setTransformationPhase(v => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${transformationPhase ? '' : 'bg-gray-300'}`}
            style={transformationPhase ? { backgroundColor: '#AEE2FF' } : {}}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${transformationPhase ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Header card */}
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Info Purchasing</p>

            {/* Supplier */}
            <div className="relative">
              <label className="block text-xs text-gray-500 mb-1">Supplier <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={supplierQuery}
                onChange={e => { setSupplierQuery(e.target.value); setSupplierId(''); setSupplierDropdown(true) }}
                onFocus={() => setSupplierDropdown(true)}
                onBlur={() => setTimeout(() => setSupplierDropdown(false), 150)}
                placeholder="Cari supplier..."
                autoComplete="off"
                className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358] ${supplierId ? 'border-[#121358]/40 bg-[#121358]/5' : 'border-gray-300'}`}
              />
              {supplierDropdown && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {suppliers
                    .filter(s => s.name.toLowerCase().includes(supplierQuery.toLowerCase()))
                    .map(s => (
                      <button key={s.id} type="button"
                        onMouseDown={() => { setSupplierId(s.id); setSupplierQuery(s.name); setSupplierDropdown(false) }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition ${supplierId === s.id ? 'bg-[#121358] text-white' : 'text-gray-700 hover:bg-gray-50'}`}>
                        {s.name}
                      </button>
                    ))}
                  {supplierQuery.trim() && !suppliers.some(s => s.name.toLowerCase() === supplierQuery.toLowerCase()) && (
                    <button type="button"
                      onMouseDown={async () => {
                        setAddingSupplier(true)
                        const { data } = await supabase.from('suppliers')
                          .insert({ name: toTitleCase(supplierQuery.trim()) })
                          .select('id, name').single()
                        setAddingSupplier(false)
                        if (data) {
                          setSuppliers(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
                          setSupplierId(data.id)
                          setSupplierQuery(data.name)
                        }
                        setSupplierDropdown(false)
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm font-semibold text-[#121358] hover:bg-[#121358]/5 transition border-t border-gray-100">
                      {addingSupplier ? 'Menyimpan...' : `+ Supplier Baru: "${toTitleCase(supplierQuery.trim())}"`}
                    </button>
                  )}
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

            {/* Jatuh Tempo */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Jatuh Tempo</label>
              <input
                type="date"
                value={jatuhTempo}
                min={date}
                onChange={e => setJatuhTempo(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]"
              />
              {periodCalc && (
                <p className="text-xs text-gray-400 mt-1">
                  {periodCalc.weeks} minggu&nbsp;|&nbsp;{periodCalc.months} bulan
                </p>
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
                  {autocomplete[i]?.open && (
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
                      {row.query.trim() && !products.some(p => p.name.toLowerCase() === row.query.toLowerCase()) && (
                        <button
                          type="button"
                          onMouseDown={() => { setNewProductIdx(i); setNewProductName(toTitleCase(row.query.trim())); setNewProductCategoryId(''); setAutocomplete(prev => prev.map((s, idx) => idx === i ? { open: false, focused: -1 } : s)) }}
                          className="w-full text-left px-4 py-2.5 text-sm font-semibold text-[#121358] hover:bg-[#121358]/5 transition border-t border-gray-100"
                        >
                          + Produk Baru: "{toTitleCase(row.query.trim())}"
                        </button>
                      )}
                    </div>
                  )}

                  {/* Inline new product form */}
                  {newProductIdx === i && (
                    <div className="mt-2 p-3 rounded-xl space-y-2" style={{ backgroundColor: '#AEE2FF', border: '1.5px solid #9FA1FF' }}>
                      <p className="text-xs font-bold text-[#121358]">+ Produk Baru: <span className="font-semibold">"{toTitleCase(row.query.trim())}"</span></p>
                      <select
                        value={newProductCategoryId}
                        onChange={e => setNewProductCategoryId(e.target.value ? Number(e.target.value) : '')}
                        className="w-full border border-[#9FA1FF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358] bg-white"
                      >
                        <option value="">-- Pilih Kategori --</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <input
                        type="number"
                        value={newProductPrice}
                        onChange={e => setNewProductPrice(e.target.value)}
                        placeholder="Harga Jual"
                        min="0"
                        className="w-full border border-[#9FA1FF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358] bg-white"
                      />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setNewProductIdx(null)}
                          className="flex-1 py-1.5 rounded-lg border border-[#9FA1FF] text-xs text-[#121358] hover:bg-white/50 transition">
                          Batal
                        </button>
                        <button type="button" onClick={() => handleAddNewProduct(i)} disabled={addingProduct}
                          className="flex-1 py-1.5 rounded-lg bg-[#121358] text-white text-xs font-semibold disabled:opacity-40 transition">
                          {addingProduct ? '...' : 'Simpan & Pilih'}
                        </button>
                      </div>
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
