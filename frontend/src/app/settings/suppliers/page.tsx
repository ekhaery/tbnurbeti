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
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [popupEditMode, setPopupEditMode] = useState(false)

  const fetchData = async () => {
    const { data } = await supabase.from('suppliers').select('id, name, phone, address, sales_name, bank_detail').order('id', { ascending: false })
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
    setShowAddModal(false)
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

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Supplier</h2>
            <p className="text-xs text-gray-500 mt-0.5">{fetching ? '...' : `${suppliers.length} supplier`}</p>
          </div>
          <button onClick={() => { setShowAddModal(true); setError(null) }}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-[#121358] text-white hover:bg-[#1a1c6e] transition">
            <FontAwesomeIcon icon={faPlus} className="w-3 h-3" /> Supplier
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">⚠️ {error}</div>
        )}

        {/* Search */}
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Cari nama supplier..."
          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#121358] shadow-sm"
        />

        {/* List */}
        {fetching ? (
          <div className="text-center text-sm text-gray-400 py-10">Memuat...</div>
        ) : suppliers.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-10">Belum ada supplier.</div>
        ) : (
          <div className="space-y-2">
            {suppliers.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())).map(s => (
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
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => setSelectedSupplier(s)}>
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
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Supplier Detail Popup */}
      {selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">

            {/* Header */}
            <div className="px-5 py-4 bg-[#121358] flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-bold text-white">{popupEditMode ? 'Edit Supplier' : selectedSupplier.name}</p>
                {!popupEditMode && selectedSupplier.sales_name && (
                  <p className="text-xs text-white/60 mt-0.5">Sales: {selectedSupplier.sales_name}</p>
                )}
              </div>
              <button onClick={() => { setSelectedSupplier(null); setPopupEditMode(false) }} className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white shrink-0 transition">
                <FontAwesomeIcon icon={faXmark} className="w-3 h-3" />
              </button>
            </div>

            {popupEditMode ? (
              /* Edit form */
              <>
                <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Nama <span className="text-red-500">*</span></label>
                    <input type="text" value={editName} onChange={e => setEditName(e.target.value)} autoFocus className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Nama Sales</label>
                      <input type="text" value={editSalesName} onChange={e => setEditSalesName(e.target.value)} placeholder="Opsional" className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">No. Telepon</label>
                      <input type="text" value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="Opsional" className={inputCls} />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">Alamat</label>
                      <input type="text" value={editAddress} onChange={e => setEditAddress(e.target.value)} placeholder="Opsional" className={inputCls} />
                    </div>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Info Rekening</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Bank</label>
                        <input type="text" value={editBank.bank ?? ''} onChange={e => setEditBank(b => ({ ...b, bank: e.target.value }))} placeholder="Opsional" className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">No. Rekening</label>
                        <input type="text" value={editBank.no_rek ?? ''} onChange={e => setEditBank(b => ({ ...b, no_rek: e.target.value }))} placeholder="Opsional" className={inputCls} />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">Rekening Atas Nama</label>
                        <input type="text" value={editBank.rek_name ?? ''} onChange={e => setEditBank(b => ({ ...b, rek_name: e.target.value }))} placeholder="Opsional" className={inputCls} />
                      </div>
                    </div>
                  </div>
                  {error && <p className="text-xs text-red-500">⚠️ {error}</p>}
                </div>
                <div className="flex gap-2 px-5 py-3 border-t border-gray-100">
                  <button onClick={() => setPopupEditMode(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition">Batal</button>
                  <button onClick={async () => {
                    await handleEdit(selectedSupplier.id)
                    const updated = { ...selectedSupplier, name: editName.trim(), phone: editPhone.trim() || null, address: editAddress.trim() || null, sales_name: editSalesName.trim() || null, bank_detail: buildBankDetail(editBank) }
                    setSelectedSupplier(updated)
                    setPopupEditMode(false)
                  }} disabled={saving || !editName.trim()} className="flex-1 py-2.5 rounded-xl bg-[#121358] hover:bg-[#1a1c6e] disabled:bg-[#121358]/40 text-white text-sm font-semibold transition">
                    {saving ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              </>
            ) : (
              /* Detail view */
              <>
                <div className="px-5 py-4 space-y-3">
                  {selectedSupplier.phone && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">No. Telepon</p>
                      <p className="text-sm text-gray-800 mt-0.5">{selectedSupplier.phone}</p>
                    </div>
                  )}
                  {selectedSupplier.address && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Alamat</p>
                      <p className="text-sm text-gray-800 mt-0.5">{selectedSupplier.address}</p>
                    </div>
                  )}
                  {selectedSupplier.bank_detail && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Info Rekening</p>
                      <p className="text-sm text-gray-800 mt-0.5">
                        {[selectedSupplier.bank_detail.bank, selectedSupplier.bank_detail.no_rek, selectedSupplier.bank_detail.rek_name].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  )}
                  {!selectedSupplier.phone && !selectedSupplier.address && !selectedSupplier.bank_detail && (
                    <p className="text-sm text-gray-400 text-center py-2">Tidak ada detail tambahan.</p>
                  )}
                </div>
                <div className="px-5 py-3 border-t border-gray-100 flex gap-2">
                  <button onClick={() => {
                    setEditName(selectedSupplier.name)
                    setEditPhone(selectedSupplier.phone ?? '')
                    setEditAddress(selectedSupplier.address ?? '')
                    setEditSalesName(selectedSupplier.sales_name ?? '')
                    setEditBank({ bank: selectedSupplier.bank_detail?.bank ?? '', no_rek: selectedSupplier.bank_detail?.no_rek ?? '', rek_name: selectedSupplier.bank_detail?.rek_name ?? '' })
                    setPopupEditMode(true)
                  }} className="flex-1 py-2 rounded-xl bg-[#121358] text-white text-sm font-semibold hover:bg-[#1a1c6e] transition flex items-center justify-center gap-1.5">
                    <FontAwesomeIcon icon={faPenToSquare} className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button onClick={() => { setSelectedSupplier(null); handleDelete(selectedSupplier) }} disabled={deletingId === selectedSupplier.id}
                    className="w-10 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 disabled:opacity-50 transition flex items-center justify-center">
                    <FontAwesomeIcon icon={faTrash} className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Add Supplier Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-800">Tambah Supplier</h3>
              <button onClick={() => setShowAddModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
              </button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="px-5 py-4 space-y-3 max-h-[65vh] overflow-y-auto">
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
              </div>
              <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition">Batal</button>
                <button type="submit" disabled={adding || !newName.trim()} className="flex-1 py-2.5 rounded-xl bg-[#121358] hover:bg-[#1a1c6e] disabled:bg-[#121358]/40 text-white text-sm font-semibold transition">
                  {adding ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
