'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '@/context/AuthContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPrint } from '@fortawesome/free-solid-svg-icons'
import { localDateStr } from '@/lib/date'
import { toTitleCase } from '@/lib/utils'

// Transaction items sold while the store was out of stock. The uncovered qty
// (external_qty) is fetched from another store; here it's recorded as a purchase
// from that store via receive_external_stock: the sold part gets its real HPP,
// any extra taken goes into stock, and "Bon" creates a Tagihan Dagang bill.
type ExternalItem = {
  id: number
  qty: number
  price_sold: number
  cogs: number
  external_qty: number
  external_purchasing_id: number | null
  transactions: { code: string; date: string } | null
  products: { name: string; base_price: number | null; unit_of_measurements: { abbreviation: string } | null } | null
  purchasing: {
    code: string
    total: number
    due_date: string | null
    suppliers: { name: string } | null
    purchasing_items: { qty: number; base_price: number }[]
  } | null
}

type Supplier = { id: number; name: string }
type Warehouse = { id: number; name: string; code: string }
type Tab = 'pending' | 'done'
type Payment = 'cash' | 'bon'

type FormState = {
  supplierId: number | ''
  supplierQuery: string
  totalQty: string
  unitCost: string
  warehouseId: number | ''
  payment: Payment
  dueDate: string
}

const fmt = (n: number) => Math.round(n).toLocaleString('id-ID')
const plusDays = (days: number) => localDateStr(new Date(Date.now() + days * 24 * 60 * 60 * 1000))

