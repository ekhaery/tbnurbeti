'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark, faBoxOpen, faCheck, faPen, faTrash } from '@fortawesome/free-solid-svg-icons'
import PurchasingTabs from '@/lib/PurchasingTabs'
import { getArrivalStatus, ARRIVAL_STATUS } from '@/lib/arrivalStatus'
import { PURCHASING_STATUS } from '@/lib/purchasingStatus'

type StockBatch = { id: number; is_available: boolean }

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
  status: string
  supplier_id: number
  suppliers: { name: string } | null
  purchasing_items: PurchasingItem[]
}

type Supplier = { id: number; name: string }

const fmt = (n: number) => n.toLocaleString('id-ID')

export default function RiwayatPurchasingPage() {
  const supabase = createClient()
  const [list, setList] = useState<Purchasing[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [fetching, setFetching] = useState(true)

  // Arrival modal
  const [selected, setSelected] = useState<Purchasing | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [doneMsg, setDoneMsg] = useState(false)

  // Edit modal
  const [editing, setEditing] = useState<Purchasing | null>(null)
  const [editSupplierId, setEditSupplierId] = useState<number | ''>('')
  const [editDate, setEditDate] = useState('')
  const [editJatuhTempo, setEditJatuhTempo] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editItems, setEditItems] = useState<{ id: number; qty: string; base_price: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)

  // Delete confirm
  const [deleting, setDeleting] = useState<Purchasing | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const fetchData = async () => {
    const { data } = await supabase
      .from('purchasing')
      .select('id, code, date, notes, period, total, status, supplier_id, suppliers(name), purchasing_items(id, qty, base_price, products(name), stock_batches(id, is_available))')
      .order('date', { ascending: false })
    setList((data as Purchasing[]) ?? [])
    setFetching(false)
  }

  useEffect(() => {
    fetchData()
    supabase.from('suppliers').select('id, name').order('name')
      .then(({ data }: { data: Supplier[] | null }) => setSuppliers(data ?? []))
  }, [])

  // Arrival modal
  const handleMarkAvailable = async () => {
    if (!selected) return
    setConfirming(true)
    const batchIds = selected.purchasing_items.flatMap(i => i.stock_batches.map(b => b.id))
    const { error } = await supabase.from('stock_batches').update({ is_available: true }).in('id', batchIds)
    if (error) { setConfirming(false); return }

    await supabase.from('purchasing').update({ status: 'completed' }).eq('id', selected.id)
    setConfirming(false)
    setDoneMsg(true)
    setTimeout(() => { setDoneMsg(false); setSelected(null); fetchData() }, 1500)
  }

  // Open edit modal
  const openEdit = (p: Purchasing, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditing(p)
    setEditSupplierId(p.supplier_id)
    setEditDate(p.date)
    // Reconstruct jatuh tempo from date + period months
    if (p.period > 0) {
      const d = new Date(p.date)
      d.setDate(d.getDate() + p.period * 7)
      setEditJatuhTempo(d.toISOString().slice(0, 10))
    } else {
      setEditJatuhTempo('')
    }
    setEditNotes(p.notes ?? '')
    setEditItems(p.purchasing_items.map(i => ({
      id: i.id,
      qty: String(i.qty),
      base_price: String(i.base_price),
      name: i.products?.name ?? '-',
    })))
  }

  const updateEditItem = (idx: number, field: 'qty' | 'base_price', value: string) => {
    setEditItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  const editTotal = editItems.reduce((sum, i) => sum + (parseFloat(i.base_price) || 0) * (parseInt(i.qty) || 0), 0)

  const calcEditPeriod = (): { weeks: number; months: number } | null => {
    if (!editDate || !editJatuhTempo) return null
    const start = new Date(editDate)
    const end = new Date(editJatuhTempo)
    if (end <= start) return null
    const diffMs = end.getTime() - start.getTime()
    const weeks = Math.round(diffMs / (1000 * 60 * 60 * 24 * 7))
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
    return { weeks, months }
  }
  const editPeriodCalc = calcEditPeriod()
  const editPeriodWeeks = editPeriodCalc?.weeks ?? 0

  // Save edit
  const handleSave = async () => {
    if (!editing) return
    setSaving(true)

    const newTotal = editItems.reduce((sum, i) => sum + (parseFloat(i.base_price) || 0) * (parseInt(i.qty) || 0), 0)

    // Update purchasing header
    const { error: purErr } = await supabase.from('purchasing')
      .update({
        supplier_id: editSupplierId,
        date: editDate,
        period: editPeriodWeeks,
        notes: editNotes.trim() || null,
        total: newTotal,
      })
      .eq('id', editing.id)

    if (purErr) { setSaving(false); showToast('Gagal menyimpan.'); return }

    // Update each purchasing_item
    for (const item of editItems) {
      await supabase.from('purchasing_items')
        .update({ qty: parseInt(item.qty) || 0, base_price: parseFloat(item.base_price) || 0 })
        .eq('id', item.id)
    }

    // Regenerate bills: delete old, insert new
    await supabase.from('bills').delete().eq('purchasing_id', editing.id)

    const periodVal = editPeriodWeeks
    if (periodVal > 0 && editJatuhTempo) {
      const installment = Math.round((newTotal / periodVal) * 100) / 100
      const purchaseDate = new Date(editDate)
      const finalDueDateStr = editJatuhTempo
      const finalMonth = new Date(editJatuhTempo).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      const bills = Array.from({ length: periodVal }, (_, i) => {
        const installmentDue = new Date(purchaseDate)
        installmentDue.setDate(installmentDue.getDate() + (i + 1) * 7)
        return {
          purchasing_id: editing.id,
          supplier_id: Number(editSupplierId),
          due_date: finalDueDateStr,
          installment_due_date: installmentDue.toISOString().slice(0, 10),
          month: finalMonth,
          installment,
          paid_amount: 0,
          bill_no: `BILL-${editing.code}-${i + 1}/${periodVal}`,
        }
      })
      await supabase.from('bills').insert(bills)
    }

    setSaving(false)
    setEditing(null)
    showToast('Purchasing berhasil diupdate.')
    fetchData()
  }

  // Delete
  const handleDelete = async () => {
    if (!deleting) return
    setConfirmingDelete(true)
    await supabase.from('purchasing').delete().eq('id', deleting.id)
    setConfirmingDelete(false)
    setDeleting(null)
    showToast('Purchasing berhasil dihapus.')
    fetchData()
  }

  const arrivalStatus = selected ? getArrivalStatus(selected.purchasing_items) : null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-xl mx-auto space-y-4">
        <PurchasingTabs />

        <div>
          <h2 className="text-lg font-bold text-gray-800">Riwayat Purchasing</h2>
          <p className="text-xs text-gray-500 mt-0.5">{fetching ? '...' : `${list.length} purchasing`}</p>
        </div>

        {fetching ? (
          <div className="text-center text-sm text-gray-400 py-10">Memuat...</div>
        ) : list.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-10">Belum ada purchasing.</div>
        ) : (
          <div className="space-y-2">
            {list.map(p => {
              const isInit = p.status === 'init'
              const canEdit = p.status !== 'completed'
              const isCreated = p.status === 'created'
              const status = (!isInit && !isCreated) ? getArrivalStatus(p.purchasing_items) : null
              return (
                <div key={p.id} className="relative bg-white rounded-xl shadow-sm overflow-hidden">
                  <button
                    onClick={() => {
                      if (!isInit) { setSelected(p); setDoneMsg(false) }
                    }}
                    className={`w-full px-4 py-3 pr-12 flex items-center justify-between text-left transition ${isInit ? 'cursor-default' : 'hover:bg-gray-50'}`}
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-800 font-mono">{p.code}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {p.suppliers?.name ?? '-'} · {new Date(p.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        {p.period > 0 && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600">
                            Bayar {p.period} bln
                          </span>
                        )}
                        {isInit || isCreated ? (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${PURCHASING_STATUS[p.status as 'init' | 'created'].className}`}>
                            {PURCHASING_STATUS[p.status as 'init' | 'created'].label}
                          </span>
                        ) : (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ARRIVAL_STATUS[status!].className}`}>
                            {ARRIVAL_STATUS[status!].label}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-[#121358]">Rp {fmt(p.total)}</p>
                      <p className="text-xs text-gray-400">{p.purchasing_items.length} produk</p>
                    </div>
                  </button>

                  {/* Edit icon */}
                  <button
                    onClick={e => canEdit ? openEdit(p, e) : showToast('Purchasing completed tidak dapat diedit.')}
                    className={`absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full transition ${
                      canEdit ? 'text-[#121358]/50 hover:bg-[#121358]/10 hover:text-[#121358]' : 'text-gray-200 cursor-default'
                    }`}
                  >
                    <FontAwesomeIcon icon={faPen} className="w-3 h-3" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white text-xs font-medium px-4 py-2.5 rounded-xl shadow-lg whitespace-nowrap">
          {toast}
        </div>
      )}

      {/* Arrival Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3" style={{ backgroundColor: '#9FA1FF' }}>
              <div>
                <p className="text-sm font-bold text-white font-mono">{selected.code}</p>
                <p className="text-xs text-[#121358]/70 mt-0.5">
                  {selected.suppliers?.name ?? '-'} · {new Date(selected.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#121358]/10 hover:bg-[#121358]/20 text-[#121358] transition shrink-0">
                <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
              </button>
            </div>
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
            <div className="px-5 py-3 bg-gray-50 flex justify-between items-center">
              <span className="text-xs text-gray-500">Total</span>
              <span className="text-sm font-bold text-[#121358]">Rp {fmt(selected.total)}</span>
            </div>
            <div className="px-5 py-4 border-t border-gray-100">
              {doneMsg ? (
                <div className="flex items-center justify-center gap-2 py-2 text-green-600">
                  <FontAwesomeIcon icon={faCheck} className="w-4 h-4" />
                  <span className="text-sm font-semibold">Stok telah diupdate</span>
                </div>
              ) : arrivalStatus === 'arrived' ? (
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
                    <button onClick={() => setSelected(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition">
                      Belum
                    </button>
                    <button onClick={handleMarkAvailable} disabled={confirming} className="flex-1 py-2.5 rounded-xl bg-[#121358] hover:bg-[#1a1c6e] disabled:bg-[#121358]/40 text-white text-sm font-semibold transition">
                      {confirming ? 'Menyimpan...' : 'Sudah'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-800">Edit Purchasing</h3>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{editing.code}</p>
              </div>
              <button onClick={() => setEditing(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {/* Header fields */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Supplier</label>
                <select value={editSupplierId} onChange={e => setEditSupplierId(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]">
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tanggal</label>
                <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Jatuh Tempo</label>
                <input type="date" value={editJatuhTempo} min={editDate}
                  onChange={e => setEditJatuhTempo(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
                {editPeriodCalc && (
                  <p className="text-xs text-gray-400 mt-1">
                    {editPeriodCalc.weeks} minggu&nbsp;|&nbsp;{editPeriodCalc.months} bulan
                    <span className="text-amber-600 ml-1">· Tagihan lama akan dibuat ulang.</span>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Catatan</label>
                <input type="text" value={editNotes} onChange={e => setEditNotes(e.target.value)}
                  placeholder="Opsional"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
              </div>

              {/* Items */}
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Produk</p>
                <div className="space-y-3">
                  {editItems.map((item, idx) => (
                    <div key={item.id} className="bg-gray-50 rounded-xl p-3 space-y-2">
                      <p className="text-sm font-medium text-gray-700">{item.name}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Qty</label>
                          <input type="number" value={item.qty} min="1"
                            onChange={e => updateEditItem(idx, 'qty', e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Harga Beli</label>
                          <input type="number" value={item.base_price} min="0"
                            onChange={e => updateEditItem(idx, 'base_price', e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 text-right">
                        Subtotal: <span className="font-semibold text-gray-600">Rp {fmt((parseInt(item.qty) || 0) * (parseFloat(item.base_price) || 0))}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* New total */}
              <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                <span className="text-xs text-gray-500">Total Baru</span>
                <span className="text-sm font-bold text-[#121358]">Rp {fmt(editTotal)}</span>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 space-y-2">
              <div className="flex gap-2">
                <button onClick={() => setEditing(null)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition">
                  Batal
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-[#121358] hover:bg-[#1a1c6e] disabled:bg-[#121358]/40 text-white text-sm font-semibold transition">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
              <button
                onClick={() => { setEditing(null); setDeleting(editing) }}
                className="w-full py-2.5 rounded-xl border border-red-200 text-sm font-medium text-red-500 hover:bg-red-50 transition flex items-center justify-center gap-2"
              >
                <FontAwesomeIcon icon={faTrash} className="w-3 h-3" />
                Hapus Purchasing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-800">Hapus Purchasing?</h3>
              <p className="text-xs text-gray-400 mt-1">
                <span className="font-mono font-semibold">{deleting.code}</span> dan semua tagihan terkait akan dihapus permanen.
              </p>
            </div>
            <div className="flex gap-2 px-5 py-4">
              <button onClick={() => setDeleting(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition">
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
    </div>
  )
}
