'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown, faChevronUp, faChevronLeft, faChevronRight, faXmark, faTrash, faArrowLeft, faPrint } from '@fortawesome/free-solid-svg-icons'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import DateRangeFilter from '@/components/DateRangeFilter'
import { nowWIB } from '@/lib/date'
import DeleteConfirmPopup from '@/components/DeleteConfirmPopup'

type TransactionItem = {
  id: number
  product_id: number
  qty: number
  price_sold: number
  cogs: number
  profit: number
  discount: number
  products: { name: string } | null
}

type EditItem = { id: number; product_id: number; product_name: string; qty: number; originalQty: number; unitPrice: number; price_sold: number; discount: number }
type NewEditItem = { product_id: number; product_name: string; qty: number; unitPrice: number; price_sold: number; discount: number }
type Product = { id: number; name: string; price: number; stock: number }

type Transaction = {
  id: number
  code: string
  date: string
  notes: string | null
  reason_to_edit: { date: string; reason: string }[] | null
  is_initial_transformation: boolean
  users: { name: string } | null
  transaction_items: TransactionItem[]
}

type ProfitRow = { date: string; is_initial_transformation: boolean; is_paid: boolean; transaction_items: { price_sold: number; profit: number }[] }

const fmt = (n: number) => n.toLocaleString('id-ID')
const PAGE_SIZE = 10

const now = new Date()
const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

