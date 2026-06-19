'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTriangleExclamation, faCircleCheck, faChevronDown, faChevronUp, faXmark, faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { localDateStr } from '@/lib/date'

type Bill = {
  id: number
  purchasing_id: number
  due_date: string
  installment_due_date: string | null
  installment: number
  paid_amount: number
  is_paid: boolean
  suppliers: {
    name: string
    bank_detail: { bank?: string; no_rek?: string; rek_name?: string } | null
  } | null
  purchasing: { code: string; date: string; due_date: string | null } | null
}

type RawBill = { id: number; installment: number; paid_amount: number; due_date: string }
type OverduePurchasing = { purchasingId: number; code: string; date: string | null; dueDate: string | null; sisa: number; rawBills: RawBill[] }
type OverdueSupplier = {
  name: string
  bank: string | null
  purchasings: OverduePurchasing[]
  rawBills: RawBill[]
  total: number
}

const fmt = (n: number) => n.toLocaleString('id-ID')
const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
const monthLabel = (m: string) => new Date(m + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

function computeDistribution(bills: { id: number; installment: number; paid_amount: number }[], totalAmount: number) {
  let remaining = totalAmount
  return bills.map(b => {
    const owed = b.installment - b.paid_amount
    const allocation = Math.min(owed, Math.max(0, remaining))
    remaining = Math.max(0, remaining - allocation)
    const newPaidAmount = b.paid_amount + allocation
    return { id: b.id, allocation, newPaidAmount, willBePaid: newPaidAmount >= b.installment }
  })
}

export default function BillsInsightPage() {
  const supabase = createClient()
  const [bills, setBills] = useState<Bill[]>([])
  const [fetching, setFetching] = useState(true)
  const [overdueExpanded, setOverdueExpanded] = useState(false)

  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set())
  const toggleSupplier = (name: string) => setExpandedSuppliers(prev => {
    const next = new Set(prev)
    if (next.has(name)) next.delete(name); else next.add(name)
    return next
  })

  const [payingSupplier, setPayingSupplier] = useState<OverdueSupplier | null>(null)
  const [payingPurchasing, setPayingPurchasing] = useState<(OverduePurchasing & { supplierName: string }) | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const payInputRef = useRef<HTMLInputElement>(null)
  const payPurchasingInputRef = useRef<HTMLInputElement>(null)

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const in7Days = new Date(now); in7Days.setDate(in7Days.getDate() + 7)
  const in7DaysStr = `${in7Days.getFullYear()}-${String(in7Days.getMonth() + 1).padStart(2, '0')}-${String(in7Days.getDate()).padStart(2, '0')}`
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`

  const fetchData = async () => {
    const { data } = await supabase
      .from('bills')
      .select('id, purchasing_id, due_date, installment_due_date, installment, paid_amount, is_paid, suppliers(name, bank_detail), purchasing(code, date, due_date)')
    setBills((data as Bill[]) ?? [])
    setFetching(false)
  }

  useEffect(() => { fetchData() }, [])
  useEffect(() => { if (payingSupplier) setTimeout(() => payInputRef.current?.focus(), 100) }, [payingSupplier])
  useEffect(() => { if (payingPurchasing) setTimeout(() => payPurchasingInputRef.current?.focus(), 100) }, [payingPurchasing])

  const handlePay = async () => {
    if (!payingSupplier) return
    const amount = parseFloat(payAmount)
    if (!amount || amount <= 0) { setPayError('Masukkan jumlah pembayaran.'); return }
    if (amount > payingSupplier.total) { setPayError(`Melebihi sisa hutang (maks Rp ${fmt(payingSupplier.total)})`); return }
    setPaying(true)
    const sorted = [...payingSupplier.rawBills].sort((a, b) => a.due_date.localeCompare(b.due_date))
    const dist = computeDistribution(sorted, amount)
    for (const d of dist) {
      if (d.allocation === 0) continue
      await supabase.from('bills').update({
        paid_amount: d.newPaidAmount,
        is_paid: d.willBePaid,
        ...(d.willBePaid ? { payment_date: localDateStr() } : {}),
      }).eq('id', d.id)
    }
    setPaying(false)
    setPayingSupplier(null)
    setPayAmount('')
    setPayError(null)
    await fetchData()
  }

  const handlePayPurchasing = async () => {
    if (!payingPurchasing) return
    const amount = parseFloat(payAmount)
    if (!amount || amount <= 0) { setPayError('Masukkan jumlah pembayaran.'); return }
    if (amount > payingPurchasing.sisa) { setPayError(`Melebihi sisa hutang (maks Rp ${fmt(payingPurchasing.sisa)})`); return }
    setPaying(true)
    const sorted = [...payingPurchasing.rawBills].sort((a, b) => a.due_date.localeCompare(b.due_date))
    const dist = computeDistribution(sorted, amount)
    for (const d of dist) {
      if (d.allocation === 0) continue
      await supabase.from('bills').update({
        paid_amount: d.newPaidAmount,
        is_paid: d.willBePaid,
        ...(d.willBePaid ? { payment_date: localDateStr() } : {}),
      }).eq('id', d.id)
    }
    setPaying(false)
    setPayingPurchasing(null)
    setPayAmount('')
    setPayError(null)
    await fetchData()
  }


  // Overdue: due_date from previous months, not fully paid
  const overdueBills = bills.filter(b => !b.is_paid && b.due_date.slice(0, 7) < currentMonth)
  const overdueAmount = overdueBills.reduce((s, b) => s + (b.installment - b.paid_amount), 0)

  const overdueBySupplier: Record<string, OverdueSupplier> = {}
  const seenPurchasingIds: Record<string, Set<number>> = {}

  overdueBills.forEach(b => {
    const name = b.suppliers?.name ?? '-'
    if (!overdueBySupplier[name]) {
      const bd = b.suppliers?.bank_detail
      const parts = bd ? [bd.bank, bd.no_rek, bd.rek_name].filter(Boolean) : []
      overdueBySupplier[name] = { name, bank: parts.length > 0 ? parts.join(' · ') : null, purchasings: [], rawBills: [], total: 0 }
      seenPurchasingIds[name] = new Set()
    }
    const sisa = b.installment - b.paid_amount
    overdueBySupplier[name].total += sisa
    overdueBySupplier[name].rawBills.push({ id: b.id, installment: b.installment, paid_amount: b.paid_amount, due_date: b.due_date })
    if (!seenPurchasingIds[name].has(b.purchasing_id)) {
      seenPurchasingIds[name].add(b.purchasing_id)
      overdueBySupplier[name].purchasings.push({
        purchasingId: b.purchasing_id,
        code: b.purchasing?.code ?? '-',
        date: b.purchasing?.date ?? null,
        dueDate: b.purchasing?.due_date ?? null,
        sisa: 0,
        rawBills: [],
      })
    }
    const p = overdueBySupplier[name].purchasings.find(x => x.purchasingId === b.purchasing_id)
    if (p) p.sisa += sisa
  })
  const overdueSupplierList = Object.values(overdueBySupplier).sort((a, b) => b.total - a.total)

  // This month by due_date
  const thisMonthBills = bills.filter(b => b.due_date.slice(0, 7) === currentMonth)
  const thisMonthTotal = thisMonthBills.reduce((s, b) => s + b.installment, 0)
  const thisMonthPaid = thisMonthBills.reduce((s, b) => s + b.paid_amount, 0)
  const thisMonthSisa = thisMonthTotal - thisMonthPaid
  const thisMonthPct = thisMonthTotal > 0 ? thisMonthPaid / thisMonthTotal * 100 : 0

  // Per supplier: bills where due_date is current month
  const supplierMap: Record<string, { sisa: number; dueDate: string; allPaid: boolean; pastDue: boolean; urgent: boolean; purchasings: OverduePurchasing[] }> = {}
  const seenThisMonthPurchasingIds: Record<string, Set<number>> = {}
  bills
    .filter(b => b.due_date.slice(0, 7) === currentMonth)
    .forEach(b => {
      const name = b.suppliers?.name ?? '-'
      if (!supplierMap[name]) {
        supplierMap[name] = { sisa: 0, dueDate: b.due_date, allPaid: true, pastDue: false, urgent: false, purchasings: [] }
        seenThisMonthPurchasingIds[name] = new Set()
      }
      const e = supplierMap[name]
      const sisa = Math.max(0, b.installment - b.paid_amount)
      e.sisa += sisa
      if (b.due_date < e.dueDate) e.dueDate = b.due_date
      if (!b.is_paid) {
        e.allPaid = false
        if (b.due_date < todayStr) e.pastDue = true
        else if (b.due_date <= in7DaysStr) e.urgent = true
      }
      if (!seenThisMonthPurchasingIds[name].has(b.purchasing_id)) {
        seenThisMonthPurchasingIds[name].add(b.purchasing_id)
        e.purchasings.push({ purchasingId: b.purchasing_id, code: b.purchasing?.code ?? '-', date: b.purchasing?.date ?? null, dueDate: b.purchasing?.due_date ?? null, sisa: 0, rawBills: [] })
      }
      const p = e.purchasings.find(x => x.purchasingId === b.purchasing_id)
      if (p) {
        p.sisa += sisa
        if (!b.is_paid) p.rawBills.push({ id: b.id, installment: b.installment, paid_amount: b.paid_amount, due_date: b.due_date })
      }
    })
  const supplierList = Object.entries(supplierMap).sort((a, b) => a[1].dueDate.localeCompare(b[1].dueDate))

  // Next month preview
  const nextMonthBills = bills.filter(b => b.due_date.slice(0, 7) === nextMonth)
  const nextMonthTotal = nextMonthBills.reduce((s, b) => s + Math.max(0, b.installment - b.paid_amount), 0)
  const nextMonthSupplierCount = new Set(nextMonthBills.map(b => b.suppliers?.name ?? '-')).size

  const totalNeeded = overdueAmount + thisMonthSisa

  if (fetching) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Memuat...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/" className="w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-sm text-gray-500 hover:text-gray-800 transition shrink-0">
            <FontAwesomeIcon icon={faArrowLeft} className="w-3.5 h-3.5" />
          </Link>
          <div>
            <h2 className="text-lg font-bold text-gray-800">Tagihan Dagang Insight</h2>
            <p className="text-xs text-gray-500 mt-0.5">Situasi hutang {monthLabel(currentMonth)}</p>
          </div>
        </div>

        {/* Overdue alert */}
        {overdueAmount > 0 && (
          <div className="rounded-xl bg-red-50 border-2 border-red-300 overflow-hidden">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <FontAwesomeIcon icon={faTriangleExclamation} className="w-4 h-4 text-red-600" />
                <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Perlu tindakan segera</p>
              </div>
              <p className="text-sm text-red-800 mb-1">Ada hutang yang sudah lewat jatuh tempo</p>
              <p className="text-2xl font-bold text-red-600">Rp {fmt(overdueAmount)}</p>
              <p className="text-xs text-red-600 mt-1.5">
                {overdueBills.length} tagihan dari {overdueSupplierList.length} supplier
              </p>
            </div>

            <button
              onClick={() => setOverdueExpanded(v => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-red-100 text-xs font-semibold text-red-700 hover:bg-red-200 transition"
            >
              <span>{overdueExpanded ? 'Sembunyikan detail' : 'Lihat detail per supplier'}</span>
              <FontAwesomeIcon icon={overdueExpanded ? faChevronUp : faChevronDown} className="w-3 h-3" />
            </button>

            {overdueExpanded && (
              <div className="divide-y divide-red-200">
                {overdueSupplierList.map(sup => (
                  <div key={sup.name} className="px-4 py-3 bg-white">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{sup.name}</p>
                        {sup.bank && <p className="text-xs text-gray-400 mt-0.5">{sup.bank}</p>}
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <p className="text-sm font-bold text-red-600">Rp {fmt(sup.total)}</p>
                        <button
                          onClick={() => { setPayingSupplier(sup); setPayAmount(''); setPayError(null) }}
                          className="text-xs font-semibold px-3 py-1 rounded-lg text-white"
                          style={{ backgroundColor: '#800000' }}
                        >
                          Bayar
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {sup.purchasings.map(p => (
                        <div key={p.purchasingId} className="bg-red-50 rounded-lg px-3 py-2">
                          <p className="text-xs font-mono text-gray-500">{p.code}</p>
                          <div className="flex justify-between items-center mt-1">
                            <div className="text-[11px] text-gray-500 space-y-0.5">
                              {p.date && <p>Tgl nota: {fmtDate(p.date)}</p>}
                              {p.dueDate && <p>Jatuh tempo: {fmtDate(p.dueDate)}</p>}
                            </div>
                            <p className="text-xs font-semibold text-red-600 shrink-0 ml-2">Rp {fmt(p.sisa)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* This month main card */}
        <div className="rounded-xl bg-[#121358] p-4">
          <p className="text-xs mb-1" style={{ color: '#B5BAFF' }}>
            Yang harus dibayar bulan {new Date(currentMonth + '-01').toLocaleDateString('id-ID', { month: 'long' })}
          </p>
          <p className="text-3xl font-bold" style={{ color: '#F5C842' }}>Rp {fmt(thisMonthSisa)}</p>
          <p className="text-xs mt-1" style={{ color: '#B5BAFF' }}>
            Total tagihan bulan ini: Rp {fmt(thisMonthTotal)}
          </p>
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1.5" style={{ color: '#B5BAFF' }}>
              <span>Sudah dibayar {thisMonthPct.toFixed(1)}%</span>
              <span>Rp {fmt(thisMonthPaid)}</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, thisMonthPct)}%`, backgroundColor: '#F5C842' }} />
            </div>
          </div>
        </div>

        {/* Per supplier */}
        {supplierList.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-1 mb-2">
              Hutang per supplier bulan ini
            </p>
            <div className="space-y-2">
              {supplierList.map(([name, data]) => {
                const isExpanded = expandedSuppliers.has(name)
                return (
                  <div key={name} className="bg-white rounded-xl shadow-sm overflow-hidden">
                    {/* Header row — clickable */}
                    <div
                      className="p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition"
                      onClick={() => toggleSupplier(name)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Jatuh tempo: {fmtDate(data.dueDate)}</p>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-2">
                        <p className="text-sm font-bold text-[#121358]">Rp {fmt(data.sisa)}</p>
                        <FontAwesomeIcon icon={isExpanded ? faChevronUp : faChevronDown} className="w-3 h-3 text-gray-400 shrink-0" />
                      </div>
                    </div>

                    {/* Expanded: per-purchasing detail */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 divide-y divide-gray-100 bg-gray-50">
                        {[...data.purchasings].sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')).map(p => {
                          const pDueDate = p.dueDate ?? ''
                          const pPastDue = pDueDate && pDueDate < todayStr
                          const pUrgent = pDueDate && !pPastDue && pDueDate <= in7DaysStr
                          const pAllPaid = p.sisa === 0
                          return (
                            <div key={p.purchasingId} className={`px-4 py-3 ${pAllPaid ? 'bg-green-50' : ''}`}>
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="text-xs font-mono text-gray-500">{p.code}</p>
                                    {!pAllPaid && (
                                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                        pPastDue ? 'bg-red-100 text-red-700'
                                          : pUrgent ? 'bg-orange-100 text-orange-700'
                                          : 'bg-amber-100 text-amber-700'
                                      }`}>
                                        {pPastDue ? 'Sudah lewat!' : pUrgent ? 'Bayar segera' : 'Belum lunas'}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-gray-500 mt-0.5 space-y-0.5">
                                    {p.date && <p>Tgl nota: {fmtDate(p.date)}</p>}
                                    {p.dueDate && <p>Jatuh tempo: {fmtDate(p.dueDate)}</p>}
                                  </div>
                                </div>
                                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                                  {!pAllPaid && <p className="text-xs font-semibold text-red-500">Sisa: Rp {fmt(p.sisa)}</p>}
                                  {!pAllPaid && (
                                    <button
                                      onClick={e => { e.stopPropagation(); setPayingPurchasing({ ...p, supplierName: name }); setPayAmount(''); setPayError(null) }}
                                      className="text-xs font-semibold px-3 py-1 rounded-lg text-white"
                                      style={{ backgroundColor: '#121358' }}
                                    >
                                      Bayar
                                    </button>
                                  )}
                                </div>
                              </div>
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

        {/* Next month preview */}
        {nextMonthTotal > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-1 mb-2">
              Bulan depan · {monthLabel(nextMonth)}
            </p>
            <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-[#B5BAFF]">
              <p className="text-xs text-gray-500 mb-1">Siapkan uang untuk bulan depan</p>
              <p className="text-xl font-bold text-[#121358]">Rp {fmt(nextMonthTotal)}</p>
              <p className="text-xs text-gray-500 mt-1">Dari {nextMonthSupplierCount} supplier</p>
            </div>
          </div>
        )}

        {/* Tips */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-1 mb-2">
            Tips pengelolaan
          </p>
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
            {overdueAmount === 0 && thisMonthSisa === 0 ? (
              <div className="flex gap-3 items-start">
                <FontAwesomeIcon icon={faCircleCheck} className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700">Semua tagihan bulan ini sudah lunas. Bagus!</p>
              </div>
            ) : (
              <>
                {overdueAmount > 0 && (
                  <div className="flex gap-3 items-start">
                    <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1.5" />
                    <p className="text-sm text-gray-700">
                      Ada <strong>Rp {fmt(overdueAmount)}</strong> hutang dari bulan lalu yang belum dibayar.
                      Prioritaskan ini sebelum bayar tagihan baru.
                    </p>
                  </div>
                )}
                {thisMonthSisa > 0 && (
                  <div className="flex gap-3 items-start">
                    <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                    <p className="text-sm text-gray-700">
                      Total yang perlu disiapkan bulan ini:{' '}
                      <strong>Rp {fmt(totalNeeded)}</strong>
                      {overdueAmount > 0 ? ' (tunggakan + tagihan baru)' : ''}
                    </p>
                  </div>
                )}
                {supplierList.some(([, d]) => (d.urgent || d.pastDue) && !d.allPaid) && (
                  <div className="flex gap-3 items-start">
                    <div className="w-2 h-2 rounded-full bg-orange-500 shrink-0 mt-1.5" />
                    <p className="text-sm text-gray-700">
                      Kalau hanya bisa bayar sebagian,{' '}
                      <strong>dahulukan supplier yang jatuh temponya paling dekat</strong>.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

      </div>

      {/* Pay popup */}
      {payingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ backgroundColor: '#800000' }}>
              <div>
                <p className="text-sm font-bold text-white">{payingSupplier.name}</p>
                {payingSupplier.bank && <p className="text-xs text-white/60 mt-0.5">{payingSupplier.bank}</p>}
              </div>
              <button onClick={() => setPayingSupplier(null)} className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition">
                <FontAwesomeIcon icon={faXmark} className="w-3 h-3" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total sisa hutang</span>
                <span className="font-semibold text-gray-800">Rp {fmt(payingSupplier.total)}</span>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Jumlah yang akan dibayar</label>
                <input
                  ref={payInputRef}
                  type="number"
                  value={payAmount}
                  onChange={e => { setPayAmount(e.target.value); setPayError(null) }}
                  min="0"
                  max={payingSupplier.total}
                  placeholder={`Maks Rp ${fmt(payingSupplier.total)}`}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2"
                  style={{ ['--tw-ring-color' as string]: '#800000' }}
                />
                {payError && <p className="text-xs text-red-500 mt-1">{payError}</p>}
              </div>
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setPayingSupplier(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition">
                Batal
              </button>
              <button onClick={handlePay} disabled={paying || !payAmount || parseFloat(payAmount) <= 0}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition disabled:opacity-40"
                style={{ backgroundColor: '#800000' }}>
                {paying ? 'Menyimpan...' : 'Konfirmasi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay per purchasing popup */}
      {payingPurchasing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ backgroundColor: '#121358' }}>
              <div>
                <p className="text-sm font-bold text-white">{payingPurchasing.supplierName}</p>
                <p className="text-xs font-mono mt-0.5" style={{ color: '#B5BAFF' }}>{payingPurchasing.code}</p>
              </div>
              <button onClick={() => setPayingPurchasing(null)} className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition">
                <FontAwesomeIcon icon={faXmark} className="w-3 h-3" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Sisa hutang nota ini</span>
                <span className="font-semibold text-gray-800">Rp {fmt(payingPurchasing.sisa)}</span>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Jumlah yang akan dibayar</label>
                <input
                  ref={payPurchasingInputRef}
                  type="number"
                  value={payAmount}
                  onChange={e => { setPayAmount(e.target.value); setPayError(null) }}
                  min="0"
                  max={payingPurchasing.sisa}
                  placeholder={`Maks Rp ${fmt(payingPurchasing.sisa)}`}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2"
                  style={{ ['--tw-ring-color' as string]: '#121358' }}
                />
                {payError && <p className="text-xs text-red-500 mt-1">{payError}</p>}
              </div>
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setPayingPurchasing(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition">
                Batal
              </button>
              <button onClick={handlePayPurchasing} disabled={paying || !payAmount || parseFloat(payAmount) <= 0}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition disabled:opacity-40"
                style={{ backgroundColor: '#121358' }}>
                {paying ? 'Menyimpan...' : 'Konfirmasi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
