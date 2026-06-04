'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark, faBoxOpen, faCheck } from '@fortawesome/free-solid-svg-icons'
import PurchasingTabs from '@/lib/PurchasingTabs'
import { getArrivalStatus, ARRIVAL_STATUS } from '@/lib/arrivalStatus'

type StockBatch = {
  id: number
  is_available: boolean
}

type PurchasingItem = {
  id: number
  qty: number
  base_price: number
  products: { name: string } | null
  stock_batches: StockBatch[]
}

type Purchasing = {
  id: number
  code: string
  date: string
  notes: string | null
  period: number
  total: number
  suppliers: { name: string } | null
  purchasing_items: PurchasingItem[]
}

const fmt = (n: number) => n.toLocaleString('id-ID')

export default function RiwayatPurchasingPage() {
  const supabase = createClient()
  const [list, setList] = useState<Purchasing[]>([])
  const [fetching, setFetching] = useState(true)
  const [selected, setSelected] = useState<Purchasing | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [doneMsg, setDoneMsg] = useState(false)

  const fetchData = async () => {
    const { data } = await supabase
      .from('purchasing')
      .select('id, code, date, notes, period, total, suppliers(name), purchasing_items(id, qty, base_price, products(name), stock_batches(id, is_available))')
      .order('date', { ascending: false })
    setList((data as Purchasing[]) ?? [])
    setFetching(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleMarkAvailable = async () => {
    if (!selected) return
    setConfirming(true)

    const batchIds = selected.purchasing_items.flatMap(i => i.stock_batches.map(b => b.id))
    const { error } = await supabase
      .from('stock_batches')
      .update({ is_available: true })
      .in('id', batchIds)

    setConfirming(false)
    if (error) return

    setDoneMsg(true)
    setTimeout(() => {
      setDoneMsg(false)
      setSelected(null)
      fetchData()
    }, 1500)
  }

  const status = selected ? getArrivalStatus(selected.purchasing_items) : null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-xl mx-auto space-y-4">
        <PurchasingTabs />

        <div>
          <h2 className="text-lg font-bold text-gray-800">Riwayat Purchasing</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {fetching ? '...' : `${list.length} purchasing`}
          </p>
        </div>

        {fetching ? (
          <div className="text-center text-sm text-gray-400 py-10">Memuat...</div>
        ) : list.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-10">Belum ada purchasing.</div>
        ) : (
          <div className="space-y-2">
            {list.map(p => {
              const arrivalStatus = getArrivalStatus(p.purchasing_items)
              return (
                <button
                  key={p.id}
                  onClick={() => { setSelected(p); setDoneMsg(false) }}
                  className="w-full bg-white rounded-xl shadow-sm px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-800 font-mono">{p.code}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {p.suppliers?.name ?? '-'} · {new Date(p.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {p.period > 0 && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600">
                          Bayar {p.period} bln
                        </span>
                      )}
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ARRIVAL_STATUS[arrivalStatus].className}`}>
                        {ARRIVAL_STATUS[arrivalStatus].label}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-[#121358]">Rp {fmt(p.total)}</p>
                    <p className="text-xs text-gray-400">{p.purchasing_items.length} produk</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">

            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3" style={{ backgroundColor: '#9FA1FF' }}>
              <div>
                <p className="text-sm font-bold text-white font-mono">{selected.code}</p>
                <p className="text-xs text-[#121358]/70 mt-0.5">
                  {selected.suppliers?.name ?? '-'} · {new Date(selected.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-[#121358]/10 hover:bg-[#121358]/20 text-[#121358] transition shrink-0"
              >
                <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Items */}
            <div className="max-h-52 overflow-y-auto divide-y divide-gray-50">
              {selected.purchasing_items.map(item => (
                <div key={item.id} className="flex items-center justify-between px-5 py-2.5">
                  <div>
                    <p className="text-sm text-gray-700">{item.products?.name ?? '-'}</p>
                    <p className="text-xs text-gray-400">Qty: {item.qty}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">@ Rp {fmt(item.base_price)}</p>
                    <p className="text-sm font-semibold text-gray-700">Rp {fmt(item.qty * item.base_price)}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="px-5 py-3 bg-gray-50 flex justify-between items-center">
              <span className="text-xs text-gray-500">Total</span>
              <span className="text-sm font-bold text-[#121358]">Rp {fmt(selected.total)}</span>
            </div>

            {/* Arrival section */}
            <div className="px-5 py-4 border-t border-gray-100">
              {doneMsg ? (
                <div className="flex items-center justify-center gap-2 py-2 text-green-600">
                  <FontAwesomeIcon icon={faCheck} className="w-4 h-4" />
                  <span className="text-sm font-semibold">Stok telah diupdate</span>
                </div>
              ) : status === 'arrived' ? (
                <div className="flex items-center justify-center gap-2 py-2 text-green-600">
                  <FontAwesomeIcon icon={faCheck} className="w-4 h-4" />
                  <span className="text-sm font-semibold">Semua produk sudah tiba di toko</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <FontAwesomeIcon icon={faBoxOpen} className="w-4 h-4" style={{ color: '#9FA1FF' }} />
                    <p className="text-sm text-gray-700 font-medium">Apakah produk sudah ready di toko?</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelected(null)}
                      className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition"
                    >
                      Belum
                    </button>
                    <button
                      onClick={handleMarkAvailable}
                      disabled={confirming}
                      className="flex-1 py-2.5 rounded-xl bg-[#121358] hover:bg-[#1a1c6e] disabled:bg-[#121358]/40 text-white text-sm font-semibold transition"
                    >
                      {confirming ? 'Menyimpan...' : 'Sudah'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
