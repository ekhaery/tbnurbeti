'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTriangleExclamation, faCircleCheck, faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'

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

const fmt = (n: number) => n.toLocaleString('id-ID')
const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
const monthLabel = (m: string) => new Date(m + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

export default function BillsInsightPage() {
  const supabase = createClient()
  const [bills, setBills] = useState<Bill[]>([])
  const [fetching, setFetching] = useState(true)
  const [overdueExpanded, setOverdueExpanded] = useState(false)

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const in7Days = new Date(now); in7Days.setDate(in7Days.getDate() + 7)
  const in7DaysStr = `${in7Days.getFullYear()}-${String(in7Days.getMonth() + 1).padStart(2, '0')}-${String(in7Days.getDate()).padStart(2, '0')}`
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`

  useEffect(() => {
    supabase
      .from('bills')
      .select('id, purchasing_id, due_date, installment_due_date, installment, paid_amount, is_paid, suppliers(name, bank_detail), purchasing(code, date, due_date)')
      .then(({ data }) => {
        setBills((data as Bill[]) ?? [])
        setFetching(false)
      })
  }, [])

  // Overdue: due_date from previous months, not fully paid
  const overdueBills = bills.filter(b => !b.is_paid && b.due_date.slice(0, 7) < currentMonth)
  const overdueAmount = overdueBills.reduce((s, b) => s + (b.installment - b.paid_amount), 0)

  // Group overdue by supplier → purchasing (distinct by purchasing_id)
  type OverduePurchasing = { purchasingId: number; code: string; date: string | null; dueDate: string | null; sisa: number }
  type OverdueSupplier = { name: string; bank: string | null; purchasings: OverduePurchasing[]; total: number }
  const overdueBySupplier: Record<string, OverdueSupplier> = {}
  const seenPurchasingIds: Record<string, Set<number>> = {}

  overdueBills.forEach(b => {
    const name = b.suppliers?.name ?? '-'
    if (!overdueBySupplier[name]) {
      const bd = b.suppliers?.bank_detail
      const parts = bd ? [bd.bank, bd.no_rek, bd.rek_name].filter(Boolean) : []
      overdueBySupplier[name] = { name, bank: parts.length > 0 ? parts.join(' · ') : null, purchasings: [], total: 0 }
      seenPurchasingIds[name] = new Set()
    }
    const sisa = b.installment - b.paid_amount
    overdueBySupplier[name].total += sisa
    if (!seenPurchasingIds[name].has(b.purchasing_id)) {
      seenPurchasingIds[name].add(b.purchasing_id)
      overdueBySupplier[name].purchasings.push({
        purchasingId: b.purchasing_id,
        code: b.purchasing?.code ?? '-',
        date: b.purchasing?.date ?? null,
        dueDate: b.purchasing?.due_date ?? null,
        sisa: 0,
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
  const supplierMap: Record<string, { sisa: number; dueDate: string; allPaid: boolean; pastDue: boolean; urgent: boolean }> = {}
  bills
    .filter(b => b.due_date.slice(0, 7) === currentMonth)
    .forEach(b => {
      const name = b.suppliers?.name ?? '-'
      if (!supplierMap[name]) {
        supplierMap[name] = { sisa: 0, dueDate: b.due_date, allPaid: true, pastDue: false, urgent: false }
      }
      const e = supplierMap[name]
      e.sisa += Math.max(0, b.installment - b.paid_amount)
      if (b.due_date < e.dueDate) e.dueDate = b.due_date
      if (!b.is_paid) {
        e.allPaid = false
        if (b.due_date < todayStr) e.pastDue = true
        else if (b.due_date <= in7DaysStr) e.urgent = true
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
        <div>
          <h2 className="text-lg font-bold text-gray-800">Tagihan Dagang Insight</h2>
          <p className="text-xs text-gray-500 mt-0.5">Situasi hutang {monthLabel(currentMonth)}</p>
        </div>

        {/* Overdue alert */}
        {overdueAmount > 0 && (
          <div className="rounded-xl bg-red-50 border-2 border-red-300 overflow-hidden">
            {/* Header row — always visible */}
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

            {/* Toggle button */}
            <button
              onClick={() => setOverdueExpanded(v => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-red-100 text-xs font-semibold text-red-700 hover:bg-red-200 transition"
            >
              <span>{overdueExpanded ? 'Sembunyikan detail' : 'Lihat detail per supplier'}</span>
              <FontAwesomeIcon icon={overdueExpanded ? faChevronUp : faChevronDown} className="w-3 h-3" />
            </button>

            {/* Expandable supplier list */}
            {overdueExpanded && (
              <div className="divide-y divide-red-200">
                {overdueSupplierList.map(sup => (
                  <div key={sup.name} className="px-4 py-3 bg-white">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{sup.name}</p>
                        {sup.bank && <p className="text-xs text-gray-400 mt-0.5">{sup.bank}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-red-600">Rp {fmt(sup.total)}</p>
                        <p className="text-[10px] text-gray-400">total sisa</p>
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
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.min(100, thisMonthPct)}%`, backgroundColor: '#F5C842' }}
              />
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
              {supplierList.map(([name, data]) => (
                <div key={name} className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Jatuh tempo: {fmtDate(data.dueDate)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-[#121358]">Rp {fmt(data.sisa)}</p>
                    <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      data.allPaid ? 'bg-green-100 text-green-700'
                        : data.pastDue ? 'bg-red-100 text-red-700'
                        : data.urgent ? 'bg-orange-100 text-orange-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {data.allPaid ? 'Sudah lunas' : data.pastDue ? 'Sudah lewat!' : data.urgent ? 'Bayar segera' : 'Belum lunas'}
                    </span>
                  </div>
                </div>
              ))}
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
    </div>
  )
}
