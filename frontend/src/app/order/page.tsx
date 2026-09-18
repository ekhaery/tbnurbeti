'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import ReceiveDeliveryOrderModal from '@/components/ReceiveDeliveryOrderModal'

type OrderItem = { id: number; qty: number; base_price: number; products: { name: string } | null }
type Order = {
  id: number
  code: string
  date: string
  supplier_id: number
  suppliers: { name: string } | null
  purchasing_items: OrderItem[]
}
type Warehouse = { id: number; name: string; code: string }

export default function OrderPage() {
  const supabase = createClient()
  const [list, setList] = useState<Order[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [fetching, setFetching] = useState(true)
  const [selected, setSelected] = useState<Order | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const fetchData = async () => {
    const { data } = await supabase
      .from('purchasing')
      .select('id, code, date, supplier_id, suppliers(name), purchasing_items(id, qty, base_price, products(name))')
      .eq('status', 'created')
      .order('date', { ascending: true })
    setList((data as Order[]) ?? [])
    setFetching(false)
  }

  useEffect(() => {
    fetchData()
    supabase.from('warehouses').select('id, name, code').eq('is_active', true).order('name')
      .then(({ data }: { data: Warehouse[] | null }) => setWarehouses(data ?? []))
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-xl mx-auto space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Order</h2>
          <p className="text-xs text-gray-500 mt-0.5">{fetching ? '...' : `${list.length} pesanan menunggu barang`}</p>
        </div>

        {fetching ? (
          <div className="text-center text-sm text-gray-400 py-10">Memuat...</div>
        ) : list.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-10">Tidak ada pesanan yang menunggu barang.</div>
        ) : (
          <div className="space-y-2">
            {list.map(p => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className="w-full bg-white rounded-xl shadow-sm px-4 py-3 text-left transition hover:bg-gray-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{p.suppliers?.name ?? '-'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(p.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#121358]/10 text-[#121358] font-mono shrink-0">
                    {p.code}
                  </span>
                </div>
                <div className="mt-2 space-y-0.5">
                  {p.purchasing_items.map(item => (
                    <p key={item.id} className="text-xs text-gray-600 truncate">
                      · {item.products?.name ?? '-'} <span className="text-gray-400">({item.qty})</span>
                    </p>
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <ReceiveDeliveryOrderModal
          purchasing={selected}
          warehouses={warehouses}
          onClose={() => setSelected(null)}
          onReceived={() => { showToast('Barang diterima. Stok diupdate.'); fetchData() }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white text-xs font-medium px-4 py-2.5 rounded-xl shadow-lg whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  )
}
