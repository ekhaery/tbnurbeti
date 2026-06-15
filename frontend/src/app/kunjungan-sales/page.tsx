'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark, faChevronLeft, faReceipt, faMoneyBillWave } from '@fortawesome/free-solid-svg-icons'
import { localDateStr } from '@/lib/date'

type Supplier = { id: number; name: string }

type PurchasingRow = {
  id: number; code: string; date: string; total: number; status: string
}

type BillRow = {
  id: number; bill_no: string | null; installment_due_date: string | null
  installment: number; paid_amount: number; is_paid: boolean
  purchasing: { code: string } | null
}

type DebtLoanRow = {
  id: number; bank_account: string; debt_type: string; debt_amount: number; due_date: string | null
  debt_loan_detail: { installment_amount: number; is_paid: boolean }[]
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
  const [billsList, setBillsList] = useState<BillRow[] | null>(null)
  const [debtList, setDebtList] = useState<DebtLoanRow[] | null>(null)
  const [showPembayaran, setShowPembayaran] = useState(false)


  useEffect(() => {
    supabase.from('suppliers').select('id, name').order('name')
      .then(({ data }: { data: Supplier[] | null }) => setSuppliers(data ?? []))
  }, [])

  const selectSupplier = (s: Supplier) => {
    setSelectedSupplier(s); setSupplierQuery(s.name); setSupplierDropdown(false)
    setPesananList(null); setBillsList(null); setDebtList(null)
    setShowPesanan(false); setShowPembayaran(false)
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
    const [billsRes, debtRes] = await Promise.all([
      supabase.from('bills')
        .select('id, bill_no, installment_due_date, installment, paid_amount, is_paid, purchasing(code)')
        .eq('supplier_id', selectedSupplier.id)
        .gt('paid_amount', 0)
        .order('installment_due_date', { ascending: false }),
      supabase.from('debt_loan')
        .select('id, bank_account, debt_type, debt_amount, due_date, debt_loan_detail(installment_amount, is_paid)')
        .eq('supplier_id', selectedSupplier.id)
        .order('due_date', { ascending: false }),
    ])
    setBillsList((billsRes.data ?? []) as BillRow[])
    setDebtList((debtRes.data ?? []) as DebtLoanRow[])
    setShowPembayaran(true); setLoadingPembayaran(false)
  }

  const hasSelection = !!selectedSupplier

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
              {billsList && billsList.length > 0 && (
                <div>
                  <p className="px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100">Tagihan Dagang ({billsList.length})</p>
                  <div className="divide-y divide-gray-100">
                    {billsList.map(b => (
                      <div key={b.id} className="flex items-start justify-between px-4 py-3 gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-500 font-mono">{b.purchasing?.code ?? '-'}</p>
                          {b.installment_due_date && <p className="text-xs text-gray-500 mt-0.5">{fmtDate(b.installment_due_date)}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-[#121358]">Rp {fmt(b.installment)}</p>
                          <span className={`text-[10px] font-semibold ${b.is_paid ? 'text-green-600' : 'text-red-500'}`}>
                            {b.is_paid ? 'Lunas' : `Sisa Rp ${fmt(b.installment - b.paid_amount)}`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {debtList && debtList.length > 0 && (
                <div>
                  <p className="px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100">Debt & Giro ({debtList.length})</p>
                  <div className="divide-y divide-gray-100">
                    {debtList.map(d => {
                      const totalPaid = d.debt_loan_detail.filter(x => x.is_paid).reduce((s, x) => s + x.installment_amount, 0)
                      const sisa = Math.max(0, Math.round(d.debt_amount - totalPaid))
                      const pct = d.debt_amount > 0 ? Math.min(100, Math.round(totalPaid / d.debt_amount * 100)) : 0
                      const isOverdue = d.due_date ? d.due_date <= localDateStr() : false
                      return (
                        <div key={d.id} className={`flex items-start justify-between px-4 py-3 gap-3 ${isOverdue ? 'bg-gray-100' : ''}`}>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-700">{d.bank_account}</p>
                            <p className="text-[10px] text-gray-400">{d.debt_type}</p>
                            {d.due_date && <p className="text-xs text-gray-500 mt-0.5">JT: {fmtDate(d.due_date)}</p>}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold text-[#121358]">Rp {fmt(d.debt_amount)}</p>
                            <p className="text-[10px] text-green-600">Dibayar: Rp {fmt(totalPaid)} ({pct}%)</p>
                            <p className={`text-[10px] font-semibold ${sisa === 0 ? 'text-green-600' : 'text-red-500'}`}>Sisa: Rp {fmt(sisa)}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {((billsList?.length ?? 0) === 0 && (debtList?.length ?? 0) === 0) && (
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
