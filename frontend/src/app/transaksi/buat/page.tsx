'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '@/context/AuthContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash } from '@fortawesome/free-solid-svg-icons'
import TransaksiTabs from '@/lib/TransaksiTabs'

type Product = {
  id: number
  name: string
  price: number
  stock: number
  categories: { name: string } | null
}

type ItemRow = {
  product_id: number | ''
  query: string
  qty: string
  price_sold: string
  discount: string
}

type AutocompleteState = {
  open: boolean
  focused: number // focused option index
}

type StockBatch = {
  id: number
  qty_remaining: number
  base_price: number
}

const emptyItem = (): ItemRow => ({ product_id: '', query: '', qty: '', price_sold: '', discount: '' })
const fmt = (n: number) => n.toLocaleString('id-ID')

function generateCode() {
  const now = new Date()
  const d = now.toISOString().slice(0, 10).replace(/-/g, '')
  const t = now.toTimeString().slice(0, 8).replace(/:/g, '')
  return `INV-${d}-${t}`
}

export default function BuatTransaksiPage() {
  const supabase = createClient()
  const { appUser } = useAuth()

  const [products, setProducts] = useState<Product[]>([])
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<ItemRow[]>([emptyItem()])
  const [autocomplete, setAutocomplete] = useState<AutocompleteState[]>([{ open: false, focused: -1 }])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('id, name, price, stock, categories(name)')
      .eq('is_discontinued', false)
      .order('name')
    setProducts((data as Product[]) ?? [])
  }

  useEffect(() => { fetchProducts() }, [])

  const updateItem = (i: number, field: keyof ItemRow, value: string | number) => {
    setItems(prev => prev.map((row, idx) => {
      if (idx !== i) return row
      const updated = { ...row, [field]: value }
      if (field === 'product_id') {
        const product = products.find(p => p.id === Number(value))
        if (product) updated.price_sold = String(product.price)
      }
      return updated
    }))
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
      ? { ...row, product_id: product.id, query: product.name, price_sold: String(product.price) }
      : row
    ))
    setAutocomplete(prev => prev.map((s, idx) => idx === i ? { open: false, focused: -1 } : s))
  }

  const filteredProducts = (query: string) =>
    query.trim() === ''
      ? products
      : products.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) ||
          (p.categories?.name ?? '').toLowerCase().includes(query.toLowerCase()))

  const validItems = items.filter(r => r.product_id && r.qty && r.price_sold)
  const subtotal = (r: ItemRow) => (parseFloat(r.price_sold) || 0) * (parseInt(r.qty) || 0) - (parseFloat(r.discount) || 0)
  const total = validItems.reduce((sum, r) => sum + subtotal(r), 0)

  const stockError = (i: number): string | null => {
    const row = items[i]
    if (!row.product_id || !row.qty) return null
    const product = products.find(p => p.id === Number(row.product_id))
    if (!product) return null
    if (parseInt(row.qty) > product.stock) return `Stok tersedia: ${product.stock}`
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (validItems.length === 0) { setError('Isi minimal satu produk.'); return }

    for (const row of validItems) {
      const product = products.find(p => p.id === Number(row.product_id))
      if (!product) { setError('Produk tidak ditemukan.'); return }
      if (parseInt(row.qty) > product.stock) {
        setError(`Stok ${product.name} tidak cukup. Tersedia: ${product.stock}`)
        return
      }
    }

    setSubmitting(true)
    const code = generateCode()

    // 1. Insert transaction header
    const { data: trx, error: trxErr } = await supabase
      .from('transactions')
      .insert({ code, date, notes: notes.trim() || null, created_by: appUser?.id })
      .select('id').single()

    if (trxErr || !trx) { setError(trxErr?.message ?? 'Gagal menyimpan.'); setSubmitting(false); return }

    // 2. FIFO consumption per item
    for (const row of validItems) {
      const productId = Number(row.product_id)
      const qtyNeeded = parseInt(row.qty)
      const discount = parseFloat(row.discount) || 0
      const priceSold = (parseFloat(row.price_sold) || 0) * qtyNeeded - discount

      // Fetch batches oldest first
      const { data: batches, error: batchErr } = await supabase
        .from('stock_batches')
        .select('id, qty_remaining, base_price')
        .eq('product_id', productId)
        .eq('is_available', true)
        .gt('qty_remaining', 0)
        .order('received_at', { ascending: true })
        .order('id', { ascending: true })

      if (batchErr || !batches) { setError(batchErr?.message ?? 'Gagal membaca stok.'); setSubmitting(false); return }

      // Calculate total COGS via FIFO
      let totalCogs = 0
      let remaining = qtyNeeded
      const consumptions: { batch: StockBatch; qty: number }[] = []

      for (const batch of batches as StockBatch[]) {
        if (remaining <= 0) break
        const consume = Math.min(remaining, batch.qty_remaining)
        totalCogs += consume * batch.base_price
        consumptions.push({ batch, qty: consume })
        remaining -= consume
      }

      // Insert transaction_item
      const { data: txItem, error: txItemErr } = await supabase
        .from('transaction_items')
        .insert({ transaction_id: trx.id, product_id: productId, qty: qtyNeeded, price_sold: priceSold, cogs: totalCogs, discount })
        .select('id').single()

      if (txItemErr || !txItem) { setError(txItemErr?.message ?? 'Gagal menyimpan item.'); setSubmitting(false); return }

      // Insert consumptions + decrement batch qty
      for (const c of consumptions) {
        const { error: consErr } = await supabase.from('stock_batch_consumption').insert({
          transaction_item_id: txItem.id,
          stock_batch_id: c.batch.id,
          qty_consumed: c.qty,
        })
        if (consErr) { setError(consErr.message); setSubmitting(false); return }

        const { error: batchUpdateErr } = await supabase
          .from('stock_batches')
          .update({ qty_remaining: c.batch.qty_remaining - c.qty })
          .eq('id', c.batch.id)
        if (batchUpdateErr) { setError(batchUpdateErr.message); setSubmitting(false); return }
      }

      // Update product stock
      const product = products.find(p => p.id === productId)!
      await supabase
        .from('products')
        .update({ stock: product.stock - qtyNeeded, updated_at: new Date().toISOString() })
        .eq('id', productId)
    }

    setSubmitting(false)
    setSuccess(`Transaksi ${code} berhasil disimpan.`)
    setNotes('')
    setItems([emptyItem()])
    setDate(new Date().toISOString().slice(0, 10))
    fetchProducts()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-xl mx-auto space-y-4">
        <TransaksiTabs />

        <div>
          <h2 className="text-lg font-bold text-gray-800">Buat Transaksi</h2>
          <p className="text-xs text-gray-400 mt-0.5">Catat penjualan produk.</p>
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
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Info Transaksi</p>

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
          </div>

          {/* Product rows */}
          <div className="space-y-3">
            {items.map((row, i) => {
              const selectedProduct = products.find(p => p.id === Number(row.product_id))
              const sErr = stockError(i)
              return (
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
                        updateItem(i, 'query', e.target.value)
                        // clear selected product if user types
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
                            <span>
                              <span className="font-medium">{p.name}</span>
                              {p.categories?.name && (
                                <span className={`ml-1 text-xs ${autocomplete[i].focused === optIdx ? 'text-white/70' : 'text-gray-400'}`}>
                                  ({p.categories.name})
                                </span>
                              )}
                            </span>
                            <span className={`text-xs shrink-0 ${autocomplete[i].focused === optIdx ? 'text-white/70' : 'text-gray-400'}`}>
                              stok: {p.stock}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {selectedProduct && (
                      <p className="text-xs text-gray-400 mt-1">
                        Harga jual: <span className="font-semibold text-gray-600">Rp {fmt(selectedProduct.price)}</span>
                        <span className="mx-1">·</span>
                        Stok: <span className="font-semibold text-gray-600">{selectedProduct.stock}</span>
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Qty <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        value={row.qty}
                        onChange={e => updateItem(i, 'qty', e.target.value)}
                        placeholder="0"
                        min="1"
                        className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358] ${sErr ? 'border-red-400' : 'border-gray-300'}`}
                      />
                      {sErr && <p className="text-xs text-red-500 mt-1">{sErr}</p>}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Harga Jual</label>
                      <input
                        type="number"
                        value={row.price_sold}
                        disabled
                        placeholder="0"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Diskon</label>
                      <input
                        type="number"
                        value={row.discount}
                        onChange={e => updateItem(i, 'discount', e.target.value)}
                        placeholder="0"
                        min="0"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]"
                      />
                    </div>
                  </div>

                  {row.qty && row.price_sold && (
                    <p className="text-xs text-gray-400 text-right">
                      Subtotal: <span className="font-semibold text-gray-700">Rp {fmt(subtotal(row))}</span>
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          <button
            type="button"
            onClick={addItem}
            className="w-full border-2 border-dashed border-gray-200 rounded-xl py-3 text-sm text-[#121358] hover:border-[#121358]/30 hover:bg-[#121358]/5 transition font-medium"
          >
            + Tambah Produk
          </button>

          {total > 0 && (
            <div className="bg-white rounded-xl shadow-sm px-4 py-3 flex justify-between items-center">
              <span className="text-sm text-gray-500">Total Penjualan</span>
              <span className="text-base font-bold text-[#121358]">Rp {fmt(total)}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || validItems.length === 0}
            className="w-full bg-[#121358] hover:bg-[#1a1c6e] disabled:bg-[#121358]/40 text-white font-semibold py-3 rounded-xl transition text-sm"
          >
            {submitting ? 'Menyimpan...' : 'Simpan Transaksi'}
          </button>
        </form>
      </div>
    </div>
  )
}
