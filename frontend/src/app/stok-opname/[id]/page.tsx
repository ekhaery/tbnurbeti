'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft, faPen, faXmark } from '@fortawesome/free-solid-svg-icons'

type Session = {
  id: number
  created_at: string
  status: string
  categories: { name: string } | null
  users: { name: string } | null
}

type Item = {
  id: number
  products: { id: number; name: string } | null
}

type Warehouse = { id: number; name: string; code: string }

export default function StokOpnameDetailPage() {
  const supabase = createClient()
  const { id } = useParams()
  const router = useRouter()

  const [session, setSession] = useState<Session | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [productWarehouseMap, setProductWarehouseMap] = useState<Record<number, number[]>>({})
  const [warehouseCounts, setWarehouseCounts] = useState<Record<number, number>>({})
  const [countedStockMap, setCountedStockMap] = useState<Record<string, number>>({})
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [editStock, setEditStock] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editSaved, setEditSaved] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      supabase
        .from('stock_opname_sessions')
        .select('id, created_at, status, categories(name), users(name)')
        .eq('id', id)
        .single(),
      supabase
        .from('stock_opname_items')
        .select('id, products(id, name)')
        .eq('session_id', id)
        .order('id'),
    ]).then(async ([{ data: sessionData }, { data: itemsData }]) => {
      setSession(sessionData as Session | null)
      const itemRows = (itemsData as Item[]) ?? []
      setItems(itemRows)

      const productIds = itemRows.map(i => i.products?.id).filter((v): v is number => v != null)
      const itemIds = itemRows.map(i => i.id)

      const [{ data: links }, { data: counts }] = await Promise.all([
        productIds.length
          ? supabase.from('product_warehouse').select('product_id, warehouse_id, warehouses(id, name, code)').in('product_id', productIds)
          : Promise.resolve({ data: [] as { product_id: number; warehouse_id: number; warehouses: Warehouse }[] }),
        itemIds.length
          ? supabase.from('stock_opname_item_warehouses').select('item_id, warehouse_id, counted_stock').in('item_id', itemIds)
          : Promise.resolve({ data: [] as { item_id: number; warehouse_id: number; counted_stock: number }[] }),
      ])

      const linkRows = (links ?? []) as { product_id: number; warehouse_id: number; warehouses: Warehouse }[]

      const warehouseMap: Record<number, Warehouse> = {}
      const pwMap: Record<number, number[]> = {}
      for (const l of linkRows) {
        if (l.warehouses) warehouseMap[l.warehouse_id] = l.warehouses
        if (!pwMap[l.product_id]) pwMap[l.product_id] = []
        pwMap[l.product_id].push(l.warehouse_id)
      }

      const warehouseList = Object.values(warehouseMap).sort((a, b) => a.name.localeCompare(b.name))
      setWarehouses(warehouseList)
      setProductWarehouseMap(pwMap)
      if (warehouseList.length > 0) setSelectedWarehouseId(warehouseList[0].id)

      const linkTally: Record<number, number> = {}
      for (const l of linkRows) {
        linkTally[l.product_id] = (linkTally[l.product_id] ?? 0) + 1
      }

      const stockMap: Record<string, number> = {}
      for (const c of (counts ?? []) as { item_id: number; warehouse_id: number; counted_stock: number }[]) {
        stockMap[`${c.item_id}_${c.warehouse_id}`] = c.counted_stock
      }

      setWarehouseCounts(linkTally)
      setCountedStockMap(stockMap)
      setLoading(false)
    })
  }, [id])

  const openEdit = async (item: Item) => {
    if (!selectedWarehouseId) return
    setEditingItem(item)
    setEditLoading(true)
    setEditError(null)
    setEditSaved(false)

    const { data } = await supabase
      .from('stock_opname_item_warehouses')
      .select('counted_stock')
      .eq('item_id', item.id)
      .eq('warehouse_id', selectedWarehouseId)
      .maybeSingle()

    setEditStock(data ? String(data.counted_stock) : '')
    setEditLoading(false)
  }

  const handleEditSave = async () => {
    if (!editingItem || !selectedWarehouseId) return
    setEditSaving(true)
    setEditError(null)

    const { error: upsertErr } = await supabase
      .from('stock_opname_item_warehouses')
      .upsert(
        { item_id: editingItem.id, warehouse_id: selectedWarehouseId, counted_stock: parseFloat(editStock) || 0 },
        { onConflict: 'item_id,warehouse_id' }
      )

    setEditSaving(false)
    if (upsertErr) { setEditError(upsertErr.message); return }

    setCountedStockMap(prev => ({
      ...prev,
      [`${editingItem.id}_${selectedWarehouseId}`]: parseFloat(editStock) || 0,
    }))

    setEditSaved(true)
    setTimeout(() => { setEditSaved(false); setEditingItem(null) }, 1000)
  }

  const handleConfirm = async () => {
    if (!session || session.status === 'confirmed') return
    setConfirming(true)
    setConfirmError(null)
    const { error } = await supabase.rpc('confirm_stock_opname', { p_session_id: Number(id) })
    setConfirming(false)
    if (error) { setConfirmError(error.message); return }
    setSession(prev => prev ? { ...prev, status: 'confirmed' } : prev)
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
        Memuat...
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
        Sesi tidak ditemukan.
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
          <FontAwesomeIcon icon={faChevronLeft} className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-base font-bold text-gray-800">Detail Stock Opname</h1>
          <p className="text-xs text-gray-400">{session.categories?.name ?? '-'}</p>
        </div>
      </div>

      <div className="px-4 py-4 max-w-xl mx-auto space-y-4">
        <div className="bg-white rounded-xl shadow-sm p-4 grid grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Tanggal</p>
            <p className="text-xs font-medium text-gray-800 mt-0.5">{formatDate(session.created_at)}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Kategori</p>
            <p className="text-xs font-medium text-gray-800 mt-0.5">{session.categories?.name ?? '-'}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Dibuat Oleh</p>
            <p className="text-xs font-medium text-gray-800 mt-0.5">{session.users?.name ?? '-'}</p>
          </div>
        </div>

        {warehouses.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-1 flex gap-1 overflow-x-auto">
            {warehouses.map(w => {
              const pending = items.filter(item =>
                item.products &&
                (productWarehouseMap[item.products.id] ?? []).includes(w.id) &&
                countedStockMap[`${item.id}_${w.id}`] === undefined
              ).length
              return (
                <button
                  key={w.id}
                  onClick={() => setSelectedWarehouseId(w.id)}
                  className={`flex-1 whitespace-nowrap text-sm font-medium py-2 px-3 rounded-xl transition-colors flex items-center justify-center gap-1.5 ${
                    selectedWarehouseId === w.id
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {w.name} ({w.code})
                  {pending > 0 && (
                    <span className="min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                      {pending}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700">Daftar Produk</p>
            <p className="text-xs text-gray-400">{items.length} produk</p>
          </div>
          <div className="divide-y divide-gray-100">
            {items
              .filter(item =>
                selectedWarehouseId === null ||
                !item.products ||
                (productWarehouseMap[item.products.id] ?? []).includes(selectedWarehouseId)
              )
              .map(item => {
                const key = `${item.id}_${selectedWarehouseId}`
                const counted = countedStockMap[key]
                const hasCounted = counted !== undefined
                const isConfirmed = session?.status === 'confirmed'
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <p className="text-sm text-gray-700 flex-1 min-w-0 truncate">{item.products?.name ?? '-'}</p>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${hasCounted ? 'text-gray-800' : 'text-gray-300'}`}>
                          {hasCounted ? counted : '-'}
                        </p>
                        <p className="text-[10px] text-gray-400">stok</p>
                      </div>
                      {!isConfirmed && (
                        <button
                          onClick={() => openEdit(item)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors"
                        >
                          <FontAwesomeIcon icon={faPen} className="w-3 h-3 text-gray-400" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>

        {session.status === 'confirmed' ? (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2">
            <span className="text-green-600 text-sm font-semibold">✓ Opname Selesai</span>
            <span className="text-green-500 text-xs">Stok warehouse telah diperbarui.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {confirmError && (
              <p className="text-xs text-red-500 px-1">{confirmError}</p>
            )}
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="w-full bg-[#121358] hover:bg-[#1a1c6e] disabled:bg-[#121358]/40 text-white font-semibold py-3 rounded-xl text-sm transition"
            >
              {confirming ? 'Memproses...' : 'Konfirmasi Selesai'}
            </button>
          </div>
        )}
      </div>

      {editingItem && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-sm font-bold text-gray-800">{editingItem.products?.name}</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Hitung stok per warehouse | {warehouses.find(w => w.id === selectedWarehouseId)?.name}
                </p>
              </div>
              <button onClick={() => setEditingItem(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <FontAwesomeIcon icon={faXmark} className="w-4 h-4" />
              </button>
            </div>

            {editLoading ? (
              <p className="text-xs text-gray-400 text-center py-4">Memuat...</p>
            ) : (
              <>
                <input
                  type="number"
                  inputMode="decimal"
                  value={editStock}
                  onChange={e => setEditStock(e.target.value)}
                  placeholder="0"
                  autoFocus
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#121358]"
                />

                {editError && <p className="text-xs text-red-500">{editError}</p>}
                {editSaved && <p className="text-xs text-green-600">✓ Tersimpan.</p>}

                <button
                  onClick={handleEditSave}
                  disabled={editSaving}
                  className="w-full bg-[#121358] text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-40 transition"
                >
                  {editSaving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
