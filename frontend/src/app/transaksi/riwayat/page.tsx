'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import TransaksiTabs from '@/lib/TransaksiTabs'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown, faChevronUp, faChevronLeft, faChevronRight, faXmark } from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '@/context/AuthContext'
import DateRangeFilter from '@/components/DateRangeFilter'

type TransactionItem = {
  id: number
  qty: number
  price_sold: number
  cogs: number
  profit: number
  products: { name: string } | null
}

type EditItem = { id: number; product_name: string; qty: number; price_sold: number }
type NewEditItem = { product_id: number; product_name: string; qty: number; price_sold: number }
type Product = { id: number; name: string; price: number }

type Transaction = {
  id: number
  code: string
  date: string
  notes: string | null
  reason_to_edit: string | null
  is_initial_transformation: boolean
  users: { name: string } | null
  transaction_items: TransactionItem[]
}

const fmt = (n: number) => n.toLocaleString('id-ID')
const PAGE_SIZE = 10

const now = new Date()
const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
const defaultTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

export default function RiwayatTransaksiPage() {
  const supabase = createClient()
  const { appUser } = useAuth()
  const isAdmin = appUser?.role === 'admin'

  const [dateFrom, setDateFrom] = useState(defaultFrom)
  const [dateTo, setDateTo] = useState(defaultTo)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [list, setList] = useState<Transaction[]>([])
  const [fetching, setFetching] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)

  // Reason modal
  const [showReason, setShowReason] = useState(false)
  const [editReason, setEditReason] = useState('')
  const [pendingEditTrx, setPendingEditTrx] = useState<Transaction | null>(null)
  // Edit state
  const [editingTrx, setEditingTrx] = useState<Transaction | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editItems, setEditItems] = useState<EditItem[]>([])
  const [newEditItems, setNewEditItems] = useState<NewEditItem[]>([])
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  // Product search for adding new items
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [newItemQuery, setNewItemQuery] = useState('')
  const [newItemDropdown, setNewItemDropdown] = useState(false)

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const fetchData = async (p: number, from: string, to: string) => {
    setFetching(true)
    setExpanded(null)
    const rangeFrom = (p - 1) * PAGE_SIZE
    const rangeTo = rangeFrom + PAGE_SIZE - 1

    const [{ count }, { data }] = await Promise.all([
      supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .gte('date', from)
        .lte('date', to),
      supabase
        .from('transactions')
        .select('id, code, date, notes, reason_to_edit, is_initial_transformation, users(name), transaction_items(id, qty, price_sold, cogs, profit, products(name))')
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: false })
        .order('id', { ascending: false })
        .range(rangeFrom, rangeTo),
    ])

    setTotalCount(count ?? 0)
    setList((data as Transaction[]) ?? [])
    setFetching(false)
  }

  useEffect(() => { fetchData(page, dateFrom, dateTo) }, [page, dateFrom, dateTo])

  const handleDateChange = (from: string, to: string) => {
    setPage(1)
    setDateFrom(from)
    setDateTo(to)
  }

  const fetchProducts = async () => {
    if (products.length > 0) return
    setLoadingProducts(true)
    const chunkSize = 1000
    let from = 0
    let all: Product[] = []
    while (true) {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price')
        .eq('is_deleted', false)
        .order('name')
        .range(from, from + chunkSize - 1)
      if (error || !data || data.length === 0) break
      all = [...all, ...(data as Product[])]
      if (data.length < chunkSize) break
      from += chunkSize
    }
    setProducts(all)
    setLoadingProducts(false)
  }

  const openEdit = (trx: Transaction) => {
    setEditingTrx(trx)
    setEditDate(trx.date)
    setEditItems(trx.transaction_items.map(i => ({
      id: i.id,
      product_name: i.products?.name ?? '-',
      qty: i.qty,
      price_sold: i.price_sold,
    })))
    setNewEditItems([])
    setNewItemQuery('')
    setEditError(null)
    fetchProducts()
  }

  const handleSave = async () => {
    if (!editingTrx) return
    setSaving(true)
    setEditError(null)

    const existingReason = editingTrx.reason_to_edit ?? ''
    const appendedReason = existingReason
      ? `${existingReason}\n${editReason.trim()}`
      : editReason.trim()

    const { error: trxErr } = await supabase
      .from('transactions')
      .update({ date: editDate, reason_to_edit: appendedReason, updated_at: new Date().toISOString() })
      .eq('id', editingTrx.id)

    if (trxErr) { setEditError(trxErr.message); setSaving(false); return }

    for (const item of editItems) {
      const { error: itemErr } = await supabase
        .from('transaction_items')
        .update({ qty: item.qty, price_sold: item.price_sold })
        .eq('id', item.id)
      if (itemErr) { setEditError(itemErr.message); setSaving(false); return }
    }

    for (const item of newEditItems) {
      const { error: itemErr } = await supabase
        .from('transaction_items')
        .insert({ transaction_id: editingTrx.id, product_id: item.product_id, qty: item.qty, price_sold: item.price_sold, cogs: 0, discount: 0 })
      if (itemErr) { setEditError(itemErr.message); setSaving(false); return }
    }

    setSaving(false)
    setEditingTrx(null)
    fetchData(page, dateFrom, dateTo)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-xl mx-auto space-y-4">
        <TransaksiTabs />

        <div>
          <h2 className="text-lg font-bold text-gray-800">Riwayat Transaksi</h2>
          <p className="text-xs text-gray-500 mt-0.5">Semua transaksi penjualan.</p>
        </div>

        <DateRangeFilter
          dateFrom={dateFrom} dateTo={dateTo}
          onFromChange={v => handleDateChange(v, dateTo)}
          onToChange={v => handleDateChange(dateFrom, v)}
        />

        {fetching ? (
          <div className="text-center text-sm text-gray-400 py-10">Memuat...</div>
        ) : list.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-10">Tidak ada transaksi dalam rentang ini.</div>
        ) : (
          <>
            <div className="space-y-3">
              {list.map(trx => {
                const totalRevenue = trx.transaction_items.reduce((s, i) => s + i.price_sold, 0)
                const totalProfit = trx.transaction_items.reduce((s, i) => s + i.profit, 0)
                const isOpen = expanded === trx.id

                return (
                  <div key={trx.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <button
                      onClick={() => setExpanded(isOpen ? null : trx.id)}
                      className="w-full px-4 py-3 flex items-start justify-between gap-3 text-left transition bg-gray-100 hover:bg-gray-200"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-mono font-semibold text-[#121358]">{trx.code}</p>
                          {trx.is_initial_transformation && (
                            <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">INIT</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(trx.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {trx.users?.name && <span> · {trx.users.name}</span>}
                        </p>
                        {trx.notes && <p className="text-xs text-gray-400 mt-0.5 italic">{trx.notes}</p>}
                      </div>
                      <div className="text-right shrink-0 flex items-start gap-2">
                        <div>
                          <p className="text-sm font-bold text-[#121358]">Rp {fmt(totalRevenue)}</p>
                          {isAdmin && !trx.is_initial_transformation && (
                            <p className={`text-xs font-semibold mt-0.5 ${totalProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              Profit: Rp {fmt(totalProfit)}
                            </p>
                          )}
                        </div>
                        <FontAwesomeIcon icon={isOpen ? faChevronUp : faChevronDown} className="w-3 h-3 text-gray-400 mt-1 shrink-0" />
                      </div>
                    </button>

                    {isOpen && (
                      <>
                        <div className="border-t border-gray-100 divide-y divide-gray-50">
                          {trx.transaction_items.map(item => (
                            <div key={item.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-700 truncate">{item.products?.name ?? '-'}</p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  qty: {item.qty} · Rp {fmt(Math.round(item.price_sold / item.qty))}
                                </p>
                              </div>
                              <p className="text-sm font-semibold text-gray-800 shrink-0">Rp {fmt(item.price_sold)}</p>
                            </div>
                          ))}
                        </div>
                        <div className="px-4 py-2.5 border-t border-gray-100 flex justify-end">
                          <button onClick={() => { setPendingEditTrx(trx); setEditReason(''); setShowReason(true) }}
                            className="text-xs font-semibold text-[#121358] bg-[#B5BAFF] hover:bg-[#9FA1FF] px-3 py-1 rounded-full transition">
                            Edit
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 text-xs font-semibold text-[#121358] disabled:opacity-30 hover:opacity-70 transition"
              >
                <FontAwesomeIcon icon={faChevronLeft} className="w-3 h-3" /> Sebelumnya
              </button>
              <p className="text-xs text-gray-500">
                Halaman <span className="font-semibold text-gray-700">{page}</span> dari <span className="font-semibold text-gray-700">{totalPages}</span>
                <span className="text-gray-400"> ({totalCount} transaksi)</span>
              </p>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 text-xs font-semibold text-[#121358] disabled:opacity-30 hover:opacity-70 transition"
              >
                Berikutnya <FontAwesomeIcon icon={faChevronRight} className="w-3 h-3" />
              </button>
            </div>
          </>
        )}
      </div>

      {showReason && pendingEditTrx && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowReason(false)} />
          <div className="fixed inset-x-4 top-1/3 z-50 bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-bold text-gray-800">Alasan mengubah transaksi</p>
              <p className="text-[10px] font-mono text-gray-400 mt-0.5">{pendingEditTrx.code}</p>
            </div>
            <div className="px-4 py-4">
              <textarea
                value={editReason}
                onChange={e => setEditReason(e.target.value)}
                placeholder="Tulis alasan perubahan..."
                rows={3}
                autoFocus
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358] resize-none ${editReason.trim().length > 0 && editReason.trim().length <= 3 ? 'border-red-400' : 'border-gray-300'}`}
              />
              {editReason.trim().length > 0 && editReason.trim().length <= 3 && (
                <p className="text-[10px] text-red-500 mt-1">Alasan minimal 4 karakter.</p>
              )}
            </div>
            <div className="flex gap-2 px-4 pb-4">
              <button onClick={() => setShowReason(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
                Batal
              </button>
              <button
                onClick={() => { openEdit(pendingEditTrx); setShowReason(false) }}
                disabled={editReason.trim().length <= 3}
                className="flex-1 py-2.5 rounded-xl bg-[#121358] disabled:opacity-40 text-white text-sm font-semibold hover:bg-[#1a1c6e] transition">
                OK
              </button>
            </div>
          </div>
        </>
      )}

      {editingTrx && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setEditingTrx(null)} />
          <div className="fixed inset-x-4 top-16 z-50 bg-white rounded-2xl shadow-xl overflow-hidden" style={{ maxHeight: '80vh' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div>
                <p className="text-sm font-bold text-gray-800">Edit Transaksi</p>
                <p className="text-[10px] font-mono text-gray-400">{editingTrx.code}</p>
              </div>
              <button onClick={() => setEditingTrx(null)}>
                <FontAwesomeIcon icon={faXmark} className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <div className="overflow-y-auto px-4 py-3 space-y-4" style={{ maxHeight: 'calc(80vh - 110px)' }}>
              {editError && <p className="text-xs font-semibold text-red-500 bg-red-50 rounded-lg px-3 py-2">⚠ {editError}</p>}

              {/* Header fields */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tanggal</label>
                <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
              </div>

              {/* Existing items */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Item</p>
                {editItems.map((item, i) => (
                  <div key={item.id} className="bg-gray-50 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-700">{item.product_name}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-gray-400 mb-1">Qty</label>
                        <input type="number" min="1" value={item.qty}
                          onChange={e => setEditItems(prev => prev.map((x, idx) => idx === i ? { ...x, qty: parseInt(e.target.value) || 1 } : x))}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-400 mb-1">Harga Jual</label>
                        <input type="number" min="0" value={item.price_sold}
                          onChange={e => setEditItems(prev => prev.map((x, idx) => idx === i ? { ...x, price_sold: parseFloat(e.target.value) || 0 } : x))}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* New items */}
              {newEditItems.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Produk Baru</p>
                  {newEditItems.map((item, i) => (
                    <div key={i} className="bg-blue-50 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-gray-700">{item.product_name}</p>
                        <button type="button" onClick={() => setNewEditItems(prev => prev.filter((_, idx) => idx !== i))}>
                          <FontAwesomeIcon icon={faXmark} className="w-3 h-3 text-gray-400 hover:text-red-400" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-gray-400 mb-1">Qty</label>
                          <input type="number" min="1" value={item.qty}
                            onChange={e => setNewEditItems(prev => prev.map((x, idx) => idx === i ? { ...x, qty: parseInt(e.target.value) || 1 } : x))}
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-400 mb-1">Harga Jual</label>
                          <input type="number" min="0" value={item.price_sold}
                            onChange={e => setNewEditItems(prev => prev.map((x, idx) => idx === i ? { ...x, price_sold: parseFloat(e.target.value) || 0 } : x))}
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add product search */}
              <div className="relative">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tambah Produk</p>
                <input
                  type="text"
                  value={newItemQuery}
                  onChange={e => { setNewItemQuery(e.target.value); setNewItemDropdown(true) }}
                  onFocus={() => setNewItemDropdown(true)}
                  onBlur={() => setTimeout(() => setNewItemDropdown(false), 150)}
                  placeholder={loadingProducts ? 'Memuat produk...' : 'Cari nama produk...'}
                  disabled={loadingProducts}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358] disabled:bg-gray-50 disabled:text-gray-400"
                />
                {newItemDropdown && newItemQuery.trim() && (
                  <div className="absolute bottom-full left-0 right-0 z-10 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto mb-1">
                    {products
                      .filter(p => p.name.toLowerCase().includes(newItemQuery.toLowerCase()))
                      .slice(0, 20)
                      .map(p => (
                        <button key={p.id} type="button"
                          onMouseDown={() => {
                            setNewEditItems(prev => [...prev, { product_id: p.id, product_name: p.name, qty: 1, price_sold: p.price }])
                            setNewItemQuery('')
                            setNewItemDropdown(false)
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-50 last:border-0">
                          <p className="font-medium">{p.name}</p>
                          <p className="text-[10px] text-gray-400">Rp {fmt(p.price)}</p>
                        </button>
                      ))
                    }
                    {products.filter(p => p.name.toLowerCase().includes(newItemQuery.toLowerCase())).length === 0 && (
                      <p className="px-3 py-3 text-sm text-gray-400 text-center">Produk tidak ditemukan.</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 px-4 py-3 border-t border-gray-100">
              <button onClick={() => setEditingTrx(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
                Batal
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-[#121358] disabled:opacity-50 text-white text-sm font-semibold hover:bg-[#1a1c6e] transition">
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
