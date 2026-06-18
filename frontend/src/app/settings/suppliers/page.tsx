'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faPenToSquare, faTrash, faXmark } from '@fortawesome/free-solid-svg-icons'
import DeleteConfirmPopup from '@/components/DeleteConfirmPopup'

type BankDetail = { bank?: string; no_rek?: string; rek_name?: string }
type SupplierDetail = { product_categories?: number[]; products?: number[] }
type Supplier = {
  id: number
  name: string
  phone: string | null
  address: string | null
  sales_name: string | null
  bank_detail: BankDetail | null
  detail: SupplierDetail | null
}
type Category = { id: number; name: string }
type Product = { id: number; name: string }

const emptyBank = (): BankDetail => ({ bank: '', no_rek: '', rek_name: '' })

export default function SuppliersPage() {
  const supabase = createClient()

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [categories, setCategories] = useState<Category[]>([])
  const [productsList, setProductsList] = useState<Product[]>([])

  // add form
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [newSalesName, setNewSalesName] = useState('')
  const [newBank, setNewBank] = useState<BankDetail>(emptyBank())
  const [newCategories, setNewCategories] = useState<number[]>([])
  const [newProducts, setNewProducts] = useState<number[]>([])
  const [newCatQuery, setNewCatQuery] = useState('')
  const [newCatDropdown, setNewCatDropdown] = useState(false)
  const [newProdQuery, setNewProdQuery] = useState('')
  const [newProdDropdown, setNewProdDropdown] = useState(false)
  const [adding, setAdding] = useState(false)

  // edit
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editSalesName, setEditSalesName] = useState('')
  const [editBank, setEditBank] = useState<BankDetail>(emptyBank())
  const [editCategories, setEditCategories] = useState<number[]>([])
  const [editProducts, setEditProducts] = useState<number[]>([])
  const [catQuery, setCatQuery] = useState('')
  const [catDropdown, setCatDropdown] = useState(false)
  const [prodQuery, setProdQuery] = useState('')
  const [prodDropdown, setProdDropdown] = useState(false)
  const [saving, setSaving] = useState(false)

  const [showAddModal, setShowAddModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [popupEditMode, setPopupEditMode] = useState(false)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null)
  const [deleteInput, setDeleteInput] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const fetchData = async () => {
    const { data } = await supabase.from('suppliers')
      .select('id, name, phone, address, sales_name, bank_detail, detail')
      .order('id', { ascending: false })
    setSuppliers((data as Supplier[]) ?? [])
    setFetching(false)
  }

  useEffect(() => {
    fetchData()
    supabase.from('categories').select('id, name').order('name')
      .then(({ data }: { data: Category[] | null }) => setCategories(data ?? []))
    // fetch products in chunks
    const fetchProds = async () => {
      const chunkSize = 1000; let from = 0; const all: Product[] = []
      while (true) {
        const { data, error } = await supabase.from('products').select('id, name').eq('is_deleted', false).order('name').range(from, from + chunkSize - 1)
        if (error || !data || data.length === 0) break
        all.push(...(data as Product[])); if (data.length < chunkSize) break; from += chunkSize
      }
      setProductsList(all)
    }
    fetchProds()
  }, [])

  const buildBankDetail = (b: BankDetail) => {
    const obj: BankDetail = {}
    if (b.bank?.trim()) obj.bank = b.bank.trim()
    if (b.no_rek?.trim()) obj.no_rek = b.no_rek.trim()
    if (b.rek_name?.trim()) obj.rek_name = b.rek_name.trim()
    return Object.keys(obj).length ? obj : null
  }

  const buildDetail = (cats: number[], prods: number[]): SupplierDetail | null => {
    if (cats.length === 0 && prods.length === 0) return null
    return { product_categories: cats, products: prods }
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true); setError(null)
    const { error } = await supabase.from('suppliers').insert({
      name: newName.trim(), phone: newPhone.trim() || null, address: newAddress.trim() || null,
      sales_name: newSalesName.trim() || null, bank_detail: buildBankDetail(newBank),
      detail: buildDetail(newCategories, newProducts),
    })
    setAdding(false)
    if (error) { setError(error.message); return }
    setNewName(''); setNewPhone(''); setNewAddress(''); setNewSalesName(''); setNewBank(emptyBank())
    setNewCategories([]); setNewProducts([]); setNewCatQuery(''); setNewProdQuery('')
    setShowAddModal(false); fetchData()
  }

  const handleEdit = async (id: number) => {
    if (!editName.trim()) return
    setSaving(true); setError(null)
    const { error } = await supabase.from('suppliers').update({
      name: editName.trim(), phone: editPhone.trim() || null, address: editAddress.trim() || null,
      sales_name: editSalesName.trim() || null, bank_detail: buildBankDetail(editBank),
      detail: buildDetail(editCategories, editProducts),
    }).eq('id', id)
    setSaving(false)
    if (error) { setError(error.message); return }
  }

  const handleDelete = async () => {
    if (!deleteTarget || deleteInput !== 'delete') return
    setConfirmingDelete(true)
    await supabase.from('suppliers').delete().eq('id', deleteTarget.id)
    setConfirmingDelete(false); setDeleteTarget(null); setDeleteInput(''); setSelectedSupplier(null)
    fetchData()
  }

  const openEdit = (s: Supplier) => {
    setEditName(s.name); setEditPhone(s.phone ?? ''); setEditAddress(s.address ?? '')
    setEditSalesName(s.sales_name ?? '')
    setEditBank({ bank: s.bank_detail?.bank ?? '', no_rek: s.bank_detail?.no_rek ?? '', rek_name: s.bank_detail?.rek_name ?? '' })
    setEditCategories(s.detail?.product_categories ?? [])
    setEditProducts(s.detail?.products ?? [])
    setCatQuery(''); setProdQuery('')
    setPopupEditMode(true)
  }

  const toggleCat = (id: number) => setEditCategories(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const toggleProd = (id: number) => setEditProducts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]'

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

        {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">⚠️ {error}</div>}

        {/* Search */}
        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder="Cari nama supplier..."
          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#121358] shadow-sm" />

        {/* List */}
        {fetching ? (
          <div className="text-center text-sm text-gray-400 py-10">Memuat...</div>
        ) : suppliers.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-10">Belum ada supplier.</div>
        ) : (
          <div className="space-y-2">
            {suppliers.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())).map(s => (
              <div key={s.id} className="bg-white rounded-xl shadow-sm px-4 py-3 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedSupplier(s)}>
                <p className="text-sm font-medium text-gray-800">{s.name}</p>
                {(s.sales_name || s.phone) && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{[s.sales_name, s.phone].filter(Boolean).join(' · ')}</p>
                )}
                {s.address && <p className="text-xs text-gray-400 truncate">{s.address}</p>}
                {s.bank_detail && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {[s.bank_detail.bank, s.bank_detail.no_rek, s.bank_detail.rek_name ? `a.n. ${s.bank_detail.rek_name}` : null].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Supplier Detail / Edit Popup */}
      {selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="px-5 py-4 bg-[#121358] flex items-start justify-between gap-3 shrink-0">
              <div>
                <p className="text-base font-bold text-white">{popupEditMode ? 'Edit Supplier' : selectedSupplier.name}</p>
                {!popupEditMode && selectedSupplier.sales_name && (
                  <p className="text-xs text-white/60 mt-0.5">Sales: {selectedSupplier.sales_name}</p>
                )}
              </div>
              <button onClick={() => { setSelectedSupplier(null); setPopupEditMode(false) }}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white shrink-0 transition">
                <FontAwesomeIcon icon={faXmark} className="w-3 h-3" />
              </button>
            </div>

            {popupEditMode ? (
              <>
                <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1">
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

                  {/* Bank */}
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

                  {/* Kategori Produk */}
                  <div className="border border-gray-200 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Kategori Produk</p>
                    {editCategories.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {editCategories.map(id => {
                          const cat = categories.find(c => c.id === id)
                          return cat ? (
                            <span key={id} className="flex items-center gap-1 text-xs font-medium bg-[#121358]/10 text-[#121358] px-2 py-1 rounded-full">
                              {cat.name}
                              <button type="button" onClick={() => toggleCat(id)} className="ml-0.5 hover:text-red-500">×</button>
                            </span>
                          ) : null
                        })}
                      </div>
                    )}
                    <div className="relative">
                      <input type="text" value={catQuery} onChange={e => { setCatQuery(e.target.value); setCatDropdown(true) }}
                        onFocus={() => setCatDropdown(true)} onBlur={() => setTimeout(() => setCatDropdown(false), 150)}
                        placeholder="Cari kategori..." className={inputCls} />
                      {catDropdown && (
                        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                          {categories.filter(c => c.name.toLowerCase().includes(catQuery.toLowerCase())).map(c => (
                            <button key={c.id} type="button"
                              onMouseDown={() => { toggleCat(c.id); setCatQuery('') }}
                              className={`w-full text-left px-4 py-2 text-sm transition flex items-center justify-between ${editCategories.includes(c.id) ? 'bg-[#121358] text-white' : 'text-gray-700 hover:bg-gray-50'}`}>
                              {c.name}
                              {editCategories.includes(c.id) && <span className="text-xs">✓</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tambahkan Produk */}
                  <div className="border border-gray-200 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Tambahkan Produk</p>
                    {editProducts.length > 0 && (
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                        {editProducts.map(id => {
                          const prod = productsList.find(p => p.id === id)
                          return prod ? (
                            <span key={id} className="flex items-center gap-1 text-xs font-medium bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                              {prod.name}
                              <button type="button" onClick={() => toggleProd(id)} className="ml-0.5 hover:text-red-500">×</button>
                            </span>
                          ) : null
                        })}
                      </div>
                    )}
                    <div className="relative">
                      <input type="text" value={prodQuery} onChange={e => { setProdQuery(e.target.value); setProdDropdown(true) }}
                        onFocus={() => setProdDropdown(true)} onBlur={() => setTimeout(() => setProdDropdown(false), 150)}
                        placeholder="Cari produk..." className={inputCls} />
                      {prodDropdown && (
                        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                          {productsList.filter(p => p.name.toLowerCase().includes(prodQuery.toLowerCase())).slice(0, 50).map(p => (
                            <button key={p.id} type="button"
                              onMouseDown={() => { toggleProd(p.id); setProdQuery('') }}
                              className={`w-full text-left px-4 py-2 text-sm transition flex items-center justify-between ${editProducts.includes(p.id) ? 'bg-[#121358] text-white' : 'text-gray-700 hover:bg-gray-50'}`}>
                              {p.name}
                              {editProducts.includes(p.id) && <span className="text-xs">✓</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {error && <p className="text-xs text-red-500">⚠️ {error}</p>}
                </div>
                <div className="flex gap-2 px-5 py-3 border-t border-gray-100 shrink-0">
                  <button onClick={() => setPopupEditMode(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition">Batal</button>
                  <button onClick={async () => {
                    await handleEdit(selectedSupplier.id)
                    const updated: Supplier = {
                      ...selectedSupplier, name: editName.trim(), phone: editPhone.trim() || null,
                      address: editAddress.trim() || null, sales_name: editSalesName.trim() || null,
                      bank_detail: buildBankDetail(editBank), detail: buildDetail(editCategories, editProducts),
                    }
                    setSelectedSupplier(updated)
                    setSuppliers(prev => prev.map(s => s.id === updated.id ? updated : s))
                    setPopupEditMode(false)
                  }} disabled={saving || !editName.trim()} className="flex-1 py-2.5 rounded-xl bg-[#121358] hover:bg-[#1a1c6e] disabled:bg-[#121358]/40 text-white text-sm font-semibold transition">
                    {saving ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1">
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
                  {(selectedSupplier.detail?.product_categories ?? []).length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Kategori Produk</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(selectedSupplier.detail?.product_categories ?? []).map(id => {
                          const cat = categories.find(c => c.id === id)
                          return cat ? <span key={id} className="text-xs bg-[#121358]/10 text-[#121358] px-2 py-0.5 rounded-full">{cat.name}</span> : null
                        })}
                      </div>
                    </div>
                  )}
                  {(selectedSupplier.detail?.products ?? []).length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Produk ({(selectedSupplier.detail?.products ?? []).length})</p>
                      <div className="flex flex-wrap gap-1 mt-1 max-h-32 overflow-y-auto">
                        {(selectedSupplier.detail?.products ?? []).map(id => {
                          const prod = productsList.find(p => p.id === id)
                          return prod ? <span key={id} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{prod.name}</span> : null
                        })}
                      </div>
                    </div>
                  )}
                  {!selectedSupplier.phone && !selectedSupplier.address && !selectedSupplier.bank_detail &&
                    !(selectedSupplier.detail?.product_categories?.length) && !(selectedSupplier.detail?.products?.length) && (
                    <p className="text-sm text-gray-400 text-center py-2">Tidak ada detail tambahan.</p>
                  )}
                </div>
                <div className="px-5 py-3 border-t border-gray-100 flex gap-2 shrink-0">
                  <button onClick={() => openEdit(selectedSupplier)}
                    className="flex-1 py-2 rounded-xl bg-[#121358] text-white text-sm font-semibold hover:bg-[#1a1c6e] transition flex items-center justify-center gap-1.5">
                    <FontAwesomeIcon icon={faPenToSquare} className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button onClick={() => { setDeleteTarget(selectedSupplier); setDeleteInput('') }}
                    className="w-10 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 transition flex items-center justify-center">
                    <FontAwesomeIcon icon={faTrash} className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {deleteTarget && (
        <DeleteConfirmPopup
          title="Hapus Supplier"
          description={`Anda akan menghapus ${deleteTarget.name} secara permanen.`}
          confirmText={deleteInput}
          onConfirmTextChange={setDeleteInput}
          onConfirm={handleDelete}
          onCancel={() => { setDeleteTarget(null); setDeleteInput('') }}
          loading={confirmingDelete}
        />
      )}

      {/* Add Supplier Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="px-5 py-4 bg-[#121358] flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Tambah Supplier</h3>
              <button onClick={() => setShowAddModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition">
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

                {/* Kategori Produk */}
                <div className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Kategori Produk</p>
                  {newCategories.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {newCategories.map(id => {
                        const cat = categories.find(c => c.id === id)
                        return cat ? (
                          <span key={id} className="flex items-center gap-1 text-xs font-medium bg-[#121358]/10 text-[#121358] px-2 py-1 rounded-full">
                            {cat.name}
                            <button type="button" onClick={() => setNewCategories(prev => prev.filter(x => x !== id))} className="ml-0.5 hover:text-red-500">×</button>
                          </span>
                        ) : null
                      })}
                    </div>
                  )}
                  <div className="relative">
                    <input type="text" value={newCatQuery} onChange={e => { setNewCatQuery(e.target.value); setNewCatDropdown(true) }}
                      onFocus={() => setNewCatDropdown(true)} onBlur={() => setTimeout(() => setNewCatDropdown(false), 150)}
                      placeholder="Cari kategori..." className={inputCls} />
                    {newCatDropdown && (
                      <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                        {categories.filter(c => c.name.toLowerCase().includes(newCatQuery.toLowerCase())).map(c => (
                          <button key={c.id} type="button"
                            onMouseDown={() => { setNewCategories(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id]); setNewCatQuery('') }}
                            className={`w-full text-left px-4 py-2 text-sm transition flex items-center justify-between ${newCategories.includes(c.id) ? 'bg-[#121358] text-white' : 'text-gray-700 hover:bg-gray-50'}`}>
                            {c.name}{newCategories.includes(c.id) && <span className="text-xs">✓</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Tambahkan Produk */}
                <div className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Tambahkan Produk</p>
                  {newProducts.length > 0 && (
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                      {newProducts.map(id => {
                        const prod = productsList.find(p => p.id === id)
                        return prod ? (
                          <span key={id} className="flex items-center gap-1 text-xs font-medium bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                            {prod.name}
                            <button type="button" onClick={() => setNewProducts(prev => prev.filter(x => x !== id))} className="ml-0.5 hover:text-red-500">×</button>
                          </span>
                        ) : null
                      })}
                    </div>
                  )}
                  <div className="relative">
                    <input type="text" value={newProdQuery} onChange={e => { setNewProdQuery(e.target.value); setNewProdDropdown(true) }}
                      onFocus={() => setNewProdDropdown(true)} onBlur={() => setTimeout(() => setNewProdDropdown(false), 150)}
                      placeholder="Cari produk..." className={inputCls} />
                    {newProdDropdown && (
                      <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                        {productsList.filter(p => p.name.toLowerCase().includes(newProdQuery.toLowerCase())).slice(0, 50).map(p => (
                          <button key={p.id} type="button"
                            onMouseDown={() => { setNewProducts(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id]); setNewProdQuery('') }}
                            className={`w-full text-left px-4 py-2 text-sm transition flex items-center justify-between ${newProducts.includes(p.id) ? 'bg-[#121358] text-white' : 'text-gray-700 hover:bg-gray-50'}`}>
                            {p.name}{newProducts.includes(p.id) && <span className="text-xs">✓</span>}
                          </button>
                        ))}
                      </div>
                    )}
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
