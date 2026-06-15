'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faXmark, faPen, faTrash, faChevronLeft } from '@fortawesome/free-solid-svg-icons'
import { useRouter } from 'next/navigation'
import {
  BANK_ACCOUNT_OPTIONS,
  DEBT_TYPE_OPTIONS,
  INSTALLMENT_TYPE_OPTIONS,
  type DebtLoanPeriod,
} from '@/lib/debtLoanOptions'
import { localDateStr } from '@/lib/date'

type DebtLoan = {
  id: number
  bank_account: string
  debt_type: string
  date: string
  debt_amount: number
  installment_type: string
  installment_amount: number
  due_date: string | null
  period: DebtLoanPeriod | null
  created_at: string
}

const fmt = (n: number) => n.toLocaleString('id-ID')
const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

const emptyForm = () => ({
  bank_account: BANK_ACCOUNT_OPTIONS[0] as string,
  debt_type: DEBT_TYPE_OPTIONS[0] as string,
  date: localDateStr(),
  debt_amount: '',
  installment_type: 'monthly' as string,
  installment_amount: '',
  due_date: '',
})

function calcPeriodFn(date: string, dueDate: string): DebtLoanPeriod | null {
  if (!date || !dueDate) return null
  const start = new Date(date)
  const end = new Date(dueDate)
  if (end <= start) return null
  const diffMs = end.getTime() - start.getTime()
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24))
  const weeks = Math.round(days / 7)
  const month = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  return { days, weeks, month }
}

async function generateDetails(supabase: ReturnType<typeof createClient>, debtLoanId: number, form: ReturnType<typeof emptyForm>, period: DebtLoanPeriod | null) {
  if (!period) return null
  const count = form.installment_type === 'daily' ? period.days
    : form.installment_type === 'weekly' ? period.weeks
    : period.month
  const installmentAmount = parseFloat(form.installment_amount) || 0
  const startDate = new Date(form.date)
  const details = Array.from({ length: count }, (_, i) => {
    const due = new Date(startDate)
    if (form.installment_type === 'daily') due.setDate(due.getDate() + (i + 1))
    else if (form.installment_type === 'weekly') due.setDate(due.getDate() + (i + 1) * 7)
    else due.setMonth(due.getMonth() + (i + 1))
    return {
      debt_loan_id: debtLoanId,
      date: form.date,
      due_date: form.due_date || null,
      installment_amount: installmentAmount,
      installment_due_date: localDateStr(due),
      is_paid: false,
    }
  })
  return supabase.from('debt_loan_detail').insert(details)
}