function RiwayatTransaksiContent() {
  const supabase = createClient()
  const { appUser } = useAuth()
  const isAdmin = appUser?.role === 'admin'
  const searchParams = useSearchParams()

  const [dateFrom, setDateFrom] = useState(searchParams.get('from') ?? todayStr)
  const [dateTo, setDateTo] = useState(searchParams.get('to') ?? todayStr)
  const [productFilterInput, setProductFilterInput] = useState('')
  const [productFilter, setProductFilter] = useState('')
  const [initFilter, setInitFilter] = useState<'all' | 'normal' | 'init'>('all')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [list, setList] = useState<Transaction[]>([])
  const [fetching, setFetching] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [profitRows, setProfitRows] = useState<ProfitRow[]>([])
  const [isDefaultRange, setIsDefaultRange] = useState(!searchParams.get('from'))

  // Reason modal
  const [showReason, setShowReason] = useState(false)
  const [editReason, setEditReason] = useState('')
  const [pendingEditTrx, setPendingEditTrx] = useState<Transaction | null>(null)
  // Edit state
  const [editingTrx, setEditingTrx] = useState<Transaction | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editItems, setEditItems] = useState<EditItem[]>([])
  const [newEditItems, setNewEditItems] = useState<NewEditItem[]>([])
  const [removedItems, setRemovedItems] = useState<EditItem[]>([])
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [showEditConfirm, setShowEditConfirm] = useState(false)
  // Delete state
  const [showDelete, setShowDelete] = useState(false)
  const [pendingDeleteTrx, setPendingDeleteTrx] = useState<Transaction | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  // Print state
  const [printingId, setPrintingId] = useState<number | null>(null)
  // Product search for adding new items
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [newItemQuery, setNewItemQuery] = useState('')
  const [newItemDropdown, setNewItemDropdown] = useState(false)

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const buildQ = (select: string, opts?: { count?: 'exact'; head?: boolean }) => {
    return (opts
      ? supabase.from('transactions').select(select, { count: opts.count, head: opts.head })
      : supabase.from('transactions').select(select)) as any
  }

  const applyFilters = (q: any, from: string, to: string, iFilter: 'all' | 'normal' | 'init', trxIds?: number[]) => {
    if (from) q = q.gte('date', from)
    if (to) q = q.lte('date', to)
    if (iFilter === 'normal') q = q.eq('is_initial_transformation', false)
    if (iFilter === 'init') q = q.eq('is_initial_transformation', true)
    if (trxIds) q = q.in('id', trxIds)
    return q
  }

  const fetchData = async (p: number, from: string, to: string, pFilter: string, iFilter: 'all' | 'normal' | 'init') => {
    setFetching(true)
    setExpanded(null)

    let trxIds: number[] | null = null
    if (pFilter.trim()) {
      const { data: itemData } = await supabase
        .from('transaction_items')
        .select('transaction_id, products!inner(name)')
        .ilike('products.name', `%${pFilter.trim()}%`)
      trxIds = [...new Set(((itemData ?? []) as { transaction_id: number }[]).map(i => i.transaction_id))]
      if (trxIds.length === 0) { setTotalCount(0); setList([]); setFetching(false); return }
    }

    if (pFilter.trim()) {
      const { data } = await applyFilters(
        buildQ('id, code, date, notes, reason_to_edit, is_initial_transformation, users(name), transaction_items(id, product_id, qty, price_sold, cogs, profit, discount, products(name))')
          .order('date', { ascending: false }).order('id', { ascending: false }),
        from, to, iFilter, trxIds!
      )
      setTotalCount((data ?? []).length)
      setList((data as Transaction[]) ?? [])
      setFetching(false)
      return
    }

    const rangeFrom = (p - 1) * PAGE_SIZE
    const rangeTo = rangeFrom + PAGE_SIZE - 1

    const [{ count }, { data }] = await Promise.all([
      applyFilters(buildQ('id', { count: 'exact', head: true }), from, to, iFilter),
      applyFilters(
        buildQ('id, code, date, notes, reason_to_edit, is_initial_transformation, users(name), transaction_items(id, product_id, qty, price_sold, cogs, profit, discount, products(name))')
          .order('date', { ascending: false }).order('id', { ascending: false }).range(rangeFrom, rangeTo),
        from, to, iFilter
      ),
    ])

    setTotalCount(count ?? 0)
    setList((data as Transaction[]) ?? [])
    setFetching(false)
  }

  const fetchProfit = async (from: string, to: string, pFilter: string) => {
    let trxIds: number[] | null = null
    if (pFilter.trim()) {
      const { data: itemData } = await supabase
        .from('transaction_items')
        .select('transaction_id, products!inner(name)')
        .ilike('products.name', `%${pFilter.trim()}%`)
      trxIds = [...new Set(((itemData ?? []) as { transaction_id: number }[]).map(i => i.transaction_id))]
      if (trxIds.length === 0) { setProfitRows([]); return }
    }

    let q = supabase.from('transactions').select('date, is_initial_transformation, is_paid, transaction_items(price_sold, profit)') as any
    if (from) q = q.gte('date', from)
    if (to) q = q.lte('date', to)
    if (trxIds) q = q.in('id', trxIds)
    q = q.order('date', { ascending: false })

    const { data } = await q
    setProfitRows((data ?? []) as ProfitRow[])
  }

  useEffect(() => { fetchData(page, dateFrom, dateTo, productFilter, initFilter) }, [page, dateFrom, dateTo, productFilter, initFilter])
  useEffect(() => {
    const from = isDefaultRange ? todayStr : dateFrom
    const to = isDefaultRange ? todayStr : dateTo
    fetchProfit(from, to, productFilter)
  }, [dateFrom, dateTo, productFilter, isDefaultRange])

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1)
      setProductFilter(productFilterInput)
    }, 400)
    return () => clearTimeout(t)
  }, [productFilterInput])

  const handleDateChange = (from: string, to: string) => {
    setPage(1)
    setDateFrom(from)
    setDateTo(to)
    setIsDefaultRange(false)
  }

  const handleInitFilter = (val: 'all' | 'normal' | 'init') => {
    setPage(1)
    setInitFilter(val)
  }

  const fetchProducts = async () => {
    if (products.length > 0) return
    setLoadingProducts(true)
    const chunkSize = 1000
    let from = 0
    let all: Omit<Product, 'stock'>[] = []
    while (true) {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price')
        .eq('is_deleted', false)
        .order('name')
        .range(from, from + chunkSize - 1)
      if (error || !data || data.length === 0) break
      all = [...all, ...(data as Omit<Product, 'stock'>[])]
      if (data.length < chunkSize) break
      from += chunkSize
    }
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
    setProducts(all.map(p => ({ ...p, stock: stockMap[p.id] ?? 0 })))
    setLoadingProducts(false)
  }

  const openEdit = (trx: Transaction) => {
    setEditingTrx(trx)
    setEditDate(trx.date)
    setEditItems(trx.transaction_items.map(i => {
      const unitPrice = i.qty > 0 ? i.price_sold / i.qty : i.price_sold
      return {
        id: i.id,
        product_id: i.product_id,
        product_name: i.products?.name ?? '-',
        qty: i.qty,
        originalQty: i.qty,
        unitPrice,
        price_sold: i.price_sold,
        discount: i.discount ?? 0,
      }
    }))
    setNewEditItems([])
    setRemovedItems([])
    setNewItemQuery('')
    setEditError(null)
    fetchProducts()
  }

  const removeEditItem = (id: number) => {
    if (editItems.length + newEditItems.length <= 1) {
      setEditError('Transaksi harus memiliki minimal satu barang.')
      return
    }
    const target = editItems.find(i => i.id === id)
    if (!target) return
    setEditError(null)
    setEditItems(prev => prev.filter(i => i.id !== id))
    setRemovedItems(prev => [...prev, target])
  }

  const restoreEditItem = (id: number) => {
    const target = removedItems.find(i => i.id === id)
    if (!target) return
    setRemovedItems(prev => prev.filter(i => i.id !== id))
    setEditItems(prev => [...prev, target])
  }

  // Stock available for a line item's new qty = remaining stock_batches for the
  // product, plus this item's own originalQty (0 for brand-new lines) since that
  // amount is already "reserved" by this transaction and isn't in stock_batches.
  const stockErrorFor = (productId: number, qty: number, originalQty: number): string | null => {
    const product = products.find(p => p.id === productId)
    if (!product) return null
    const available = product.stock + originalQty
    if (qty > available) return `Stok tersedia: ${available}`
    return null
  }

  // Restores FIFO stock consumed by the given transaction_items (reverses
  // stock_batch_consumption onto stock_batches.qty_remaining), then removes
  // the consumption rows. Shared by whole-transaction delete and single-item
  // removal during edit so stock stays in sync either way.
  const restoreStockForItems = async (itemIds: number[]): Promise<string | null> => {
    if (itemIds.length === 0) return null
    const { data: consumptions, error: consFetchErr } = await supabase
      .from('stock_batch_consumption')
      .select('stock_batch_id, qty_consumed')
      .in('transaction_item_id', itemIds)
    if (consFetchErr) return consFetchErr.message
    if (!consumptions || consumptions.length === 0) return null

    const batchMap: Record<number, number> = {}
    for (const c of consumptions as { stock_batch_id: number; qty_consumed: number }[]) {
      batchMap[c.stock_batch_id] = (batchMap[c.stock_batch_id] ?? 0) + c.qty_consumed
    }
    for (const [batchId, qtyToRestore] of Object.entries(batchMap)) {
      const { data: batch } = await supabase
        .from('stock_batches')
        .select('qty_remaining')
        .eq('id', Number(batchId))
        .single()
      if (batch) {
        const { error: batchErr } = await supabase
          .from('stock_batches')
          .update({ qty_remaining: (batch as { qty_remaining: number }).qty_remaining + qtyToRestore })
          .eq('id', Number(batchId))
        if (batchErr) return batchErr.message
      }
    }
    const { error: consErr } = await supabase.from('stock_batch_consumption').delete().in('transaction_item_id', itemIds)
    if (consErr) return consErr.message
    return null
  }

  const handleSave = async () => {
    if (!editingTrx) return
    if (editItems.length + newEditItems.length === 0) {
      setEditError('Transaksi harus memiliki minimal satu barang.')
      return
    }

    if (!editingTrx.is_initial_transformation) {
      for (const item of editItems) {
        const err = stockErrorFor(item.product_id, item.qty, item.originalQty)
        if (err) { setEditError(`Stok ${item.product_name} tidak cukup. ${err}`); return }
      }
      for (const item of newEditItems) {
        const err = stockErrorFor(item.product_id, item.qty, 0)
        if (err) { setEditError(`Stok ${item.product_name} tidak cukup. ${err}`); return }
      }
    }

    setSaving(true)
    setEditError(null)

    const existingReasons = editingTrx.reason_to_edit ?? []
    const newReasons = [...existingReasons, { date: nowWIB(), reason: editReason.trim() }]

    const { error: trxErr } = await supabase
      .from('transactions')
      .update({ date: editDate, reason_to_edit: newReasons, updated_at: nowWIB() })
      .eq('id', editingTrx.id)

    if (trxErr) { setEditError(trxErr.message); setSaving(false); return }

    if (removedItems.length > 0) {
      const removedIds = removedItems.map(i => i.id)

      if (!editingTrx.is_initial_transformation) {
        const restoreErr = await restoreStockForItems(removedIds)
        if (restoreErr) { setEditError(restoreErr); setSaving(false); return }
      }

      const { error: delItemsErr } = await supabase.from('transaction_items').delete().in('id', removedIds)
      if (delItemsErr) { setEditError(delItemsErr.message); setSaving(false); return }
    }

    for (const item of editItems) {
      if (editingTrx.is_initial_transformation) {
        const { error: itemErr } = await supabase
          .from('transaction_items')
          .update({ qty: item.qty, price_sold: item.price_sold, discount: item.discount })
          .eq('id', item.id)
        if (itemErr) { setEditError(itemErr.message); setSaving(false); return }
      } else {
        const { error: syncErr } = await supabase.rpc('sync_transaction_item_stock', {
          p_transaction_item_id: item.id,
          p_qty: item.qty,
          p_price_sold: item.price_sold,
          p_discount: item.discount,
        })
        if (syncErr) { setEditError(syncErr.message); setSaving(false); return }
      }
    }

    for (const item of newEditItems) {
      const { data: newRow, error: itemErr } = await supabase
        .from('transaction_items')
        .insert({ transaction_id: editingTrx.id, product_id: item.product_id, qty: item.qty, price_sold: item.price_sold, cogs: 0, discount: item.discount })
        .select('id')
        .single()
      if (itemErr || !newRow) { setEditError(itemErr?.message ?? 'Gagal menambah produk.'); setSaving(false); return }

      if (!editingTrx.is_initial_transformation) {
        const { error: syncErr } = await supabase.rpc('sync_transaction_item_stock', {
          p_transaction_item_id: (newRow as { id: number }).id,
          p_qty: item.qty,
          p_price_sold: item.price_sold,
          p_discount: item.discount,
        })
        if (syncErr) { setEditError(syncErr.message); setSaving(false); return }
      }
    }

    setSaving(false)
    setShowEditConfirm(false)
    setEditingTrx(null)
    setRemovedItems([])
    setProducts([])
    fetchData(page, dateFrom, dateTo, productFilter, initFilter)
  }

  const handleDelete = async () => {
    if (!pendingDeleteTrx) return
    setDeleting(true)
    setDeleteError(null)

    const itemIds = pendingDeleteTrx.transaction_items.map(i => i.id)

    if (!pendingDeleteTrx.is_initial_transformation && itemIds.length > 0) {
      const restoreErr = await restoreStockForItems(itemIds)
      if (restoreErr) { setDeleteError(restoreErr); setDeleting(false); return }
    }

    if (itemIds.length > 0) {
      const { error: itemsErr } = await supabase.from('transaction_items').delete().in('id', itemIds)
      if (itemsErr) { setDeleteError(itemsErr.message); setDeleting(false); return }
    }

    const { error: trxErr } = await supabase.from('transactions').delete().eq('id', pendingDeleteTrx.id)
    if (trxErr) { setDeleteError(trxErr.message); setDeleting(false); return }

    setDeleting(false)
    setShowDelete(false)
    setDeleteConfirmText('')
    setPendingDeleteTrx(null)
    fetchData(page, dateFrom, dateTo, productFilter, initFilter)
  }

  async function handlePrint(transactionId: number) {
    setPrintingId(transactionId)
    try {
      await supabase.from('print_jobs').insert({ transaction_id: transactionId })
    } finally {
      setPrintingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-xl mx-auto space-y-4">

        <div className="flex items-center gap-3">
          <Link href="/" className="w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-sm text-gray-500 hover:text-gray-800 transition shrink-0">
            <FontAwesomeIcon icon={faArrowLeft} className="w-3.5 h-3.5" />
          </Link>
          <div>
            <h2 className="text-lg font-bold text-gray-800">Riwayat Transaksi</h2>
            <p className="text-xs text-gray-500 mt-0.5">Semua transaksi penjualan.</p>
          </div>
        </div>

        <DateRangeFilter
          dateFrom={dateFrom} dateTo={dateTo}
          onFromChange={v => handleDateChange(v, dateTo)}
          onToChange={v => handleDateChange(dateFrom, v)}
        />

        <div className="rounded-2xl shadow-sm px-4 py-4" style={{ backgroundColor: '#B5BAFF' }}>
          <p className="text-xs font-semibold text-[#121358] mb-2">Nama Produk:</p>
          <div className="relative">
            <input
              type="text"
              value={productFilterInput}
              onChange={e => setProductFilterInput(e.target.value)}
              placeholder="Cari nama produk..."
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358] pr-8"
            />
            {productFilterInput && (
              <button
                onClick={() => setProductFilterInput('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <FontAwesomeIcon icon={faXmark} className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Initial transformation filter */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-gray-500 shrink-0">Tipe:</p>
            <div className="flex gap-1.5 flex-wrap">
              {([['all', 'Semua'], ['normal', 'Transaksi'], ['init', 'Initial']] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => handleInitFilter(val)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full transition ${
                    initFilter === val
                      ? 'bg-[#121358] text-white'
                      : 'bg-white text-gray-500 border border-gray-200 hover:border-[#121358] hover:text-[#121358]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {initFilter !== 'all' && !fetching && (
            <div className="flex items-center gap-2 px-1">
              <span className="text-xs text-gray-500">Total</span>
              <span className="text-xs font-bold text-[#121358] bg-[#B5BAFF] px-2.5 py-0.5 rounded-full">
                {totalCount} transaksi
              </span>
            </div>
          )}
        </div>

        {isAdmin && (() => {
          const validRows = profitRows.filter(t => !t.is_initial_transformation && t.is_paid)
          if (validRows.length === 0) return null

          const dateLabel = isDefaultRange
            ? 'Hari ini'
            : (() => {
                const fmtShort = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
                return `${fmtShort(dateFrom)} – ${fmtShort(dateTo)}`
              })()

          const totalRev = validRows.reduce((s, t) => s + t.transaction_items.reduce((si, i) => si + i.price_sold, 0), 0)
          const totalProfit = validRows.reduce((s, t) => s + t.transaction_items.reduce((si, i) => si + i.profit, 0), 0)
          const margin = totalRev > 0 ? (totalProfit / totalRev) * 100 : 0

          const piutangRows = profitRows.filter(t => !t.is_initial_transformation && !t.is_paid)
          const totalPiutang = piutangRows.reduce((s, t) => s + t.transaction_items.reduce((si, i) => si + i.price_sold, 0), 0)
          const totalProfitPiutang = piutangRows.reduce((s, t) => s + t.transaction_items.reduce((si, i) => si + i.profit, 0), 0)

          return (
            <div className="rounded-2xl px-4 py-4 space-y-2" style={{ backgroundColor: '#121358' }}>
              <p className="text-xs font-semibold" style={{ color: '#B5BAFF' }}>
                Profit · {validRows.length} transaksi · {dateLabel}{productFilter ? ` · "${productFilter}"` : ''}
              </p>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px]" style={{ color: '#B5BAFF' }}>Total Penjualan</p>
                  <p className="text-sm font-bold text-white">Rp {fmt(totalRev)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px]" style={{ color: '#B5BAFF' }}>Total Profit</p>
                  <p className={`text-xl font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    Rp {fmt(totalProfit)}
                  </p>
                </div>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                <div className="h-full rounded-full bg-green-400" style={{ width: `${Math.min(100, Math.max(0, margin))}%` }} />
              </div>
              <p className="text-[10px] text-right" style={{ color: '#B5BAFF' }}>Margin {margin.toFixed(1)}%</p>

              {piutangRows.length > 0 && (
                <div className="flex items-end justify-between gap-3 pt-2 border-t border-white/10">
                  <div>
                    <p className="text-[10px]" style={{ color: '#B5BAFF' }}>Piutang</p>
                    <p className="text-sm font-bold text-white">Rp {fmt(totalPiutang)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px]" style={{ color: '#B5BAFF' }}>Total Profit Piutang</p>
                    <p className={`text-xl font-bold ${totalProfitPiutang >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                      Rp {fmt(totalProfitPiutang)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )
        })()}


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
                        <div className="px-4 py-2.5 border-t border-gray-100 flex justify-end gap-2">
                          <button onClick={() => handlePrint(trx.id)} disabled={printingId === trx.id}
                            className="text-xs font-semibold text-blue-500 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-full transition disabled:opacity-50">
                            <FontAwesomeIcon icon={faPrint} className="w-3 h-3" />
                          </button>
                          <button onClick={() => { setPendingDeleteTrx(trx); setDeleteConfirmText(''); setShowDelete(true) }}
                            className="text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-full transition">
                            <FontAwesomeIcon icon={faTrash} className="w-3 h-3" />
                          </button>
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
            {productFilter && (
              <p className="text-xs text-gray-400 px-1">{totalCount} transaksi ditemukan</p>
            )}
            <div className={`flex items-center justify-between px-1 ${productFilter ? 'hidden' : ''}`}>
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

      {showDelete && pendingDeleteTrx && (
        <DeleteConfirmPopup
          title="Hapus Transaksi"
          subLabel={pendingDeleteTrx.code}
          description="Tindakan ini akan menghapus transaksi dan mengembalikan stok produk."
          confirmText={deleteConfirmText}
          onConfirmTextChange={setDeleteConfirmText}
          onConfirm={handleDelete}
          onCancel={() => { setShowDelete(false); setDeleteConfirmText(''); setDeleteError(null) }}
          loading={deleting}
          error={deleteError ?? undefined}
        />
      )}

      {showReason && pendingEditTrx && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4" onClick={() => setShowReason(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
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
          </div>
        </>
      )}

      {editingTrx && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4" onClick={() => setEditingTrx(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden" style={{ maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
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
                {editItems.map((item, i) => {
                  const subtotal = item.price_sold - (item.discount ?? 0)
                  const qtyErr = stockErrorFor(item.product_id, item.qty, item.originalQty)
                  return (
                    <div key={item.id} className="bg-gray-50 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-gray-700">{item.product_name}</p>
                        <button type="button" onClick={() => removeEditItem(item.id)}>
                          <FontAwesomeIcon icon={faTrash} className="w-3 h-3 text-gray-400 hover:text-red-400" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-gray-400 mb-1">Harga Jual</label>
                          <input type="number" value={item.unitPrice} disabled
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-gray-100 text-gray-500 cursor-not-allowed" />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-400 mb-1">Diskon</label>
                          <input type="number" min="0" value={item.discount}
                            onChange={e => setEditItems(prev => prev.map((x, idx) => idx === i ? { ...x, discount: parseFloat(e.target.value) || 0 } : x))}
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-400 mb-1">Qty</label>
                        <div className="flex items-center gap-2">
                          <button type="button"
                            onClick={() => setEditItems(prev => prev.map((x, idx) => {
                              if (idx !== i) return x
                              const q = Math.max(0.25, Math.round((x.qty - 0.25) * 100) / 100)
                              return { ...x, qty: q, price_sold: q * x.unitPrice }
                            }))}
                            className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-400 hover:bg-red-500 text-white font-bold text-lg transition shrink-0">−</button>
                          <input type="text" inputMode="numeric" value={item.qty}
                            onChange={e => {
                              const v = e.target.value
                              if (v === '' || /^\d+$/.test(v)) {
                                const q = v === '' ? 0 : parseInt(v)
                                setEditItems(prev => prev.map((x, idx) => idx === i ? { ...x, qty: q, price_sold: q * x.unitPrice } : x))
                              }
                            }}
                            className={`flex-1 border rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#121358] ${qtyErr ? 'border-red-400' : 'border-gray-300'}`} />
                          <button type="button"
                            onClick={() => setEditItems(prev => prev.map((x, idx) => {
                              if (idx !== i) return x
                              const q = Math.round((x.qty + 0.25) * 100) / 100
                              return { ...x, qty: q, price_sold: q * x.unitPrice }
                            }))}
                            className="w-9 h-9 flex items-center justify-center rounded-lg font-bold text-lg transition shrink-0"
                            style={{ backgroundColor: '#ffc908', color: '#121358' }}>+</button>
                        </div>
                        {qtyErr && <p className="text-xs text-red-500 mt-1">{qtyErr}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400">Subtotal</p>
                        <p className="text-sm font-semibold text-[#121358]">Rp {fmt(subtotal)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* New items */}
              {newEditItems.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Produk Baru</p>
                  {newEditItems.map((item, i) => {
                    const subtotal = item.price_sold - (item.discount ?? 0)
                    const qtyErr = stockErrorFor(item.product_id, item.qty, 0)
                    return (
                      <div key={i} className="bg-blue-50 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-gray-700">{item.product_name}</p>
                          <button type="button" onClick={() => setNewEditItems(prev => prev.filter((_, idx) => idx !== i))}>
                            <FontAwesomeIcon icon={faXmark} className="w-3 h-3 text-gray-400 hover:text-red-400" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-gray-400 mb-1">Harga Jual</label>
                            <input type="number" value={item.unitPrice} disabled
                              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-blue-100 text-gray-500 cursor-not-allowed" />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-400 mb-1">Diskon</label>
                            <input type="number" min="0" value={item.discount}
                              onChange={e => setNewEditItems(prev => prev.map((x, idx) => idx === i ? { ...x, discount: parseFloat(e.target.value) || 0 } : x))}
                              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-400 mb-1">Qty</label>
                          <div className="flex items-center gap-2">
                            <button type="button"
                              onClick={() => setNewEditItems(prev => prev.map((x, idx) => {
                                if (idx !== i) return x
                                const q = Math.max(0.25, Math.round((x.qty - 0.25) * 100) / 100)
                                return { ...x, qty: q, price_sold: q * x.unitPrice }
                              }))}
                              className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-400 hover:bg-red-500 text-white font-bold text-lg transition shrink-0">−</button>
                            <input type="text" inputMode="numeric" value={item.qty}
                              onChange={e => {
                                const v = e.target.value
                                if (v === '' || /^\d+$/.test(v)) {
                                  const q = v === '' ? 0 : parseInt(v)
                                  setNewEditItems(prev => prev.map((x, idx) => idx === i ? { ...x, qty: q, price_sold: q * x.unitPrice } : x))
                                }
                              }}
                              className={`flex-1 border rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#121358] ${qtyErr ? 'border-red-400' : 'border-gray-300'}`} />
                            <button type="button"
                              onClick={() => setNewEditItems(prev => prev.map((x, idx) => {
                                if (idx !== i) return x
                                const q = Math.round((x.qty + 0.25) * 100) / 100
                                return { ...x, qty: q, price_sold: q * x.unitPrice }
                              }))}
                              className="w-9 h-9 flex items-center justify-center rounded-lg font-bold text-lg transition shrink-0"
                              style={{ backgroundColor: '#ffc908', color: '#121358' }}>+</button>
                          </div>
                          {qtyErr && <p className="text-xs text-red-500 mt-1">{qtyErr}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-gray-400">Subtotal</p>
                          <p className="text-sm font-semibold text-[#121358]">Rp {fmt(subtotal)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Removed items */}
              {removedItems.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Akan Dihapus</p>
                  {removedItems.map(item => (
                    <div key={item.id} className="bg-red-50 rounded-xl p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-700 truncate line-through">{item.product_name}</p>
                        <p className="text-[10px] text-gray-400">qty {item.qty} · Rp {fmt(item.unitPrice)}</p>
                      </div>
                      <button type="button" onClick={() => restoreEditItem(item.id)}
                        className="text-[10px] font-semibold text-[#121358] bg-white border border-gray-200 px-2 py-1 rounded-full hover:bg-gray-50 shrink-0">
                        Batalkan
                      </button>
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
                            setNewEditItems(prev => [...prev, { product_id: p.id, product_name: p.name, qty: 1, unitPrice: p.price, price_sold: p.price, discount: 0 }])
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
              <button onClick={() => setShowEditConfirm(true)}
                className="flex-1 py-2.5 rounded-xl bg-[#121358] text-white text-sm font-semibold hover:bg-[#1a1c6e] transition">
                Simpan
              </button>
            </div>
          </div>
          </div>
        </>
      )}

      {showEditConfirm && editingTrx && (() => {
        const allItems = [
          ...editItems.map(i => ({ name: i.product_name, qty: i.qty, price_sold: i.price_sold, discount: i.discount, isNew: false })),
          ...newEditItems.map(i => ({ name: i.product_name, qty: i.qty, price_sold: i.price_sold, discount: i.discount, isNew: true })),
        ]
        const grandTotal = allItems.reduce((s, i) => s + i.price_sold - i.discount, 0)
        return (
          <>
            <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center px-4" onClick={() => setShowEditConfirm(false)}>
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" style={{ maxHeight: '75vh' }} onClick={e => e.stopPropagation()}>
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-bold text-gray-800">Konfirmasi Perubahan</p>
                <p className="text-[10px] font-mono text-gray-400 mt-0.5">{editingTrx.code} · {editDate}</p>
              </div>
              <div className="overflow-y-auto px-4 py-3 space-y-2" style={{ maxHeight: 'calc(75vh - 120px)' }}>
                {allItems.map((item, i) => (
                  <div key={i} className={`rounded-xl px-3 py-2.5 ${item.isNew ? 'bg-blue-50' : 'bg-gray-50'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-gray-700 flex-1">{item.name}</p>
                      {item.isNew && <span className="text-[9px] font-bold bg-blue-200 text-blue-700 px-1.5 py-0.5 rounded-full shrink-0">BARU</span>}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[10px] text-gray-400">
                        qty {item.qty} · Rp {fmt(Math.round(item.price_sold / item.qty))}
                        {item.discount > 0 && <span className="text-red-400"> − diskon Rp {fmt(item.discount)}</span>}
                      </p>
                      <p className="text-xs font-semibold text-[#121358]">Rp {fmt(item.price_sold - item.discount)}</p>
                    </div>
                  </div>
                ))}
                {removedItems.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-1">Dihapus (stok dikembalikan)</p>
                    {removedItems.map(item => (
                      <div key={item.id} className="rounded-xl px-3 py-2.5 bg-red-50">
                        <p className="text-xs font-semibold text-gray-700 line-through">{item.product_name}</p>
                        <p className="text-[10px] text-gray-400">qty {item.qty} · Rp {fmt(item.unitPrice)}</p>
                      </div>
                    ))}
                  </>
                )}
                <div className="flex items-center justify-between border-t border-gray-100 pt-2 mt-2">
                  <p className="text-sm font-bold text-gray-700">Total</p>
                  <p className="text-sm font-bold text-[#121358]">Rp {fmt(grandTotal)}</p>
                </div>
              </div>
              <div className="flex gap-2 px-4 py-3 border-t border-gray-100">
                <button onClick={() => setShowEditConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
                  Batal
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-[#121358] disabled:opacity-50 text-white text-sm font-semibold hover:bg-[#1a1c6e] transition">
                  {saving ? 'Menyimpan...' : 'Sudah Benar'}
                </button>
              </div>
            </div>
            </div>
          </>
        )
      })()}
    </div>
  )
}

export default function RiwayatTransaksiPage() {
  return <Suspense><RiwayatTransaksiContent /></Suspense>
}
