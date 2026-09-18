'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons'

type SalesRow = {
  product_id: number
  product_name: string
  category_id: number | null
  category_name: string | null
  total_qty: number
  total_revenue: number
}

type DeadStockRow = {
  product_id: number
  product_name: string
  category_name: string | null
  stock: number
}

const OVERSTOCK_MULTIPLE = 3
const DEAD_STOCK_CANDIDATE_LIMIT = 15

const fmt = (n: number) => Math.round(n).toLocaleString('id-ID')

// Validated categorical palette (dataviz skill) — fixed order, never cycled/reassigned by rank churn.
const CATEGORY_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4']
const OTHER_COLOR = '#898781'
const TRACK_COLOR = '#e1e0d9'

const RADIUS = 80
const STROKE = 26
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const SEGMENT_GAP = 3

export default function LaporanPenjualanProdukPage() {
  const supabase = createClient()
  const [calMonth, setCalMonth] = useState(() => new Date())
  const [rows, setRows] = useState<SalesRow[]>([])
  const [stockMap, setStockMap] = useState<Record<number, number>>({})
  const [deadStock, setDeadStock] = useState<DeadStockRow[]>([])
  const [fetching, setFetching] = useState(true)

  const now = new Date()
  const isCurrentMonth = calMonth.getFullYear() === now.getFullYear() && calMonth.getMonth() === now.getMonth()

  useEffect(() => {
    const fetchData = async () => {
      setFetching(true)
      const y = calMonth.getFullYear()
      const m = calMonth.getMonth()
      const from = `${y}-${String(m + 1).padStart(2, '0')}-01`
      const lastDay = new Date(y, m + 1, 0).getDate()
      const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

      const [{ data: salesData }, { data: stockData }] = await Promise.all([
        supabase.rpc('get_product_sales_report', { p_date_from: from, p_date_to: to }),
        supabase.from('stock_batches').select('product_id, qty_remaining').eq('is_available', true),
      ])

      const sales = (salesData as SalesRow[]) ?? []
      setRows(sales)

      const map: Record<number, number> = {}
      for (const b of (stockData ?? []) as { product_id: number; qty_remaining: number }[]) {
        map[b.product_id] = (map[b.product_id] ?? 0) + b.qty_remaining
      }
      setStockMap(map)

      // Products with stock on hand but zero sales this month — candidates for "dead stock".
      const soldIds = new Set(sales.map(r => r.product_id))
      const deadStockCandidateIds = Object.entries(map)
        .filter(([id, qty]) => qty > 0 && !soldIds.has(Number(id)))
        .sort((a, b) => b[1] - a[1])
        .slice(0, DEAD_STOCK_CANDIDATE_LIMIT)
        .map(([id]) => Number(id))

      if (deadStockCandidateIds.length > 0) {
        const { data: productsData } = await supabase
          .from('products')
          .select('id, name, categories(name)')
          .in('id', deadStockCandidateIds)
        const products = (productsData ?? []) as { id: number; name: string; categories: { name: string } | null }[]
        setDeadStock(products.map(p => ({
          product_id: p.id,
          product_name: p.name,
          category_name: p.categories?.name ?? null,
          stock: map[p.id] ?? 0,
        })))
      } else {
        setDeadStock([])
      }

      setFetching(false)
    }
    fetchData()
  }, [calMonth])

  const totalRevenue = rows.reduce((s, r) => s + r.total_revenue, 0)
  const totalQty = rows.reduce((s, r) => s + r.total_qty, 0)
  const best = rows[0]

  // Ring segments — top 5 categories by revenue this month, rest folded into "Lainnya".
  const categoryTotals = (() => {
    const map = new Map<string, number>()
    for (const r of rows) {
      const key = r.category_name ?? 'Tanpa Kategori'
      map.set(key, (map.get(key) ?? 0) + r.total_revenue)
    }
    const sorted = [...map.entries()].sort((a, b) => b[1] - a[1])
    const top = sorted.slice(0, 5)
    const restSum = sorted.slice(5).reduce((s, [, v]) => s + v, 0)
    const segments = top.map(([name, value], i) => ({ name, value, color: CATEGORY_COLORS[i] }))
    if (restSum > 0) segments.push({ name: 'Lainnya', value: restSum, color: OTHER_COLOR })
    return segments
  })()

  const arcs = categoryTotals.reduce<{ name: string; value: number; color: string; length: number; offset: number; pct: number }[]>(
    (acc, seg) => {
      const fraction = totalRevenue > 0 ? seg.value / totalRevenue : 0
      const length = Math.max(fraction * CIRCUMFERENCE - SEGMENT_GAP, 0)
      const offset = acc.length > 0 ? acc[acc.length - 1].offset + (acc[acc.length - 1].pct / 100) * CIRCUMFERENCE : 0
      return [...acc, { ...seg, length, offset, pct: fraction * 100 }]
    },
    []
  )

  // Products that sold this month but have less than half a month's worth of stock left.
  const restockCandidates = rows
    .filter(r => r.total_qty > 0 && (stockMap[r.product_id] ?? 0) < r.total_qty * 0.5)
    .sort((a, b) => b.total_qty - a.total_qty)

  // Slow-moving: sold but stock is far more than this month's pace (overstock), or not sold at all (dead stock).
  const overstockCandidates = rows.filter(r => r.total_qty > 0 && (stockMap[r.product_id] ?? 0) >= r.total_qty * OVERSTOCK_MULTIPLE)
  const overstockIds = new Set(overstockCandidates.map(r => r.product_id))

  const slowMovers = [
    ...deadStock.map(d => ({ product_id: d.product_id, product_name: d.product_name, stock: d.stock, qty_sold: 0 })),
    ...overstockCandidates.map(r => ({ product_id: r.product_id, product_name: r.product_name, stock: stockMap[r.product_id] ?? 0, qty_sold: r.total_qty })),
  ].sort((a, b) => {
    const coverA = a.qty_sold > 0 ? a.stock / a.qty_sold : Infinity
    const coverB = b.qty_sold > 0 ? b.stock / b.qty_sold : Infinity
    return coverB - coverA
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-2xl mx-auto space-y-4">

        <div>
          <h2 className="text-lg font-bold text-gray-800">Laporan Penjualan Produk</h2>
          <p className="text-xs text-gray-500 mt-0.5">Ringkasan penjualan & rekomendasi order barang.</p>
        </div>

        {/* Month nav */}
        <div className="bg-white rounded-2xl shadow-sm px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setCalMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-[#121358]/10 hover:bg-[#121358]/20 text-[#121358] transition"
          >
            <FontAwesomeIcon icon={faChevronLeft} className="w-3 h-3" />
          </button>
          <p className="text-sm font-semibold text-gray-800">
            {calMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
          </p>
          <button
            onClick={() => setCalMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            disabled={isCurrentMonth}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-[#121358]/10 hover:bg-[#121358]/20 text-[#121358] disabled:opacity-30 transition"
          >
            <FontAwesomeIcon icon={faChevronRight} className="w-3 h-3" />
          </button>
        </div>

        {fetching ? (
          <div className="text-center text-sm text-gray-400 py-10">Memuat data...</div>
        ) : rows.length === 0 && slowMovers.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-10">Belum ada penjualan pada bulan ini.</div>
        ) : (
          <>
            {/* Donut chart */}
            {rows.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <div className="relative w-48 h-48 mx-auto">
                <svg viewBox="0 0 200 200" className="w-48 h-48 -rotate-90">
                  <circle cx="100" cy="100" r={RADIUS} fill="none" stroke={TRACK_COLOR} strokeWidth={STROKE} />
                  {arcs.map(a => (
                    <circle
                      key={a.name}
                      cx="100" cy="100" r={RADIUS}
                      fill="none"
                      stroke={a.color}
                      strokeWidth={STROKE}
                      strokeDasharray={`${a.length} ${CIRCUMFERENCE - a.length}`}
                      strokeDashoffset={-a.offset}
                      strokeLinecap="round"
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
                  <p className="text-[10px] text-gray-500">Total Penjualan</p>
                  <p className="text-base font-bold text-[#121358] mt-0.5">Rp {fmt(totalRevenue)}</p>
                </div>
              </div>

              {/* Legend */}
              <div className="space-y-1.5 mt-5">
                {arcs.map(seg => (
                  <div key={seg.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                      <span className="text-gray-700 truncate">{seg.name}</span>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <span className="text-gray-400 mr-2">{Math.round(seg.pct)}%</span>
                      <span className="font-semibold text-gray-700">Rp {fmt(seg.value)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <a href="#detail-produk" className="block text-center text-xs font-semibold text-[#121358] mt-4 hover:underline">
                Lihat Detail Penjualan →
              </a>
            </div>
            )}

            {/* Statement / order-decision card */}
            <div className="rounded-2xl px-4 py-4 space-y-2" style={{ backgroundColor: '#121358' }}>
              <p className="text-xs font-semibold" style={{ color: '#B5BAFF' }}>Ringkasan & Rekomendasi Order</p>
              <p className="text-sm text-white">
                {rows.length > 0
                  ? `Bulan ini terjual ${fmt(totalQty)} unit dari ${rows.length} produk, total Rp ${fmt(totalRevenue)}.`
                  : 'Belum ada penjualan pada bulan ini.'}
                {best && ` Produk terlaris: ${best.product_name} (${fmt(best.total_qty)} unit, Rp ${fmt(best.total_revenue)}).`}
              </p>
              {restockCandidates.length > 0 ? (
                <div className="pt-2 border-t border-white/10 space-y-1">
                  <p className="text-xs font-semibold text-amber-300">⚠ {restockCandidates.length} produk berpotensi kehabisan stok</p>
                  {restockCandidates.slice(0, 5).map(r => (
                    <div key={r.product_id} className="flex items-center justify-between gap-2 py-1 border-b border-white/10 last:border-0">
                      <p className="text-xs truncate" style={{ color: '#B5BAFF' }}>{r.product_name}</p>
                      <p className="text-xs font-semibold text-amber-300 shrink-0">
                        terjual {fmt(r.total_qty)} · sisa {fmt(stockMap[r.product_id] ?? 0)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : rows.length > 0 ? (
                <p className="text-xs" style={{ color: '#B5BAFF' }}>✓ Stok produk terlaris masih aman bulan ini.</p>
              ) : null}
              {slowMovers.length > 0 && (
                <div className="pt-2 border-t border-white/10 space-y-1">
                  <p className="text-xs font-semibold text-gray-300">📦 {slowMovers.length} produk pergerakannya lambat — pertimbangkan kurangi/tunda order</p>
                  {slowMovers.slice(0, 5).map(r => (
                    <div key={r.product_id} className="flex items-center justify-between gap-2 py-1 border-b border-white/10 last:border-0">
                      <p className="text-xs truncate" style={{ color: '#B5BAFF' }}>{r.product_name}</p>
                      <p className="text-xs font-semibold text-gray-300 shrink-0">
                        {r.qty_sold > 0 ? `terjual ${fmt(r.qty_sold)}` : 'belum terjual'} · sisa {fmt(r.stock)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Detail table */}
            {rows.length > 0 && (
            <div id="detail-produk" className="scroll-mt-20 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">Detail Per Produk</p>
              {rows.map(r => {
                const stock = stockMap[r.product_id] ?? 0
                const needsRestock = r.total_qty > 0 && stock < r.total_qty * 0.5
                const isSlowMoving = overstockIds.has(r.product_id)
                const badge = needsRestock
                  ? { label: 'Segera Order', className: 'bg-red-100 text-red-600' }
                  : isSlowMoving
                  ? { label: 'Slow Moving', className: 'bg-amber-100 text-amber-600' }
                  : { label: 'Aman', className: 'bg-green-100 text-green-600' }
                return (
                  <div key={r.product_id} className="bg-white rounded-2xl shadow-sm px-4 py-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{r.product_name}</p>
                        <p className="text-xs text-gray-400">{r.category_name ?? 'Tanpa Kategori'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-[#121358]">Rp {fmt(r.total_revenue)}</p>
                        <p className="text-xs text-gray-400">{fmt(r.total_qty)} terjual</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-gray-500">Sisa stok: <span className="font-semibold text-gray-700">{fmt(stock)}</span></p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
            )}
          </>
        )}

      </div>
    </div>
  )
}
