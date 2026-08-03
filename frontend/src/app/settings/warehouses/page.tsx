'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faPenToSquare, faCheck, faXmark } from '@fortawesome/free-solid-svg-icons'
import WarehouseTabs from '@/lib/WarehouseTabs'

type Warehouse = {
  id: number
  name: string
  code: string
  type: 'warehouse' | 'store' | 'rack' | 'bin'
  parent_id: number | null
  is_active: boolean
}

const TYPE_LABELS: Record<string, string> = {
  warehouse: 'Warehouse',
  store: 'Store',
  rack: 'Rack',
  bin: 'Bin',
}

const TYPE_COLORS: Record<string, string> = {
  warehouse: 'bg-blue-50 text-blue-600',
  store: 'bg-green-50 text-green-600',
  rack: 'bg-amber-50 text-amber-600',
  bin: 'bg-gray-100 text-gray-500',
}

const emptyForm = { name: '', code: '', type: 'warehouse' as Warehouse['type'], parent_id: '' }

export default function WarehousesPage() {
  const supabase = createClient()

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [fetching, setFetching] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [adding, setAdding] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchWarehouses = async () => {
    const { data } = await supabase
      .from('warehouses')
      .select('id, name, code, type, parent_id, is_active')
      .order('name')
    setWarehouses((data as Warehouse[]) ?? [])
    setFetching(false)
  }

  useEffect(() => { fetchWarehouses() }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.code.trim()) return
    setAdding(true)
    setError(null)
    const { error: err } = await supabase.from('warehouses').insert({
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      type: form.type,
      parent_id: form.parent_id ? Number(form.parent_id) : null,
      is_active: true,
    })
    setAdding(false)
    if (err) { setError(err.message); return }
    setForm(emptyForm)
    setShowForm(false)
    fetchWarehouses()
  }

  const openEdit = (w: Warehouse) => {
    setEditId(w.id)
    setEditForm({ name: w.name, code: w.code, type: w.type, parent_id: w.parent_id ? String(w.parent_id) : '' })
    setError(null)
  }

  const handleEdit = async (id: number) => {
    if (!editForm.name.trim() || !editForm.code.trim()) return
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from('warehouses').update({
      name: editForm.name.trim(),
      code: editForm.code.trim().toUpperCase(),
      type: editForm.type,
      parent_id: editForm.parent_id ? Number(editForm.parent_id) : null,
    }).eq('id', id)
    setSaving(false)
    if (err) { setError(err.message); return }
    setEditId(null)
    fetchWarehouses()
  }

  const toggleActive = async (w: Warehouse) => {
    await supabase.from('warehouses').update({ is_active: !w.is_active }).eq('id', w.id)
    fetchWarehouses()
  }

  const parentOptions = warehouses.filter(w => w.type === 'warehouse' || w.type === 'store')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-xl mx-auto space-y-4">

        <WarehouseTabs />

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Warehouse</h2>
            <p className="text-xs text-gray-500 mt-0.5">{fetching ? '...' : `${warehouses.length} lokasi`}</p>
          </div>
          <button
            onClick={() => { setShowForm(v => !v); setError(null) }}
            className="flex items-center gap-1.5 bg-[#121358] text-white text-xs font-semibold px-3 py-2 rounded-xl"
          >
            <FontAwesomeIcon icon={showForm ? faXmark : faPlus} className="w-3 h-3" />
            {showForm ? 'Batal' : 'Tambah'}
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            ⚠️ {error}
          </div>
        )}

        {showForm && (
          <form onSubmit={handleAdd} className="bg-white rounded-xl shadow-sm p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-600">Warehouse Baru</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nama <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Gudang Utama"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Kode <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value })}
                  placeholder="WH-01"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tipe</label>
                <select
                  value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value as Warehouse['type'] })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#121358]"
                >
                  <option value="warehouse">Warehouse</option>
                  <option value="store">Store</option>
                  <option value="rack">Rack</option>
                  <option value="bin">Bin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Parent (opsional)</label>
                <select
                  value={form.parent_id}
                  onChange={e => setForm({ ...form, parent_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#121358]"
                >
                  <option value="">-- Tidak ada --</option>
                  {parentOptions.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={adding || !form.name.trim() || !form.code.trim()}
              className="w-full bg-[#121358] hover:bg-[#1a1c6e] disabled:bg-[#121358]/40 text-white text-sm font-semibold py-2.5 rounded-lg transition"
            >
              {adding ? 'Menyimpan...' : 'Simpan'}
            </button>
          </form>
        )}

        {fetching ? (
          <div className="text-center text-sm text-gray-400 py-10">Memuat...</div>
        ) : warehouses.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-10">Belum ada warehouse.</div>
        ) : (
          <div className="space-y-2">
            {warehouses.map(w => (
              <div key={w.id} className="bg-white rounded-xl shadow-sm px-4 py-3">
                {editId === w.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                        autoFocus
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]"
                      />
                      <input
                        type="text"
                        value={editForm.code}
                        onChange={e => setEditForm({ ...editForm, code: e.target.value })}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <select
                        value={editForm.type}
                        onChange={e => setEditForm({ ...editForm, type: e.target.value as Warehouse['type'] })}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#121358]"
                      >
                        <option value="warehouse">Warehouse</option>
                        <option value="store">Store</option>
                        <option value="rack">Rack</option>
                        <option value="bin">Bin</option>
                      </select>
                      <select
                        value={editForm.parent_id}
                        onChange={e => setEditForm({ ...editForm, parent_id: e.target.value })}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#121358]"
                      >
                        <option value="">-- Tidak ada --</option>
                        {parentOptions.filter(p => p.id !== w.id).map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(w.id)} disabled={saving}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-100 hover:bg-green-200 text-green-700 text-xs font-medium transition">
                        <FontAwesomeIcon icon={faCheck} className="w-3 h-3" /> Simpan
                      </button>
                      <button onClick={() => setEditId(null)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 text-xs font-medium transition">
                        <FontAwesomeIcon icon={faXmark} className="w-3 h-3" /> Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800 truncate">{w.name}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${TYPE_COLORS[w.type]}`}>
                          {TYPE_LABELS[w.type]}
                        </span>
                        {!w.is_active && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-50 text-red-400">Nonaktif</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{w.code}{w.parent_id ? ` · Parent: ${warehouses.find(p => p.id === w.parent_id)?.name ?? '-'}` : ''}</p>
                    </div>
                    <button onClick={() => openEdit(w)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-[#121358]/10 text-gray-400 hover:text-[#121358] transition"
                      title="Edit">
                      <FontAwesomeIcon icon={faPenToSquare} className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => toggleActive(w)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg transition text-xs font-bold ${w.is_active ? 'bg-green-50 text-green-500 hover:bg-red-50 hover:text-red-400' : 'bg-red-50 text-red-400 hover:bg-green-50 hover:text-green-500'}`}
                      title={w.is_active ? 'Nonaktifkan' : 'Aktifkan'}>
                      {w.is_active ? '✓' : '✕'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
