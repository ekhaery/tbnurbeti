'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMoneyBillWave, faCheck, faXmark } from '@fortawesome/free-solid-svg-icons'

type Bill = {
  id: number
  bill_no: string | null
  purchasing_id: number
  due_date: string
  installment_due_date: string | null
  month: string
  installment: number
  paid_amount: number
  is_paid: boolean
  suppliers: { name: string } | null
  purchasing: { code: string } | null
}

type FilterStatus = 'all' | 'unpaid' | 'paid'

const fmt = (n: number) => n.toLocaleString('id-ID')

const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

// Sort: month → supplier name → bill_no → installment_due_date
function sortBills(bills: Bill[]): Bill[] {
  return [...bills].sort((a, b) => {
    const monthA = a.month ?? ''
    const monthB = b.month ?? ''
    if (monthA !== monthB) return monthA.localeCompare(monthB)

    const supA = a.suppliers?.name ?? ''
    const supB = b.suppliers?.name ?? ''
    if (supA !== supB) return supA.localeCompare(supB)

    const codeA = a.bill_no ?? ''
    const codeB = b.bill_no ?? ''
    if (codeA !== codeB) return codeA.localeCompare(codeB)

    return (a.installment_due_date ?? '').localeCompare(b.installment_due_date ?? '')
  })
}

