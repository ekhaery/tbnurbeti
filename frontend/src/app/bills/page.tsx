'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMoneyBillWave, faCheck, faXmark, faCalendarDays, faChevronDown, faChevronUp, faEye } from '@fortawesome/free-solid-svg-icons'

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
  purchasing: { code: string; total: number; date: string } | null
}

type FilterStatus = 'all' | 'unpaid' | 'paid'

type PurchasingRow = {
  id: number
  code: string
  date: string
  due_date: string | null
  total: number
  status: string
  suppliers: { name: string } | null
}

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
  const [expandedBill, setExpandedBill] = useState<number | null>(null)
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set())
  const toggleWeek = (week: string) => setExpandedWeeks(prev => {
    const next = new Set(prev)
    next.has(week) ? next.delete(week) : next.add(week)
    return next
  })
  const [purchasingItems, setPurchasingItems] = useState<Record<number, { id: number; qty: number; base_price: number; products: { name: string } | null }[]>>({})
  const [billsTab, setBillsTab] = useState<'cicilan' | 'jatuh_tempo'>('cicilan')
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

  const fetchData = async () => {
    const { data } = await supabase
      .from('bills')
      .select('id, bill_no, purchasing_id, due_date, installment_due_date, month, installment, paid_amount, is_paid, suppliers(name), purchasing(code, total, date)')
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
      .select('id, code, date, due_date, total, status, suppliers(name)')
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
          <div className="relative">
            <button onClick={() => setShowCalendarMenu(v => !v)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#121358] text-white hover:bg-[#1a1c6e] transition shadow-sm">
              <FontAwesomeIcon icon={faCalendarDays} className="w-4 h-4 text-white" />
            </button>
            {showCalendarMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowCalendarMenu(false)} />
                <div className="absolute right-0 top-10 z-40 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden w-36">
                  <button
                    onClick={() => { setShowCalendarMenu(false); setShowCalendar(true) }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition"
                  >
                    Mingguan
                  </button>
                  <button
                    onClick={() => { setShowCalendarMenu(false); setMonthCalendarDate(new Date()); setShowMonthCalendar(true) }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition border-t border-gray-100"
                  >
                    Bulanan
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#121358] rounded-xl shadow-sm p-3">
            <p className="text-xs font-semibold" style={{ color: '#B5BAFF' }}>Belum Lunas</p>
            <p className="text-base font-bold mt-0.5" style={{ color: '#FCB7C7' }}>Rp {fmt(totalUnpaid)}</p>
          </div>
          <div className="bg-[#121358] rounded-xl shadow-sm p-3">
            <p className="text-xs font-semibold" style={{ color: '#B5BAFF' }}>Sudah Lunas</p>
            <p className="text-base font-bold mt-0.5" style={{ color: '#D9F9DF' }}>Rp {fmt(totalPaid)}</p>
          </div>
        </div>

        {/* Filter card */}
        <div className="rounded-2xl shadow-sm p-4 space-y-3" style={{ backgroundColor: '#B5BAFF' }}>
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

        {/* Total tagihan summary */}
        {(() => {
          const supplierBills = supplierFilter ? bills.filter(b => b.suppliers?.name === supplierFilter) : bills
          const totalAll = supplierBills.reduce((s, b) => s + b.installment, 0)
          const totalPaidAll = supplierBills.reduce((s, b) => s + b.paid_amount, 0)
          const totalSisa = totalAll - totalPaidAll
          return (
            <div className="rounded-xl bg-[#121358] overflow-hidden">
              {/* Supplier name if filtered */}
              {supplierFilter && (
                <div className="px-4 pt-3 pb-1">
                  <p className="text-xs font-bold text-white">{supplierFilter}</p>
                </div>
              )}
              {/* Mobile layout */}
              <div className="px-4 py-2.5 space-y-2 sm:hidden">
                <div className="flex items-center justify-between">
                  <p className="text-[10px]" style={{ color: '#B5BAFF' }}>Total Tagihan Seluruhnya</p>
                  <p className="text-xs font-semibold text-white">Rp {fmt(totalAll)}</p>
                </div>
                <div className="flex items-center justify-between border-t border-white/10 pt-2">
                  <p className="text-[10px]" style={{ color: '#B5BAFF' }}>Dibayarkan</p>
                  <p className="text-xs font-semibold" style={{ color: '#D9F9DF' }}>Rp {fmt(totalPaidAll)}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[10px]" style={{ color: '#B5BAFF' }}>{monthFilter ? 'Total Tagihan Bulanan' : 'Total Tagihan Tahunan'} · {filtered.filter(b => !b.is_paid).length} tagihan</p>
                  <p className="text-xs font-semibold" style={{ color: '#FCB7C7' }}>Rp {fmt(filtered.filter(b => !b.is_paid).reduce((s, b) => s + (b.installment - b.paid_amount), 0))}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[10px]" style={{ color: '#B5BAFF' }}>Sisa</p>
                  <p className="text-xs font-semibold" style={{ color: '#FCB7C7' }}>Rp {fmt(totalSisa)}</p>
                </div>
              </div>

              {/* Desktop layout */}
              <div className="hidden sm:block">
                <div className="px-4 py-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold" style={{ color: '#B5BAFF' }}>{monthFilter ? 'Total Tagihan Bulanan' : 'Total Tagihan Tahunan'}</p>
                    <p className="text-[10px] mt-0.5 text-white">{filtered.length} tagihan</p>
                  </div>
                  <p className="text-sm font-bold" style={{ color: '#FCB7C7' }}>Rp {fmt(filtered.filter(b => !b.is_paid).reduce((s, b) => s + (b.installment - b.paid_amount), 0))}</p>
                </div>
                <div className="px-4 py-2.5 border-t border-white/10 grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[10px]" style={{ color: '#B5BAFF' }}>Seluruhnya</p>
                    <p className="text-xs font-semibold text-white mt-0.5">Rp {fmt(totalAll)}</p>
                  </div>
                  <div>
                    <p className="text-[10px]" style={{ color: '#B5BAFF' }}>Dibayarkan</p>
                    <p className="text-xs font-semibold mt-0.5" style={{ color: '#D9F9DF' }}>Rp {fmt(totalPaidAll)}</p>
                  </div>
                  <div>
                    <p className="text-[10px]" style={{ color: '#B5BAFF' }}>Sisa</p>
                    <p className="text-xs font-semibold mt-0.5" style={{ color: '#FCB7C7' }}>Rp {fmt(totalSisa)}</p>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm p-1 flex gap-1">
          {(['cicilan', 'jatuh_tempo'] as const).map(t => (
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
                  <div key={p.id} className={`bg-white rounded-xl shadow-sm p-4 border-l-4 ${allPaid ? 'border-green-400' : 'border-[#9FA1FF]'}`}>
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
                      <p className="text-sm font-bold text-[#121358] shrink-0">Rp {fmt(p.total)}</p>
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
                    className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition" style={{ backgroundColor: '#AEE2FF', color: '#121358' }}
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
        const todayStr = new Date().toISOString().slice(0, 10)
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
                  const dateStr = day.toISOString().slice(0, 10)
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
        const todayStr = new Date().toISOString().slice(0, 10)

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
                  const dateStr = day.toISOString().slice(0, 10)
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
                              {dayBills.map(b => (
                                <div key={b.id} className={`rounded-lg px-2 py-1 text-xs font-semibold ${b.is_paid ? 'bg-green-100 text-green-700' : 'text-white'}`}
                                  style={b.is_paid ? {} : { backgroundColor: '#9FA1FF' }}>
                                  <span>{b.suppliers?.name ?? '-'}</span>
                                  <span className="mx-1 opacity-60">·</span>
                                  <span>Rp {fmt(b.installment)}</span>
                                </div>
                              ))}
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
    </div>
  )
}
