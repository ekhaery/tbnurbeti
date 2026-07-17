'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '@/context/AuthContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash, faChevronLeft, faXmark } from '@fortawesome/free-solid-svg-icons'
import { localDateStr } from '@/lib/date'
import { epsonPrint } from '@/lib/epsonPrint'

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

type Customer = { id: number; name: string }

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
  const [isHutang, setIsHutang] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerId, setCustomerId] = useState<number | ''>('')
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerDropdown, setCustomerDropdown] = useState(false)
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [newCustomerSaving, setNewCustomerSaving] = useState(false)
  const [newCustomerError, setNewCustomerError] = useState<string | null>(null)
  const [items, setItems] = useState<ItemRow[]>([])
  const [current, setCurrent] = useState<ItemRow>(emptyItem())
  const [autocomplete, setAutocomplete] = useState<AutocompleteState>({ open: false, focused: -1 })
  const [entryKey, setEntryKey] = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)
  const [previewCode, setPreviewCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [printData, setPrintData] = useState<{
    code: string
    date: string
    items: { name: string; qty: number; price_sold: number; discount: number }[]
    total: number
    notes: string
    isHutang: boolean
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

  useEffect(() => {
    fetchProducts()
    supabase.from('customers').select('id, name').order('name')
      .then(({ data }: { data: Customer[] | null }) => setCustomers(data ?? []))
  }, [])

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

  const updateItemQty = (i: number, delta: number) => {
    setItems(prev => prev.map((row, idx) => {
      if (idx !== i) return row
      const newQty = Math.max(0.25, Math.round(((parseFloat(row.qty) || 0.25) + delta) * 100) / 100)
      return { ...row, qty: String(newQty) }
    }))
  }

  const filteredProducts = (query: string) => {
    const withStock = products.filter(p => p.stock > 0)
    return query.trim() === ''
      ? withStock
      : withStock.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) ||
          (p.categories?.name ?? '').toLowerCase().includes(query.toLowerCase()))
  }

  const handleSaveNewCustomer = async () => {
    if (!newCustomerName.trim()) { setNewCustomerError('Nama customer wajib diisi.'); return }
    setNewCustomerSaving(true); setNewCustomerError(null)
    const { data: newC, error: newCErr } = await supabase.from('customers')
      .insert({ name: newCustomerName.trim(), phone_number_1: newCustomerPhone.trim() || null })
      .select('id, name').single()
    setNewCustomerSaving(false)
    if (newCErr || !newC) { setNewCustomerError(newCErr?.message ?? 'Gagal menyimpan customer.'); return }
    setCustomers(prev => [...prev, newC].sort((a, b) => a.name.localeCompare(b.name)))
    setCustomerId(newC.id)
    setCustomerQuery(newC.name)
    setShowNewCustomer(false)
    setNewCustomerName('')
    setNewCustomerPhone('')
  }

  const validItems = items.filter(r => r.product_id && r.qty && r.price_sold)
  const subtotal = (r: ItemRow) => (parseFloat(r.price_sold) || 0) * (parseFloat(r.qty) || 0) - (parseFloat(r.discount) || 0)
  const total = validItems.reduce((sum, r) => sum + subtotal(r), 0)

  const currentStockError = (): string | null => {
    if (!current.product_id || !current.qty) return null
    const product = products.find(p => p.id === Number(current.product_id))
    if (!product) return null
    if (parseFloat(current.qty) > product.stock) return `Stok tersedia: ${product.stock}`
    return null
  }

  const handleSubmit = async () => {
    setShowConfirm(false)
    setError(null)
    setSuccess(null)

    if (validItems.length === 0) { setError('Isi minimal satu produk.'); return }

    for (const row of validItems) {
      const product = products.find(p => p.id === Number(row.product_id))
      if (!product) { setError('Produk tidak ditemukan.'); return }
      if (parseFloat(row.qty) > product.stock) {
        setError(`Stok ${product.name} tidak cukup. Tersedia: ${product.stock}`)
        return
      }
    }

    if (isHutang && !customerId) { setError('Pilih customer untuk transaksi hutang.'); return }
    if (isHutang && !notes.trim()) { setError('Catat Nama / Alamat / No Rek / Lain lain wajib diisi untuk transaksi hutang.'); return }

    setSubmitting(true)
    const code = previewCode || generateCode()

    // One atomic call: transaction header, every transaction_item, FIFO stock
    // consumption (stock_batch_consumption + stock_batches decrement), and — when
    // Hutang — the customer_receivables row all happen inside a single DB
    // transaction. If anything fails, nothing is inserted and no stock moves.
    const { data: rpcResult, error: rpcErr } = await supabase.rpc('create_transaction_with_items', {
      p_code: code,
      p_date: date,
      p_notes: notes.trim() || null,
      p_created_by: appUser?.id ?? null,
      p_is_initial_transformation: false,
      p_items: validItems.map(row => {
        const qty = parseFloat(row.qty)
        const discount = parseFloat(row.discount) || 0
        return {
          product_id: Number(row.product_id),
          qty,
          price_sold: (parseFloat(row.price_sold) || 0) * qty - discount,
          discount,
        }
      }),
      p_hutang: isHutang,
      p_customer_id: isHutang ? Number(customerId) : null,
      p_due_date: null,
      p_total: total,
    })

    if (rpcErr || !rpcResult) { setError(rpcErr?.message ?? 'Gagal menyimpan.'); setSubmitting(false); return }

    setSubmitting(false)
    const pd = {
      code,
      date,
      items: validItems.map(r => ({
        name: products.find(p => p.id === Number(r.product_id))?.name ?? '-',
        qty: parseFloat(r.qty),
        price_sold: parseFloat(r.price_sold) || 0,
        discount: parseFloat(r.discount) || 0,
      })),
      total,
      notes: notes.trim(),
      isHutang,
    }
    setPrintData(pd)
    setSuccess(`Transaksi ${code} berhasil disimpan.`)
    setNotes('')
    setItems([])
    setCurrent(emptyItem())
    setAutocomplete({ open: false, focused: -1 })
    setDate(localDateStr())
    setIsHutang(false)
    setCustomerId('')
    setCustomerQuery('')
    fetchProducts()
  }

  return (
    <>
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pb-10 max-w-7xl mx-auto -mt-2">

        {success && (
          <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm mb-4">✅ {success}</div>
        )}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm mb-4">⚠️ {error}</div>
        )}

        {/* Desktop grid: row1 = Info Transaksi(7) + white area(5); row2 = Tambahkan Produk(4) + Ringkasan(3) + white area continues */}
        <div className="grid grid-cols-12 gap-4 items-start">

          {/* Info Transaksi — row 1, 7/12 */}
          <div className="col-span-12 md:col-span-8">
            <div className="rounded-xl shadow-sm p-2.5 space-y-2" style={{ backgroundColor: '#B5BAFF' }}>
              <div className="flex flex-col md:flex-row gap-2">
                <div className="shrink-0">
                  <label className="block text-xs text-[#121358] mb-1">Tanggal <span className="text-[#121358]">*</span></label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full md:w-44 h-9 border border-[#9099e8] bg-white rounded-lg px-2 text-xs text-[#121358] focus:outline-none focus:ring-2 focus:ring-[#121358]"
                    required
                  />
                </div>

                <div className="flex-1">
                  <label className="block text-xs text-[#121358] mb-1">
                    Catat Nama / Alamat / No Rek / Lain lain {isHutang && <span className="text-[#121358]">*</span>}
                  </label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder={isHutang ? 'Wajib diisi untuk transaksi hutang' : 'Opsional'}
                    rows={1}
                    className={`w-full h-9 border bg-white rounded-lg px-3 py-2 text-xs text-[#121358] focus:outline-none focus:ring-2 focus:ring-[#121358] resize-none overflow-hidden ${isHutang && !notes.trim() ? 'border-red-400' : 'border-[#9099e8]'}`}
                  />
                </div>

                <div className="shrink-0">
                  <label className="block text-xs text-[#121358] mb-1">Hutang</label>
                  <div className="h-9 flex items-center">
                    <button
                      type="button"
                      onClick={() => setIsHutang(v => !v)}
                      className={`relative w-8 h-4 rounded-full transition-colors shrink-0 ${isHutang ? 'bg-amber-500' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${isHutang ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                </div>

                {isHutang && (
                  <div className="relative flex-1">
                    <label className="block text-xs text-[#121358] mb-1">Customer <span className="text-[#121358]">*</span></label>
                    <input
                      type="text"
                      value={customerQuery}
                      onChange={e => {
                        setCustomerQuery(e.target.value)
                        setCustomerId('')
                        setCustomerDropdown(true)
                      }}
                      onFocus={() => setCustomerDropdown(true)}
                      onBlur={() => setTimeout(() => setCustomerDropdown(false), 150)}
                      placeholder="Cari atau tambah customer..."
                      autoComplete="off"
                      className={`w-full h-9 border rounded-lg px-3 text-xs text-[#121358] focus:outline-none focus:ring-2 focus:ring-[#121358] bg-white ${customerId ? 'border-[#121358]/40' : 'border-[#9099e8]'}`}
                    />
                    {customerDropdown && (
                      <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {customers
                          .filter(c => c.name.toLowerCase().includes(customerQuery.toLowerCase()))
                          .map(c => (
                            <button key={c.id} type="button"
                              onMouseDown={() => { setCustomerQuery(c.name); setCustomerId(c.id); setCustomerDropdown(false) }}
                              className={`w-full text-left px-4 py-2.5 text-sm transition ${customerId === c.id ? 'bg-[#121358] text-white' : 'text-gray-700 hover:bg-gray-50'}`}>
                              {c.name}
                            </button>
                          ))}
                        {customerQuery.trim() && !customers.some(c => c.name.toLowerCase() === customerQuery.toLowerCase()) && (
                          <button type="button"
                            onMouseDown={() => {
                              setNewCustomerName(customerQuery.trim())
                              setNewCustomerPhone('')
                              setNewCustomerError(null)
                              setShowNewCustomer(true)
                              setCustomerDropdown(false)
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm text-[#121358] font-semibold hover:bg-[#121358]/5 transition border-t border-gray-100">
                            + New Customer: "{customerQuery.trim()}"
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>{/* end Info Transaksi */}

          {/* White area — spans row 1 & 2, 5/12 */}
          <div className="col-span-12 md:col-span-4 md:row-span-2 md:self-stretch">
            <div className="hidden md:flex md:flex-col h-full">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Buat Transaksi</h2>
              <div className="flex-1 bg-white rounded-xl shadow-sm flex items-center justify-center text-gray-300 text-xs min-h-[300px]">
                <span className="text-center px-2">Gambar Produk<br/>(upcoming)</span>
              </div>
            </div>
          </div>{/* end white area */}

          {/* Produk entry form — row 2, 4/12 */}
          <div className="col-span-12 md:col-span-4">
        <form onSubmit={e => e.preventDefault()} className="space-y-4">

          {/* Product rows */}
          {/* Single product entry */}
          <div key={entryKey}>
          {(() => {
            const selectedProduct = products.find(p => p.id === Number(current.product_id))
            const sErr = currentStockError()
            return (
              <div className="rounded-xl shadow-sm p-4 space-y-3" style={{ backgroundColor: '#121358' }}>
                <div className="relative">
                  <p className="text-xs font-semibold text-white uppercase tracking-wide mb-3">Tambahkan Produk</p>
                  <div className="flex items-center gap-2">
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
                    className={`flex-1 border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358] bg-white ${current.product_id ? 'border-[#121358]/40' : 'border-gray-300'}`}
                  />
                  {current.query && (
                    <button type="button" onMouseDown={() => { setCurrent(emptyItem()); setAutocomplete({ open: false, focused: -1 }) }}
                      className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-red-400/20 hover:bg-red-400/30 text-red-400 hover:text-red-500 transition">
                      <FontAwesomeIcon icon={faTrash} className="w-3 h-3" />
                    </button>
                  )}
                  </div>
                  {autocomplete.open && filteredProducts(current.query).length > 0 && (
                    <div className="absolute z-20 left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-[26rem] overflow-y-auto w-full md:w-[124%]">
                      {filteredProducts(current.query).map((p, optIdx) => (
                        <button key={p.id} type="button" onMouseDown={() => selectProduct(p)}
                          className={`w-full text-left px-4 py-2.5 text-sm transition flex items-center justify-between gap-3 ${autocomplete.focused === optIdx ? 'bg-[#121358] text-white' : 'hover:bg-gray-50 text-gray-700'}`}>
                          <span className="font-medium">{p.name}</span>
                          <span className={`text-xs shrink-0 ${autocomplete.focused === optIdx ? 'text-white/70' : 'text-gray-400'}`}>
                            <span className="hidden md:inline">Rp {p.price.toLocaleString('id-ID')} · stok: {p.stock}</span>
                            <span className="md:hidden">Rp {p.price.toLocaleString('id-ID')} | <span className="font-bold">{p.stock}</span></span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedProduct && (
                    <p className="text-xs mt-1" style={{ color: '#ffc908' }}>
                      <span className="font-normal">Harga jual:</span> <span className="font-semibold">Rp {fmt(selectedProduct.price)}</span>
                      <span className="mx-1">·</span>
                      <span className="font-normal">Stok:</span> <span className="font-semibold">{selectedProduct.stock}</span>
                    </p>
                  )}
                  <div className="mt-6" />
                </div>

                <div className="space-y-3 mt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-white/80 mb-1">Harga Jual</label>
                      <input type="number" value={current.price_sold} disabled placeholder="0"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white text-gray-400 cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="block text-xs text-white/80 mb-1">Diskon</label>
                      <input type="number" value={current.discount} onChange={e => updateCurrent('discount', e.target.value)}
                        placeholder="0" min="0"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358] bg-white" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-white/80 mb-1">Qty <span className="text-red-300">*</span></label>
                    <div className="flex items-center gap-2">
                      <button type="button"
                        onClick={() => updateCurrent('qty', String(Math.max(0.25, Math.round(((parseFloat(current.qty) || 0.25) - 0.25) * 100) / 100)))}
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-400 hover:bg-red-500 text-white font-bold text-lg transition shrink-0">−</button>
                      <input type="text" inputMode="numeric" value={current.qty}
                        onChange={e => { const v = e.target.value; if (v === '' || /^\d+$/.test(v)) updateCurrent('qty', v) }}
                        onFocus={e => { if (current.qty.includes('.')) e.target.select() }}
                        onClick={e => { if (current.qty.includes('.')) e.currentTarget.select() }}
                        placeholder="0"
                        className={`flex-1 border rounded-lg px-3 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#121358] bg-white ${sErr ? 'border-red-400' : 'border-gray-300'}`} />
                      <button type="button"
                        onClick={() => updateCurrent('qty', String(Math.round(((parseFloat(current.qty) || 0) + 0.25) * 100) / 100))}
                        className="w-9 h-9 flex items-center justify-center rounded-lg font-bold text-lg transition shrink-0"
                        style={{ backgroundColor: '#ffc908', color: '#121358' }}>+</button>
                    </div>
                    {sErr && <p className="text-xs text-red-300 mt-1">{sErr}</p>}
                  </div>
                </div>

                {current.qty && current.price_sold && (
                  <p className="text-sm text-white text-right">
                    Subtotal: <span className="font-bold text-base" style={{ color: '#ffc908' }}>Rp {fmt(subtotal(current))}</span>
                  </p>
                )}

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={addItem}
                    disabled={!current.product_id || !current.qty}
                    className="w-full rounded-xl py-2.5 md:py-12 text-sm font-semibold text-[#121358] disabled:opacity-40 disabled:cursor-not-allowed transition hover:brightness-105"
                    style={{ backgroundColor: '#ffc908' }}
                  >
                    + Tambah Produk
                  </button>
                </div>
              </div>
            )
          })()}
          </div>

        </form>

          </div>{/* end Tambahkan Produk */}

          {/* Ringkasan Transaksi — row 2, 3/12 */}
          <div className="col-span-12 md:col-span-4">
            <div className="rounded-2xl p-6 min-h-[400px] flex flex-col gap-4" style={{ backgroundColor: '#121358' }}>
              <div className="text-center">
                <p className="text-xs uppercase tracking-widest -mx-6 -mt-6 px-6 py-3 rounded-t-2xl font-semibold" style={{ backgroundColor: '#B5BAFF', color: '#121358' }}>
                  <span className="font-semibold">Ringkasan Transaksi</span>
                  {date ? <span className="font-normal"> | {new Date(date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span> : ''}
                </p>
                {notes && (
                  <>
                    <p className="text-xs text-white/60 mt-1 italic">{notes}</p>
                    <div className="mt-2 border-t border-white/15" />
                  </>
                )}
              </div>

              {validItems.length === 0 ? (
                <p className="text-white/30 text-sm">Belum ada produk dipilih.</p>
              ) : (
                <div className="space-y-2 flex-1 overflow-y-auto">
                  {items.map((row, i) => {
                    const product = products.find(p => p.id === Number(row.product_id))
                    return (
                      <div key={i} className="relative bg-white/10 rounded-xl px-3 py-2.5">
                        <button type="button" onClick={() => removeItem(i)}
                          className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded-full bg-red-400/20 hover:bg-red-400/30 text-red-400 hover:text-red-500 transition">
                          <FontAwesomeIcon icon={faXmark} className="w-3 h-3" />
                        </button>
                        <div className="pr-6 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{product?.name ?? '-'}</p>
                          <div className="flex justify-between text-sm text-white/60 mt-0.5">
                            <div className="flex items-center gap-1.5">
                              <button type="button" onClick={() => updateItemQty(i, -0.25)}
                                className="w-5 h-5 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white font-bold text-xs transition leading-none">−</button>
                              <span className="font-bold text-white">{row.qty}</span>
                              <button type="button" onClick={() => updateItemQty(i, 0.25)}
                                className="w-5 h-5 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white font-bold text-xs transition leading-none">+</button>
                              <span className="ml-1">× {fmt(parseFloat(row.price_sold) || 0)}{parseFloat(row.discount) > 0 ? ` − ${fmt(parseFloat(row.discount))}` : ''}</span>
                            </div>
                            <span className="font-semibold text-white">{fmt(subtotal(row))}</span>
                          </div>
                        </div>
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
                  onClick={() => { if (validItems.length > 0) { setPreviewCode(generateCode()); setShowConfirm(true) } }}
                  disabled={submitting || validItems.length === 0}
                  className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-30 transition hover:brightness-105"
                  style={{ backgroundColor: '#ffc908', color: '#121358' }}
                >
                  {submitting ? 'Menyimpan...' : 'Cetak Struk'}
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

                {/* Receipt preview */}
                <div className="bg-white border border-dashed border-gray-300 rounded-xl px-3 py-3 font-mono text-[10px] text-gray-800 leading-relaxed">
                  <p className="text-center">{'================================'}</p>
                  <p className="text-center font-bold">TB. NURBETI</p>
                  <p className="text-center">Jl. KS. Tubun No. 46</p>
                  <p className="text-center">Tegal</p>
                  <p className="text-center">HP Admin: 0815-4806-4220</p>
                  <p className="text-center">{'================================'}</p>
                  <p>No. Invoice : {previewCode}</p>
                  <p>Tanggal&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; : {date ? new Date(date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</p>
                  <p>Status&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; : {isHutang ? 'BELUM LUNAS' : 'LUNAS'}</p>
                  <p>{'--------------------------------'}</p>
                  <p>Nama Barang&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Qty&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Total</p>
                  <p>{'--------------------------------'}</p>
                  {validItems.map((row, i) => {
                    const product = products.find(p => p.id === Number(row.product_id))
                    const priceSold = parseFloat(row.price_sold) || 0
                    const disc = parseFloat(row.discount) || 0
                    const qty = parseFloat(row.qty) || 0
                    const sub = priceSold * qty - disc
                    return (
                      <div key={i}>
                        <p className="font-semibold truncate">{product?.name ?? '—'}</p>
                        <p className="pl-2 text-gray-600">
                          {disc > 0 && <span>Disc: Rp {fmt(disc)}{'\n'}</span>}
                          {qty} pcs &nbsp;&nbsp; Rp {fmt(sub)}
                        </p>
                      </div>
                    )
                  })}
                  <p>{'--------------------------------'}</p>
                  <p className="font-bold">TOTAL&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Rp {fmt(total)}</p>
                  <p>&nbsp;</p>
                  <p>Terima kasih atas kepercayaan Anda.</p>
                  <p>&nbsp;</p>
                  <p className="font-bold">Ketentuan Pengembalian Barang:</p>
                  <p>- Konfirmasi sebelum pengembalian.</p>
                  <p>- Maksimal 1 hari setelah barang diterima.</p>
                  <p>- Barang belum digunakan dan kemasan</p>
                  <p>&nbsp;&nbsp;masih utuh.</p>
                  <p>- Nota asli wajib dibawa.</p>
                  <p>- Barang pesanan khusus atau yang telah</p>
                  <p>&nbsp;&nbsp;dipotong tidak dapat dikembalikan.</p>
                  <p>{'================================'}</p>
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

        {showNewCustomer && (
          <>
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4" onClick={() => setShowNewCustomer(false)}>
              <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-bold text-gray-800">Customer Baru</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Belum tersimpan di data customer.</p>
                </div>
                <div className="px-4 py-3 space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Nama <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={newCustomerName}
                      onChange={e => setNewCustomerName(e.target.value)}
                      placeholder="Nama customer"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">No. Telepon</label>
                    <input
                      type="text"
                      value={newCustomerPhone}
                      onChange={e => setNewCustomerPhone(e.target.value)}
                      placeholder="Opsional"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]"
                    />
                  </div>
                  {newCustomerError && <p className="text-xs text-red-500">{newCustomerError}</p>}
                </div>
                <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
                  <button type="button" onClick={() => setShowNewCustomer(false)}
                    className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition">
                    Batal
                  </button>
                  <button type="button" onClick={handleSaveNewCustomer} disabled={newCustomerSaving}
                    className="flex-1 py-2.5 rounded-xl bg-[#121358] text-white text-sm font-semibold hover:bg-[#1a1c6e] disabled:opacity-50 transition">
                    {newCustomerSaving ? 'Menyimpan...' : 'Simpan'}
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
        {Array.from({ length: printData.isHutang ? 2 : 1 }).map((_, copyIdx) => (
          <div key={copyIdx} style={copyIdx === 0 && printData.isHutang ? { pageBreakAfter: 'always' } : undefined}>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>NOTA PENJUALAN</div>
              <div>{printData.code}</div>
              <div>{new Date(printData.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
              <div>Status: {printData.isHutang ? 'BELUM LUNAS' : 'LUNAS'}</div>
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
        ))}
      </div>
    )}
    </>
  )
}
