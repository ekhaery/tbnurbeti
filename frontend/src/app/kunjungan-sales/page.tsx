'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark, faChevronLeft, faChevronDown, faReceipt, faMoneyBillWave } from '@fortawesome/free-solid-svg-icons'
import { localDateStr } from '@/lib/date'

type Supplier = { id: number; name: string }

type PurchasingRow = {
  id: number; code: string; date: string; total: number; status: string
}


type DebtLoanRow = {
  id: number; bank_account: string; debt_type: string; debt_amount: number; due_date: string | null
  debt_loan_detail: { installment_amount: number; is_paid: boolean }[]
}

type WeekPurchasing = {
  id: number; code: string; date: string; due_date: string; total: number
  supplier_id: number; suppliers: { name: string } | null
}

type WeekDebtLoan = {
  id: number; debt_type: string; due_date: string; debt_amount: number
  supplier_id: number; suppliers: { name: string } | null
  debt_loan_detail: { installment_amount: number; is_paid: boolean }[]
}

type PurchasingNotaRow = {
  id: number; code: string; date: string; due_date: string | null; total: number; status: string
  suppliers: { name: string; bank_detail: { bank?: string; no_rek?: string; rek_name?: string } | null } | null
}

type NotaBillRow = {
  id: number; bill_no: string | null; purchasing_id: number; due_date: string
  installment_due_date: string | null; installment: number; paid_amount: number
  is_paid: boolean; payment_date: string | null
}

const fmt = (n: number) => n.toLocaleString('id-ID')
const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

