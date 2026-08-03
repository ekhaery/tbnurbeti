'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons'

type Item = {
  id: number
  products: { id: number; name: string } | null
}

type Warehouse = { id: number; name: string; code: string }

export default function StokOpnameItemPage() {
  const supabase = createClient()
  const { id, itemId } = useParams()
  const router = useRouter()

  const [item, setItem] = useState<Item | null>(null)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [activeWarehouseId, setActiveWarehouseId] = useState<number | null>(null)
  const [counts, setCounts] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('stock_opname_items')
      .select('id, products(id, name)')
      .eq('id', itemId)
      .single()
      .then(async ({ data: itemRow }: { data: Item | null }) => {
        setItem(itemRow)
        if (!itemRow?.products) {
          setLoading(false)
          return
        }

        const [{ data: warehouseLinks }, { data: existingCounts }] = await Promise.all([
          supabase
            .from('product_warehouse')
            .select('warehouses(id, name, code)')
            .eq('product_id', itemRow.products.id),
          supabase
            .from('stock_opname_item_warehouses')
            .select('warehouse_id, counted_stock')
            .eq('item_id', itemId),
        ])

        const whs = ((warehouseLinks ?? []) as unknown as { warehouses: Warehouse | null }[])
          .map(r => r.warehouses)
          .filter((w): w is Warehouse => w !== null)
        setWarehouses(whs)
        setActiveWarehouseId(whs[0]?.id ?? null)

        const initialCounts: Record<number, string> = {}
        for (const c of (existingCounts ?? []) as { warehouse_id: number; counted_stock: number }[]) {
          initialCounts[c.warehouse_id] = String(c.counted_stock)
        }
        setCounts(initialCounts)
        setLoading(false)
      })
  }, [itemId])

  const total = warehouses.reduce((sum, w) => sum + (parseFloat(counts[w.id]) || 0), 0)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)

    const rows = warehouses.map(w => ({
      item_id: Number(itemId),
      warehouse_id: w.id,
      counted_stock: parseFloat(counts[w.id]) || 0,
    }))

    const { error: upsertErr } = await supabase
      .from('stock_opname_item_warehouses')
      .upsert(rows, { onConflict: 'item_id,warehouse_id' })

    setSaving(false)
    if (upsertErr) {
      setError(upsertErr.message)
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
        Memuat...
      </div>
    )
  }

  if (!item?.products) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
        Item tidak ditemukan.
      </div>
    )
  }

  const activeWarehouse = warehouses.find(w => w.id === activeWarehouseId) ?? null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
          <FontAwesomeIcon icon={faChevronLeft} className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-base font-bold text-gray-800">{item.products.name}</h1>
          <p className="text-xs text-gray-400">Hitung stok per warehouse</p>
        </div>
      </div>

      <div className="px-4 py-4 max-w-xl mx-auto space-y-4">
        {warehouses.length === 0 ? (
          <p className="text-sm text-gray-400 text-center mt-12">
            Produk ini belum terhubung ke warehouse manapun. Atur di Masterdata &gt; Warehouse.
          </p>
        ) : (
          <>
            <div className="bg-white rounded-2xl shadow-sm p-1 flex gap-1 overflow-x-auto">
              {warehouses.map(w => (
                <button
                  key={w.id}
                  onClick={() => setActiveWarehouseId(w.id)}
                  className={`flex-1 whitespace-nowrap text-center text-sm font-medium py-2 px-3 rounded-xl transition-colors ${
                    activeWarehouseId === w.id
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-200 sm:bg-transparent text-slate-500 sm:hover:bg-slate-200'
                  }`}
                >
                  {w.name} ({w.code})
                </button>
              ))}
            </div>

            {activeWarehouse && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <label className="block text-xs text-gray-500 mb-1">
                  Stok Fisik di {activeWarehouse.name} ({activeWarehouse.code})
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={counts[activeWarehouse.id] ?? ''}
                  onChange={e =>
                    setCounts(prev => ({ ...prev, [activeWarehouse.id]: e.target.value }))
                  }
                  placeholder="0"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#121358]"
                />
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm overflow-hidden divide-y divide-gray-100">
              <div className="px-4 py-3 flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700">Total Semua Warehouse</p>
                <p className="text-sm font-bold text-gray-800">{total.toLocaleString('id-ID')}</p>
              </div>
              {warehouses.map(w => (
                <div key={w.id} className="px-4 py-2 flex items-center justify-between">
                  <p className="text-xs text-gray-500">{w.name} ({w.code})</p>
                  <p className="text-xs text-gray-700">{(parseFloat(counts[w.id]) || 0).toLocaleString('id-ID')}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
              {saved && <p className="text-xs text-green-600">✓ Perubahan tersimpan.</p>}
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-[#121358] text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-40 transition"
              >
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
