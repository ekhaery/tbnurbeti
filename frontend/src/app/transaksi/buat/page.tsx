'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '@/context/AuthContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash, faChevronLeft, faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import Link from 'next/link'
import { localDateStr } from '@/lib/date'

type Product = {
  id: number
  name: string
  price: number
  stock: number // derived from stock_batches
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
  const d = localDateStr(now).replace(/-/g, '')
  const t = now.toTimeString().slice(0, 8).replace(/:/g, '')
  return `INV-${d}-${t}`
}

export default function BuatTransaksiPage() {
  const supabase = createClient()
  const { appUser } = useAuth()

  const [products, setProducts] = useState<Product[]>([])
  const [date, setDate] = useState(localDateStr())
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<ItemRow[]>([])
  const [current, setCurrent] = useState<ItemRow>(emptyItem())
  const [autocomplete, setAutocomplete] = useState<AutocompleteState>({ open: false, focused: -1 })
  const [entryKey, setEntryKey] = useState(0)
  const [isInitialTransformation, setIsInitialTransformation] = useState(true)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [printData, setPrintData] = useState<{
    code: string
    date: string
    items: { name: string; qty: number; price_sold: number; discount: number }[]
    total: number
    notes: string
  } | null>(null)

  const fetchProducts = async () => {
    const chunkSize = 1000
    let from = 0
    let allProducts: Omit<Product, 'stock'>[] = []
    while (true) {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, categories(name)')
        .eq('is_discontinued', false)
        .eq('is_deleted', false)
        .order('name')
        .range(from, from + chunkSize - 1)
      if (error || !data || data.length === 0) break
      allProducts = [...allProducts, ...(data as Omit<Product, 'stock'>[])]
      if (data.length < chunkSize) break
      from += chunkSize
    }
    // Get available stock from stock_batches
    from = 0
    const stockMap: Record<number, number> = {}
    while (true) {
      const { data, error } = await supabase
        .from('stock_batches')
        .select('product_id, qty_remaining')
        .eq('is_available', true)
        .range(from, from + chunkSize - 1)
      if (error || !data || data.length === 0) break
      for (const b of data as { product_id: number; qty_remaining: number }[]) {
        stockMap[b.product_id] = (stockMap[b.product_id] ?? 0) + b.qty_remaining
      }
      if (data.length < chunkSize) break
      from += chunkSize
    }
    setProducts(allProducts.map(p => ({ ...p, stock: stockMap[p.id] ?? 0 })))
  }

  useEffect(() => { fetchProducts() }, [])

  const updateCurrent = (field: keyof ItemRow, value: string) => {
    setCurrent(prev => {
      const updated = { ...prev, [field]: value }
      if (field === 'product_id') {
        const product = products.find(p => p.id === Number(value))
        if (product) updated.price_sold = String(product.price)
      }
      return updated
    })
  }

  const selectProduct = (product: Product) => {
    setCurrent(prev => ({ ...prev, product_id: product.id, query: product.name, price_sold: String(product.price), qty: prev.qty || '1' }))
    setAutocomplete({ open: false, focused: -1 })
  }

  const addItem = () => {
    if (!current.product_id || !current.qty) return
    setItems(prev => [...prev, current])
    setCurrent(emptyItem())
    setAutocomplete({ open: false, focused: -1 })
    setEntryKey(k => k + 1)
  }

  const removeItem = (i: number) => {
    setItems(prev => prev.filter((_, idx) => idx !== i))
  }

  const filteredProducts = (query: string) => {
    const withStock = products.filter(p => p.stock > 0)
    return query.trim() === ''
      ? withStock
      : withStock.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) ||
          (p.categories?.name ?? '').toLowerCase().includes(query.toLowerCase()))
  }

  const validItems = items.filter(r => r.product_id && r.qty && r.price_sold)
  const subtotal = (r: ItemRow) => (parseFloat(r.price_sold) || 0) * (parseInt(r.qty) || 0) - (parseFloat(r.discount) || 0)
  const total = validItems.reduce((sum, r) => sum + subtotal(r), 0)

  const currentStockError = (): string | null => {
    if (!current.product_id || !current.qty) return null
    const product = products.find(p => p.id === Number(current.product_id))
    if (!product) return null
    if (parseInt(current.qty) > product.stock) return `Stok tersedia: ${product.stock}`
    return null
  }

  const handleSubmit = async () => {
    setShowConfirm(false)
    setError(null)
    setSuccess(null)

    if (validItems.length === 0) { setError('Isi minimal satu produk.'); return }

    if (!isInitialTransformation) {
      for (const row of validItems) {
        const product = products.find(p => p.id === Number(row.product_id))
        if (!product) { setError('Produk tidak ditemukan.'); return }
        if (parseInt(row.qty) > product.stock) {
          setError(`Stok ${product.name} tidak cukup. Tersedia: ${product.stock}`)
          return
        }
      }
    }

    setSubmitting(true)
    const code = generateCode()

    // 1. Insert transaction header
    const { data: trx, error: trxErr } = await supabase
      .from('transactions')
      .insert({ code, date, notes: notes.trim() || null, created_by: appUser?.id, is_initial_transformation: isInitialTransformation })
      .select('id').single()

    if (trxErr || !trx) { setError(trxErr?.message ?? 'Gagal menyimpan.'); setSubmitting(false); return }

    if (isInitialTransformation) {
      // Initial transformation: record revenue only, skip stock & COGS
      for (const row of validItems) {
        const productId = Number(row.product_id)
        const qtyNeeded = parseInt(row.qty)
        const discount = parseFloat(row.discount) || 0
        const priceSold = (parseFloat(row.price_sold) || 0) * qtyNeeded - discount
        const { error: txItemErr } = await supabase
          .from('transaction_items')
          .insert({ transaction_id: trx.id, product_id: productId, qty: qtyNeeded, price_sold: priceSold, cogs: 0, discount })
        if (txItemErr) { setError(txItemErr.message); setSubmitting(false); return }
      }
    } else {
      // Normal flow: FIFO consumption per item
      for (const row of validItems) {
        const productId = Number(row.product_id)
        const qtyNeeded = parseInt(row.qty)
        const discount = parseFloat(row.discount) || 0
        const priceSold = (parseFloat(row.price_sold) || 0) * qtyNeeded - discount

        const { data: batches, error: batchErr } = await supabase
          .from('stock_batches')
          .select('id, qty_remaining, base_price')
          .eq('product_id', productId)
          .eq('is_available', true)
          .gt('qty_remaining', 0)
          .order('received_at', { ascending: true })
          .order('id', { ascending: true })

        if (batchErr || !batches) { setError(batchErr?.message ?? 'Gagal membaca stok.'); setSubmitting(false); return }

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

        const { data: txItem, error: txItemErr } = await supabase
          .from('transaction_items')
          .insert({ transaction_id: trx.id, product_id: productId, qty: qtyNeeded, price_sold: priceSold, cogs: totalCogs, discount })
          .select('id').single()

        if (txItemErr || !txItem) { setError(txItemErr?.message ?? 'Gagal menyimpan item.'); setSubmitting(false); return }

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
      }
    }

    setSubmitting(false)
    setSuccess(`Transaksi ${code} berhasil disimpan.`)
    setPrintData({
      code,
      date,
      items: validItems.map(r => ({
        name: products.find(p => p.id === Number(r.product_id))?.name ?? '-',
        qty: parseInt(r.qty),
        price_sold: parseFloat(r.price_sold) || 0,
        discount: parseFloat(r.discount) || 0,
      })),
      total,
      notes: notes.trim(),
    })
    setNotes('')
    setItems([])
    setCurrent(emptyItem())
    setAutocomplete({ open: false, focused: -1 })
    setDate(localDateStr())
    fetchProducts()
  }

  return (
    <>
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Link href="/" className="w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-sm text-gray-500 hover:text-gray-800 transition shrink-0">
            <FontAwesomeIcon icon={faArrowLeft} className="w-3.5 h-3.5" />
          </Link>
          <div>
            <h2 className="text-lg font-bold text-gray-800">Buat Transaksi</h2>
            <p className="text-xs text-gray-500 mt-0.5">Catat penjualan produk.</p>
          </div>
        </div>

        {success && (
          <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm mb-4">✅ {success}</div>
        )}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm mb-4">⚠️ {error}</div>
        )}

        {/* Desktop 3-column grid: 2-5-5 */}
        <div className="grid grid-cols-12 gap-4 items-start">

          {/* Col 1 — product image placeholder (2/12) */}
          <div className="col-span-12 md:col-span-2">
            <div className="bg-white rounded-xl shadow-sm flex items-center justify-center text-gray-300 text-xs h-32 md:h-full md:min-h-[400px]">
              <span className="text-center px-2">Gambar Produk<br/>(upcoming)</span>
            </div>
          </div>

          {/* Col 2 — form (5/12) */}
          <div className="col-span-12 md:col-span-5">
        <form onSubmit={e => e.preventDefault()} className="space-y-4">

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

            <div className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 border transition ${isInitialTransformation ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-200'}`}>
              <p className="text-[10px] text-gray-500">Initial Transformation</p>
              <button
                type="button"
                onClick={() => setIsInitialTransformation(v => !v)}
                className={`relative w-8 h-4 rounded-full transition-colors shrink-0 ${isInitialTransformation ? 'bg-amber-400' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${isInitialTransformation ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>

          {/* Product rows */}
          {/* Single product entry */}
          <div key={entryKey}>
          {(() => {
            const selectedProduct = products.find(p => p.id === Number(current.product_id))
            const sErr = currentStockError()
            return (
              <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
                <div className="relative">
                  <label className="block text-xs text-gray-500 mb-1">Produk <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={current.query}
                    onChange={e => {
                      setCurrent(prev => ({ ...prev, product_id: '', query: e.target.value }))
                      setAutocomplete({ open: true, focused: -1 })
                    }}
                    onFocus={() => setAutocomplete(prev => ({ ...prev, open: true }))}
                    onBlur={() => setTimeout(() => setAutocomplete({ open: false, focused: -1 }), 150)}
                    onKeyDown={e => {
                      const opts = filteredProducts(current.query)
                      if (e.key === 'ArrowDown') { e.preventDefault(); setAutocomplete(prev => ({ open: true, focused: Math.min(prev.focused + 1, opts.length - 1) })) }
                      else if (e.key === 'ArrowUp') { e.preventDefault(); setAutocomplete(prev => ({ ...prev, focused: Math.max(prev.focused - 1, 0) })) }
                      else if (e.key === 'Enter' && autocomplete.focused >= 0) { e.preventDefault(); selectProduct(opts[autocomplete.focused]) }
                      else if (e.key === 'Escape') setAutocomplete({ open: false, focused: -1 })
                    }}
                    placeholder="Cari produk..."
                    autoComplete="off"
                    className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358] ${current.product_id ? 'border-[#121358]/40 bg-[#121358]/5' : 'border-gray-300'}`}
                  />
                  {autocomplete.open && filteredProducts(current.query).length > 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                      {filteredProducts(current.query).map((p, optIdx) => (
                        <button key={p.id} type="button" onMouseDown={() => selectProduct(p)}
                          className={`w-full text-left px-4 py-2.5 text-sm transition flex items-center justify-between gap-3 ${autocomplete.focused === optIdx ? 'bg-[#121358] text-white' : 'hover:bg-gray-50 text-gray-700'}`}>
                          <span className="font-medium">{p.name}</span>
                          <span className={`text-xs shrink-0 ${autocomplete.focused === optIdx ? 'text-white/70' : 'text-gray-400'}`}>
                            Rp {p.price.toLocaleString('id-ID')} · stok: {p.stock}
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
                    <input type="number" value={current.qty} onChange={e => updateCurrent('qty', e.target.value)}
                      placeholder="0" min="1"
                      className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358] ${sErr ? 'border-red-400' : 'border-gray-300'}`} />
                    {sErr && <p className="text-xs text-red-500 mt-1">{sErr}</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Harga Jual</label>
                    <input type="number" value={current.price_sold} disabled placeholder="0"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 text-gray-400 cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Diskon</label>
                    <input type="number" value={current.discount} onChange={e => updateCurrent('discount', e.target.value)}
                      placeholder="0" min="0"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
                  </div>
                </div>

                {current.qty && current.price_sold && (
                  <p className="text-xs text-gray-400 text-right">
                    Subtotal: <span className="font-semibold text-gray-700">Rp {fmt(subtotal(current))}</span>
                  </p>
                )}
              </div>
            )
          })()}
          </div>

          <button
            type="button"
            onClick={addItem}
            disabled={!current.product_id || !current.qty}
            className="w-full border-2 border-dashed border-gray-200 rounded-xl py-3 text-sm text-[#121358] hover:border-[#121358]/30 hover:bg-[#121358]/5 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium"
          >
            + Tambah Produk
          </button>

        </form>

          </div>{/* end form col */}

          {/* Col 3 — dark navy summary card (5/12) */}
          <div className="col-span-12 md:col-span-5">
            <div className="rounded-2xl p-6 min-h-[400px] flex flex-col gap-4" style={{ backgroundColor: '#121358' }}>
              <p className="text-xs font-semibold text-white uppercase tracking-widest">Ringkasan Transaksi</p>

              {validItems.length === 0 ? (
                <p className="text-white/30 text-sm">Belum ada produk dipilih.</p>
              ) : (
                <div className="space-y-2 flex-1 overflow-y-auto">
                  {items.map((row, i) => {
                    const product = products.find(p => p.id === Number(row.product_id))
                    return (
                      <div key={i} className="bg-white/10 rounded-xl px-3 py-2.5 flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{product?.name ?? '-'}</p>
                          <div className="flex justify-between text-xs text-white/60 mt-0.5">
                            <span>{row.qty} × Rp {fmt(parseFloat(row.price_sold) || 0)}{parseFloat(row.discount) > 0 ? ` − Rp ${fmt(parseFloat(row.discount))}` : ''}</span>
                            <span className="font-semibold text-white">Rp {fmt(subtotal(row))}</span>
                          </div>
                        </div>
                        <button type="button" onClick={() => removeItem(i)}
                          className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-white/10 hover:bg-red-400/30 text-white/40 hover:text-red-300 transition">
                          <FontAwesomeIcon icon={faTrash} className="w-3 h-3" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="border-t border-white/10 pt-4 mt-auto">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm text-white/60">Total</span>
                  <span className="text-2xl font-bold text-white">Rp {fmt(total)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => { if (validItems.length > 0) setShowConfirm(true) }}
                  disabled={submitting || validItems.length === 0}
                  className="w-full py-3 rounded-xl bg-white text-[#121358] font-bold text-sm hover:bg-white/90 disabled:opacity-30 transition"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Transaksi'}
                </button>
                {printData && (
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="w-full mt-2 py-2.5 rounded-xl border border-white/20 text-white/70 text-sm hover:bg-white/10 transition"
                  >
                    🖨 Print Nota Terakhir
                  </button>
                )}
              </div>
            </div>
          </div>

        </div>{/* end grid */}

        {showConfirm && (
          <>
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4" onClick={() => setShowConfirm(false)}>
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden" style={{ maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-bold text-gray-800">Konfirmasi Transaksi</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Periksa kembali sebelum menyimpan.</p>
              </div>
              <div className="overflow-y-auto px-4 py-3 space-y-3" style={{ maxHeight: 'calc(80vh - 110px)' }}>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Tanggal</span>
                  <span className="font-semibold text-gray-700">{date}</span>
                </div>
                {isInitialTransformation && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-[10px] font-semibold text-amber-700">
                    Initial Transformation — COGS & stok tidak dicatat sekarang.
                  </div>
                )}
                <div className="space-y-2">
                  {validItems.map((row, i) => {
                    const product = products.find(p => p.id === Number(row.product_id))
                    return (
                      <div key={i} className="bg-gray-50 rounded-xl px-3 py-2.5 space-y-1">
                        <p className="text-xs font-semibold text-gray-800">{product?.name ?? '-'}</p>
                        <div className="flex justify-between text-[10px] text-gray-500">
                          <span>{row.qty} × Rp {fmt(parseFloat(row.price_sold) || 0)}{parseFloat(row.discount) > 0 ? ` − Rp ${fmt(parseFloat(row.discount))} diskon` : ''}</span>
                          <span className="font-semibold text-gray-700">Rp {fmt(subtotal(row))}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                  <span className="text-xs text-gray-500">Total</span>
                  <span className="text-sm font-bold text-[#121358]">Rp {fmt(total)}</span>
                </div>
              </div>
              <div className="flex gap-2 px-4 py-3 border-t border-gray-100">
                <button onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
                  Batal
                </button>
                <button onClick={handleSubmit}
                  className="flex-1 py-2.5 rounded-xl bg-[#121358] text-white text-sm font-semibold hover:bg-[#1a1c6e] transition">
                  Sudah Benar
                </button>
              </div>
            </div>
            </div>
          </>
        )}
      </div>
    </div>

    {/* Hidden thermal receipt — only visible during print */}
    {printData && (
      <div id="thermal-receipt" style={{ visibility: 'hidden', position: 'absolute', top: 0, left: 0 }}>
        <style>{`
          @media print {
            body * { visibility: hidden; }
            #thermal-receipt, #thermal-receipt * { visibility: visible; }
            #thermal-receipt {
              position: fixed;
              top: 0;
              left: 0;
            }
            @page {
              size: 80mm auto;
              margin: 4mm;
            }
          }
          #thermal-receipt {
            width: 72mm;
            font-family: monospace;
            font-size: 11px;
            color: #000;
          }
        `}</style>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>NOTA PENJUALAN</div>
          <div>{printData.code}</div>
          <div>{new Date(printData.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        </div>
        <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '6px 0', marginBottom: 6 }}>
          {printData.items.map((item, i) => (
            <div key={i} style={{ marginBottom: 4 }}>
              <div style={{ fontWeight: 600 }}>{item.name}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{item.qty} × Rp {(item.price_sold).toLocaleString('id-ID')}</span>
                <span>Rp {(item.qty * item.price_sold - item.discount).toLocaleString('id-ID')}</span>
              </div>
              {item.discount > 0 && (
                <div style={{ color: '#555' }}>Diskon: -Rp {item.discount.toLocaleString('id-ID')}</div>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
          <span>TOTAL</span>
          <span>Rp {printData.total.toLocaleString('id-ID')}</span>
        </div>
        {printData.notes && (
          <div style={{ fontSize: 10, color: '#555', marginBottom: 6 }}>Catatan: {printData.notes}</div>
        )}
        <div style={{ textAlign: 'center', fontSize: 10, marginTop: 8 }}>Terima kasih!</div>
      </div>
    )}
    </>
  )
}
