'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark, faBoxOpen, faCheck } from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '@/context/AuthContext'
import { logActivity, USER_ACTIVITY } from '@/lib/userActivity'
import { localDateStr } from '@/lib/date'

type ReceiveItem = {
  id: number
  qty: number
  base_price: number
  unit_of_measurement_id: number | null
  entered_qty: number | null
  receipt_id: number | null
  products: { name: string; unit_of_measurement_id: number | null; unit_of_measurements: { abbreviation: string } | null } | null
  unit_of_measurements: { abbreviation: string } | null
}
type ReceivePurchasing = {
  id: number
  code: string
  date: string
  supplier_id: number
  suppliers: { name: string } | null
  purchasing_items: ReceiveItem[]
}
type Warehouse = { id: number; name: string; code: string }
type ItemInput = {
  id: number
  name: string
  qtyOrderedDisplay: number
  unitLabel: string
  baseAbbr: string
  // How many base units equal 1 of the unit the DO was originally entered in
  // (e.g. 1 Dus = 12 Pcs). 1 when no alternate unit was recorded.
  factor: number
  qty: string
  base_price: string
  discountPercent: string
  // Whether this line is part of THIS faktur. Unchecked lines stay pending
  // (receipt_id null) so a supplier that splits one PO across multiple
  // invoices can be received in separate passes.
  included: boolean
}

const fmt = (n: number) => n.toLocaleString('id-ID')
// Same rounding formula the RPC uses server-side, so the preview shown here
// never contradicts what actually gets stored.
const netPrice = (gross: number, discountPercent: number) => Math.round(gross * (1 - discountPercent / 100) * 100) / 100

