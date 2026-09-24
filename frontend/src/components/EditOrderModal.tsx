'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark, faTrash, faRotateLeft } from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '@/context/AuthContext'
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
type Supplier = { id: number; name: string }
type ItemInput = {
  id: number
  name: string
  unitLabel: string
  baseAbbr: string
  // Base units per 1 of the unit the order was entered in (1 when no alternate unit)
  factor: number
  hasEnteredUnit: boolean
  qty: string
  removed: boolean
}

// Admin-only editor for an order still waiting for goods. Only lines not yet
// received (receipt_id null) can be changed or removed — received lines already
// have stock_batches behind them and are shown read-only.
export default function EditOrderModal({
  order,
  onClose,
  onSaved,
}: {
  order: Order
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const { appUser } = useAuth()

  const receivedItems = order.purchasing_items.filter(i => i.receipt_id != null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [supplierId, setSupplierId] = useState<number>(order.supplier_id)
  const [date, setDate] = useState(order.date)
  const [notes, setNotes] = useState(order.notes ?? '')
  const [items, setItems] = useState<ItemInput[]>(
    order.purchasing_items.filter(i => i.receipt_id == null).map(i => {
      const baseAbbr = i.products?.unit_of_measurements?.abbreviation ?? ''
      const hasEnteredUnit = i.unit_of_measurement_id != null && i.entered_qty != null && i.entered_qty > 0
      return {
        id: i.id,
        name: i.products?.name ?? '-',
        unitLabel: hasEnteredUnit ? (i.unit_of_measurements?.abbreviation ?? baseAbbr) : baseAbbr,
        baseAbbr,
        factor: hasEnteredUnit ? i.qty / i.entered_qty! : 1,
        hasEnteredUnit,
        qty: String(hasEnteredUnit ? i.entered_qty : i.qty),
        removed: false,
      }
    })
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('suppliers').select('id, name').order('name')
      .then(({ data }: { data: Supplier[] | null }) => setSuppliers(data ?? []))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateQty = (idx: number, value: string) =>
    setItems(prev => prev.map((row, i) => i === idx ? { ...row, qty: value } : row))
  const toggleRemoved = (idx: number) =>
    setItems(prev => prev.map((row, i) => i === idx ? { ...row, removed: !row.removed } : row))

  const baseQtyFor = (i: ItemInput) => (parseFloat(i.qty) || 0) * i.factor
  const keptItems = items.filter(i => !i.removed)
  const removedItems = items.filter(i => i.removed)

  const handleSave = async () => {
    setError(null)
    if (!date) { setError('Tanggal wajib diisi.'); return }
    if (keptItems.length === 0 && receivedItems.length === 0) {
      setError('Semua produk dihapus. Gunakan tombol Hapus untuk menghapus order ini.')
      return
    }
    const badQty = keptItems.find(i => !(parseFloat(i.qty) > 0))
    if (badQty) { setError(`Qty ${badQty.name} harus lebih dari 0.`); return }
    // purchasing_items.qty is an integer in the base unit, same rule as purchasing/buat
    const fractional = keptItems.find(i => Math.abs(baseQtyFor(i) - Math.round(baseQtyFor(i))) > 1e-6)
    if (fractional) {
      setError(`Qty ${fractional.name} menghasilkan pecahan (${baseQtyFor(fractional)}) setelah dikonversi ke ${fractional.baseAbbr || 'unit dasar'}.`)
      return
    }

    setSaving(true)
    if (removedItems.length > 0) {
      const { error: delErr } = await supabase.from('purchasing_items')
        .delete().in('id', removedItems.map(i => i.id)).is('receipt_id', null)
      if (delErr) { setSaving(false); setError(delErr.message); return }
    }
    for (const i of keptItems) {
      const { error: itemErr } = await supabase.from('purchasing_items')
        .update({
          qty: Math.round(baseQtyFor(i)),
          ...(i.hasEnteredUnit ? { entered_qty: parseFloat(i.qty) } : {}),
        })
        .eq('id', i.id).is('receipt_id', null)
      if (itemErr) { setSaving(false); setError(itemErr.message); return }
    }

    // Removing the last pending lines of a partially received order completes it
    const { data: remaining } = await supabase.from('purchasing_items')
      .select('qty, base_price, receipt_id').eq('purchasing_id', order.id)
    const rows = (remaining ?? []) as { qty: number; base_price: number; receipt_id: number | null }[]
    const total = rows.reduce((sum, r) => sum + r.qty * (r.base_price || 0), 0)
    const hasPending = rows.some(r => r.receipt_id == null)

    const { error: purErr } = await supabase.from('purchasing')
      .update({
        supplier_id: supplierId,
        date,
        notes: notes.trim() || null,
        total,
        ...(hasPending ? {} : { status: 'completed' }),
      })
      .eq('id', order.id)
    setSaving(false)
    if (purErr) { setError(purErr.message); return }

    await logActivity(supabase, appUser?.id, USER_ACTIVITY.EDIT_PURCHASING(appUser?.name ?? 'User', order.code, total))
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3" style={{ backgroundColor: '#9FA1FF' }}>
          <div>
            <p className="text-sm font-bold text-white">Edit Order</p>
            <p className="text-xs text-white/70 mt-0.5 font-mono">{order.code}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition shrink-0">
            <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Supplier</label>
            <select value={supplierId} onChange={e => setSupplierId(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#121358]">
              {suppliers.length === 0 && <option value={order.supplier_id}>{order.suppliers?.name ?? '-'}</option>}
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tanggal</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Catatan</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opsional"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
          </div>

          <div className="pt-1">
            <p className="text-xs font-semibold text-gray-600 mb-2">Produk belum diterima</p>
            {items.length === 0 && <p className="text-xs text-gray-400">Tidak ada.</p>}
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={item.id} className={`flex items-center gap-2 ${item.removed ? 'opacity-40' : ''}`}>
                  <span className={`flex-1 min-w-0 text-sm text-gray-700 truncate ${item.removed ? 'line-through' : ''}`}>{item.name}</span>
                  <input type="number" value={item.qty} min="0" step="any" disabled={item.removed}
                    onChange={e => updateQty(idx, e.target.value)}
                    className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#121358] disabled:bg-gray-50" />
                  <span className="w-10 text-xs text-gray-400 shrink-0">{item.unitLabel}</span>
                  <button type="button" onClick={() => toggleRemoved(idx)}
                    title={item.removed ? 'Batal hapus' : 'Hapus produk'}
                    className={`w-7 h-7 flex items-center justify-center rounded-full shrink-0 transition ${item.removed ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' : 'bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-500'}`}>
                    <FontAwesomeIcon icon={item.removed ? faRotateLeft : faTrash} className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {receivedItems.length > 0 && (
            <div className="pt-1">
              <p className="text-xs font-semibold text-gray-600 mb-1">Sudah diterima (tidak bisa diubah)</p>
              {receivedItems.map(i => (
                <p key={i.id} className="text-xs text-gray-400">· {i.products?.name ?? '-'} ({i.qty} {i.products?.unit_of_measurements?.abbreviation ?? ''})</p>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 space-y-2">
          {error && <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">⚠️ {error}</div>}
          <button onClick={handleSave} disabled={saving}
            className="w-full py-2.5 rounded-xl bg-[#121358] hover:bg-[#1a1c6e] disabled:bg-[#121358]/40 text-white text-sm font-semibold transition">
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </div>
    </div>
  )
}
