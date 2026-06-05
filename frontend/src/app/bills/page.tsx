'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMoneyBillWave, faCheck, faXmark, faCalendarDays, faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'

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
  const [weeklyExpanded, setWeeklyExpanded] = useState(false)
  const [billsTab, setBillsTab] = useState<'cicilan' | 'jatuh_tempo'>('cicilan')
  const [purchasing, setPurchasing] = useState<PurchasingRow[]>([])
  const [fetchingPurchasing, setFetchingPurchasing] = useState(false)
  const now = new Date()
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [monthFilter, setMonthFilter] = useState(defaultMonth)
  const [supplierFilter, setSupplierFilter] = useState('')
  const [supplierQuery, setSupplierQuery] = useState('')
  const [supplierDropdown, setSupplierDropdown] = useState(false)

  // Calendar
  const [showCalendar, setShowCalendar] = useState(false)
  const [calendarWeekStart, setCalendarWeekStart] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - d.getDay() + 1) // Monday
    d.setHours(0, 0, 0, 0)
    return d
  })

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

  // Group by month (Cicilan tab) or due_date month (Jatuh Tempo tab)
  const grouped = filtered.reduce<Record<string, Bill[]>>((acc, b) => {
    let key: string
    if (billsTab === 'jatuh_tempo') {
      key = b.due_date
        ? new Date(b.due_date).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
        : 'Tanpa Jatuh Tempo'
    } else {
      key = b.month
    }
    if (!acc[key]) acc[key] = []
    acc[key].push(b)
    return acc
  }, {})

  // Group by week (Mon–Sun) for weekly summary
  const weeklyTotalsMap = filtered.reduce<Record<string, { total: number; monday: Date }>>((acc, b) => {
    if (!b.installment_due_date) return acc
    const d = new Date(b.installment_due_date)
    const day = d.getDay() === 0 ? 6 : d.getDay() - 1 // Mon=0
    const mon = new Date(d); mon.setDate(d.getDate() - day); mon.setHours(0, 0, 0, 0)
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    const key = `${mon.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} – ${sun.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`
    if (!acc[key]) acc[key] = { total: 0, monday: mon }
    acc[key].total += b.installment
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Tagihan Dagang</h2>
            <p className="text-xs text-gray-500 mt-0.5">Tagihan dari pengadaan berjangka.</p>
          </div>
          <button onClick={() => setShowCalendar(true)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#121358] text-white hover:bg-[#1a1c6e] transition shadow-sm">
            <FontAwesomeIcon icon={faCalendarDays} className="w-4 h-4 text-white" />
          </button>
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
              className={`text-xs font-semibold px-2.5 py-1 rounded-full transition ${!monthFilter ? 'bg-[#121358] text-white' : 'bg-gray-100 text-gray-500'}`}>
              {now.getFullYear()}
            </button>
            {months.map(m => (
              <button key={m} onClick={() => setMonthFilter(m)}
                className={`text-xs font-semibold px-2.5 py-1 rounded-full transition ${monthFilter === m ? 'bg-[#121358] text-white' : 'bg-gray-100 text-gray-500'}`}>
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

        {/* Total bulanan — only when a month is selected */}
        {monthFilter && (
          <div className="space-y-2">
            <div className="rounded-xl px-4 py-2.5 flex items-center justify-between bg-[#121358]">
              <div>
                <p className="text-xs font-semibold" style={{ color: '#B5BAFF' }}>Total Tagihan Bulanan</p>
                <p className="text-[10px] mt-0.5 text-white">{filtered.length} tagihan</p>
              </div>
              <p className="text-sm font-bold" style={{ color: '#FCB7C7' }}>Rp {fmt(filtered.reduce((s, b) => s + b.installment, 0))}</p>
            </div>

            {/* Weekly breakdown */}
            <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#B5BAFF' }}>
              <button
                onClick={() => setWeeklyExpanded(v => !v)}
                className="w-full px-4 py-2.5 flex items-center justify-between"
              >
                <p className="text-xs font-semibold text-[#121358]">Total Tagihan Mingguan</p>
                <FontAwesomeIcon icon={weeklyExpanded ? faChevronUp : faChevronDown} className="w-3 h-3 text-[#121358]/50" />
              </button>
              {weeklyExpanded && (
                <div className="border-t border-[#121358]/10 divide-y divide-gray-300 bg-gray-200">
                  {Object.entries(weeklyTotalsMap).map(([week, { total, monday }]) => (
                    <button
                      key={week}
                      onClick={() => { setCalendarWeekStart(monday); setShowCalendar(true) }}
                      className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-200 transition text-left"
                    >
                      <p className="text-xs text-[#121358]/70">{week}</p>
                      <p className="text-xs font-semibold text-[#121358]">Rp {fmt(total)}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm p-1 flex gap-1">
          {(['cicilan', 'jatuh_tempo'] as const).map(t => (
            <button key={t} onClick={() => setBillsTab(t)}
              className={`flex-1 text-center text-sm font-medium py-2 rounded-xl transition-colors ${billsTab === t ? 'bg-slate-800 text-white' : 'bg-slate-200 sm:bg-transparent text-slate-500 sm:hover:bg-slate-200'}`}>
              {t === 'cicilan' ? 'Cicilan' : 'Jatuh Tempo'}
            </button>
          ))}
        </div>

        {/* Jatuh Tempo tab */}
        {billsTab === 'jatuh_tempo' && (
          fetchingPurchasing ? (
            <div className="text-center text-sm text-gray-400 py-10">Memuat...</div>
          ) : (() => {
            const filteredPurchasing = purchasing.filter(p => {
              if (!p.due_date) return false
              if (monthFilter && p.due_date.slice(0, 7) !== monthFilter) return false
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
                {items.map(p => (
                  <div key={p.id} className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-[#9FA1FF]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{p.suppliers?.name ?? '-'}</p>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{p.code}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Tanggal: {fmtDate(p.date)}</p>
                        {p.due_date && <p className="text-xs text-gray-500 mt-0.5">Jatuh tempo: {fmtDate(p.due_date)}</p>}
                        <span className={`inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                          p.status === 'completed' ? 'bg-green-100 text-green-600' :
                          p.status === 'created' ? 'bg-blue-100 text-blue-600' :
                          'bg-orange-100 text-orange-500'
                        }`}>{p.status}</span>
                      </div>
                      <p className="text-sm font-bold text-[#121358] shrink-0">Rp {fmt(p.total)}</p>
                    </div>
                  </div>
                ))}
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
          Object.entries(grouped).map(([month, monthBills]) => (
            <div key={month} className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-1">{month}</p>
              {monthBills.map(b => (
                <div key={b.id} className={`bg-white rounded-xl shadow-sm p-4 border-l-4 ${b.is_paid ? 'border-green-400' : 'border-[#9FA1FF]'}`}>
                  <div className="flex items-start justify-between gap-3">
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
        ))}
      </div>

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
                  const dayBills = bills.filter(b => b.installment_due_date === dateStr)

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
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-800">Bayar Tagihan</h3>
                <p className="text-xs text-gray-500 mt-0.5">{payingBill.suppliers?.name} · {payingBill.month}</p>
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
