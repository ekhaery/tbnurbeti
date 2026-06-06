'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faXmark, faPen, faTrash } from '@fortawesome/free-solid-svg-icons'
import { SALARY_PERIOD_OPTIONS, salaryPeriodLabel } from '@/lib/employeeOptions'

type SalaryRow = {
  id?: number
  period: string
  amount: string
}

type Employee = {
  id: number
  name: string
  phone_number_1: string | null
  phone_number_2: string | null
  alamat: string | null
  employee_salary: { id: number; period: string; amount: number }[]
}

const fmt = (n: number) => n.toLocaleString('id-ID')

const emptyForm = () => ({
  name: '',
  phone_number_1: '',
  phone_number_2: '',
  alamat: '',
  salaries: [{ period: 'harian', amount: '' }] as SalaryRow[],
})

export default function KaryawanPage() {
  const supabase = createClient()
  const [list, setList] = useState<Employee[]>([])
  const [fetching, setFetching] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState<Employee | null>(null)
  const [editForm, setEditForm] = useState(emptyForm())
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [deleting, setDeleting] = useState<Employee | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const fetchData = async () => {
    const { data } = await supabase
      .from('employees')
      .select('id, name, phone_number_1, phone_number_2, alamat, employee_salary(id, period, amount)')
      .order('name')
    setList((data as Employee[]) ?? [])
    setFetching(false)
  }

  useEffect(() => { fetchData() }, [])

  const set = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }))
  const setEdit = (field: string, value: string) => setEditForm(prev => ({ ...prev, [field]: value }))

  const updateSalary = (form: ReturnType<typeof emptyForm>, setFn: (f: ReturnType<typeof emptyForm>) => void, idx: number, field: 'period' | 'amount', value: string) => {
    setFn({ ...form, salaries: form.salaries.map((s, i) => i === idx ? { ...s, [field]: value } : s) })
  }

  const addSalaryRow = (form: ReturnType<typeof emptyForm>, setFn: (f: ReturnType<typeof emptyForm>) => void) => {
    setFn({ ...form, salaries: [...form.salaries, { period: 'harian', amount: '' }] })
  }

  const removeSalaryRow = (form: ReturnType<typeof emptyForm>, setFn: (f: ReturnType<typeof emptyForm>) => void, idx: number) => {
    setFn({ ...form, salaries: form.salaries.filter((_, i) => i !== idx) })
  }

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Masukkan nama karyawan.'); return }
    setSaving(true); setError(null)

    const { data: emp, error: empErr } = await supabase.from('employees').insert({
      name: form.name.trim(),
      phone_number_1: form.phone_number_1.trim() || null,
      phone_number_2: form.phone_number_2.trim() || null,
      alamat: form.alamat.trim() || null,
    }).select('id').single()

    if (empErr || !emp) { setError(empErr?.message ?? 'Gagal menyimpan.'); setSaving(false); return }

    const salaries = form.salaries.filter(s => s.amount).map(s => ({
      employee_id: emp.id,
      period: s.period,
      amount: parseFloat(s.amount),
    }))
    if (salaries.length > 0) await supabase.from('employee_salary').insert(salaries)

    setSaving(false); setShowForm(false); setForm(emptyForm()); fetchData()
  }

  const openEdit = (e: Employee) => {
    setEditing(e); setEditError(null)
    setEditForm({
      name: e.name,
      phone_number_1: e.phone_number_1 ?? '',
      phone_number_2: e.phone_number_2 ?? '',
      alamat: e.alamat ?? '',
      salaries: e.employee_salary.length > 0
        ? e.employee_salary.map(s => ({ id: s.id, period: s.period, amount: String(s.amount) }))
        : [{ period: 'harian', amount: '' }],
    })
  }

  const handleEditSave = async () => {
    if (!editForm.name.trim()) { setEditError('Masukkan nama karyawan.'); return }
    setEditSaving(true); setEditError(null)

    await supabase.from('employees').update({
      name: editForm.name.trim(),
      phone_number_1: editForm.phone_number_1.trim() || null,
      phone_number_2: editForm.phone_number_2.trim() || null,
      alamat: editForm.alamat.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', editing!.id)

    // Regenerate salaries
    await supabase.from('employee_salary').delete().eq('employee_id', editing!.id)
    const salaries = editForm.salaries.filter(s => s.amount).map(s => ({
      employee_id: editing!.id,
      period: s.period,
      amount: parseFloat(s.amount),
    }))
    if (salaries.length > 0) await supabase.from('employee_salary').insert(salaries)

    setEditSaving(false); setEditing(null); fetchData()
  }

  const handleDelete = async () => {
    if (!deleting) return
    setConfirmingDelete(true)
    await supabase.from('employees').delete().eq('id', deleting.id)
    setConfirmingDelete(false); setDeleting(null); fetchData()
  }

  const FormBody = ({ f, setF, onUpdateSalary, onAddSalary, onRemoveSalary, err }: {
    f: ReturnType<typeof emptyForm>
    setF: (k: string, v: string) => void
    onUpdateSalary: (idx: number, field: 'period' | 'amount', value: string) => void
    onAddSalary: () => void
    onRemoveSalary: (idx: number) => void
    err: string | null
  }) => (
    <div className="px-5 py-4 space-y-3 max-h-[65vh] overflow-y-auto">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Nama <span className="text-red-500">*</span></label>
        <input type="text" value={f.name} onChange={e => setF('name', e.target.value)} placeholder="Nama karyawan"
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Alamat</label>
        <input type="text" value={f.alamat} onChange={e => setF('alamat', e.target.value)} placeholder="Opsional"
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

      {/* Salary rows */}
      <div className="pt-2 border-t border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Komponen Gaji</p>
        <div className="space-y-2">
          {f.salaries.map((s, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <select value={s.period} onChange={e => onUpdateSalary(idx, 'period', e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]">
                {SALARY_PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <input type="number" value={s.amount} onChange={e => onUpdateSalary(idx, 'amount', e.target.value)}
                placeholder="0" min="0"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
              <button type="button" onClick={() => onRemoveSalary(idx)} disabled={f.salaries.length === 1}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-red-50 hover:bg-red-100 text-red-400 disabled:opacity-20 transition">
                <FontAwesomeIcon icon={faXmark} className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={onAddSalary}
          className="mt-2 w-full border border-dashed border-gray-200 rounded-lg py-2 text-xs text-[#121358] hover:border-[#121358]/30 transition">
          + Tambah Komponen
        </button>
      </div>

      {err && <p className="text-xs text-red-500">⚠️ {err}</p>}
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-xl mx-auto space-y-4">

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Karyawan</h2>
            <p className="text-xs text-gray-500 mt-0.5">Daftar karyawan dan komponen gaji.</p>
          </div>
          <button onClick={() => { setShowForm(true); setError(null) }}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-[#121358] text-white hover:bg-[#1a1c6e] transition">
            <FontAwesomeIcon icon={faPlus} className="w-3 h-3" /> Tambah
          </button>
        </div>

        {fetching ? (
          <div className="text-center text-sm text-gray-400 py-10">Memuat...</div>
        ) : list.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-10">Belum ada karyawan.</div>
        ) : (
          <div className="space-y-2">
            {list.map(e => (
              <div key={e.id} className="relative bg-white rounded-xl shadow-sm p-4 border-l-4 border-[#9FA1FF]">
                <div className="pr-8">
                  <p className="text-sm font-semibold text-gray-800">{e.name}</p>
                  {e.alamat && <p className="text-xs text-gray-500 mt-0.5">{e.alamat}</p>}
                  <div className="flex gap-3 mt-0.5">
                    {e.phone_number_1 && <p className="text-xs text-gray-500">{e.phone_number_1}</p>}
                    {e.phone_number_2 && <p className="text-xs text-gray-500">{e.phone_number_2}</p>}
                  </div>
                  {e.employee_salary.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {e.employee_salary.map(s => (
                        <span key={s.id} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#9FA1FF]/20 text-[#121358]">
                          {salaryPeriodLabel(s.period)}: Rp {fmt(s.amount)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => openEdit(e)}
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
              <h3 className="text-sm font-bold text-gray-800">Tambah Karyawan</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
              </button>
            </div>
            <FormBody f={form} setF={set} err={error}
              onUpdateSalary={(idx, field, val) => updateSalary(form, setForm, idx, field, val)}
              onAddSalary={() => addSalaryRow(form, setForm)}
              onRemoveSalary={(idx) => removeSalaryRow(form, setForm, idx)} />
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
              <h3 className="text-sm font-bold text-gray-800">Edit Karyawan</h3>
              <button onClick={() => setEditing(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
              </button>
            </div>
            <FormBody f={editForm} setF={setEdit} err={editError}
              onUpdateSalary={(idx, field, val) => updateSalary(editForm, setEditForm, idx, field, val)}
              onAddSalary={() => addSalaryRow(editForm, setEditForm)}
              onRemoveSalary={(idx) => removeSalaryRow(editForm, setEditForm, idx)} />
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
              <h3 className="text-sm font-bold text-gray-800">Hapus Karyawan?</h3>
              <p className="text-xs text-gray-400 mt-1"><span className="font-semibold">{deleting.name}</span> dan data gajinya akan dihapus permanen.</p>
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
