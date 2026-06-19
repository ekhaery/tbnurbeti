'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMoneyBillWave, faCheck, faXmark, faCalendarDays, faChevronDown, faChevronUp, faEye, faReceipt } from '@fortawesome/free-solid-svg-icons'
import { localDateStr } from '@/lib/date'

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
  payment_date: string | null
  updated_at: string
  suppliers: { name: string } | null
  purchasing: { code: string; total: number; date: string; due_date: string | null } | null
}

type FilterStatus = 'all' | 'unpaid' | 'paid'

type PurchasingRow = {
  id: number
  code: string
  date: string
  due_date: string | null
  total: number
  status: string
  suppliers: { name: string; bank_detail: { bank?: string; no_rek?: string; rek_name?: string } | null } | null
}

const fmt = (n: number) => n.toLocaleString('id-ID')

function computeDistribution(bills: Bill[], totalAmount: number) {
  let remaining = totalAmount
  return bills.map(b => {
    if (b.is_paid) return { id: b.id, allocation: 0, newPaidAmount: b.paid_amount, willBePaid: true, owed: 0 }
    const owed = b.installment - b.paid_amount
    const allocation = Math.min(owed, Math.max(0, remaining))
    remaining = Math.max(0, remaining - allocation)
    const newPaidAmount = b.paid_amount + allocation
    return { id: b.id, allocation, newPaidAmount, willBePaid: newPaidAmount >= b.installment, owed }
  })
}

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
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [expandedBill, setExpandedBill] = useState<number | null>(null)
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set())
  const toggleWeek = (week: string) => setExpandedWeeks(prev => {
    const next = new Set(prev)
    next.has(week) ? next.delete(week) : next.add(week)
    return next
  })
  const [purchasingItems, setPurchasingItems] = useState<Record<number, { id: number; qty: number; base_price: number; products: { name: string } | null }[]>>({})
  const [billsTab, setBillsTab] = useState<'cicilan' | 'jatuh_tempo'>('jatuh_tempo')
  const [showPaidModal, setShowPaidModal] = useState(false)
  const [paidPage, setPaidPage] = useState(1)
  const PAID_PAGE_SIZE = 50
  const [purchasing, setPurchasing] = useState<PurchasingRow[]>([])
  const [fetchingPurchasing, setFetchingPurchasing] = useState(false)
  const now = new Date()
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [monthFilter, setMonthFilter] = useState(defaultMonth)
  const [supplierFilter, setSupplierFilter] = useState('')
  const [supplierQuery, setSupplierQuery] = useState('')
  const [supplierDropdown, setSupplierDropdown] = useState(false)

  // Weekly calendar
  const [showCalendar, setShowCalendar] = useState(false)
  const [calendarWeekStart, setCalendarWeekStart] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - d.getDay() + 1) // Monday
    d.setHours(0, 0, 0, 0)
    return d
  })

  // Monthly calendar
  const [showMonthCalendar, setShowMonthCalendar] = useState(false)
  const [monthCalendarDate, setMonthCalendarDate] = useState(new Date())

  // Calendar dropdown
  const [showCalendarMenu, setShowCalendarMenu] = useState(false)

  // Pay modal
  const [payingBill, setPayingBill] = useState<Bill | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Kumpulan Nota detail popup
  const [selectedPurchasing, setSelectedPurchasing] = useState<PurchasingRow | null>(null)
  const [purchasingBills, setPurchasingBills] = useState<Bill[]>([])
  const [fetchingPBills, setFetchingPBills] = useState(false)
  const [selectedBillIds, setSelectedBillIds] = useState<Set<number>>(new Set())
  const [markingLunas, setMarkingLunas] = useState(false)
  const [showManualInput, setShowManualInput] = useState(false)
  const [manualAmount, setManualAmount] = useState('')

  const openPurchasingDetail = async (p: PurchasingRow) => {
    setSelectedPurchasing(p)
    setSelectedBillIds(new Set())
    setShowManualInput(false)
    setManualAmount('')
    setFetchingPBills(true)
    const { data } = await supabase.from('bills')
      .select('id, bill_no, purchasing_id, due_date, installment_due_date, month, installment, paid_amount, is_paid, payment_date, updated_at, suppliers(name), purchasing(code, total, date, due_date)')
      .eq('purchasing_id', p.id)
      .order('installment_due_date', { ascending: true })
    setPurchasingBills((data as Bill[]) ?? [])
    setFetchingPBills(false)
  }

  const toggleBillId = (id: number) => {
    setManualAmount('')
    setSelectedBillIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleLunas = async () => {
    if (!selectedPurchasing || selectedBillIds.size === 0) return
    setMarkingLunas(true)
    const ids = Array.from(selectedBillIds)
    for (const id of ids) {
      const bill = purchasingBills.find(b => b.id === id)
      if (!bill) continue
      await supabase.from('bills').update({
        is_paid: true,
        paid_amount: bill.installment,
        payment_date: localDateStr()
      }).eq('id', id)
    }
    const { data } = await supabase.from('bills')
      .select('id, bill_no, purchasing_id, due_date, installment_due_date, month, installment, paid_amount, is_paid, payment_date, updated_at, suppliers(name), purchasing(code, total, date, due_date)')
      .eq('purchasing_id', selectedPurchasing.id)
      .order('installment_due_date', { ascending: true })
    setPurchasingBills((data as Bill[]) ?? [])
    setSelectedBillIds(new Set())
    setMarkingLunas(false)
    fetchData()
  }

  const handleManualSave = async () => {
    if (!selectedPurchasing) return
    const amount = parseFloat(manualAmount) || 0
    if (amount <= 0) return
    setMarkingLunas(true)
    const dist = computeDistribution(purchasingBills, amount)
    for (const d of dist) {
      if (d.allocation === 0) continue
      await supabase.from('bills').update({
        paid_amount: d.newPaidAmount,
        is_paid: d.willBePaid,
        ...(d.willBePaid ? { payment_date: localDateStr() } : {}),
      }).eq('id', d.id)
    }
    const { data } = await supabase.from('bills')
      .select('id, bill_no, purchasing_id, due_date, installment_due_date, month, installment, paid_amount, is_paid, payment_date, updated_at, suppliers(name), purchasing(code, total, date, due_date)')
      .eq('purchasing_id', selectedPurchasing.id)
      .order('installment_due_date', { ascending: true })
    setPurchasingBills((data as Bill[]) ?? [])
    setSelectedBillIds(new Set())
    setManualAmount('')
    setShowManualInput(false)
    setMarkingLunas(false)
    fetchData()
  }

  const fetchData = async () => {
    const { data } = await supabase
      .from('bills')
      .select('id, bill_no, purchasing_id, due_date, installment_due_date, month, installment, paid_amount, is_paid, payment_date, updated_at, suppliers(name), purchasing(code, total, date, due_date)')
    setBills((data as Bill[]) ?? [])
    setFetching(false)
  }

  useEffect(() => { fetchData() }, [])
  useEffect(() => { if (payingBill) setTimeout(() => inputRef.current?.focus(), 100) }, [payingBill])

  const toggleBill = async (bill: Bill) => {
    if (expandedBill === bill.id) { setExpandedBill(null); return }
    setExpandedBill(bill.id)
    if (!purchasingItems[bill.purchasing_id]) {
      const { data } = await supabase
        .from('purchasing_items')
        .select('id, qty, base_price, products(name)')
        .eq('purchasing_id', bill.purchasing_id)
      setPurchasingItems(prev => ({ ...prev, [bill.purchasing_id]: (data ?? []) as { id: number; qty: number; base_price: number; products: { name: string } | null }[] }))
    }
  }

  useEffect(() => {
    if (billsTab !== 'jatuh_tempo') return
    setFetchingPurchasing(true)
    supabase
      .from('purchasing')
      .select('id, code, date, due_date, total, status, suppliers(name, bank_detail)')
      .not('due_date', 'is', null)
      .order('due_date', { ascending: true })
      .then(({ data }: { data: PurchasingRow[] | null }) => {
        setPurchasing(data ?? [])
        setFetchingPurchasing(false)
      })
  }, [billsTab])

  const supplierNames = Array.from(new Set(bills.map(b => b.suppliers?.name ?? '').filter(Boolean))).sort()

  // Unique months from installment_due_date sorted ASC
  const months = Array.from(new Set(
    bills.map(b => b.installment_due_date ? b.installment_due_date.slice(0, 7) : '').filter(Boolean)
  )).sort()

  const monthLabel = (m: string) => {
    const [y, mo] = m.split('-')
    return new Date(parseInt(y), parseInt(mo) - 1).toLocaleDateString('id-ID', { month: 'short' })
  }

  const filtered = sortBills(bills.filter(b => {
    if (filter === 'paid' && !b.is_paid) return false
    if (filter === 'unpaid' && b.is_paid) return false
    if (supplierFilter && b.suppliers?.name !== supplierFilter) return false
    if (monthFilter) {
      if (!b.installment_due_date) return false
      const bMonth = b.installment_due_date.slice(0, 7) // "YYYY-MM"
      if (bMonth !== monthFilter) return false
    }
    return true
  }))

  const totalUnpaid = bills.filter(b => !b.is_paid).reduce((s, b) => s + (b.installment - b.paid_amount), 0)
  const totalPaid = bills.filter(b => b.is_paid).reduce((s, b) => s + b.installment, 0)

  const supplierBills = supplierFilter ? bills.filter(b => b.suppliers?.name === supplierFilter) : bills
  const totalAll = supplierBills.reduce((s, b) => s + b.installment, 0)
  const totalPaidAll = supplierBills.reduce((s, b) => s + b.paid_amount, 0)
  const totalSisa = totalAll - totalPaidAll

  // Paid amount per purchasing_id (for Kumpulan Nota progress)
  const purchasingPaidMap = bills.reduce<Record<number, number>>((acc, b) => {
    acc[b.purchasing_id] = (acc[b.purchasing_id] ?? 0) + b.paid_amount
    return acc
  }, {})

  // Month-filtered bills for Card 2 summary (by installment_due_date)
  const monthBills = bills.filter(b => {
    if (monthFilter && b.installment_due_date?.slice(0, 7) !== monthFilter) return false
    if (supplierFilter && b.suppliers?.name !== supplierFilter) return false
    return true
  })
  const monthTotalTagihan = monthBills.reduce((s, b) => s + b.installment, 0)
  const monthTotalTerbayar = monthBills.reduce((s, b) => s + b.paid_amount, 0)
  const monthSisaTagihan = monthBills.reduce((s, b) => s + (b.installment - b.paid_amount), 0)

  // Total Terbayar JT: sum paid_amount filtered by bills.due_date month and supplier
  const monthTotalTerbayarJT = bills
    .filter(b => {
      if (monthFilter && b.due_date?.slice(0, 7) !== monthFilter) return false
      if (supplierFilter && b.suppliers?.name !== supplierFilter) return false
      return true
    })
    .reduce((s, b) => s + b.paid_amount, 0)

  // Total Tagihan JT: sum purchasing.total deduplicated by purchasing_id, filtered by purchasing.due_date month and supplier
  const monthTotalTagihanJT = bills.reduce<{ seen: Set<number>; total: number }>((acc, b) => {
    if (acc.seen.has(b.purchasing_id)) return acc
    if (supplierFilter && b.suppliers?.name !== supplierFilter) return acc
    const pDueDate = b.purchasing?.due_date
    if (monthFilter && (!pDueDate || pDueDate.slice(0, 7) !== monthFilter)) return acc
    acc.seen.add(b.purchasing_id)
    return { seen: acc.seen, total: acc.total + (b.purchasing?.total ?? 0) }
  }, { seen: new Set(), total: 0 }).total

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
      .update({ paid_amount: newPaid, payment_date: localDateStr() })
      .eq('id', payingBill.id)
    setPaying(false)
    if (error) { setError(error.message); return }
    setPayingBill(null)
    fetchData()
  }

  const remaining = (b: Bill) => b.installment - b.paid_amount

  // Helper: get Mon–Sun week label for a date string
  const getWeekKey = (dateStr: string) => {
    const d = new Date(dateStr)
    const day = d.getDay() === 0 ? 6 : d.getDay() - 1 // Mon=0
    const mon = new Date(d); mon.setDate(d.getDate() - day)
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    return `${mon.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} – ${sun.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`
  }

  // Group by week (Cicilan tab) or due_date month (Jatuh Tempo tab)
  const grouped = filtered.reduce<Record<string, Bill[]>>((acc, b) => {
    let key: string
    if (billsTab === 'jatuh_tempo') {
      key = b.due_date
        ? new Date(b.due_date).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
        : 'Tanpa Jatuh Tempo'
    } else {
      key = b.installment_due_date ? getWeekKey(b.installment_due_date) : 'Tanpa Tanggal'
    }
    if (!acc[key]) acc[key] = []
    acc[key].push(b)
    return acc
  }, {})

  // Group by week (Mon–Sun) for weekly summary

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Tagihan Dagang</h2>
            <p className="text-xs text-gray-500 mt-0.5">Tagihan dari pengadaan berjangka.</p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => { setShowPaidModal(true); setPaidPage(1) }} className="bg-white border-2 border-[#121358] rounded-xl shadow-sm p-3 text-left hover:bg-gray-50 transition w-full">
            <p className="text-xs font-semibold text-[#121358]">Riwayat</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <FontAwesomeIcon icon={faReceipt} className="w-3.5 h-3.5 text-[#121358]" />
              <p className="text-sm font-bold text-[#121358]">Lihat Riwayat</p>
            </div>
          </button>
          <div className="relative">
            <button onClick={() => setShowCalendarMenu(v => !v)} className="w-full h-full bg-white border-2 border-[#121358] rounded-xl shadow-sm p-3 text-left hover:bg-gray-50 transition">
              <p className="text-xs font-semibold text-[#121358]">Jadwal Bayar</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <FontAwesomeIcon icon={faCalendarDays} className="w-3.5 h-3.5 text-[#121358]" />
                <p className="text-sm font-bold text-[#121358]">Lihat Jadwal</p>
              </div>
            </button>
            {showCalendarMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowCalendarMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-40 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden w-36">
                  <button onClick={() => { setShowCalendarMenu(false); setShowCalendar(true) }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition">Mingguan</button>
                  <button onClick={() => { setShowCalendarMenu(false); setShowMonthCalendar(true) }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition border-t border-gray-100">Bulanan</button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Cards: Seluruhnya / Dibayarkan / Sisa */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-[#121358] px-3 py-2.5">
            <p className="text-[10px]" style={{ color: '#B5BAFF' }}>Seluruhnya</p>
            <p className="text-xs font-semibold text-white mt-0.5">Rp {fmt(totalAll)}</p>
          </div>
          <div className="rounded-xl bg-[#121358] px-3 py-2.5">
            <p className="text-[10px]" style={{ color: '#B5BAFF' }}>Dibayarkan</p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: '#D9F9DF' }}>Rp {fmt(totalPaidAll)}</p>
          </div>
          <div className="rounded-xl bg-[#121358] px-3 py-2.5">
            <p className="text-[10px]" style={{ color: '#B5BAFF' }}>Sisa</p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: '#FCB7C7' }}>Rp {fmt(totalSisa)}</p>
          </div>
        </div>

        {/* Filter card */}
        <div className="rounded-2xl shadow-sm p-4 space-y-3 bg-white border-2 border-[#121358]">
          <p className="text-xs font-semibold text-[#121358]">Apply Filter:</p>

          {/* Status tabs */}
          <div className="bg-gray-100 rounded-xl p-1 flex gap-1">
            {(['unpaid', 'paid', 'all'] as FilterStatus[]).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`flex-1 text-center text-sm font-medium py-2 rounded-xl transition-colors ${filter === f ? 'bg-slate-800 text-white' : 'bg-slate-200 sm:bg-transparent text-slate-500 sm:hover:bg-slate-200'}`}>
                {f === 'unpaid' ? 'Belum Lunas' : f === 'paid' ? 'Lunas' : 'Semua'}
              </button>
            ))}
          </div>

          {/* Month filter */}
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setMonthFilter('')}
              className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition ${!monthFilter ? 'bg-[#121358] text-white' : 'bg-gray-100 text-gray-500'}`}>
              {now.getFullYear()}
            </button>
            {months.map(m => (
              <button key={m} onClick={() => setMonthFilter(m)}
                className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition ${monthFilter === m ? 'bg-[#121358] text-white' : 'bg-gray-100 text-gray-500'}`}>
                {monthLabel(m)}
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
        </div>

        {/* Card 2: Tagihan Bulanan/Tahunan */}
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#8FB3E2' }}>
          <div className="px-4 pt-2.5 pb-1 text-center">
            <p className="text-xs font-semibold text-[#121358]">{monthFilter ? `Sisa Tagihan JT: Bulan ${new Date(monthFilter + '-01').toLocaleDateString('id-ID', { month: 'long' })}` : 'Sisa Tagihan Tahunan'}</p>
            <p className="text-sm font-bold text-[#121358] mt-0.5">Rp {fmt(monthSisaTagihan)}</p>
          </div>
          <div className="px-4 pb-2.5 pt-1 grid grid-cols-2 gap-2 border-t border-[#121358]/10 mt-1">
            <div>
              <p className="text-[10px] text-[#1a2a5e]">{monthFilter ? `Total Tagihan JT: Bulan ${new Date(monthFilter + '-01').toLocaleDateString('id-ID', { month: 'long' })}` : 'Total Tagihan Tahunan'}</p>
              <p className="text-xs font-semibold text-[#121358] mt-0.5">Rp {fmt(monthTotalTagihanJT)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-[#1a2a5e]">{monthFilter ? `Total Terbayar JT: Bulan ${new Date(monthFilter + '-01').toLocaleDateString('id-ID', { month: 'long' })}` : 'Total Terbayar Tahunan'}</p>
              <p className="text-xs font-semibold text-[#121358] mt-0.5">Rp {fmt(monthTotalTerbayarJT)}</p>
            </div>
          </div>
          <div className="px-4 pb-2.5 border-t border-[#121358]/10" style={{ backgroundColor: '#F5C842' }}>
            <p className="text-[10px] text-[#1a2a5e] mt-1.5">
              Total <strong>rekomendasi</strong> pembayaran{monthFilter ? ` Bulan ${new Date(monthFilter + '-01').toLocaleDateString('id-ID', { month: 'long' })}` : ''} agar tidak ada tagihan overdue: <span className="font-semibold text-[#121358]">Rp {fmt(monthTotalTagihan)}</span> (lihat tab cicilan)
            </p>
            <p className="text-[10px] text-[#1a2a5e] mt-0.5">
              Sudah terbayarkan <span className="font-semibold text-[#121358]">{monthTotalTagihan > 0 ? (monthTotalTerbayar / monthTotalTagihan * 100).toFixed(1) : '0.0'}%</span> · <span className="font-semibold text-[#121358]">Rp {fmt(monthTotalTerbayar)}</span> | <span className="font-semibold" style={{ color: '#B22222' }}>sisa: Rp {fmt(monthTotalTagihan - monthTotalTerbayar)}</span>
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm p-1 flex gap-1">
          {(['jatuh_tempo', 'cicilan'] as const).map(t => (
            <button key={t} onClick={() => setBillsTab(t)}
              className={`flex-1 text-center text-sm font-medium py-2 rounded-xl transition-colors ${billsTab === t ? 'bg-slate-800 text-white' : 'bg-slate-200 sm:bg-transparent text-slate-500 sm:hover:bg-slate-200'}`}>
              {t === 'cicilan' ? 'Cicilan' : 'Kumpulan Nota'}
            </button>
          ))}
        </div>

        {/* Kumpulan Nota info */}
        {billsTab === 'jatuh_tempo' && (
          <p className="text-xs text-gray-500 px-1">
            {monthFilter
              ? `Berikut adalah kumpulan nota dengan jatuh tempo bulan : ${new Date(monthFilter + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`
              : `Berikut adalah kumpulan nota dengan jatuh tempo di tahun : ${now.getFullYear()}`}
          </p>
        )}

        {/* Jatuh Tempo tab */}
        {billsTab === 'jatuh_tempo' && (
          fetchingPurchasing ? (
            <div className="text-center text-sm text-gray-400 py-10">Memuat...</div>
          ) : (() => {
            const filteredPurchasing = purchasing.filter(p => {
              if (!p.due_date) return false
              if (monthFilter && p.due_date.slice(0, 7) !== monthFilter) return false
              if (supplierFilter && p.suppliers?.name !== supplierFilter) return false
              return true
            })
            const groupedPurchasing = filteredPurchasing.reduce<Record<string, PurchasingRow[]>>((acc, p) => {
              const key = new Date(p.due_date!).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
              if (!acc[key]) acc[key] = []
              acc[key].push(p)
              return acc
            }, {})
            return filteredPurchasing.length === 0 ? (
              <div className="text-center text-sm text-gray-400 py-10">Tidak ada data.</div>
            ) : Object.entries(groupedPurchasing).map(([month, items]) => (
              <div key={month} className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-1">{month}</p>
                {items.map(p => {
                  const pBills = bills.filter(b => b.purchasing_id === p.id)
                  const unpaidBills = pBills.filter(b => !b.is_paid)
                  const allPaid = pBills.length > 0 && unpaidBills.length === 0
                  return (
                  <div key={p.id} onClick={() => openPurchasingDetail(p)} className={`bg-white rounded-xl shadow-sm p-4 border-l-4 cursor-pointer hover:shadow-md transition-shadow ${allPaid ? 'border-green-400' : 'border-[#9FA1FF]'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{p.suppliers?.name ?? '-'}</p>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{p.code}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Tanggal: {fmtDate(p.date)}</p>
                        {p.due_date && <p className="text-xs text-gray-500 mt-0.5">Jatuh tempo: {fmtDate(p.due_date)}</p>}
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                            p.status === 'completed' ? 'bg-green-100 text-green-600' :
                            p.status === 'created' ? 'bg-blue-100 text-blue-600' :
                            'bg-orange-100 text-orange-500'
                          }`}>{p.status}</span>
                          {pBills.length > 0 && (
                            allPaid ? (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-600">
                                Lunas
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
                                Belum Lunas · {unpaidBills.length} tagihan
                              </span>
                            )
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-[#121358]">Rp {fmt(p.total)}</p>
                        {(() => {
                          const paid = purchasingPaidMap[p.id] ?? 0
                          const sisa = Math.max(0, Math.round(p.total - paid))
                          const pct = p.total > 0 ? Math.min(100, Math.round(paid / p.total * 100)) : 0
                          return paid > 0 ? (
                            <div className="mt-1">
                              <p className="text-[10px] text-green-600">Terbayar: Rp {fmt(paid)} ({pct}%)</p>
                              <p className={`text-[10px] font-bold ${sisa === 0 ? 'text-green-600' : 'text-red-500'}`}>Sisa: Rp {fmt(sisa)}</p>
                            </div>
                          ) : null
                        })()}
                      </div>
                    </div>
                  </div>
                  )
                })}
              </div>
            ))
          })()
        )}

        {/* Cicilan tab — Bill list */}
        {billsTab === 'cicilan' && (fetching ? (
          <div className="text-center text-sm text-gray-400 py-10">Memuat...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-10">Tidak ada tagihan.</div>
        ) : (
          Object.entries(grouped).map(([month, monthBills]) => {
            const firstDate = monthBills[0]?.installment_due_date
            const isWeekOpen = expandedWeeks.has(month)
            const getMonday = (dateStr: string) => {
              const d = new Date(dateStr)
              const day = d.getDay() === 0 ? 6 : d.getDay() - 1
              d.setDate(d.getDate() - day)
              d.setHours(0, 0, 0, 0)
              return d
            }
            return (
            <div key={month} className="space-y-1">
              {/* Week header — clickable */}
              <div onClick={() => toggleWeek(month)}
                className="w-full flex items-center justify-between px-3 py-2 bg-white rounded-xl shadow-sm hover:bg-gray-50 transition cursor-pointer">
                <div className="flex items-center gap-2">
                  <FontAwesomeIcon icon={isWeekOpen ? faChevronUp : faChevronDown} className="w-3 h-3 text-gray-400" />
                  <p className="text-xs font-semibold text-gray-600">{month}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-400">{monthBills.length} tagihan · Rp {fmt(monthBills.reduce((s, b) => s + b.installment, 0))}</p>
                  {firstDate && (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setCalendarWeekStart(getMonday(firstDate)); setShowCalendar(true) }}
                    className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition" style={{ backgroundColor: '#8FB3E2', color: '#121358' }}
                  >
                    <FontAwesomeIcon icon={faEye} className="w-2.5 h-2.5" />
                    Kalender
                  </button>
                  )}
                </div>
              </div>

              {/* Bills — shown when week is expanded */}
              {isWeekOpen && <div className="space-y-1 pl-1">
              {monthBills.map(b => {
                const isOpen = expandedBill === b.id
                const items = purchasingItems[b.purchasing_id]
                return (
                <div key={b.id} className={`bg-white rounded-xl shadow-sm overflow-hidden border-l-4 ${b.is_paid ? 'border-green-400' : 'border-[#9FA1FF]'}`}>
                  {/* Bill header */}
                  <div className="p-4 flex items-start justify-between gap-3 cursor-pointer hover:bg-gray-50 transition" onClick={() => toggleBill(b)}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{b.suppliers?.name ?? '-'}</p>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">{b.bill_no ?? b.purchasing?.code}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {b.installment_due_date ? fmtDate(b.installment_due_date) : '-'} · Jatuh tempo: {fmtDate(b.due_date)}
                      </p>
                      {b.paid_amount > 0 && !b.is_paid && (
                        <p className="text-xs mt-0.5" style={{ color: '#9FA1FF' }}>
                          Terbayar: Rp {fmt(b.paid_amount)} · Sisa: Rp {fmt(remaining(b))}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0 flex items-start gap-2">
                      <div>
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
                              onClick={e => { e.stopPropagation(); openPay(b) }}
                              className="mt-1 flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-[#121358] text-white hover:bg-[#1a1c6e] transition"
                            >
                              <FontAwesomeIcon icon={faMoneyBillWave} className="w-3 h-3" />
                              Bayar
                            </button>
                          </>
                        )}
                      </div>
                      <FontAwesomeIcon icon={isOpen ? faChevronUp : faChevronDown} className="w-3 h-3 text-gray-400 mt-1 shrink-0" />
                    </div>
                  </div>

                  {/* Expanded: purchasing items */}
                  {isOpen && (
                    <div className="border-t border-gray-100 bg-gray-50 divide-y divide-gray-100">
                      {!items ? (
                        <p className="px-4 py-2 text-xs text-gray-400">Memuat...</p>
                      ) : items.length === 0 ? (
                        <p className="px-4 py-2 text-xs text-gray-400">Tidak ada item.</p>
                      ) : items.map(item => (
                        <div key={item.id} className="flex items-center justify-between px-4 py-2">
                          <div>
                            <p className="text-xs font-medium text-gray-700">{item.products?.name ?? '-'}</p>
                            <p className="text-xs text-gray-400">Qty: {item.qty}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-400">@ Rp {fmt(item.base_price)}</p>
                            <p className="text-xs font-semibold text-gray-700">Rp {fmt(item.qty * item.base_price)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                )
              })}
              </div>}
            </div>
            )
          })
        ))}
      </div>

      {/* Paid Bills Modal */}
      {showPaidModal && (() => {
        const paidBills = [...bills]
          .filter(b => b.paid_amount > 0)
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

        const totalPages = Math.ceil(paidBills.length / PAID_PAGE_SIZE)
        const paginated = paidBills.slice((paidPage - 1) * PAID_PAGE_SIZE, paidPage * PAID_PAGE_SIZE)

        // Group by day
        const grouped = paginated.reduce<Record<string, typeof paginated>>((acc, b) => {
          const day = b.updated_at.slice(0, 10)
          const label = (() => {
            const today = localDateStr()
            const yesterday = localDateStr(new Date(Date.now() - 86400000))
            if (day === today) return 'Hari Ini'
            if (day === yesterday) return 'Kemarin'
            return new Date(day).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
          })()
          if (!acc[label]) acc[label] = []
          acc[label].push(b)
          return acc
        }, {})

        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
              {/* Header */}
              <div className="px-5 py-4 flex items-center justify-between bg-[#121358] shrink-0">
                <div>
                  <p className="text-sm font-bold text-white">Riwayat Pembayaran</p>
                  <p className="text-xs text-white/60 mt-0.5">{paidBills.length} tagihan dibayar</p>
                </div>
                <button onClick={() => setShowPaidModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition">
                  <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* List */}
              <div className="overflow-y-auto flex-1 px-4 py-3 space-y-4">
                {Object.entries(grouped).map(([day, dayBills]) => (
                  <div key={day} className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{day}</p>
                      <p className="text-xs font-semibold text-gray-500">Rp {fmt(dayBills.reduce((s, b) => s + b.paid_amount, 0))}</p>
                    </div>
                    {dayBills.map(b => (
                      <div key={b.id} className={`bg-white border rounded-xl p-3 flex items-start justify-between gap-3 ${b.is_paid ? 'border-green-200' : 'border-amber-200'}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{b.suppliers?.name ?? '-'}</p>
                          <p className="text-xs text-gray-400 font-mono mt-0.5">{b.bill_no ?? '-'}</p>
                          {b.payment_date && <p className="text-xs text-gray-400 mt-0.5">Dibayar: {fmtDate(b.payment_date)}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-[#121358]">Rp {fmt(b.paid_amount)}</p>
                          <span className={`inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${b.is_paid ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                            {b.is_paid ? 'Lunas' : 'Sebagian'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 shrink-0">
                  <p className="text-xs text-gray-400">{(paidPage - 1) * PAID_PAGE_SIZE + 1}–{Math.min(paidPage * PAID_PAGE_SIZE, paidBills.length)} dari {paidBills.length}</p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPaidPage(p => Math.max(1, p - 1))} disabled={paidPage === 1}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-sm text-gray-500 disabled:opacity-30">‹</button>
                    <span className="text-xs text-gray-500 px-2">{paidPage}/{totalPages}</span>
                    <button onClick={() => setPaidPage(p => Math.min(totalPages, p + 1))} disabled={paidPage === totalPages}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-sm text-gray-500 disabled:opacity-30">›</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Monthly Calendar Modal */}
      {showMonthCalendar && (() => {
        const year = monthCalendarDate.getFullYear()
        const month = monthCalendarDate.getMonth()
        const firstDay = new Date(year, month, 1)
        const lastDay = new Date(year, month + 1, 0)
        // Start from Monday before the 1st
        const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1
        const startDate = new Date(firstDay); startDate.setDate(1 - startOffset)
        // Build 6 weeks × 7 days
        const cells = Array.from({ length: 42 }, (_, i) => {
          const d = new Date(startDate); d.setDate(startDate.getDate() + i); return d
        })
        const dayNames = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
        const todayStr = localDateStr()
        const prevMonth = () => setMonthCalendarDate(new Date(year, month - 1, 1))
        const nextMonth = () => setMonthCalendarDate(new Date(year, month + 1, 1))
        const monthLabel = firstDay.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden">

              {/* Header */}
              <div className="px-5 py-4 flex items-center justify-between bg-[#121358]">
                <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-bold">‹</button>
                <p className="text-sm font-semibold text-white capitalize">{monthLabel}</p>
                <div className="flex items-center gap-2">
                  <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-bold">›</button>
                  <button onClick={() => setShowMonthCalendar(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition">
                    <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Day name headers */}
              <div className="grid grid-cols-7 border-b border-gray-100">
                {dayNames.map(d => (
                  <div key={d} className="py-2 text-center text-[10px] font-semibold text-gray-400">{d}</div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 divide-x divide-gray-100 max-h-[55vh] overflow-y-auto">
                {cells.map((day, idx) => {
                  const dateStr = localDateStr(day)
                  const isCurrentMonth = day.getMonth() === month
                  const isToday = dateStr === todayStr
                  const dayBills = bills.filter(b => b.installment_due_date === dateStr)

                  return (
                    <div key={idx} className={`min-h-[72px] p-1 border-b border-gray-100 ${!isCurrentMonth ? 'bg-gray-50' : ''}`}>
                      <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold mb-1 ${
                        isToday ? 'bg-[#121358] text-white' : isCurrentMonth ? 'text-gray-700' : 'text-gray-300'
                      }`}>
                        {day.getDate()}
                      </div>
                      <div className="space-y-0.5">
                        {dayBills.length > 0 && (
                          <p className="text-[8px] font-bold text-[#121358] pb-0.5">
                            Rp {fmt(dayBills.reduce((s, b) => s + b.installment, 0))}
                          </p>
                        )}
                        {dayBills.map(b => (
                          <div key={b.id} className={`rounded px-1 py-0.5 text-[8px] font-semibold leading-tight truncate ${b.is_paid ? 'bg-green-100 text-green-700' : 'text-white'}`}
                            style={b.is_paid ? {} : { backgroundColor: '#9FA1FF' }}>
                            {b.suppliers?.name ?? '-'}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded" style={{ backgroundColor: '#9FA1FF' }}></span>
                  <span className="text-xs text-gray-500">Belum Lunas</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-green-100"></span>
                  <span className="text-xs text-gray-500">Lunas</span>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Weekly Calendar Modal */}
      {showCalendar && (() => {
        const days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(calendarWeekStart)
          d.setDate(d.getDate() + i)
          return d
        })
        const weekEnd = days[6]
        const prevWeek = () => setCalendarWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })
        const nextWeek = () => setCalendarWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })
        const dayNames = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
        const todayStr = localDateStr()

        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden">

              {/* Header */}
              <div className="px-5 py-4 flex items-center justify-between bg-[#121358]">
                <button onClick={prevWeek} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition text-sm font-bold">‹</button>
                <p className="text-sm font-semibold text-white">
                  {calendarWeekStart.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} – {weekEnd.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={nextWeek} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition text-sm font-bold">›</button>
                  <button onClick={() => setShowCalendar(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition">
                    <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Day rows */}
              <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
                {days.map((day, idx) => {
                  const dateStr = localDateStr(day)
                  const isToday = dateStr === todayStr
                  const dayBills = filtered.filter(b => b.installment_due_date === dateStr)

                  return (
                    <div key={dateStr} className={`flex items-start gap-3 px-4 py-3 ${isToday ? 'bg-[#121358]/5' : ''}`}>
                      {/* Day label */}
                      <div className={`shrink-0 w-12 text-center rounded-lg py-1.5 ${isToday ? 'bg-[#121358]' : 'bg-gray-100'}`}>
                        <p className={`text-[10px] font-semibold ${isToday ? 'text-white/70' : 'text-gray-400'}`}>{dayNames[idx]}</p>
                        <p className={`text-sm font-bold ${isToday ? 'text-white' : 'text-gray-700'}`}>{day.getDate()}</p>
                      </div>

                      {/* Bills */}
                      <div className="flex-1 py-1 min-h-[2rem]">
                        {dayBills.length === 0 ? (
                          <p className="text-xs text-gray-300">—</p>
                        ) : (
                          <>
                            <p className="text-xs font-bold text-[#121358] mb-1.5">
                              Total: Rp {fmt(dayBills.reduce((s, b) => s + b.installment, 0))}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {dayBills.map(b => {
                                const isJatuhTempo = b.due_date && b.installment_due_date && b.due_date === b.installment_due_date
                                return (
                                <div key={b.id} className={`rounded-lg px-2 py-1 text-xs font-semibold ${b.is_paid ? 'bg-green-100 text-green-700' : 'text-white'}`}
                                  style={b.is_paid ? {} : { backgroundColor: isJatuhTempo ? '#D92243' : '#9FA1FF' }}>
                                  <span>{b.suppliers?.name ?? '-'}</span>
                                  <span className="mx-1 opacity-60">·</span>
                                  <span>Rp {fmt(b.installment)}</span>
                                  {isJatuhTempo && b.purchasing?.total != null && (
                                    <span className="ml-1">| <span className="font-black">Rp {fmt(b.purchasing.total)}</span></span>
                                  )}
                                </div>
                                )
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded" style={{ backgroundColor: '#9FA1FF' }}></span>
                  <span className="text-xs text-gray-500">Belum Lunas</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-green-100"></span>
                  <span className="text-xs text-gray-500">Lunas</span>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Pay modal */}
      {payingBill && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between" style={{ backgroundColor: '#B5BAFF' }}>
              <div className="flex-1 text-center">
                <h3 className="text-base font-bold text-[#121358]">
                  Bayar Tagihan ke {payingBill.bill_no ? payingBill.bill_no.split('-').pop() : ''}
                </h3>
                <p className="text-xs text-[#121358]/70 mt-0.5">
                  {payingBill.suppliers?.name} · Jatuh tempo: {payingBill.due_date.split('-').reverse().join('/')}
                </p>
                {payingBill.purchasing?.date && (
                  <p className="text-xs text-[#121358]/70 mt-0.5">
                    Tanggal Nota: <span className="font-semibold text-[#121358]">{payingBill.purchasing.date.split('-').reverse().join('/')}</span>
                  </p>
                )}
                {payingBill.purchasing?.total != null && (
                  <p className="text-xs text-[#121358]/70 mt-0.5">
                    Total Purchasing: <span className="font-semibold text-[#121358]">Rp {fmt(payingBill.purchasing.total)}</span>
                  </p>
                )}
              </div>
              <button onClick={() => setPayingBill(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#121358]/10 hover:bg-[#121358]/20 text-[#121358] transition">
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

      {/* Kumpulan Nota Detail Popup */}
      {selectedPurchasing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[85vh]">

            {/* Header */}
            <div className="px-5 py-4 bg-[#121358] shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">{selectedPurchasing.suppliers?.name ?? '-'}</p>
                  <p className="text-xs font-mono text-white/60 mt-0.5">{selectedPurchasing.code}</p>
                  {selectedPurchasing.due_date && (
                    <p className="text-xs text-white/60 mt-0.5">JT: {fmtDate(selectedPurchasing.due_date)}</p>
                  )}
                  {selectedPurchasing.suppliers?.bank_detail && (() => {
                    const bd = selectedPurchasing.suppliers!.bank_detail!
                    const parts = [bd.bank, bd.no_rek, bd.rek_name].filter(Boolean)
                    return parts.length > 0 ? (
                      <p className="text-xs text-white/50 mt-0.5">{parts.join(' · ')}</p>
                    ) : null
                  })()}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-white">Rp {fmt(selectedPurchasing.total)}</p>
                  <button onClick={() => setSelectedPurchasing(null)} className="mt-1 w-6 h-6 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white ml-auto">
                    <FontAwesomeIcon icon={faXmark} className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Bills list */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {fetchingPBills ? (
                <p className="text-center text-sm text-gray-400 py-10">Memuat...</p>
              ) : purchasingBills.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-10">Tidak ada tagihan.</p>
              ) : (() => {
                const manualActive = showManualInput && parseFloat(manualAmount) > 0
                const distribution = manualActive ? computeDistribution(purchasingBills, parseFloat(manualAmount)) : null
                return purchasingBills.map(b => {
                  const d = distribution?.find(x => x.id === b.id)
                  const isManualFull = manualActive && !!d && d.willBePaid && !b.is_paid
                  const isManualPartial = manualActive && !!d && d.allocation > 0 && !d.willBePaid && !b.is_paid
                  const isChecked = selectedBillIds.has(b.id)
                  const owed = b.installment - b.paid_amount
                  return (
                    <div key={b.id}
                      onClick={() => !b.is_paid && !manualActive && toggleBillId(b.id)}
                      className={`flex items-center gap-3 px-5 py-3 transition
                        ${b.is_paid ? 'opacity-50' : (!manualActive ? 'cursor-pointer hover:bg-gray-50' : '')}
                        ${isManualFull ? 'bg-green-50' : isManualPartial ? 'bg-amber-50' : isChecked ? 'bg-blue-50' : ''}`}>
                      <input
                        type="checkbox"
                        checked={b.is_paid || isChecked || isManualFull}
                        disabled={b.is_paid || manualActive}
                        onChange={() => !b.is_paid && !manualActive && toggleBillId(b.id)}
                        onClick={e => e.stopPropagation()}
                        className="w-4 h-4 accent-[#121358] shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500">
                          {b.installment_due_date ? fmtDate(b.installment_due_date) : '-'}
                        </p>
                        {(b.is_paid || isManualFull) && (
                          <span className="text-[10px] font-semibold text-green-600">Lunas</span>
                        )}
                        {isManualPartial && (
                          <span className="text-[10px] font-semibold text-amber-600">
                            Bayar Rp {fmt(d!.allocation)} · Sisa Rp {fmt(owed - d!.allocation)}
                          </span>
                        )}
                      </div>
                      <p className={`text-sm font-semibold shrink-0 ${
                        b.is_paid || isManualFull ? 'text-green-600' :
                        isManualPartial ? 'text-amber-600' : 'text-[#121358]'
                      }`}>
                        Rp {fmt(owed > 0 ? owed : b.installment)}
                      </p>
                    </div>
                  )
                })
              })()}
            </div>

            {/* Footer buttons */}
            <div className="px-5 pt-4 border-t border-gray-100 shrink-0 space-y-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowManualInput(true); setManualAmount(''); setSelectedBillIds(new Set()) }}
                  className={`shrink-0 py-2.5 rounded-xl text-[#121358] text-sm font-semibold transition px-4 ${showManualInput ? 'bg-[#9FA1FF]' : 'bg-[#B5BAFF] hover:bg-[#9FA1FF]'}`}>
                  Input Manual
                </button>
                {showManualInput && (() => {
                  const maxManual = purchasingBills.filter(b => !b.is_paid).reduce((s, b) => s + (b.installment - b.paid_amount), 0)
                  const exceeded = parseFloat(manualAmount) > maxManual
                  return (
                    <div className="flex-1 space-y-1">
                      <input
                        type="number"
                        min="0"
                        max={maxManual}
                        value={manualAmount}
                        onChange={e => setManualAmount(e.target.value)}
                        placeholder={`Maks Rp ${fmt(maxManual)}`}
                        autoFocus
                        disabled={selectedBillIds.size > 0}
                        className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed ${exceeded ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-[#121358]'}`}
                      />
                      {exceeded && <p className="text-[10px] text-red-500">Melebihi sisa tagihan (maks Rp {fmt(maxManual)})</p>}
                    </div>
                  )
                })()}
              </div>
              <div className="flex gap-2 pb-4">
                <button onClick={() => setSelectedPurchasing(null)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition">
                  Batal
                </button>
                {showManualInput && parseFloat(manualAmount) > 0 && parseFloat(manualAmount) <= purchasingBills.filter(b => !b.is_paid).reduce((s, b) => s + (b.installment - b.paid_amount), 0) ? (
                  <button onClick={handleManualSave} disabled={markingLunas}
                    className="flex-1 py-2.5 rounded-xl bg-[#121358] hover:bg-[#1a1c6e] disabled:bg-[#121358]/40 text-white text-sm font-semibold transition">
                    {markingLunas ? 'Menyimpan...' : 'Bayar'}
                  </button>
                ) : (
                  <button
                    onClick={handleLunas}
                    disabled={markingLunas || selectedBillIds.size === 0}
                    className="flex-1 py-2.5 rounded-xl bg-[#121358] hover:bg-[#1a1c6e] disabled:bg-[#121358]/40 text-white text-sm font-semibold transition">
                    {markingLunas ? 'Menyimpan...' : `Lunas (${selectedBillIds.size})`}
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
