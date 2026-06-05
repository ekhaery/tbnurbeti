'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faXmark, faPen, faTrash } from '@fortawesome/free-solid-svg-icons'
import { PAYMENT_DISCIPLINE_OPTIONS, disciplineConfig } from '@/lib/customerOptions'

type Customer = {
  id: number
  name: string
  address: string | null
  phone_number_1: string | null
  phone_number_2: string | null
  payment_discipline: string | null
  notes: string | null
}

const emptyForm = () => ({
  name: '',
  address: '',
  phone_number_1: '',
  phone_number_2: '',
  payment_discipline: '',
  notes: '',
})

export default function CustomersPage() {
  const supabase = createClient()
  const [list, setList] = useState<Customer[]>([])
  const [fetching, setFetching] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState<Customer | null>(null)
  const [editForm, setEditForm] = useState(emptyForm())
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [deleting, setDeleting] = useState<Customer | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const fetchData = async () => {
    const { data } = await supabase.from('customers').select('*').order('name')
    setList((data as Customer[]) ?? [])
    setFetching(false)
  }

  useEffect(() => { fetchData() }, [])

  const set = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }))
  const setEdit = (field: string, value: string) => setEditForm(prev => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Masukkan nama customer.'); return }
    setSaving(true); setError(null)
    const { error } = await supabase.from('customers').insert({
      name: form.name.trim(),
      address: form.address.trim() || null,
      phone_number_1: form.phone_number_1.trim() || null,
      phone_number_2: form.phone_number_2.trim() || null,
      payment_discipline: form.payment_discipline || null,
      notes: form.notes.trim() || null,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    setShowForm(false); setForm(emptyForm()); fetchData()
  }

  const openEdit = (c: Customer) => {
    setEditing(c); setEditError(null)
    setEditForm({
      name: c.name,
      address: c.address ?? '',
      phone_number_1: c.phone_number_1 ?? '',
      phone_number_2: c.phone_number_2 ?? '',
      payment_discipline: c.payment_discipline ?? 'good',
      notes: c.notes ?? '',
    })
  }

  const handleEditSave = async () => {
    if (!editForm.name.trim()) { setEditError('Masukkan nama customer.'); return }
    setEditSaving(true); setEditError(null)
    const { error } = await supabase.from('customers').update({
      name: editForm.name.trim(),
      address: editForm.address.trim() || null,
      phone_number_1: editForm.phone_number_1.trim() || null,
      phone_number_2: editForm.phone_number_2.trim() || null,
      payment_discipline: editForm.payment_discipline || null,
      notes: editForm.notes.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', editing!.id)
    setEditSaving(false)
    if (error) { setEditError(error.message); return }
    setEditing(null); fetchData()
  }

  const handleDelete = async () => {
    if (!deleting) return
    setConfirmingDelete(true)
    await supabase.from('customers').delete().eq('id', deleting.id)
    setConfirmingDelete(false); setDeleting(null); fetchData()
  }

  const FormBody = ({ f, setF, err }: { f: ReturnType<typeof emptyForm>; setF: (k: string, v: string) => void; err: string | null }) => (
    <div className="px-5 py-4 space-y-3 max-h-[65vh] overflow-y-auto">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Nama <span className="text-red-500">*</span></label>
        <input type="text" value={f.name} onChange={e => setF('name', e.target.value)} placeholder="Nama customer"
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Alamat</label>
        <input type="text" value={f.address} onChange={e => setF('address', e.target.value)} placeholder="Opsional"
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">No. Telepon 1</label>
          <input type="text" value={f.phone_number_1} onChange={e => setF('phone_number_1', e.target.value)} placeholder="Opsional"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">No. Telepon 2</label>
          <input type="text" value={f.phone_number_2} onChange={e => setF('phone_number_2', e.target.value)} placeholder="Opsional"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Kedisiplinan Pembayaran</label>
        <select value={f.payment_discipline} onChange={e => setF('payment_discipline', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]">
          <option value="">— Tidak diisi —</option>
          {PAYMENT_DISCIPLINE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Catatan</label>
        <input type="text" value={f.notes} onChange={e => setF('notes', e.target.value)} placeholder="Opsional"
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
      </div>
      {err && <p className="text-xs text-red-500">⚠️ {err}</p>}
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-xl mx-auto space-y-4">

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Customer</h2>
            <p className="text-xs text-gray-500 mt-0.5">Daftar pelanggan.</p>
          </div>
          <button onClick={() => { setShowForm(true); setError(null) }}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-[#121358] text-white hover:bg-[#1a1c6e] transition">
            <FontAwesomeIcon icon={faPlus} className="w-3 h-3" /> Tambah
          </button>
        </div>

        {fetching ? (
          <div className="text-center text-sm text-gray-400 py-10">Memuat...</div>
        ) : list.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-10">Belum ada customer.</div>
        ) : (
          <div className="space-y-2">
            {list.map(c => {
              const disc = disciplineConfig(c.payment_discipline ?? '')
              return (
                <div key={c.id} className="relative bg-white rounded-xl shadow-sm p-4 border-l-4 border-[#9FA1FF]">
                  <div className="pr-8">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                      {c.payment_discipline && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${disc.className}`}>
                          {disc.label}
                        </span>
                      )}
                    </div>
                    {c.address && <p className="text-xs text-gray-500 mt-0.5">{c.address}</p>}
                    <div className="flex gap-3 mt-0.5">
                      {c.phone_number_1 && <p className="text-xs text-gray-500">{c.phone_number_1}</p>}
                      {c.phone_number_2 && <p className="text-xs text-gray-500">{c.phone_number_2}</p>}
                    </div>
                    {c.notes && <p className="text-xs text-gray-400 mt-0.5 italic">{c.notes}</p>}
                  </div>
                  <button onClick={() => openEdit(c)}
                    className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full text-[#121358]/50 hover:bg-[#121358]/10 hover:text-[#121358] transition">
                    <FontAwesomeIcon icon={faPen} className="w-3 h-3" />
                  </button>
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
              <h3 className="text-sm font-bold text-gray-800">Tambah Customer</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
              </button>
            </div>
            <FormBody f={form} setF={set} err={error} />
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
              <h3 className="text-sm font-bold text-gray-800">Edit Customer</h3>
              <button onClick={() => setEditing(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
              </button>
            </div>
            <FormBody f={editForm} setF={setEdit} err={editError} />
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
              <h3 className="text-sm font-bold text-gray-800">Hapus Customer?</h3>
              <p className="text-xs text-gray-400 mt-1"><span className="font-semibold">{deleting.name}</span> akan dihapus permanen.</p>
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