// Supplier invoices often stack discounts ("15+3+6" = 15%, then 3% of the rest,
// then 6%). Returns each step plus the single equivalent percent sent to the RPC,
// or null when the input isn't a valid "a+b+c" list of 0–100 numbers.
const parseDiscount = (input: string): { steps: number[]; effective: number } | null => {
  const trimmed = input.replace(/\s+/g, '').replace(/,/g, '.')
  if (trimmed === '') return { steps: [], effective: 0 }
  const steps = trimmed.split('+').map(Number)
  if (steps.some(d => !Number.isFinite(d) || d < 0 || d > 100)) return null
  const remaining = steps.reduce((acc, d) => acc * (1 - d / 100), 1)
  return { steps, effective: (1 - remaining) * 100 }
}
const discountOf = (input: string) => parseDiscount(input)?.effective ?? 0

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

  // Only lines not yet received (no faktur assigned) can be worked on here.
  const pendingItems = purchasing.purchasing_items.filter(i => i.receipt_id == null)

  const [items, setItems] = useState<ItemInput[]>(
    pendingItems.map(i => {
      const baseAbbr = i.products?.unit_of_measurements?.abbreviation ?? ''
      const hasEnteredUnit = i.unit_of_measurement_id != null && i.entered_qty != null && i.entered_qty > 0
      // qty is always stored converted to the base unit; entered_qty (when present)
      // is what staff actually typed at DO-creation time (e.g. "25 Dus"). Deriving
      // the factor from these two lets qty/price below be entered in that same
      // original unit, matching the supplier's invoice, instead of only the
      // already-converted base-unit number.
      const factor = hasEnteredUnit ? i.qty / i.entered_qty! : 1
      const unitLabel = hasEnteredUnit ? (i.unit_of_measurements?.abbreviation ?? baseAbbr) : baseAbbr
      return {
        id: i.id,
        name: i.products?.name ?? '-',
        qtyOrderedDisplay: hasEnteredUnit ? i.entered_qty! : i.qty,
        unitLabel,
        baseAbbr,
        factor,
        qty: hasEnteredUnit ? String(i.entered_qty) : String(i.qty),
        base_price: i.base_price ? String(i.base_price * factor) : '',
        discountPercent: '',
        included: true,
      }
    })
  )
  const [invoiceNo, setInvoiceNo] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [warehouseId, setWarehouseId] = useState<number | ''>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingAfterSubmit, setPendingAfterSubmit] = useState<string[] | null>(null)

  const updateItem = (idx: number, field: 'qty' | 'base_price' | 'discountPercent', value: string) => {
    setItems(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row))
  }
  const toggleIncluded = (idx: number) => {
    setItems(prev => prev.map((row, i) => i === idx ? { ...row, included: !row.included } : row))
  }

  const includedItems = items.filter(i => i.included)
  // qty/base_price above are both in the item's own unitLabel unit, so money
  // math needs no factor here (mirrors the same pattern in purchasing/buat).
  // Discount is applied on the (qty * gross) subtotal, same result as applying
  // it per-unit first since it's a straight percentage.
  const total = includedItems.reduce((sum, i) => {
    const gross = (parseFloat(i.base_price) || 0) * (parseFloat(i.qty) || 0)
    return sum + netPrice(gross, discountOf(i.discountPercent))
  }, 0)
  const baseQtyFor = (i: ItemInput) => (parseFloat(i.qty) || 0) * i.factor

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
    if (includedItems.length === 0) {
      setError('Pilih minimal satu produk untuk diterima.')
      return
    }
    if (includedItems.some(i => (parseFloat(i.qty) || 0) > 0 && !(parseFloat(i.base_price) > 0))) {
      setError('Isi harga beli untuk setiap produk yang diterima.')
      return
    }
    const badDiscount = includedItems.find(i => parseDiscount(i.discountPercent) === null)
    if (badDiscount) {
      setError(`Diskon ${badDiscount.name} tidak valid. Isi angka 0–100, atau bertingkat seperti 15+3+6.`)
      return
    }
    // stock_batches/purchasing_items.qty are stored in the base unit and must stay
    // whole numbers, same constraint as purchasing/buat — catch a fractional result
    // (e.g. typing 2.5 Dus) before it silently gets rounded away.
    const fractionalItem = includedItems.find(i => {
      const bq = baseQtyFor(i)
      return bq > 0 && Math.abs(bq - Math.round(bq)) > 1e-6
    })
    if (fractionalItem) {
      setError(`Qty ${fractionalItem.name} menghasilkan pecahan (${baseQtyFor(fractionalItem)}) setelah dikonversi ke ${fractionalItem.baseAbbr || 'unit dasar'}. Ubah qty-nya.`)
      return
    }
    setSubmitting(true)

    const p_items = includedItems.map(i => ({
      purchasing_item_id: i.id,
      qty: Math.round(baseQtyFor(i)),
      gross_base_price: (parseFloat(i.base_price) || 0) / i.factor,
      discount_percent: discountOf(i.discountPercent),
    }))

    const { data: receiptId, error: rpcErr } = await supabase.rpc('receive_delivery_order', {
      p_purchasing_id: purchasing.id,
      p_items,
      p_invoice_no: invoiceNo.trim() || null,
      p_due_date: dueDate || null,
      p_warehouse_id: warehouseId || null,
      p_created_by: appUser?.id ?? null,
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
          purchasing_receipt_id: receiptId,
          supplier_id: purchasing.supplier_id,
          due_date: dueTolerance,
          installment_due_date: localDateStr(installmentDue),
          month: finalMonth,
          installment: isLast ? total - installment * (totalBills - 1) : installment,
          paid_amount: 0,
          bill_no: `BILL-${purchasing.code}-R${receiptId}-${i + 1}/${totalBills}`,
        }
      })
      await supabase.from('bills').insert(bills)
    }

    await logActivity(supabase, appUser?.id,
      USER_ACTIVITY.RECEIVE_DELIVERY_ORDER(appUser?.name ?? 'User', purchasing.code, purchasing.suppliers?.name ?? '-', total))

    setSubmitting(false)
    onReceived()

    const stillPending = items.filter(i => !i.included).map(i => i.name)
    if (stillPending.length > 0) {
      setPendingAfterSubmit(stillPending)
    } else {
      onClose()
    }
  }

  if (pendingAfterSubmit) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
        <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3" style={{ backgroundColor: '#9FA1FF' }}>
            <p className="text-sm font-bold text-white font-mono">{purchasing.code}</p>
          </div>
          <div className="px-5 py-5 space-y-3">
            <div className="flex items-center gap-2 text-green-600">
              <FontAwesomeIcon icon={faCheck} className="w-4 h-4" />
              <span className="text-sm font-semibold">Faktur ini sudah disimpan.</span>
            </div>
            <p className="text-xs text-gray-500">
              {pendingAfterSubmit.length} produk belum diterima (faktur lain): {pendingAfterSubmit.join(', ')}.
              Bisa diterima lagi nanti dari menu yang sama.
            </p>
          </div>
          <div className="px-5 py-4 border-t border-gray-100">
            <button onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-[#121358] hover:bg-[#1a1c6e] text-white text-sm font-semibold transition">
              Selesai
            </button>
          </div>
        </div>
      </div>
    )
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

        {items.length > 1 && (
          <p className="px-5 pt-3 text-[11px] text-gray-400">
            Kalau supplier memecah faktur, uncheck produk yang datang di faktur lain — bisa diterima terpisah nanti.
          </p>
        )}

        <div className="max-h-[45vh] overflow-y-auto divide-y divide-gray-50 px-5 py-3 space-y-3">
          {items.map((item, idx) => {
            const gross = parseFloat(item.base_price) || 0
            const parsedDisc = parseDiscount(item.discountPercent)
            const disc = parsedDisc?.effective ?? 0
            return (
              <div key={item.id} className={`pt-3 first:pt-0 space-y-2 transition ${!item.included ? 'opacity-40' : ''}`}>
                <label className="flex items-start gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={item.included} onChange={() => toggleIncluded(idx)}
                    className="mt-0.5 w-4 h-4 accent-[#121358] shrink-0" />
                  <span>
                    {item.name} <span className="text-xs text-gray-400 font-normal">(dipesan {item.qtyOrderedDisplay} {item.unitLabel})</span>
                  </span>
                </label>
                <fieldset disabled={!item.included} className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">
                        Qty Diterima {item.factor !== 1 && <span className="text-gray-400 font-normal">({item.unitLabel})</span>}
                      </label>
                      <input type="number" value={item.qty} min="0"
                        onChange={e => updateItem(idx, 'qty', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358] disabled:bg-gray-50" />
                      {item.factor !== 1 && item.qty && (
                        <p className="text-[11px] text-gray-400 mt-1">= {baseQtyFor(item)} {item.baseAbbr}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">
                        Harga Beli {item.factor !== 1 && <span className="text-gray-400 font-normal">(per {item.unitLabel})</span>}
                      </label>
                      <input type="number" value={item.base_price} min="0"
                        onChange={e => updateItem(idx, 'base_price', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358] disabled:bg-gray-50" />
                      {item.factor !== 1 && item.base_price && (
                        <p className="text-[11px] text-gray-400 mt-1">
                          = Rp {fmt((parseFloat(item.base_price) || 0) / item.factor)} / {item.baseAbbr}
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Diskon (%) <span className="font-normal">— opsional</span></label>
                    <input type="text" inputMode="decimal" value={item.discountPercent}
                      placeholder="0 atau 15+3+6"
                      onChange={e => { const v = e.target.value; if (/^[\d.,+\s]*$/.test(v)) updateItem(idx, 'discountPercent', v) }}
                      className={`w-36 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358] disabled:bg-gray-50 ${parsedDisc ? 'border-gray-300' : 'border-red-400'}`} />
                    {!parsedDisc && (
                      <p className="text-[11px] text-red-500 mt-1">Format diskon: angka 0–100, bertingkat pakai + (mis. 15+3+6)</p>
                    )}
                    {disc > 0 && gross > 0 && (
                      <p className="text-[11px] text-gray-400 mt-1">
                        Rp {fmt(gross)} → {parsedDisc!.steps.map(d => `-${fmt(d)}%`).join(' ')}
                        {parsedDisc!.steps.length > 1 && ` (= ${fmt(Math.round(disc * 1000) / 1000)}%)`}
                        {' '}→ Rp {fmt(netPrice(gross, disc))} {item.factor !== 1 ? `/ ${item.unitLabel}` : ''}
                      </p>
                    )}
                  </div>
                </fieldset>
              </div>
            )
          })}
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
              <span className="text-xs text-gray-500">Total faktur ini</span>
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
