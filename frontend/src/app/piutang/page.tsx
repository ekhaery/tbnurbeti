'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faXmark, faPen, faTrash, faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'
import { RECEIVABLES_STATUS_OPTIONS, receivablesStatusConfig } from '@/lib/receivablesOptions'

type Customer = { id: number; name: string }

type ReceivablesDetail = {
  id: number
  date: string
  amount: number
  notes: string | null
}

type Receivable = {
  id: number
  customer_id: number
  date: string
  due_date: string | null
  total: number
  remaining_amount: number
  status: string
  customers: { name: string } | null
  customer_receivables_detail: ReceivablesDetail[]
}

const fmt = (n: number) => n.toLocaleString('id-ID')
const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

const emptyForm = () => ({
  customer_id: '' as number | '',
  date: new Date().toISOString().slice(0, 10),
  due_date: '',
  total: '',
  remaining_amount: '',
  status: 'Belum Dibayar',
})

const emptyDetail = () => ({
  date: new Date().toISOString().slice(0, 10),
  amount: '',
  notes: '',
})

export default function PiutangPage() {
  const supabase = createClient()
  const [list, setList] = useState<Receivable[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [fetching, setFetching] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)

  // Add receivable
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Edit receivable
  const [editing, setEditing] = useState<Receivable | null>(null)
  const [editForm, setEditForm] = useState(emptyForm())
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Delete receivable
  const [deleting, setDeleting] = useState<Receivable | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  // Add detail payment
  const [addingDetail, setAddingDetail] = useState<Receivable | null>(null)
  const [detailForm, setDetailForm] = useState(emptyDetail())
  const [detailSaving, setDetailSaving] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const fetchData = async () => {
    const { data } = await supabase
      .from('customer_receivables')
      .select('id, customer_id, date, due_date, total, remaining_amount, status, customers(name), customer_receivables_detail(id, date, amount, notes)')
      .order('date', { ascending: false })
    setList((data as Receivable[]) ?? [])
    setFetching(false)
  }

  useEffect(() => {
    fetchData()
    supabase.from('customers').select('id, name').order('name')
      .then(({ data }: { data: Customer[] | null }) => setCustomers(data ?? []))
  }, [])

  const set = (field: string, value: string | number) => setForm(prev => ({ ...prev, [field]: value }))
  const setEdit = (field: string, value: string | number) => setEditForm(prev => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    if (!form.customer_id) { setError('Pilih customer.'); return }
    if (!form.total) { setError('Masukkan total piutang.'); return }
    setSaving(true); setError(null)
    const { error } = await supabase.from('customer_receivables').insert({
      customer_id: Number(form.customer_id),
      date: form.date,
      due_date: form.due_date || null,
      total: parseFloat(form.total),
      remaining_amount: parseFloat(form.remaining_amount || form.total),
      status: form.status,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    setShowForm(false); setForm(emptyForm()); fetchData()
  }

  const openEdit = (r: Receivable) => {
    setEditing(r); setEditError(null)
    setEditForm({
      customer_id: r.customer_id,
      date: r.date,
      due_date: r.due_date ?? '',
      total: String(r.total),
      remaining_amount: String(r.remaining_amount),
      status: r.status,
    })
  }

  const handleEditSave = async () => {
    if (!editForm.customer_id) { setEditError('Pilih customer.'); return }
    setEditSaving(true); setEditError(null)
    const { error } = await supabase.from('customer_receivables').update({
      customer_id: Number(editForm.customer_id),
      date: editForm.date,
      due_date: editForm.due_date || null,
      total: parseFloat(editForm.total),
      remaining_amount: parseFloat(editForm.remaining_amount),
      status: editForm.status,
      updated_at: new Date().toISOString(),
    }).eq('id', editing!.id)
    setEditSaving(false)
    if (error) { setEditError(error.message); return }
    setEditing(null); fetchData()
  }

  const handleDelete = async () => {
    if (!deleting) return
    setConfirmingDelete(true)
    await supabase.from('customer_receivables').delete().eq('id', deleting.id)
    setConfirmingDelete(false); setDeleting(null); fetchData()
  }

  const handleAddDetail = async () => {
    if (!detailForm.amount) { setDetailError('Masukkan jumlah pembayaran.'); return }
    setDetailSaving(true); setDetailError(null)

    const amount = parseFloat(detailForm.amount)
    const { error } = await supabase.from('customer_receivables_detail').insert({
      customer_receivables_id: addingDetail!.id,
      date: detailForm.date,
      amount,
      notes: detailForm.notes.trim() || null,
    })
    if (error) { setDetailError(error.message); setDetailSaving(false); return }

    // Update remaining_amount and status
    const newRemaining = Math.max(0, addingDetail!.remaining_amount - amount)
    const newStatus = newRemaining === 0 ? 'Lunas' : 'Dibayar Sebagian'
    await supabase.from('customer_receivables').update({
      remaining_amount: newRemaining,
      status: newStatus,
      updated_at: new Date().toISOString(),
    }).eq('id', addingDetail!.id)

    setDetailSaving(false); setAddingDetail(null); setDetailForm(emptyDetail()); fetchData()
  }

  const totalPiutang = list.reduce((s, r) => s + r.remaining_amount, 0)
  const totalLunas = list.filter(r => r.status === 'Lunas').reduce((s, r) => s + r.total, 0)

  const formFields = (f: ReturnType<typeof emptyForm>, setF: (k: string, v: string | number) => void, err: string | null) => (
    <div className="px-5 py-4 space-y-3 max-h-[65vh] overflow-y-auto">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Customer <span className="text-red-500">*</span></label>
        <select value={f.customer_id} onChange={e => setF('customer_id', Number(e.target.value))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]">
          <option value="">-- Pilih Customer --</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Tanggal</label>
          <input type="date" value={f.date} onChange={e => setF('date', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Jatuh Tempo</label>
          <input type="date" value={f.due_date} onChange={e => setF('due_date', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Total <span className="text-red-500">*</span></label>
          <input type="number" value={f.total} onChange={e => setF('total', e.target.value)} placeholder="0" min="0"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Sisa</label>
          <input type="number" value={f.remaining_amount} onChange={e => setF('remaining_amount', e.target.value)} placeholder="= Total"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Status</label>
        <select value={f.status} onChange={e => setF('status', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]">
          {RECEIVABLES_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      {err && <p className="text-xs text-red-500">⚠️ {err}</p>}
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Piutang</h2>
            <p className="text-xs text-gray-500 mt-0.5">Tagihan kepada pelanggan.</p>
          </div>
          <button onClick={() => { setShowForm(true); setError(null) }}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-[#121358] text-white hover:bg-[#1a1c6e] transition">
            <FontAwesomeIcon icon={faPlus} className="w-3 h-3" /> Tambah
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#121358] rounded-xl p-3">
            <p className="text-xs font-semibold" style={{ color: '#B5BAFF' }}>Total Piutang</p>
            <p className="text-base font-bold mt-0.5" style={{ color: '#FCB7C7' }}>Rp {fmt(totalPiutang)}</p>
          </div>
          <div className="bg-[#121358] rounded-xl p-3">
            <p className="text-xs font-semibold" style={{ color: '#B5BAFF' }}>Total Lunas</p>
            <p className="text-base font-bold mt-0.5" style={{ color: '#D9F9DF' }}>Rp {fmt(totalLunas)}</p>
          </div>
        </div>

        {/* List */}
        {fetching ? (
          <div className="text-center text-sm text-gray-400 py-10">Memuat...</div>
        ) : list.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-10">Belum ada piutang.</div>
        ) : (
          <div className="space-y-2">
            {list.map(r => {
              const statusCfg = receivablesStatusConfig(r.status)
              const isOpen = expanded === r.id
              return (
                <div key={r.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="relative p-4 pr-10">
                    <button onClick={() => setExpanded(isOpen ? null : r.id)} className="w-full text-left">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800">{r.customers?.name ?? '-'}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{fmtDate(r.date)}{r.due_date ? ` · JT: ${fmtDate(r.due_date)}` : ''}</p>
                          <span className={`inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusCfg.className}`}>
                            {statusCfg.label}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-[#121358]">Rp {fmt(r.total)}</p>
                          {r.remaining_amount < r.total && (
                            <p className="text-xs mt-0.5" style={{ color: '#9FA1FF' }}>Sisa: Rp {fmt(r.remaining_amount)}</p>
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Edit icon */}
                    <button onClick={() => openEdit(r)}
                      className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full text-[#121358]/50 hover:bg-[#121358]/10 hover:text-[#121358] transition">
                      <FontAwesomeIcon icon={faPen} className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Expanded: detail payments */}
                  {isOpen && (
                    <div className="border-t border-gray-100">
                      {r.customer_receivables_detail.length === 0 ? (
                        <p className="px-4 py-3 text-xs text-gray-400">Belum ada pembayaran.</p>
                      ) : (
                        <div className="divide-y divide-gray-50">
                          {r.customer_receivables_detail.map(d => (
                            <div key={d.id} className="flex items-center justify-between px-4 py-2.5">
                              <div>
                                <p className="text-xs text-gray-700">{fmtDate(d.date)}</p>
                                {d.notes && <p className="text-xs text-gray-400 italic">{d.notes}</p>}
                              </div>
                              <p className="text-sm font-semibold text-green-600">Rp {fmt(d.amount)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {r.status !== 'Lunas' && (
                        <div className="px-4 py-3 border-t border-gray-50">
                          <button onClick={() => { setAddingDetail(r); setDetailForm(emptyDetail()); setDetailError(null) }}
                            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#121358] text-white hover:bg-[#1a1c6e] transition">
                            <FontAwesomeIcon icon={faPlus} className="w-3 h-3" /> Catat Pembayaran
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-800">Tambah Piutang</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
              </button>
            </div>
            {formFields(form, set, error)}
            <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition">Batal</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-[#121358] hover:bg-[#1a1c6e] disabled:bg-[#121358]/40 text-white text-sm font-semibold transition">
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-800">Edit Piutang</h3>
              <button onClick={() => setEditing(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
              </button>
            </div>
            {formFields(editForm, setEdit, editError)}
            <div className="px-5 py-4 border-t border-gray-100 space-y-2">
              <div className="flex gap-2">
                <button onClick={() => setEditing(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition">Batal</button>
                <button onClick={handleEditSave} disabled={editSaving} className="flex-1 py-2.5 rounded-xl bg-[#121358] hover:bg-[#1a1c6e] disabled:bg-[#121358]/40 text-white text-sm font-semibold transition">
                  {editSaving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
              <button onClick={() => { setEditing(null); setDeleting(editing) }}
                className="w-full py-2.5 rounded-xl border border-red-200 text-sm font-medium text-red-500 hover:bg-red-50 transition flex items-center justify-center gap-2">
                <FontAwesomeIcon icon={faTrash} className="w-3 h-3" /> Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-800">Hapus Piutang?</h3>
              <p className="text-xs text-gray-400 mt-1">Semua detail pembayaran akan ikut dihapus.</p>
            </div>
            <div className="flex gap-2 px-5 py-4">
              <button onClick={() => setDeleting(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition">Batal</button>
              <button onClick={handleDelete} disabled={confirmingDelete} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white text-sm font-semibold transition">
                {confirmingDelete ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Detail Payment Modal */}
      {addingDetail && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-800">Catat Pembayaran</h3>
                <p className="text-xs text-gray-400 mt-0.5">{addingDetail.customers?.name} · Sisa: Rp {fmt(addingDetail.remaining_amount)}</p>
              </div>
              <button onClick={() => setAddingDetail(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tanggal</label>
                <input type="date" value={detailForm.date} onChange={e => setDetailForm(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Jumlah <span className="text-red-500">*</span></label>
                <input type="number" value={detailForm.amount} onChange={e => setDetailForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0" min="0" max={addingDetail.remaining_amount}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Catatan</label>
                <input type="text" value={detailForm.notes} onChange={e => setDetailForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Opsional"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
              </div>
              {detailError && <p className="text-xs text-red-500">⚠️ {detailError}</p>}
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setAddingDetail(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition">Batal</button>
              <button onClick={handleAddDetail} disabled={detailSaving} className="flex-1 py-2.5 rounded-xl bg-[#121358] hover:bg-[#1a1c6e] disabled:bg-[#121358]/40 text-white text-sm font-semibold transition">
                {detailSaving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
