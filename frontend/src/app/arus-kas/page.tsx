'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { localDateStr } from '@/lib/date'
import { useAuth } from '@/context/AuthContext'
import DeleteConfirmPopup from '@/components/DeleteConfirmPopup'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faXmark, faPen, faTrash } from '@fortawesome/free-solid-svg-icons'

type OutflowRow = {
  id: number
  date: string
  category: string | null
  amount: number
  description: string | null
}

type CashOpening = {
  id: number
  date: string
  amount: number
} | null

const fmt = (n: number) => n.toLocaleString('id-ID')

const emptyForm = (date: string) => ({
  date,
  category: '',
  amount: '',
  description: '',
})

export default function ArusKasPage() {
  const supabase = createClient()
  const { appUser } = useAuth()
  const [selectedDate, setSelectedDate] = useState(localDateStr())

  // Kas awal
  const [kasAwal, setKasAwal] = useState<CashOpening>(null)
  const [kasAwalInput, setKasAwalInput] = useState('')
  const [savingKasAwal, setSavingKasAwal] = useState(false)

  // Outflow list
  const [rows, setRows] = useState<OutflowRow[]>([])
  const [loading, setLoading] = useState(true)

  // Add/edit form
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm(selectedDate))
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Delete
  const [deleting, setDeleting] = useState<OutflowRow | null>(null)
  const [deleteInput, setDeleteInput] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    const [{ data: opening }, { data: outflowRows }] = await Promise.all([
      supabase.from('cash_openings').select('id, date, amount').eq('date', selectedDate).maybeSingle(),
      supabase
        .from('outflow')
        .select('id, date, category, amount, description')
        .eq('date', selectedDate)
        .is('purchasing_id', null)
        .is('debt_loan_id', null)
        .order('id', { ascending: false }),
    ])
    setKasAwal((opening as CashOpening) ?? null)
    setKasAwalInput(opening ? String((opening as { amount: number }).amount) : '')
    setRows((outflowRows as OutflowRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [selectedDate]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }))

  const totalOperasional = rows.reduce((sum, r) => sum + (r.amount ?? 0), 0)

  const handleSaveKasAwal = async () => {
    if (!kasAwalInput) return
    setSavingKasAwal(true)
    await supabase.from('cash_openings').upsert(
      { date: selectedDate, amount: parseFloat(kasAwalInput) || 0, created_by: appUser?.id ?? null },
      { onConflict: 'date' }
    )
    setSavingKasAwal(false)
    fetchData()
  }

  const openAdd = () => {
    setEditingId(null)
    setForm(emptyForm(selectedDate))
    setError(null)
    setShowForm(true)
  }

  const openEdit = (r: OutflowRow) => {
    setEditingId(r.id)
    setForm({ date: r.date, category: r.category ?? '', amount: String(r.amount), description: r.description ?? '' })
    setError(null)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.category.trim()) { setError('Masukkan kategori pengeluaran.'); return }
    if (!form.amount || parseFloat(form.amount) <= 0) { setError('Masukkan jumlah pengeluaran.'); return }
    setSaving(true); setError(null)

    const payload = {
      date: form.date,
      category: form.category.trim(),
      amount: parseFloat(form.amount),
      description: form.description.trim() || null,
      purchasing_id: null,
      debt_loan_id: null,
      paid_by: appUser?.id ?? null,
    }

    const { error } = editingId
      ? await supabase.from('outflow').update(payload).eq('id', editingId)
      : await supabase.from('outflow').insert(payload)

    if (error) { setError(error.message); setSaving(false); return }
    setSaving(false); setShowForm(false); fetchData()
  }

  const handleDelete = async () => {
    if (!deleting || deleteInput !== 'delete') return
    setConfirmingDelete(true)
    await supabase.from('outflow').delete().eq('id', deleting.id)
    setConfirmingDelete(false); setDeleting(null); setDeleteInput('')
    fetchData()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-2xl mx-auto space-y-4">

        <div>
          <h2 className="text-lg font-bold text-gray-800">Arus Kas</h2>
          <p className="text-xs text-gray-500 mt-0.5">Kas awal & pengeluaran operasional harian.</p>
        </div>

        {/* Date picker */}
        <div className="rounded-2xl shadow-sm px-4 py-3 space-y-2" style={{ backgroundColor: '#B5BAFF' }}>
          <label className="block text-[10px] font-semibold text-[#121358] uppercase tracking-wide mb-1">Tanggal</label>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            className="w-auto bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#121358]" />
        </div>

        {/* Kas Awal */}
        <div className="bg-white rounded-2xl shadow-sm px-4 py-3 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Kas Awal</p>
          <div className="flex gap-2">
            <input type="number" min="0" value={kasAwalInput} onChange={e => setKasAwalInput(e.target.value)}
              placeholder="0"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
            <button onClick={handleSaveKasAwal} disabled={savingKasAwal || !kasAwalInput}
              className="px-4 py-2 rounded-lg bg-[#121358] hover:bg-[#1a1c6e] disabled:bg-[#121358]/40 text-white text-sm font-semibold transition">
              {savingKasAwal ? '...' : 'Simpan'}
            </button>
          </div>
          {kasAwal && <p className="text-[10px] text-gray-400">Tersimpan: Rp {fmt(kasAwal.amount)}</p>}
        </div>

        {/* Total + Add button */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Total Pengeluaran Operasional</p>
            <p className="text-sm font-bold text-red-500">Rp {fmt(totalOperasional)}</p>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#121358] hover:bg-[#1a1c6e] text-white text-sm font-semibold transition">
            <FontAwesomeIcon icon={faPlus} className="w-3.5 h-3.5" /> Tambah
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center text-sm text-gray-400 py-10">Memuat data...</div>
        ) : rows.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-10">Belum ada pengeluaran operasional untuk tanggal ini.</div>
        ) : (
          <div className="space-y-2">
            {rows.map(r => (
              <div key={r.id} className="relative bg-white rounded-2xl shadow-sm px-4 py-3 pr-16">
                <div className="flex justify-between items-start">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-gray-800">{r.category}</p>
                    {r.description && <p className="text-xs text-gray-500">{r.description}</p>}
                  </div>
                  <p className="text-sm font-bold text-[#121358]">Rp {fmt(r.amount)}</p>
                </div>
                <div className="absolute top-3 right-3 flex gap-1">
                  <button onClick={() => openEdit(r)}
                    className="w-7 h-7 flex items-center justify-center rounded-full text-[#121358]/50 hover:bg-[#121358]/10 hover:text-[#121358] transition">
                    <FontAwesomeIcon icon={faPen} className="w-3 h-3" />
                  </button>
                  <button onClick={() => { setDeleting(r); setDeleteInput('') }}
                    className="w-7 h-7 flex items-center justify-center rounded-full text-red-400/70 hover:bg-red-50 hover:text-red-500 transition">
                    <FontAwesomeIcon icon={faTrash} className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-[11px] text-gray-400 text-center">
          Pengeluaran ini otomatis muncul di{' '}
          <Link href="/laporan-pengeluaran" className="text-[#121358] font-semibold hover:underline">
            Laporan Pengeluaran → Operasional
          </Link>.
        </p>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-800">{editingId ? 'Edit' : 'Tambah'} Pengeluaran Operasional</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tanggal</label>
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Kategori <span className="text-red-500">*</span></label>
                <input type="text" value={form.category} onChange={e => set('category', e.target.value)}
                  placeholder="Contoh: Plastik, Bensin"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Jumlah <span className="text-red-500">*</span></label>
                <input type="number" min="0" value={form.amount} onChange={e => set('amount', e.target.value)}
                  placeholder="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Deskripsi</label>
                <input type="text" value={form.description} onChange={e => set('description', e.target.value)}
                  placeholder="Opsional"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
              </div>
              {error && <p className="text-xs text-red-500">⚠️ {error}</p>}
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition">Batal</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-[#121358] hover:bg-[#1a1c6e] disabled:bg-[#121358]/40 text-white text-sm font-semibold transition">
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleting && (
        <DeleteConfirmPopup
          title="Hapus Pengeluaran?"
          description={`${deleting.category ?? '—'} · Rp ${fmt(deleting.amount)}`}
          confirmText={deleteInput}
          onConfirmTextChange={setDeleteInput}
          onConfirm={handleDelete}
          onCancel={() => { setDeleting(null); setDeleteInput('') }}
          loading={confirmingDelete}
        />
      )}
    </div>
  )
}