export default function HppTokoLainPage() {
  const supabase = createClient()
  const { appUser } = useAuth()
  const [items, setItems] = useState<ExternalItem[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [fetching, setFetching] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('pending')
  const [forms, setForms] = useState<Record<number, FormState>>({})
  const [supplierDropdown, setSupplierDropdown] = useState<number | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [errors, setErrors] = useState<Record<number, string>>({})
  const [printItem, setPrintItem] = useState<ExternalItem | null>(null)
  const [printing, setPrinting] = useState(false)
  const [printError, setPrintError] = useState<string | null>(null)
  const [printedMsg, setPrintedMsg] = useState<string | null>(null)

  const queryItems = () => supabase
    .from('transaction_items')
    .select('id, qty, price_sold, cogs, external_qty, external_purchasing_id, transactions(code, date), products(name, base_price, unit_of_measurements(abbreviation)), purchasing:external_purchasing_id(code, total, due_date, suppliers(name), purchasing_items(qty, base_price))')
    .or('external_qty.gt.0,external_purchasing_id.not.is.null')
    .order('id', { ascending: false })

  const applyItems = (data: unknown, error?: { message: string } | null) => {
    setLoadError(error?.message ?? null)
    const rows = ((data ?? []) as ExternalItem[])
      .sort((a, b) => (b.transactions?.date ?? '').localeCompare(a.transactions?.date ?? ''))
    setItems(rows)
    setFetching(false)
  }

  useEffect(() => {
    queryItems().then(({ data, error }: { data: unknown; error: { message: string } | null }) => applyItems(data, error))
    supabase.from('suppliers').select('id, name').order('name')
      .then(({ data }: { data: Supplier[] | null }) => setSuppliers(data ?? []))
    supabase.from('warehouses').select('id, name, code').eq('is_active', true).order('name')
      .then(({ data }: { data: Warehouse[] | null }) => setWarehouses(data ?? []))
  }, [])

  const pending = items.filter(i => i.external_qty > 0)
  const done = items.filter(i => i.external_qty <= 0 && i.external_purchasing_id !== null)
  const shown = tab === 'pending' ? pending : done

  const formFor = (item: ExternalItem): FormState => forms[item.id] ?? {
    supplierId: '',
    supplierQuery: '',
    totalQty: String(Math.ceil(item.external_qty)),
    unitCost: '',
    warehouseId: '',
    payment: 'cash',
    dueDate: plusDays(7),
  }

  const updateForm = (item: ExternalItem, patch: Partial<FormState>) => {
    setForms(prev => ({ ...prev, [item.id]: { ...formFor(item), ...patch } }))
    setErrors(prev => ({ ...prev, [item.id]: '' }))
  }

  const addSupplier = async (item: ExternalItem, name: string) => {
    const { data, error } = await supabase.from('suppliers').insert({ name: toTitleCase(name.trim()) }).select('id, name').single()
    if (error || !data) { setErrors(prev => ({ ...prev, [item.id]: error?.message ?? 'Gagal menambah toko.' })); return }
    setSuppliers(prev => [...prev, data as Supplier].sort((a, b) => a.name.localeCompare(b.name)))
    updateForm(item, { supplierId: (data as Supplier).id, supplierQuery: '' })
  }

  const handleSave = async (item: ExternalItem) => {
    const f = formFor(item)
    const total = Number(f.totalQty)
    const cost = parseFloat(f.unitCost)
    const leftover = total - item.external_qty
    const fail = (msg: string) => setErrors(prev => ({ ...prev, [item.id]: msg }))
    if (!f.supplierId) return fail('Pilih toko asal.')
    if (!Number.isInteger(total) || total < item.external_qty) return fail(`Total diambil minimal ${Math.ceil(item.external_qty)} dan harus bilangan bulat.`)
    if (!(cost > 0)) return fail('Isi harga modal.')
    if (leftover > 0 && !f.warehouseId) return fail('Pilih warehouse untuk sisa barang.')
    if (f.payment === 'bon' && !f.dueDate) return fail('Isi jatuh tempo tagihan.')

    setSavingId(item.id)
    const { error } = await supabase.rpc('receive_external_stock', {
      p_transaction_item_id: item.id,
      p_total_qty: total,
      p_unit_cost: cost,
      p_supplier_id: f.supplierId,
      p_warehouse_id: leftover > 0 ? f.warehouseId : null,
      p_due_date: f.payment === 'bon' ? f.dueDate : null,
      p_created_by: appUser?.id ?? null,
    })
    setSavingId(null)
    if (error) return fail(error.message)
    const { data, error: reloadErr } = await queryItems()
    applyItems(data, reloadErr)
  }

  // Payload for print_jobs 'surat_jalan' — the thermal printer listeners
  // (printer-listener/listener.js, /api/print) render it.
  const suratJalanFor = (item: ExternalItem) => {
    const f = formFor(item)
    return {
      no: `SJ-${localDateStr().replace(/-/g, '')}-${item.id}`,
      date: localDateStr(),
      store: suppliers.find(s => s.id === f.supplierId)?.name ?? '',
      items: [{
        name: item.products?.name ?? '-',
        qty: Number(f.totalQty) || Math.ceil(item.external_qty),
        unit: item.products?.unit_of_measurements?.abbreviation ?? '',
      }],
    }
  }

  const openPrintPreview = (item: ExternalItem) => {
    if (!formFor(item).supplierId) {
      setErrors(prev => ({ ...prev, [item.id]: 'Pilih toko asal dulu sebelum cetak surat jalan.' }))
      return
    }
    setPrintError(null)
    setPrintItem(item)
  }

  const handlePrint = async () => {
    if (!printItem) return
    setPrinting(true)
    setPrintError(null)
    const { error } = await supabase.from('print_jobs').insert({
      type: 'surat_jalan',
      payload: suratJalanFor(printItem),
      created_by: appUser?.id ?? null,
    })
    setPrinting(false)
    if (error) { setPrintError(error.message); return }
    setPrintedMsg(`Surat jalan ${printItem.products?.name ?? ''} dikirim ke printer.`)
    setPrintItem(null)
    setTimeout(() => setPrintedMsg(null), 4000)
  }

  const formatDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

  const sj = printItem ? suratJalanFor(printItem) : null

  return (
    <>
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-2xl mx-auto space-y-4">

        <div>
          <h2 className="text-lg font-bold text-gray-800">HPP Toko Lain</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Barang yang terjual saat stok toko kosong dan diambil dari toko lain. Catat toko asal, jumlah yang diambil
            dan harga modalnya — kelebihan barang masuk stok, dan pembayaran bon masuk Tagihan Dagang.
          </p>
        </div>

        {printedMsg && (
          <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">✓ {printedMsg}</div>
        )}

        <div className="bg-white rounded-2xl shadow-sm p-1 flex gap-1">
          {([['pending', 'Belum diisi', pending.length], ['done', 'Sudah diisi', done.length]] as [Tab, string, number][]).map(([key, label, count]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 text-sm font-medium py-2 rounded-xl transition-colors flex items-center justify-center gap-1.5 ${
                tab === key ? 'bg-[#121358] text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`min-w-[18px] h-[18px] text-[10px] font-bold rounded-full flex items-center justify-center px-1 ${
                  key === 'pending' ? 'bg-red-500 text-white' : tab === key ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {fetching ? (
          <div className="text-center text-sm text-gray-400 py-10">Memuat data...</div>
        ) : loadError ? (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">⚠️ Gagal memuat data: {loadError}</div>
        ) : shown.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-10">
            {tab === 'pending' ? 'Tidak ada barang yang menunggu diambil dari toko lain.' : 'Belum ada pengambilan dari toko lain yang dicatat.'}
          </div>
        ) : (
          <div className="space-y-3">
            {shown.map(item => {
              const abbr = item.products?.unit_of_measurements?.abbreviation ?? 'unit'
              const header = (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{item.products?.name ?? '-'}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {item.transactions?.code ?? '-'} · {item.transactions?.date ? formatDate(item.transactions.date) : '-'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] text-gray-400">Harga jual</p>
                    <p className="text-sm font-bold text-[#121358]">Rp {fmt(item.price_sold)}</p>
                  </div>
                </div>
              )

              if (tab === 'done') {
                const pi = item.purchasing?.purchasing_items?.[0]
                const taken = pi?.qty ?? 0
                const sold = item.qty
                const profit = item.price_sold - item.cogs
                return (
                  <div key={item.id} className="bg-white rounded-xl shadow-sm p-4 space-y-3">
                    {header}
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 border-t border-gray-100 pt-3">
                      <p>Toko asal: <span className="font-semibold">{item.purchasing?.suppliers?.name ?? '-'}</span></p>
                      <p>Diambil: <span className="font-semibold">{taken} {abbr}</span></p>
                      <p>Modal: <span className="font-semibold">Rp {fmt(pi?.base_price ?? 0)}/{abbr}</span></p>
                      <p>Masuk stok: <span className="font-semibold">{Math.max(0, taken - sold)} {abbr}</span></p>
                      <p>Pembelian: <span className="font-semibold">{item.purchasing?.code ?? '-'}</span></p>
                      <p>
                        {item.purchasing?.due_date
                          ? <>Bon · jatuh tempo <span className="font-semibold">{formatDate(item.purchasing.due_date)}</span></>
                          : <>Cash</>}
                        {' '}· Rp {fmt(item.purchasing?.total ?? 0)}
                      </p>
                      <p className="col-span-2">
                        Laba item: <span className={`font-semibold ${profit < 0 ? 'text-red-500' : 'text-green-600'}`}>Rp {fmt(profit)}</span>
                      </p>
                    </div>
                  </div>
                )
              }

              const f = formFor(item)
              const total = Number(f.totalQty) || 0
              const cost = parseFloat(f.unitCost) || 0
              const leftover = Math.max(0, total - item.external_qty)
              const selectedSupplier = suppliers.find(s => s.id === f.supplierId)
              const supplierMatches = suppliers.filter(s => s.name.toLowerCase().includes(f.supplierQuery.toLowerCase())).slice(0, 8)
              return (
                <div key={item.id} className="bg-white rounded-xl shadow-sm p-4 space-y-3">
                  {header}

                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 font-medium">
                      Kurang stok: {item.external_qty} {abbr}
                      {item.qty !== item.external_qty && <span className="text-amber-500"> dari {item.qty} {abbr} terjual</span>}
                    </span>
                    {item.products?.base_price ? (
                      <span className="px-2 py-1 rounded-lg bg-gray-50 text-gray-500">
                        Modal biasa: Rp {fmt(item.products.base_price)}/{abbr}
                      </span>
                    ) : null}
                    <button
                      onClick={() => openPrintPreview(item)}
                      className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#121358]/30 text-[#121358] font-semibold hover:bg-[#121358]/5 transition"
                    >
                      <FontAwesomeIcon icon={faPrint} className="w-3 h-3" />
                      Cetak Surat Jalan
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2 relative">
                      <label className="block text-[11px] text-gray-500 mb-1">Toko asal <span className="text-red-500">*</span></label>
                      {selectedSupplier ? (
                        <div className="flex items-center justify-between border border-[#121358]/40 rounded-lg px-3 py-2 text-sm">
                          <span className="font-medium text-gray-800">{selectedSupplier.name}</span>
                          <button onClick={() => updateForm(item, { supplierId: '' })} className="text-xs text-gray-400 hover:text-red-500">Ganti</button>
                        </div>
                      ) : (
                        <>
                          <input
                            type="text"
                            value={f.supplierQuery}
                            onChange={e => { updateForm(item, { supplierQuery: e.target.value }); setSupplierDropdown(item.id) }}
                            onFocus={() => setSupplierDropdown(item.id)}
                            onBlur={() => setTimeout(() => setSupplierDropdown(d => d === item.id ? null : d), 150)}
                            placeholder="Cari toko / supplier..."
                            autoComplete="off"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]"
                          />
                          {supplierDropdown === item.id && (
                            <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                              {supplierMatches.map(s => (
                                <button key={s.id} type="button"
                                  onMouseDown={() => updateForm(item, { supplierId: s.id, supplierQuery: '' })}
                                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                  {s.name}
                                </button>
                              ))}
                              {f.supplierQuery.trim() && !suppliers.some(s => s.name.toLowerCase() === f.supplierQuery.trim().toLowerCase()) && (
                                <button type="button"
                                  onMouseDown={() => addSupplier(item, f.supplierQuery)}
                                  className="w-full text-left px-3 py-2 text-sm font-semibold text-[#121358] hover:bg-gray-50 border-t border-gray-100">
                                  + Tambah &quot;{toTitleCase(f.supplierQuery.trim())}&quot;
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-1">Total diambil ({abbr}) <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={Math.ceil(item.external_qty)}
                        step="1"
                        value={f.totalQty}
                        onChange={e => updateForm(item, { totalQty: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-1">Harga modal per {abbr} <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        value={f.unitCost}
                        onChange={e => updateForm(item, { unitCost: e.target.value })}
                        placeholder="0"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]"
                      />
                    </div>
                    {leftover > 0 && (
                      <div className="col-span-2">
                        <label className="block text-[11px] text-gray-500 mb-1">
                          Warehouse untuk sisa {leftover} {abbr} <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={f.warehouseId}
                          onChange={e => updateForm(item, { warehouseId: e.target.value ? Number(e.target.value) : '' })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#121358]"
                        >
                          <option value="">Pilih warehouse...</option>
                          {warehouses.map(w => (
                            <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="col-span-2">
                      <label className="block text-[11px] text-gray-500 mb-1">Pembayaran ke toko asal</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(['cash', 'bon'] as Payment[]).map(p => (
                          <button key={p} type="button"
                            onClick={() => updateForm(item, { payment: p })}
                            className={`py-2 rounded-lg text-xs font-semibold border transition ${
                              f.payment === p ? 'bg-[#121358] text-white border-[#121358]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                            }`}>
                            {p === 'cash' ? 'Cash (tanpa tagihan)' : 'Bon (masuk Tagihan Dagang)'}
                          </button>
                        ))}
                      </div>
                    </div>
                    {f.payment === 'bon' && (
                      <div className="col-span-2">
                        <label className="block text-[11px] text-gray-500 mb-1">Jatuh tempo tagihan <span className="text-red-500">*</span></label>
                        <input
                          type="date"
                          value={f.dueDate}
                          onChange={e => updateForm(item, { dueDate: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]"
                        />
                      </div>
                    )}
                  </div>

                  {total > 0 && cost > 0 && (
                    <div className="rounded-lg bg-gray-50 px-3 py-2 text-[11px] text-gray-600 space-y-0.5">
                      <p>Total pembelian: <span className="font-semibold">Rp {fmt(total * cost)}</span> ({total} {abbr} × Rp {fmt(cost)})</p>
                      <p>Untuk pelanggan: {item.external_qty} {abbr}{leftover > 0 && <> · Masuk stok: <span className="font-semibold">{leftover} {abbr}</span></>}</p>
                      <p>{f.payment === 'bon' ? 'Masuk Tagihan Dagang' : 'Dibayar cash — tidak ada tagihan'}</p>
                    </div>
                  )}

                  {errors[item.id] && <p className="text-xs text-red-500">{errors[item.id]}</p>}

                  <button
                    onClick={() => handleSave(item)}
                    disabled={savingId === item.id}
                    className="w-full py-2.5 rounded-lg bg-[#121358] hover:bg-[#1a1c6e] disabled:opacity-40 text-white text-sm font-semibold transition"
                  >
                    {savingId === item.id ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>

    {/* Surat jalan preview — same receipt layout the thermal printer prints */}
    {printItem && sj && (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4" onClick={() => setPrintItem(null)}>
        <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden" style={{ maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-bold text-gray-800">Cetak Surat Jalan</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Dicetak otomatis di printer thermal toko.</p>
          </div>
          <div className="overflow-y-auto px-4 py-3" style={{ maxHeight: 'calc(85vh - 120px)' }}>
            <div className="bg-white border border-dashed border-gray-300 rounded-xl px-3 py-3 font-mono text-[10px] text-gray-800 leading-relaxed">
              <p className="text-center">{'================================'}</p>
              <p className="text-center font-bold">TB. NURBETI</p>
              <p className="text-center">Jl. KS. Tubun No. 46</p>
              <p className="text-center">Tegal</p>
              <p className="text-center">HP Admin: 0815-4806-4220</p>
              <p className="text-center">{'================================'}</p>
              <p className="text-center font-bold">SURAT JALAN</p>
              <p>No. SJ&nbsp;&nbsp;: {sj.no}</p>
              <p>Tanggal : {new Date(sj.date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p>Toko&nbsp;&nbsp;&nbsp;&nbsp;: {sj.store}</p>
              <p>{'--------------------------------'}</p>
              <p className="whitespace-pre">{'Nama Barang                 Qty'}</p>
              <p>{'--------------------------------'}</p>
              {sj.items.map((it, i) => (
                <div key={i}>
                  <p className="font-semibold">{it.name}</p>
                  <p className="pl-2">{it.qty} {it.unit}</p>
                </div>
              ))}
              <p>{'--------------------------------'}</p>
              <p>&nbsp;</p>
              <p className="whitespace-pre">{'Pengambil         Toko Pemberi'}</p>
              <p>&nbsp;</p>
              <p>&nbsp;</p>
              <p className="whitespace-pre">{'(__________)      (__________)'}</p>
              <p>{'================================'}</p>
            </div>
            {printError && <p className="text-xs text-red-500 mt-2">{printError}</p>}
          </div>
          <div className="flex gap-2 px-4 py-3 border-t border-gray-100">
            <button onClick={() => setPrintItem(null)}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
              Batal
            </button>
            <button onClick={handlePrint} disabled={printing}
              className="flex-1 py-2.5 rounded-xl bg-[#121358] text-white text-sm font-semibold hover:bg-[#1a1c6e] disabled:opacity-40 transition">
              {printing ? 'Mengirim...' : 'Cetak'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
