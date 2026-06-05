'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faPenToSquare, faTrash, faCheck, faXmark } from '@fortawesome/free-solid-svg-icons'

type BankDetail = { bank?: string; no_rek?: string; rek_name?: string }
type Supplier = {
  id: number
  name: string
  phone: string | null
  address: string | null
  sales_name: string | null
  bank_detail: BankDetail | null
}

const emptyBank = (): BankDetail => ({ bank: '', no_rek: '', rek_name: '' })

export default function SuppliersPage() {
  const supabase = createClient()

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // add form
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [newSalesName, setNewSalesName] = useState('')
  const [newBank, setNewBank] = useState<BankDetail>(emptyBank())
  const [adding, setAdding] = useState(false)

  // edit
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editSalesName, setEditSalesName] = useState('')
  const [editBank, setEditBank] = useState<BankDetail>(emptyBank())
  const [saving, setSaving] = useState(false)

  const [deletingId, setDeletingId] = useState<number | null>(null)

  const fetchData = async () => {
    const { data } = await supabase.from('suppliers').select('id, name, phone, address, sales_name, bank_detail').order('name')
    setSuppliers((data as Supplier[]) ?? [])
    setFetching(false)
  }

  useEffect(() => { fetchData() }, [])

  const buildBankDetail = (b: BankDetail) => {
    const obj: BankDetail = {}
    if (b.bank?.trim()) obj.bank = b.bank.trim()
    if (b.no_rek?.trim()) obj.no_rek = b.no_rek.trim()
    if (b.rek_name?.trim()) obj.rek_name = b.rek_name.trim()
    return Object.keys(obj).length ? obj : null
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    setError(null)
    const { error } = await supabase.from('suppliers').insert({
      name: newName.trim(),
      phone: newPhone.trim() || null,
      address: newAddress.trim() || null,
      sales_name: newSalesName.trim() || null,
      bank_detail: buildBankDetail(newBank),
    })
    setAdding(false)
    if (error) { setError(error.message); return }
    setNewName(''); setNewPhone(''); setNewAddress(''); setNewSalesName(''); setNewBank(emptyBank())
    fetchData()
  }

  const handleEdit = async (id: number) => {
    if (!editName.trim()) return
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('suppliers').update({
      name: editName.trim(),
      phone: editPhone.trim() || null,
      address: editAddress.trim() || null,
      sales_name: editSalesName.trim() || null,
      bank_detail: buildBankDetail(editBank),
    }).eq('id', id)
    setSaving(false)
    if (error) { setError(error.message); return }
    setEditId(null)
    fetchData()
  }

  const handleDelete = async (s: Supplier) => {
    if (!confirm(`Hapus supplier "${s.name}"?`)) return
    setDeletingId(s.id)
    await supabase.from('suppliers').delete().eq('id', s.id)
    setDeletingId(null)
    fetchData()
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]'
  const editInputCls = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-xl mx-auto space-y-4">

        <div>
          <h2 className="text-lg font-bold text-gray-800">Supplier</h2>
          <p className="text-xs text-gray-500 mt-0.5">{fetching ? '...' : `${suppliers.length} supplier`}</p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">⚠️ {error}</div>
        )}

        {/* Add form */}
        <form onSubmit={handleAdd} className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tambah Supplier</p>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Nama <span className="text-red-500">*</span></label>
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nama supplier" className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nama Sales</label>
              <input type="text" value={newSalesName} onChange={e => setNewSalesName(e.target.value)} placeholder="Opsional" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">No. Telepon</label>
              <input type="text" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Opsional" className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Alamat</label>
              <input type="text" value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="Opsional" className={inputCls} />
            </div>
          </div>

          {/* Bank detail */}
          <div className="border border-gray-200 rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Info Rekening</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Bank</label>
                <input type="text" value={newBank.bank ?? ''} onChange={e => setNewBank(b => ({ ...b, bank: e.target.value }))} placeholder="Opsional" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">No. Rekening</label>
                <input type="text" value={newBank.no_rek ?? ''} onChange={e => setNewBank(b => ({ ...b, no_rek: e.target.value }))} placeholder="Opsional" className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Rekening Atas Nama</label>
                <input type="text" value={newBank.rek_name ?? ''} onChange={e => setNewBank(b => ({ ...b, rek_name: e.target.value }))} placeholder="Opsional" className={inputCls} />
              </div>
            </div>
          </div>

          <button type="submit" disabled={adding || !newName.trim()}
            className="w-full flex items-center justify-center gap-1.5 bg-[#121358] hover:bg-[#1a1c6e] disabled:bg-[#121358]/40 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition">
            <FontAwesomeIcon icon={faPlus} className="w-3.5 h-3.5" />
            {adding ? 'Menyimpan...' : 'Tambah Supplier'}
          </button>
        </form>

        {/* List */}
        {fetching ? (
          <div className="text-center text-sm text-gray-400 py-10">Memuat...</div>
        ) : suppliers.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-10">Belum ada supplier.</div>
        ) : (
          <div className="space-y-2">
            {suppliers.map(s => (
              <div key={s.id} className="bg-white rounded-xl shadow-sm px-4 py-3">
                {editId === s.id ? (
                  <div className="space-y-2">
                    <input type="text" value={editName} onChange={e => setEditName(e.target.value)} autoFocus
                      className={`w-full ${editInputCls}`} />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" value={editSalesName} onChange={e => setEditSalesName(e.target.value)} placeholder="Nama Sales" className={editInputCls} />
                      <input type="text" value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="No. Telepon" className={editInputCls} />
                      <input type="text" value={editAddress} onChange={e => setEditAddress(e.target.value)} placeholder="Alamat" className={`col-span-2 ${editInputCls}`} />
                    </div>
                    <div className="border border-gray-200 rounded-lg p-2 space-y-2">
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Info Rekening</p>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" value={editBank.bank ?? ''} onChange={e => setEditBank(b => ({ ...b, bank: e.target.value }))} placeholder="Bank" className={editInputCls} />
                        <input type="text" value={editBank.no_rek ?? ''} onChange={e => setEditBank(b => ({ ...b, no_rek: e.target.value }))} placeholder="No. Rekening" className={editInputCls} />
                        <input type="text" value={editBank.rek_name ?? ''} onChange={e => setEditBank(b => ({ ...b, rek_name: e.target.value }))} placeholder="Rekening Atas Nama" className={`col-span-2 ${editInputCls}`} />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditId(null)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                        <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleEdit(s.id)} disabled={saving} className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-100 hover:bg-green-200 text-green-600 transition">
                        <FontAwesomeIcon icon={faCheck} className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{s.name}</p>
                      {(s.sales_name || s.phone) && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {[s.sales_name, s.phone].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {s.address && <p className="text-xs text-gray-400 truncate">{s.address}</p>}
                      {s.bank_detail && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {[s.bank_detail.bank, s.bank_detail.no_rek, s.bank_detail.rek_name ? `a.n. ${s.bank_detail.rek_name}` : null].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setEditId(s.id)
                        setEditName(s.name)
                        setEditPhone(s.phone ?? '')
                        setEditAddress(s.address ?? '')
                        setEditSalesName(s.sales_name ?? '')
                        setEditBank({ bank: s.bank_detail?.bank ?? '', no_rek: s.bank_detail?.no_rek ?? '', rek_name: s.bank_detail?.rek_name ?? '' })
                      }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-[#121358]/10 text-gray-400 hover:text-[#121358] transition"
                    >
                      <FontAwesomeIcon icon={faPenToSquare} className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(s)} disabled={deletingId === s.id}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-red-100 text-gray-400 hover:text-red-500 disabled:opacity-50 transition">
                      <FontAwesomeIcon icon={faTrash} className="w-3.5 h-3.5" />
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
