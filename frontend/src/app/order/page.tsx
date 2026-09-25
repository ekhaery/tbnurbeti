'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '@/context/AuthContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPen, faTrash } from '@fortawesome/free-solid-svg-icons'
import ReceiveDeliveryOrderModal from '@/components/ReceiveDeliveryOrderModal'
import EditOrderModal from '@/components/EditOrderModal'
import { logActivity, USER_ACTIVITY } from '@/lib/userActivity'

type OrderItem = {
  id: number
  qty: number
  base_price: number
  unit_of_measurement_id: number | null
  entered_qty: number | null
  receipt_id: number | null
  products: { name: string; unit_of_measurement_id: number | null; unit_of_measurements: { abbreviation: string } | null } | null
  unit_of_measurements: { abbreviation: string } | null
}
type Order = {
  id: number
  code: string
  date: string
  notes: string | null
  supplier_id: number
  suppliers: { name: string } | null
  purchasing_items: OrderItem[]
}
type Warehouse = { id: number; name: string; code: string }

export default function OrderPage() {
  const supabase = createClient()
  const { appUser } = useAuth()
  const isAdmin = appUser?.role === 'admin'
  const [list, setList] = useState<Order[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [fetching, setFetching] = useState(true)
  const [selected, setSelected] = useState<Order | null>(null)
  const [editing, setEditing] = useState<Order | null>(null)
  const [deleting, setDeleting] = useState<Order | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const fetchData = async () => {
    const { data } = await supabase
      .from('purchasing')
      .select('id, code, date, notes, supplier_id, suppliers(name), purchasing_items(id, qty, base_price, unit_of_measurement_id, entered_qty, receipt_id, products(name, unit_of_measurement_id, unit_of_measurements(abbreviation)), unit_of_measurements(abbreviation))')
      .in('status', ['created', 'partial'])
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

  // Deleting cascades to purchasing_items → stock_batches, so an order with any
  // received line would also wipe stock that already arrived. Only fully pending
  // orders can be deleted; pending lines of a partial order are removed via Edit.
  const hasReceived = (o: Order) => o.purchasing_items.some(i => i.receipt_id != null)

  // "3 dus (72 biji)" when ordered in an alternate unit, else "72 biji" / "72"
  const qtyLabel = (item: OrderItem) => {
    const baseAbbr = item.products?.unit_of_measurements?.abbreviation ?? ''
    const base = `${item.qty}${baseAbbr ? ' ' + baseAbbr : ''}`
    const altAbbr = item.unit_of_measurements?.abbreviation
    const isAlt = item.entered_qty != null && item.entered_qty > 0 && altAbbr
      && item.unit_of_measurement_id !== item.products?.unit_of_measurement_id
    return isAlt ? `${item.entered_qty} ${altAbbr} (${base})` : base
  }

  const handleDelete = async () => {
    if (!deleting) return
    setConfirmingDelete(true)
    const { data: deleted, error } = await supabase.from('purchasing')
      .delete().eq('id', deleting.id).eq('status', 'created').select('id')
    setConfirmingDelete(false)
    if (error) { showToast(`Gagal menghapus: ${error.message}`); return }
    if (!deleted || deleted.length === 0) { showToast('Order tidak bisa dihapus (sudah ada barang diterima).'); setDeleting(null); fetchData(); return }
    await logActivity(supabase, appUser?.id, USER_ACTIVITY.DELETE_ORDER(appUser?.name ?? 'User', deleting.code, deleting.suppliers?.name ?? '-'))
    setDeleting(null)
    showToast('Order berhasil dihapus.')
    fetchData()
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
              <div key={p.id} className="bg-white rounded-xl shadow-sm transition hover:bg-gray-50">
                <button
                  onClick={() => setSelected(p)}
                  className="w-full px-4 pt-3 pb-3 text-left"
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
                        · {item.products?.name ?? '-'} <span className="text-gray-400">({qtyLabel(item)})</span>
                      </p>
                    ))}
                  </div>
                </button>
                {isAdmin && (
                  <div className="flex justify-end gap-2 px-4 pb-3 -mt-1">
                    <button type="button" onClick={() => setEditing(p)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#121358]/10 hover:bg-[#121358]/20 text-[#121358] text-xs font-semibold transition">
                      <FontAwesomeIcon icon={faPen} className="w-3 h-3" /> Edit
                    </button>
                    <button type="button" onClick={() => setDeleting(p)} disabled={hasReceived(p)}
                      title={hasReceived(p) ? 'Sebagian barang sudah diterima — hapus produk yang belum datang lewat Edit' : undefined}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed">
                      <FontAwesomeIcon icon={faTrash} className="w-3 h-3" /> Hapus
                    </button>
                  </div>
                )}
              </div>
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

      {editing && (
        <EditOrderModal
          order={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); showToast('Order berhasil diupdate.'); fetchData() }}
        />
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-5 space-y-4">
            <div>
              <p className="text-sm font-bold text-gray-800">Hapus order?</p>
              <p className="text-xs text-gray-500 mt-1">
                Order <span className="font-mono font-semibold">{deleting.code}</span> dari {deleting.suppliers?.name ?? '-'} ({deleting.purchasing_items.length} produk) akan dihapus permanen.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleting(null)} disabled={confirmingDelete}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">
                Batal
              </button>
              <button onClick={handleDelete} disabled={confirmingDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white text-sm font-semibold transition">
                {confirmingDelete ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white text-xs font-medium px-4 py-2.5 rounded-xl shadow-lg whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  )
}