export default function BillsPage() {
  const supabase = createClient()

  const [bills, setBills] = useState<Bill[]>([])
  const [fetching, setFetching] = useState(true)
  const [filter, setFilter] = useState<FilterStatus>('unpaid')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [supplierQuery, setSupplierQuery] = useState('')
  const [supplierDropdown, setSupplierDropdown] = useState(false)

  // Pay modal
  const [payingBill, setPayingBill] = useState<Bill | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const fetchData = async () => {
    const { data } = await supabase
      .from('bills')
      .select('id, bill_no, purchasing_id, due_date, installment_due_date, month, installment, paid_amount, is_paid, suppliers(name), purchasing(code)')
    setBills((data as Bill[]) ?? [])
    setFetching(false)
  }

  useEffect(() => { fetchData() }, [])
  useEffect(() => { if (payingBill) setTimeout(() => inputRef.current?.focus(), 100) }, [payingBill])

  // Unique supplier names for filter dropdown
  const supplierNames = Array.from(new Set(bills.map(b => b.suppliers?.name ?? '').filter(Boolean))).sort()

  const filtered = sortBills(bills.filter(b => {
    if (filter === 'paid' && !b.is_paid) return false
    if (filter === 'unpaid' && b.is_paid) return false
    if (supplierFilter && b.suppliers?.name !== supplierFilter) return false
    return true
  }))

  const totalUnpaid = bills.filter(b => !b.is_paid).reduce((s, b) => s + (b.installment - b.paid_amount), 0)
  const totalPaid = bills.filter(b => b.is_paid).reduce((s, b) => s + b.installment, 0)

  const openPay = (bill: Bill) => {
    setPayingBill(bill)
    setPayAmount(String(bill.installment - bill.paid_amount))
    setError(null)
  }

  const handlePay = async () => {
    if (!payingBill) return
    const amount = parseFloat(payAmount)
    if (!amount || amount <= 0) { setError('Masukkan jumlah pembayaran.'); return }
    const newPaid = payingBill.paid_amount + amount
    if (newPaid > payingBill.installment) { setError(`Melebihi sisa tagihan Rp ${fmt(payingBill.installment - payingBill.paid_amount)}.`); return }
    setPaying(true)
    const { error } = await supabase.from('bills')
      .update({ paid_amount: newPaid, payment_date: new Date().toISOString().slice(0, 10) })
      .eq('id', payingBill.id)
    setPaying(false)
    if (error) { setError(error.message); return }
    setPayingBill(null)
    fetchData()
  }

  const remaining = (b: Bill) => b.installment - b.paid_amount

  // Group by month
  const grouped = filtered.reduce<Record<string, Bill[]>>((acc, b) => {
    if (!acc[b.month]) acc[b.month] = []
    acc[b.month].push(b)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-xl mx-auto space-y-4">

        {/* Header */}
        <div>
          <h2 className="text-lg font-bold text-gray-800">Tagihan</h2>
          <p className="text-xs text-gray-400 mt-0.5">Tagihan dari purchasing berjangka.</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl shadow-sm p-3">
            <p className="text-xs text-gray-400">Belum Lunas</p>
            <p className="text-base font-bold text-red-500 mt-0.5">Rp {fmt(totalUnpaid)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-3">
            <p className="text-xs text-gray-400">Sudah Lunas</p>
            <p className="text-base font-bold text-green-600 mt-0.5">Rp {fmt(totalPaid)}</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="bg-white rounded-2xl shadow-sm p-1 flex gap-1">
          {(['unpaid', 'paid', 'all'] as FilterStatus[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 text-center text-sm font-medium py-2 rounded-xl transition-colors ${
                filter === f ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {f === 'unpaid' ? 'Belum Lunas' : f === 'paid' ? 'Lunas' : 'Semua'}
            </button>
          ))}
        </div>

        {/* Supplier filter — autocomplete */}
        <div className="relative">
          <input
            type="text"
            value={supplierQuery}
            onChange={e => {
              setSupplierQuery(e.target.value)
              setSupplierFilter('')
              setSupplierDropdown(true)
            }}
            onFocus={() => setSupplierDropdown(true)}
            onBlur={() => setTimeout(() => setSupplierDropdown(false), 150)}
            placeholder="Filter supplier..."
            autoComplete="off"
            className={`w-full bg-white border rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#121358] shadow-sm ${supplierFilter ? 'border-[#121358]/40 bg-[#121358]/5' : 'border-gray-200'}`}
          />
          {supplierQuery && (
            <button
              onClick={() => { setSupplierQuery(''); setSupplierFilter(''); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <FontAwesomeIcon icon={faXmark} className="w-3 h-3" />
            </button>
          )}
          {supplierDropdown && (
            <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
              <button
                onMouseDown={() => { setSupplierFilter(''); setSupplierQuery(''); setSupplierDropdown(false) }}
                className={`w-full text-left px-4 py-2.5 text-sm transition ${!supplierFilter ? 'bg-[#121358] text-white' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                Semua Supplier
              </button>
              {supplierNames
                .filter(n => n.toLowerCase().includes(supplierQuery.toLowerCase()))
                .map(name => (
                  <button
                    key={name}
                    onMouseDown={() => { setSupplierFilter(name); setSupplierQuery(name); setSupplierDropdown(false) }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition ${supplierFilter === name ? 'bg-[#121358] text-white' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    {name}
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Bill list grouped by month */}
        {fetching ? (
          <div className="text-center text-sm text-gray-400 py-10">Memuat...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-10">Tidak ada tagihan.</div>
        ) : (
          Object.entries(grouped).map(([month, monthBills]) => (
            <div key={month} className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-1">{month}</p>
              {monthBills.map(b => (
                <div key={b.id} className={`bg-white rounded-xl shadow-sm p-4 border-l-4 ${b.is_paid ? 'border-green-400' : 'border-[#9FA1FF]'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{b.suppliers?.name ?? '-'}</p>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">{b.bill_no ?? b.purchasing?.code}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {b.installment_due_date ? fmtDate(b.installment_due_date) : '-'} · Jatuh tempo: {fmtDate(b.due_date)}
                      </p>
                      {b.paid_amount > 0 && !b.is_paid && (
                        <p className="text-xs mt-0.5" style={{ color: '#9FA1FF' }}>
                          Terbayar: Rp {fmt(b.paid_amount)} · Sisa: Rp {fmt(remaining(b))}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {!(b.paid_amount > 0 && !b.is_paid) && (
                        <p className="text-sm font-bold text-[#121358]">Rp {fmt(b.installment)}</p>
                      )}
                      {b.is_paid ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-600 mt-1">
                          <FontAwesomeIcon icon={faCheck} className="w-2.5 h-2.5" /> Lunas
                        </span>
                      ) : (
                        <>
                          {b.paid_amount > 0 && (
                            <p className="text-sm font-bold mt-0.5" style={{ color: '#9FA1FF' }}>
                              Rp {fmt(remaining(b))}
                            </p>
                          )}
                          <button
                            onClick={() => openPay(b)}
                            className="mt-1 flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-[#121358] text-white hover:bg-[#1a1c6e] transition"
                          >
                            <FontAwesomeIcon icon={faMoneyBillWave} className="w-3 h-3" />
                            Bayar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Pay modal */}
      {payingBill && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-800">Bayar Tagihan</h3>
                <p className="text-xs text-gray-400 mt-0.5">{payingBill.suppliers?.name} · {payingBill.month}</p>
              </div>
              <button onClick={() => setPayingBill(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total Tagihan</span>
                <span className="font-semibold text-gray-800">Rp {fmt(payingBill.installment)}</span>
              </div>
              {payingBill.paid_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Sudah Dibayar</span>
                  <span className="font-semibold text-green-600">Rp {fmt(payingBill.paid_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Sisa</span>
                <span className="font-bold text-red-500">Rp {fmt(remaining(payingBill))}</span>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Jumlah Bayar</label>
                <input
                  ref={inputRef}
                  type="number"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  min="0"
                  max={remaining(payingBill)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]"
                />
              </div>
              {error && <p className="text-xs text-red-500">⚠️ {error}</p>}
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setPayingBill(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition">
                Batal
              </button>
              <button onClick={handlePay} disabled={paying}
                className="flex-1 py-2.5 rounded-xl bg-[#121358] hover:bg-[#1a1c6e] disabled:bg-[#121358]/40 text-white text-sm font-semibold transition">
                {paying ? 'Menyimpan...' : 'Konfirmasi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
