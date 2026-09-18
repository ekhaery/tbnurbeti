'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark, faBoxOpen } from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '@/context/AuthContext'
import { logActivity, USER_ACTIVITY } from '@/lib/userActivity'
import { localDateStr } from '@/lib/date'

type ReceiveItem = { id: number; qty: number; base_price: number; products: { name: string } | null }
type ReceivePurchasing = {
  id: number
  code: string
  date: string
  supplier_id: number
  suppliers: { name: string } | null
  purchasing_items: ReceiveItem[]
}
type Warehouse = { id: number; name: string; code: string }
type ItemInput = { id: number; name: string; qtyOrdered: number; qty: string; base_price: string }

const fmt = (n: number) => n.toLocaleString('id-ID')

export default function ReceiveDeliveryOrderModal({
  purchasing,
  warehouses,
  onClose,
  onReceived,
}: {
  purchasing: ReceivePurchasing
  warehouses: Warehouse[]
  onClose: () => void
  onReceived: () => void
}) {
  const supabase = createClient()
  const { appUser } = useAuth()

  const [items, setItems] = useState<ItemInput[]>(
    purchasing.purchasing_items.map(i => ({
      id: i.id,
      name: i.products?.name ?? '-',
      qtyOrdered: i.qty,
      qty: String(i.qty),
      base_price: i.base_price ? String(i.base_price) : '',
    }))
  )
  const [invoiceNo, setInvoiceNo] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [warehouseId, setWarehouseId] = useState<number | ''>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateItem = (idx: number, field: 'qty' | 'base_price', value: string) => {
    setItems(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row))
  }

  const total = items.reduce((sum, i) => sum + (parseFloat(i.base_price) || 0) * (parseInt(i.qty) || 0), 0)

  // Period/installments are counted from the receipt date (when the invoice comes in),
  // not the Delivery Order's original order date — matches how the supplier bills it.
  const receivedDateStr = localDateStr()

  const calcPeriod = (): { weeks: number } | null => {
    if (!dueDate) return null
    const start = new Date(receivedDateStr)
    const end = new Date(dueDate)
    if (end <= start) return null
    const diffMs = end.getTime() - start.getTime()
    const weeks = Math.round(diffMs / (1000 * 60 * 60 * 24 * 7))
    return { weeks }
  }
  const periodWeeks = calcPeriod()?.weeks ?? 0

  const handleSubmit = async () => {
    setError(null)
    if (items.some(i => (parseInt(i.qty) || 0) > 0 && !(parseFloat(i.base_price) > 0))) {
      setError('Isi harga beli untuk setiap produk yang diterima.')
      return
    }
    setSubmitting(true)

    const p_items = items.map(i => ({
      purchasing_item_id: i.id,
      qty: parseInt(i.qty) || 0,
      base_price: parseFloat(i.base_price) || 0,
    }))

    const { error: rpcErr } = await supabase.rpc('receive_delivery_order', {
      p_purchasing_id: purchasing.id,
      p_items,
      p_invoice_no: invoiceNo.trim() || null,
      p_due_date: dueDate || null,
      p_warehouse_id: warehouseId || null,
    })
    if (rpcErr) { setError(rpcErr.message); setSubmitting(false); return }

    // Generate installment bills if a due date was given, same logic as creating a purchasing directly
    if (periodWeeks > 0 && dueDate) {
      const dueTolerance = localDateStr(new Date(new Date(dueDate).getTime() + 21 * 24 * 60 * 60 * 1000))
      const totalBills = periodWeeks + 3
      const installment = Math.floor(total / totalBills)
      const purchaseDate = new Date(receivedDateStr)
      const finalMonth = new Date(dueTolerance).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      const bills = Array.from({ length: totalBills }, (_, i) => {
        const installmentDue = new Date(purchaseDate)
        installmentDue.setDate(installmentDue.getDate() + (i + 1) * 7)
        const isLast = i === totalBills - 1
        return {
          purchasing_id: purchasing.id,
          supplier_id: purchasing.supplier_id,
          due_date: dueTolerance,
          installment_due_date: localDateStr(installmentDue),
          month: finalMonth,
          installment: isLast ? total - installment * (totalBills - 1) : installment,
          paid_amount: 0,
          bill_no: `BILL-${purchasing.code}-${i + 1}/${totalBills}`,
        }
      })
      await supabase.from('bills').insert(bills)
    }

    await logActivity(supabase, appUser?.id,
      USER_ACTIVITY.RECEIVE_DELIVERY_ORDER(appUser?.name ?? 'User', purchasing.code, purchasing.suppliers?.name ?? '-', total))

    setSubmitting(false)
    onReceived()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3" style={{ backgroundColor: '#9FA1FF' }}>
          <div>
            <p className="text-sm font-bold text-white font-mono">{purchasing.code}</p>
            <p className="text-xs text-white/70 mt-0.5">
              {purchasing.suppliers?.name ?? '-'} · {new Date(purchasing.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition shrink-0">
            <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="max-h-[45vh] overflow-y-auto divide-y divide-gray-50 px-5 py-3 space-y-3">
          {items.map((item, idx) => (
            <div key={item.id} className="pt-3 first:pt-0 space-y-2">
              <p className="text-sm font-medium text-gray-700">{item.name} <span className="text-xs text-gray-400">(dipesan {item.qtyOrdered})</span></p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Qty Diterima</label>
                  <input type="number" value={item.qty} min="0"
                    onChange={e => updateItem(idx, 'qty', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Harga Beli</label>
                  <input type="number" value={item.base_price} min="0"
                    onChange={e => updateItem(idx, 'base_price', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">No Faktur</label>
            <input type="text" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)}
              placeholder="Opsional"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tanggal Jatuh Tempo</label>
            <input type="date" value={dueDate} min={receivedDateStr}
              onChange={e => setDueDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
            {periodWeeks > 0 && (
              <p className="text-xs text-gray-400 mt-1">{periodWeeks} minggu · tagihan akan dibuat otomatis</p>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Warehouse tujuan</label>
            <select
              value={warehouseId}
              onChange={e => setWarehouseId(e.target.value ? Number(e.target.value) : '')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#121358]"
            >
              <option value="">-- Pilih Warehouse --</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
              ))}
            </select>
          </div>

          {total > 0 && (
            <div className="flex justify-between items-center pt-1 border-t border-gray-100">
              <span className="text-xs text-gray-500">Total</span>
              <span className="text-sm font-bold text-[#121358]">Rp {fmt(total)}</span>
            </div>
          )}

          {error && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">⚠️ {error}</div>
          )}

          <button onClick={handleSubmit} disabled={submitting}
            className="w-full py-2.5 rounded-xl bg-[#121358] hover:bg-[#1a1c6e] disabled:bg-[#121358]/40 text-white text-sm font-semibold flex items-center justify-center gap-2 transition">
            <FontAwesomeIcon icon={faBoxOpen} className="w-3.5 h-3.5" style={{ color: '#9FA1FF' }} />
            {submitting ? 'Menyimpan...' : 'Barang Diterima'}
          </button>
        </div>
      </div>
    </div>
  )
}