export default function DebtLoanPage() {
  const supabase = createClient()
  const router = useRouter()
  const [list, setList] = useState<DebtLoan[]>([])
  const [fetching, setFetching] = useState(true)

  // Add form
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Edit modal
  const [editing, setEditing] = useState<DebtLoan | null>(null)
  const [editForm, setEditForm] = useState(emptyForm())
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Delete
  const [deleting, setDeleting] = useState<DebtLoan | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const fetchData = async () => {
    const { data } = await supabase.from('debt_loan').select('*').neq('debt_type', 'Giro').order('date', { ascending: false })
    setList((data as DebtLoan[]) ?? [])
    setFetching(false)
  }

  useEffect(() => { fetchData() }, [])

  const set = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }))
  const setEdit = (field: string, value: string) => setEditForm(prev => ({ ...prev, [field]: value }))

  const period = calcPeriodFn(form.date, form.due_date)
  const editPeriod = calcPeriodFn(editForm.date, editForm.due_date)

  const installmentLabel = (type: string) => INSTALLMENT_TYPE_OPTIONS.find(o => o.value === type)?.label ?? type

  // Add
  const handleSave = async () => {
    if (!form.debt_amount) { setError('Masukkan jumlah hutang.'); return }
    setSaving(true); setError(null)

    const { data: newRecord, error } = await supabase.from('debt_loan').insert({
      bank_account: form.bank_account, debt_type: form.debt_type, date: form.date,
      debt_amount: parseFloat(form.debt_amount), installment_type: form.installment_type,
      installment_amount: parseFloat(form.installment_amount) || 0,
      due_date: form.due_date || null, period: period ?? null,
    }).select('id').single()

    if (error || !newRecord) { setError(error?.message ?? 'Gagal menyimpan.'); setSaving(false); return }
    if (form.debt_type !== 'Rekening Koran') {
      await generateDetails(supabase, newRecord.id, form, period)
    }
    setSaving(false); setShowForm(false); setForm(emptyForm()); fetchData()
  }

  // Edit open
  const openEdit = (d: DebtLoan) => {
    setEditing(d)
    setEditError(null)
    setEditForm({
      bank_account: d.bank_account,
      debt_type: d.debt_type,
      date: d.date,
      debt_amount: String(d.debt_amount),
      installment_type: d.installment_type,
      installment_amount: String(d.installment_amount),
      due_date: d.due_date ?? '',
    })
  }

  // Edit save
  const handleEditSave = async () => {
    if (!editForm.debt_amount) { setEditError('Masukkan jumlah hutang.'); return }
    setEditSaving(true); setEditError(null)

    const { error } = await supabase.from('debt_loan').update({
      bank_account: editForm.bank_account, debt_type: editForm.debt_type, date: editForm.date,
      debt_amount: parseFloat(editForm.debt_amount), installment_type: editForm.installment_type,
      installment_amount: parseFloat(editForm.installment_amount) || 0,
      due_date: editForm.due_date || null, period: editPeriod ?? null,
    }).eq('id', editing!.id)

    if (error) { setEditError(error.message); setEditSaving(false); return }

    // Regenerate details (skip for Rekening Koran)
    await supabase.from('debt_loan_detail').delete().eq('debt_loan_id', editing!.id)
    if (editForm.debt_type !== 'Rekening Koran') {
      await generateDetails(supabase, editing!.id, editForm, editPeriod)
    }

    setEditSaving(false); setEditing(null); fetchData()
  }

  // Delete
  const handleDelete = async () => {
    if (!deleting) return
    setConfirmingDelete(true)
    await supabase.from('debt_loan').delete().eq('id', deleting.id)
    setConfirmingDelete(false); setDeleting(null); fetchData()
  }

  const formFields = (f: ReturnType<typeof emptyForm>, setF: (k: string, v: string) => void, p: DebtLoanPeriod | null, err: string | null) => (
    <div className="px-5 py-4 space-y-3 max-h-[65vh] overflow-y-auto">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Bank Account</label>
        <select value={f.bank_account} onChange={e => setF('bank_account', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]">
          {BANK_ACCOUNT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Tipe Hutang</label>
        <select value={f.debt_type} onChange={e => setF('debt_type', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]">
          {DEBT_TYPE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Tanggal</label>
        <input type="date" value={f.date} onChange={e => setF('date', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Jumlah Hutang <span className="text-red-500">*</span></label>
        <input type="number" value={f.debt_amount} onChange={e => setF('debt_amount', e.target.value)}
          placeholder="0" min="0"
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
      </div>
      {f.debt_type === 'Rekening Koran' ? (
        <div>
          <label className="block text-xs text-gray-500 mb-1">Bunga per Bulan</label>
          <input type="number" value={f.installment_amount} onChange={e => setF('installment_amount', e.target.value)}
            placeholder="0" min="0"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tipe Cicilan</label>
              <select value={f.installment_type} onChange={e => setF('installment_type', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]">
                {INSTALLMENT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Jumlah Cicilan</label>
              <input type="number" value={f.installment_amount} onChange={e => setF('installment_amount', e.target.value)}
                placeholder="0" min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tanggal Lunas</label>
            <input type="date" value={f.due_date} min={f.date} onChange={e => setF('due_date', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
            {p && <p className="text-xs text-gray-400 mt-1">{p.days} hari · {p.weeks} minggu · {p.month} bulan</p>}
          </div>
        </>
      )}
      {err && <p className="text-xs text-red-500">⚠️ {err}</p>}
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-xl mx-auto space-y-4">

        <button onClick={() => router.back()} className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-[#121358] transition">
          <FontAwesomeIcon icon={faChevronLeft} className="w-3 h-3" /> Kembali ke halaman Debt & Loan
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Daftar Debt & Loan</h2>
            <p className="text-xs text-gray-500 mt-0.5">Daftar hutang dan pinjaman.</p>
          </div>
        </div>

        {fetching ? (
          <div className="text-center text-sm text-gray-400 py-10">Memuat...</div>
        ) : list.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-10">Belum ada data.</div>
        ) : (
          <div className="space-y-3">
            {list.map(d => (
              <div key={d.id} className="relative bg-white rounded-xl shadow-sm p-4 border-l-4 border-[#9FA1FF]">
                <div className="flex items-start justify-between gap-3 pr-8">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-800">{d.bank_account}</p>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#9FA1FF]/20 text-[#121358]">{d.debt_type}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{fmtDate(d.date)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Cicilan: {installmentLabel(d.installment_type)} · Rp {fmt(d.installment_amount)}</p>
                    {d.due_date && <p className="text-xs text-gray-500 mt-0.5">Lunas: {fmtDate(d.due_date)}</p>}
                    {d.period && <p className="text-xs text-gray-500 mt-0.5">{d.period.days} hari · {d.period.weeks} minggu · {d.period.month} bulan</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-[#121358]">Rp {fmt(d.debt_amount)}</p>
                  </div>
                </div>
                <button onClick={() => openEdit(d)}
                  className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full text-[#121358]/50 hover:bg-[#121358]/10 hover:text-[#121358] transition">
                  <FontAwesomeIcon icon={faPen} className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-800">Tambah Debt & Loan</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
              </button>
            </div>
            {formFields(form, set, period, error)}
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
              <h3 className="text-sm font-bold text-gray-800">Edit Debt & Loan</h3>
              <button onClick={() => setEditing(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
              </button>
            </div>
            {formFields(editForm, setEdit, editPeriod, editError)}
            {editPeriod && (
              <p className="px-5 text-xs text-amber-600 pb-2">⚠️ Detail cicilan lama akan dihapus dan dibuat ulang.</p>
            )}
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
              <h3 className="text-sm font-bold text-gray-800">Hapus Debt & Loan?</h3>
              <p className="text-xs text-gray-400 mt-1">Semua detail cicilan terkait juga akan dihapus permanen.</p>
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
    </div>
  )
}