export default function KunjunganSalesPage() {
  const supabase = createClient()

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [supplierQuery, setSupplierQuery] = useState('')
  const [supplierDropdown, setSupplierDropdown] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)

  const [loadingPesanan, setLoadingPesanan] = useState(false)
  const [pesananList, setPesananList] = useState<PurchasingRow[] | null>(null)
  const [showPesanan, setShowPesanan] = useState(false)

  const [loadingPembayaran, setLoadingPembayaran] = useState(false)
  const [purchasingNotaList, setPurchasingNotaList] = useState<PurchasingNotaRow[] | null>(null)
  const [allBillsForSupplier, setAllBillsForSupplier] = useState<NotaBillRow[]>([])
  const [debtList, setDebtList] = useState<DebtLoanRow[] | null>(null)
  const [showPembayaran, setShowPembayaran] = useState(false)

  const [expandedNotaId, setExpandedNotaId] = useState<number | null>(null)
  const [notaBillsCache, setNotaBillsCache] = useState<Record<number, NotaBillRow[]>>({})
  const [fetchingNotaId, setFetchingNotaId] = useState<number | null>(null)

  const [weekPurchasing, setWeekPurchasing] = useState<WeekPurchasing[] | null>(null)
  const [weekDebtLoan, setWeekDebtLoan] = useState<WeekDebtLoan[] | null>(null)
  const [showWeek, setShowWeek] = useState(false)
  const [showSupplierWeek, setShowSupplierWeek] = useState(false)

  useEffect(() => {
    supabase.from('suppliers').select('id, name').order('name')
      .then(({ data }: { data: Supplier[] | null }) => setSuppliers(data ?? []))
  }, [])

  useEffect(() => {
    const now = new Date()
    const dow = now.getDay()
    const diffToMon = dow === 0 ? 6 : dow - 1
    const mon = new Date(now)
    mon.setDate(now.getDate() - diffToMon)
    const sun = new Date(mon)
    sun.setDate(mon.getDate() + 6)
    const weekStart = localDateStr(mon)
    const weekEnd = localDateStr(sun)
    Promise.all([
      supabase.from('purchasing')
        .select('id, code, date, due_date, total, supplier_id, suppliers(name)')
        .gte('due_date', weekStart)
        .lte('due_date', weekEnd)
        .order('due_date', { ascending: true }),
      supabase.from('debt_loan')
        .select('id, debt_type, due_date, debt_amount, supplier_id, suppliers(name), debt_loan_detail(installment_amount, is_paid)')
        .gte('due_date', weekStart)
        .lte('due_date', weekEnd)
        .order('due_date', { ascending: true }),
    ]).then(([purchRes, debtRes]) => {
      setWeekPurchasing((purchRes.data ?? []) as WeekPurchasing[])
      setWeekDebtLoan((debtRes.data ?? []) as WeekDebtLoan[])
    })
  }, [])

  const selectSupplier = (s: Supplier) => {
    setSelectedSupplier(s); setSupplierQuery(s.name); setSupplierDropdown(false)
    setPesananList(null); setPurchasingNotaList(null); setAllBillsForSupplier([]); setDebtList(null)
    setShowPesanan(false); setShowPembayaran(false); setShowSupplierWeek(false)
    setExpandedNotaId(null); setNotaBillsCache({})
  }

  const fetchPesanan = async () => {
    if (!selectedSupplier) return
    setLoadingPesanan(true)
    const { data } = await supabase.from('purchasing')
      .select('id, code, date, total, status')
      .eq('supplier_id', selectedSupplier.id)
      .order('date', { ascending: false })
    setPesananList((data ?? []) as PurchasingRow[])
    setShowPesanan(true); setLoadingPesanan(false)
  }

  const fetchPembayaran = async () => {
    if (!selectedSupplier) return
    setLoadingPembayaran(true)
    const [purchRes, billsRes, debtRes] = await Promise.all([
      supabase.from('purchasing')
        .select('id, code, date, due_date, total, status, suppliers(name, bank_detail)')
        .eq('supplier_id', selectedSupplier.id)
        .not('due_date', 'is', null)
        .order('due_date', { ascending: true }),
      supabase.from('bills')
        .select('id, bill_no, purchasing_id, due_date, installment_due_date, installment, paid_amount, is_paid, payment_date')
        .eq('supplier_id', selectedSupplier.id),
      supabase.from('debt_loan')
        .select('id, bank_account, debt_type, debt_amount, due_date, debt_loan_detail(installment_amount, is_paid)')
        .eq('supplier_id', selectedSupplier.id)
        .order('due_date', { ascending: false }),
    ])
    setPurchasingNotaList((purchRes.data ?? []) as PurchasingNotaRow[])
    setAllBillsForSupplier((billsRes.data ?? []) as NotaBillRow[])
    setDebtList((debtRes.data ?? []) as DebtLoanRow[])
    setShowPembayaran(true); setLoadingPembayaran(false)
  }

  const toggleNotaExpand = async (p: PurchasingNotaRow) => {
    if (expandedNotaId === p.id) { setExpandedNotaId(null); return }
    setExpandedNotaId(p.id)
    if (notaBillsCache[p.id]) return
    setFetchingNotaId(p.id)
    const { data } = await supabase.from('bills')
      .select('id, bill_no, purchasing_id, due_date, installment_due_date, installment, paid_amount, is_paid, payment_date')
      .eq('purchasing_id', p.id)
      .order('installment_due_date', { ascending: true })
    setNotaBillsCache(prev => ({ ...prev, [p.id]: (data as NotaBillRow[]) ?? [] }))
    setFetchingNotaId(null)
  }

  const hasSelection = !!selectedSupplier
  const supplierWeekPurchasing = weekPurchasing?.filter(p => p.supplier_id === selectedSupplier?.id) ?? []
  const supplierWeekDebtLoan = weekDebtLoan?.filter(d => d.supplier_id === selectedSupplier?.id) ?? []
  const supplierTotalWeek = supplierWeekPurchasing.length + supplierWeekDebtLoan.length
  const supplierTotalAmount =
    supplierWeekDebtLoan.reduce((s, d) => s + d.debt_amount, 0) +
    supplierWeekPurchasing.reduce((s, p) => s + p.total, 0)
  const isAllPaid = supplierTotalWeek > 0 &&
    supplierWeekPurchasing.length === 0 &&
    supplierWeekDebtLoan.every(d => {
      const paid = d.debt_loan_detail.filter(x => x.is_paid).reduce((s, x) => s + x.installment_amount, 0)
      return d.debt_amount > 0 ? ((d.debt_amount - paid) / d.debt_amount * 100) < 1 : true
    })
  const purchasingPaidMap = allBillsForSupplier.reduce<Record<number, number>>((acc, b) => {
    acc[b.purchasing_id] = (acc[b.purchasing_id] ?? 0) + b.paid_amount
    return acc
  }, {})

  const totalWeek = (weekPurchasing?.length ?? 0) + (weekDebtLoan?.length ?? 0)
  const totalWeekAmount =
    (weekDebtLoan?.reduce((s, d) => s + d.debt_amount, 0) ?? 0) +
    (weekPurchasing?.reduce((s, p) => s + p.total, 0) ?? 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-4 pb-10 max-w-xl mx-auto space-y-4">

        <div className="flex items-center gap-3">
          <Link href="/" className="w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-sm text-[#121358] hover:bg-gray-100 transition shrink-0">
            <FontAwesomeIcon icon={faChevronLeft} className="w-3 h-3" />
          </Link>
          <div>
            <h2 className="text-lg font-bold text-gray-800">Kunjungan Sales</h2>
            <p className="text-xs text-gray-500 mt-0.5">Lihat riwayat pesanan & pembayaran per supplier.</p>
          </div>
        </div>

        {/* Week Due Button */}
        <button
          onClick={() => setShowWeek(true)}
          className="self-start flex items-center gap-2 px-4 py-2.5 bg-rose-700 hover:bg-rose-800 text-white text-sm font-semibold rounded-full shadow-sm transition"
        >
          Jatuh Tempo Minggu Ini
          {totalWeek > 0 && (
            <span className="bg-white text-rose-700 text-[11px] font-bold px-2 py-0.5 rounded-full leading-none">
              {totalWeek}
            </span>
          )}
        </button>

        {/* Filter Card */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filter Supplier</p>
          <div className="relative">
            <input type="text" value={supplierQuery}
              onChange={e => { setSupplierQuery(e.target.value); setSelectedSupplier(null); setSupplierDropdown(true) }}
              onFocus={() => setSupplierDropdown(true)}
              onBlur={() => setTimeout(() => setSupplierDropdown(false), 150)}
              placeholder="Cari nama supplier..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#121358]"
            />
            {supplierQuery && (
              <button onClick={() => { setSupplierQuery(''); setSelectedSupplier(null) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <FontAwesomeIcon icon={faXmark} className="w-3 h-3" />
              </button>
            )}
            {supplierDropdown && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {suppliers.filter(s => s.name.toLowerCase().includes(supplierQuery.toLowerCase())).map(s => (
                  <button key={s.id} onMouseDown={() => selectSupplier(s)}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition">
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Supplier title */}
        {hasSelection && (
          <h3 className="text-base font-bold text-gray-800">{selectedSupplier?.name}</h3>
        )}

        {/* Supplier week due label */}
        {hasSelection && supplierTotalWeek > 0 && (
          <div className={`border rounded-xl overflow-hidden ${isAllPaid ? 'bg-green-50 border-green-100' : 'bg-rose-50 border-rose-100'}`}>
            <button
              onClick={() => setShowSupplierWeek(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <span className={`text-sm ${isAllPaid ? 'text-green-800' : 'text-rose-800'}`}>
                Ada {supplierTotalWeek} tagihan dalam minggu ini · <span className="font-bold">Rp {fmt(supplierTotalAmount)}</span>
              </span>
              <FontAwesomeIcon
                icon={faChevronDown}
                className={`w-3 h-3 transition-transform duration-200 ${isAllPaid ? 'text-green-600' : 'text-rose-600'} ${showSupplierWeek ? 'rotate-180' : ''}`}
              />
            </button>
            {showSupplierWeek && (
              <div className={`border-t divide-y ${isAllPaid ? 'border-green-100 divide-green-50' : 'border-rose-100 divide-rose-50'}`}>
                <p className={`px-4 py-2 text-[10px] ${isAllPaid ? 'text-green-600' : 'text-rose-500'}`}>
                  Untuk melihat detail pembayaran, pilih &lsquo;Riwayat Pembayaran&rsquo;
                </p>
                {supplierWeekDebtLoan.map(d => (
                  <div key={`dl-${d.id}`} className="flex items-start justify-between px-4 py-2.5 gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-700">{d.debt_type}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">JT: {fmtDate(d.due_date)}</p>
                    </div>
                    <p className={`text-sm font-bold shrink-0 ${isAllPaid ? 'text-green-700' : 'text-rose-700'}`}>Rp {fmt(d.debt_amount)}</p>
                  </div>
                ))}
                {supplierWeekPurchasing.map(p => (
                  <div key={`pu-${p.id}`} className="flex items-start justify-between px-4 py-2.5 gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-700 font-mono">{p.code}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(p.date)} · JT: {fmtDate(p.due_date)}</p>
                    </div>
                    <p className={`text-sm font-bold shrink-0 ${isAllPaid ? 'text-green-700' : 'text-rose-700'}`}>Rp {fmt(p.total)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action cards — side by side */}
        {hasSelection && (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={fetchPesanan} disabled={loadingPesanan}
              className="rounded-2xl p-4 flex flex-col gap-2 bg-[#121358] hover:bg-[#1a1c6e] disabled:opacity-60 transition shadow-sm text-left">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/15">
                <FontAwesomeIcon icon={faReceipt} className="w-4 h-4 text-white" />
              </div>
              <p className="text-sm font-bold text-white leading-tight">Riwayat Pesanan</p>
              <p className="text-[10px] text-white/60">{loadingPesanan ? 'Memuat...' : 'Lihat data purchasing'}</p>
            </button>

            <button onClick={fetchPembayaran} disabled={loadingPembayaran}
              className="rounded-2xl p-4 flex flex-col gap-2 bg-[#4C8CE4] hover:bg-[#3a7bd5] disabled:opacity-60 transition shadow-sm text-left">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/15">
                <FontAwesomeIcon icon={faMoneyBillWave} className="w-4 h-4 text-white" />
              </div>
              <p className="text-sm font-bold text-white leading-tight">Riwayat Pembayaran</p>
              <p className="text-[10px] text-white/60">{loadingPembayaran ? 'Memuat...' : 'Lihat tagihan & cicilan'}</p>
            </button>
          </div>
        )}
      </div>

      {/* Riwayat Pesanan Popup */}
      {showPesanan && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 bg-[#121358] flex items-center justify-between shrink-0">
              <div>
                <p className="text-sm font-bold text-white">Riwayat Pesanan</p>
                <p className="text-xs text-white/60 mt-0.5">{selectedSupplier?.name}</p>
              </div>
              <button onClick={() => setShowPesanan(false)} className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition">
                <FontAwesomeIcon icon={faXmark} className="w-3 h-3" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {pesananList === null || pesananList.length === 0 ? (
                <div className="px-5 py-6 space-y-3">
                  <p className="text-center text-sm text-gray-400">Tidak ada data pesanan.</p>
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                    <p className="text-xs text-blue-700 leading-relaxed">
                      Jika tidak ada data pesanan namun ada Tagihan &amp; Riwayat Pembayaran,
                      artinya admin hanya memasukan tagihan &amp; riwayat pembayaran sebagai data saja.
                      Tujuannya untuk melihat tagihan mendatang dan pencatatan uang keluar.
                    </p>
                  </div>
                </div>
              ) : pesananList.map(p => (
                <div key={p.id} className="flex items-start justify-between px-4 py-3 gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 font-mono">{p.code}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{fmtDate(p.date)}</p>
                    <span className={`inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      p.status === 'completed' ? 'bg-green-100 text-green-600' :
                      p.status === 'created' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-500'
                    }`}>{p.status}</span>
                  </div>
                  <p className="text-sm font-bold text-[#121358] shrink-0">Rp {fmt(p.total)}</p>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 shrink-0">
              <button onClick={() => setShowPesanan(false)} className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* Jatuh Tempo Minggu Ini Popup */}
      {showWeek && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 bg-rose-700 flex items-center justify-between shrink-0">
              <div>
                <p className="text-sm font-bold text-white">Jatuh Tempo Minggu Ini</p>
                <p className="text-xs text-white/70 mt-0.5">{totalWeek} tagihan · <span className="font-bold text-white">Rp {fmt(totalWeekAmount)}</span></p>
              </div>
              <button onClick={() => setShowWeek(false)} className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition">
                <FontAwesomeIcon icon={faXmark} className="w-3 h-3" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {totalWeek === 0 ? (
                <p className="text-center text-sm text-gray-400 py-10">Tidak ada tagihan yang jatuh tempo minggu ini.</p>
              ) : (
                <>
                  {weekDebtLoan && weekDebtLoan.length > 0 && (
                    <div>
                      <p className="px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100">Debt &amp; Loan ({weekDebtLoan.length})</p>
                      <div className="divide-y divide-gray-100">
                        {weekDebtLoan.map(d => (
                          <div key={d.id} className="px-4 py-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm font-semibold text-gray-800">{d.suppliers?.name ?? '-'}</p>
                              {d.debt_type && <span className="text-xs text-gray-500">· {d.debt_type}</span>}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Jatuh Tempo: {fmtDate(d.due_date)}</p>
                            <p className="text-sm font-bold text-[#121358] mt-0.5">Rp {fmt(d.debt_amount)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {weekPurchasing && weekPurchasing.length > 0 && (
                    <div>
                      <p className="px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100">Purchasing ({weekPurchasing.length})</p>
                      <div className="divide-y divide-gray-100">
                        {weekPurchasing.map(p => (
                          <div key={p.id} className="px-4 py-3">
                            <p className="text-sm font-semibold text-gray-800">{p.suppliers?.name ?? '-'}</p>
                            <p className="text-xs text-gray-500 mt-1">Tanggal Nota: {fmtDate(p.date)}</p>
                            <p className="text-xs text-gray-500">Jatuh Tempo: {fmtDate(p.due_date)}</p>
                            <p className="text-sm font-bold text-[#121358] mt-0.5">Rp {fmt(p.total)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 shrink-0">
              <button onClick={() => setShowWeek(false)} className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* Riwayat Pembayaran Popup */}
      {showPembayaran && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 bg-[#4C8CE4] flex items-center justify-between shrink-0">
              <div>
                <p className="text-sm font-bold text-white">Riwayat Pembayaran</p>
                <p className="text-xs text-white/60 mt-0.5">{selectedSupplier?.name}</p>
              </div>
              <button onClick={() => setShowPembayaran(false)} className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition">
                <FontAwesomeIcon icon={faXmark} className="w-3 h-3" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {purchasingNotaList && purchasingNotaList.length > 0 && (
                <div>
                  <p className="px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100">Kumpulan Nota ({purchasingNotaList.length})</p>
                  <div className="divide-y divide-gray-100">
                    {purchasingNotaList.map(p => {
                      const pBills = allBillsForSupplier.filter(b => b.purchasing_id === p.id)
                      const unpaidBills = pBills.filter(b => !b.is_paid)
                      const allPaid = pBills.length > 0 && unpaidBills.length === 0
                      const paid = purchasingPaidMap[p.id] ?? 0
                      const sisa = Math.max(0, Math.round(p.total - paid))
                      const pct = p.total > 0 ? Math.min(100, Math.round(paid / p.total * 100)) : 0
                      const isExpanded = expandedNotaId === p.id
                      const cachedBills = notaBillsCache[p.id]
                      return (
                        <div key={p.id} className={`border-l-4 ${allPaid ? 'border-green-400' : 'border-[#9FA1FF]'}`}>
                          <div onClick={() => toggleNotaExpand(p)}
                            className="px-4 py-3 cursor-pointer hover:bg-gray-50 transition">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-800">{p.suppliers?.name ?? '-'}</p>
                                <p className="text-xs text-gray-400 font-mono mt-0.5">{p.code}</p>
                                <p className="text-xs text-gray-500 mt-0.5">Tanggal: {fmtDate(p.date)}</p>
                                {p.due_date && <p className="text-xs text-gray-500 mt-0.5">JT: {fmtDate(p.due_date)}</p>}
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                    p.status === 'completed' ? 'bg-green-100 text-green-600' :
                                    p.status === 'created' ? 'bg-blue-100 text-blue-600' :
                                    'bg-orange-100 text-orange-500'
                                  }`}>{p.status}</span>
                                  {pBills.length > 0 && (allPaid ? (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-600">Lunas</span>
                                  ) : (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
                                      Belum Lunas · {unpaidBills.length} tagihan
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-start gap-2 shrink-0">
                                <div className="text-right">
                                  <p className="text-sm font-bold text-[#121358]">Rp {fmt(p.total)}</p>
                                  {paid > 0 && (
                                    <div className="mt-1">
                                      <p className="text-[10px] text-green-600">Terbayar: Rp {fmt(paid)} ({pct}%)</p>
                                      <p className={`text-[10px] font-bold ${sisa === 0 ? 'text-green-600' : 'text-red-500'}`}>Sisa: Rp {fmt(sisa)}</p>
                                    </div>
                                  )}
                                </div>
                                <FontAwesomeIcon icon={faChevronDown}
                                  className={`w-3 h-3 text-gray-400 mt-1 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                              </div>
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="border-t border-gray-100 bg-gray-50 divide-y divide-gray-100">
                              {fetchingNotaId === p.id ? (
                                <p className="px-5 py-3 text-xs text-gray-400">Memuat...</p>
                              ) : !cachedBills || cachedBills.length === 0 ? (
                                <p className="px-5 py-3 text-xs text-gray-400">Tidak ada tagihan.</p>
                              ) : cachedBills.map(b => {
                                const amount = b.paid_amount > 0 && !b.is_paid ? b.installment - b.paid_amount : b.installment
                                return (
                                  <div key={b.id} className="flex items-center justify-between px-5 py-2.5">
                                    <div>
                                      <p className="text-xs text-gray-500">{b.installment_due_date ? fmtDate(b.installment_due_date) : '-'}</p>
                                      {b.is_paid && <span className="text-[10px] font-semibold text-green-600">Lunas</span>}
                                    </div>
                                    <p className={`text-sm font-semibold ${b.is_paid ? 'text-green-600' : 'text-[#121358]'}`}>Rp {fmt(amount)}</p>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {debtList && debtList.length > 0 && (
                <div>
                  <p className="px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100">Debt & Giro ({debtList.length})</p>
                  <div className="divide-y divide-gray-100">
                    {debtList.map(d => {
                      const totalPaid = d.debt_loan_detail.filter(x => x.is_paid).reduce((s, x) => s + x.installment_amount, 0)
                      const sisa = Math.max(0, d.debt_amount - totalPaid)
                      const pctRemaining = d.debt_amount > 0 ? (sisa / d.debt_amount * 100) : 0
                      const pct = d.debt_amount > 0 ? Math.min(100, Math.round(totalPaid / d.debt_amount * 100)) : 0
                      const sisaDisplay = Math.round(sisa)
                      const isOverdue = d.due_date ? d.due_date <= localDateStr() : false
                      const isPracticallyPaid = pctRemaining < 1
                      const rowBg = isOverdue ? (isPracticallyPaid ? 'bg-gray-100' : 'bg-red-50') : ''
                      return (
                        <div key={d.id} className={`flex items-start justify-between px-4 py-3 gap-3 ${rowBg}`}>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-700">{d.bank_account}</p>
                            <p className="text-[10px] text-gray-400">{d.debt_type}</p>
                            {d.due_date && <p className="text-xs text-gray-500 mt-0.5">JT: {fmtDate(d.due_date)}</p>}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold text-[#121358]">Rp {fmt(d.debt_amount)}</p>
                            <p className="text-[10px] text-green-600">Dibayar: Rp {fmt(Math.round(totalPaid))} ({pct}%)</p>
                            <p className={`text-[10px] font-semibold ${isPracticallyPaid ? 'text-green-600' : 'text-red-500'}`}>Sisa: Rp {fmt(isPracticallyPaid ? 0 : sisaDisplay)}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {((purchasingNotaList?.length ?? 0) === 0 && (debtList?.length ?? 0) === 0) && (
                <p className="text-center text-sm text-gray-400 py-10">Tidak ada riwayat pembayaran.</p>
              )}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 shrink-0">
              <button onClick={() => setShowPembayaran(false)} className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition">Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
