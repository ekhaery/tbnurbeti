'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faTriangleExclamation, faCircleCheck, faChevronDown, faChevronUp, faXmark } from '@fortawesome/free-solid-svg-icons'

const fmt = (n: number) => n.toLocaleString('id-ID')
const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
const monthLabel = (m: string) => new Date(m + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

type GiroLoan = { id: number; bank_account: string; date: string; debt_amount: number; due_date: string | null; suppliers: { name: string } | null }
type GiroCicilanRaw = { id: number; debt_loan_id: number; installment_due_date: string | null; installment_amount: number; is_paid: boolean; due_date: string | null }

export default function TagihanGiroInsightPage() {
  const supabase = createClient()
  const [fetching, setFetching] = useState(true)
  const [loans, setLoans] = useState<GiroLoan[]>([])
  const [loanMap, setLoanMap] = useState<Record<number, GiroLoan>>({})
  const [paidMap, setPaidMap] = useState<Record<number, number>>({})
  const [cicilan, setCicilan] = useState<GiroCicilanRaw[]>([])
  const [overdueExpanded, setOverdueExpanded] = useState(false)
  const [confirmLunas, setConfirmLunas] = useState<GiroCicilanRaw | null>(null)
  const [savingLunas, setSavingLunas] = useState(false)

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`

  const fetchData = async () => {
    setFetching(true)
    const { data: loansData } = await supabase
      .from('debt_loan')
      .select('id, bank_account, date, debt_amount, due_date, suppliers(name)')
      .eq('debt_type', 'Giro')
      .order('date', { ascending: false })

    const lns = (loansData ?? []) as GiroLoan[]
    const ids = lns.map(l => l.id)
    const map: Record<number, GiroLoan> = {}
    for (const l of lns) map[l.id] = l
    setLoanMap(map)
    setLoans(lns)

    if (ids.length === 0) { setFetching(false); return }

    const [{ data: paidData }, { data: cicilanData }] = await Promise.all([
      supabase.from('debt_loan_detail').select('debt_loan_id, installment_amount').eq('is_paid', true).in('debt_loan_id', ids),
      supabase.from('debt_loan_detail').select('id, debt_loan_id, installment_due_date, installment_amount, is_paid, due_date').order('installment_due_date', { ascending: true }).in('debt_loan_id', ids),
    ])

    const pm: Record<number, number> = {}
    for (const p of (paidData ?? []) as { debt_loan_id: number; installment_amount: number }[]) {
      pm[p.debt_loan_id] = (pm[p.debt_loan_id] ?? 0) + p.installment_amount
    }
    setPaidMap(pm)
    setCicilan((cicilanData ?? []) as GiroCicilanRaw[])
    setFetching(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleLunas = async () => {
    if (!confirmLunas) return
    setSavingLunas(true)
    await supabase.from('debt_loan_detail').update({ is_paid: true }).eq('id', confirmLunas.id)
    setSavingLunas(false)
    setConfirmLunas(null)
    await fetchData()
  }

  const supplierName = (c: GiroCicilanRaw) =>
    loanMap[c.debt_loan_id]?.suppliers?.name ?? loanMap[c.debt_loan_id]?.bank_account ?? '-'

  const totalDebt = loans.reduce((s, l) => s + l.debt_amount, 0)
  const totalPaid = loans.reduce((s, l) => s + (paidMap[l.id] ?? 0), 0)
  const totalSisa = Math.max(0, totalDebt - totalPaid)
  const paidPct = totalDebt > 0 ? totalPaid / totalDebt * 100 : 0

  const unpaid = cicilan.filter(c => !c.is_paid)
  const overdueCicilan = unpaid.filter(c => c.installment_due_date && c.installment_due_date.slice(0, 7) < currentMonth)
  const thisMonthCicilan = unpaid.filter(c => c.installment_due_date?.slice(0, 7) === currentMonth)
  const nextMonthCicilan = unpaid.filter(c => c.installment_due_date?.slice(0, 7) === nextMonth)

  const overdueTotal = overdueCicilan.reduce((s, c) => s + c.installment_amount, 0)
  const thisMonthTotal = thisMonthCicilan.reduce((s, c) => s + c.installment_amount, 0)
  const nextMonthTotal = nextMonthCicilan.reduce((s, c) => s + c.installment_amount, 0)

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
            <h2 className="text-lg font-bold text-gray-800">Tagihan Giro Insight</h2>
            <p className="text-xs text-gray-500 mt-0.5">Situasi hutang giro {monthLabel(currentMonth)}</p>
          </div>
        </div>

        {/* Overdue alert */}
        {overdueTotal > 0 && (
          <div className="rounded-xl bg-red-50 border-2 border-red-300 overflow-hidden">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <FontAwesomeIcon icon={faTriangleExclamation} className="w-4 h-4 text-red-600" />
                <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Perlu tindakan segera</p>
              </div>
              <p className="text-sm text-red-800 mb-1">Ada cicilan yang sudah lewat jatuh tempo</p>
              <p className="text-2xl font-bold text-red-600">Rp {fmt(overdueTotal)}</p>
              <p className="text-xs text-red-600 mt-1.5">{overdueCicilan.length} cicilan belum dibayar</p>
            </div>
            <button
              onClick={() => setOverdueExpanded(v => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-red-100 text-xs font-semibold text-red-700 hover:bg-red-200 transition"
            >
              <span>{overdueExpanded ? 'Sembunyikan detail' : 'Lihat detail cicilan'}</span>
              <FontAwesomeIcon icon={overdueExpanded ? faChevronUp : faChevronDown} className="w-3 h-3" />
            </button>
            {overdueExpanded && (
              <div className="divide-y divide-red-200">
                {overdueCicilan.map(c => (
                  <div key={c.id} className="px-4 py-3 bg-white flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{supplierName(c)}</p>
                      {c.installment_due_date && <p className="text-xs text-gray-500 mt-0.5">Cicilan: {fmtDate(c.installment_due_date)}</p>}
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <p className="text-sm font-bold text-red-600">Rp {fmt(c.installment_amount)}</p>
                      <button onClick={() => setConfirmLunas(c)}
                        className="text-xs font-semibold px-3 py-1 rounded-lg text-white"
                        style={{ backgroundColor: '#800000' }}>
                        Lunas
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Main total card */}
        <div className="rounded-xl p-4" style={{ backgroundColor: '#3730A3' }}>
          <p className="text-xs mb-1" style={{ color: '#C7D2FE' }}>Sisa hutang giro keseluruhan</p>
          <p className="text-3xl font-bold text-white">Rp {fmt(totalSisa)}</p>
          <p className="text-xs mt-1" style={{ color: '#C7D2FE' }}>Total hutang asli: Rp {fmt(totalDebt)}</p>
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1.5" style={{ color: '#C7D2FE' }}>
              <span>Sudah dibayar {paidPct.toFixed(1)}%</span>
              <span>Rp {fmt(totalPaid)}</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
              <div className="h-full rounded-full bg-[#A5F3FC]" style={{ width: `${Math.min(100, paidPct)}%` }} />
            </div>
          </div>
        </div>

        {/* This month cicilan */}
        {thisMonthCicilan.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-1 mb-2">
              Yang harus dibayar bulan {new Date(currentMonth + '-01').toLocaleDateString('id-ID', { month: 'long' })}
            </p>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: '#EEF2FF' }}>
                <p className="text-xs font-semibold" style={{ color: '#3730A3' }}>{thisMonthCicilan.length} cicilan</p>
                <p className="text-sm font-bold" style={{ color: '#3730A3' }}>Rp {fmt(thisMonthTotal)}</p>
              </div>
              <div className="divide-y divide-gray-100">
                {thisMonthCicilan.map(c => {
                  const isPastDue = c.installment_due_date && c.installment_due_date < todayStr
                  return (
                    <div key={c.id} className={`px-4 py-3 flex items-center justify-between gap-3 ${isPastDue ? 'bg-red-50' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-semibold text-gray-800">{supplierName(c)}</p>
                          {isPastDue && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Sudah lewat!</span>
                          )}
                        </div>
                        {c.installment_due_date && <p className="text-xs text-gray-500 mt-0.5">{fmtDate(c.installment_due_date)}</p>}
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        <p className={`text-sm font-bold ${isPastDue ? 'text-red-600' : 'text-[#3730A3]'}`}>Rp {fmt(c.installment_amount)}</p>
                        <button onClick={() => setConfirmLunas(c)}
                          className="text-xs font-semibold px-3 py-1 rounded-lg text-white"
                          style={{ backgroundColor: '#3730A3' }}>
                          Lunas
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Next month preview */}
        {nextMonthTotal > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-1 mb-2">
              Bulan depan · {monthLabel(nextMonth)}
            </p>
            <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-[#9FA1FF]">
              <p className="text-xs text-gray-500 mb-1">Siapkan uang untuk bulan depan</p>
              <p className="text-xl font-bold" style={{ color: '#3730A3' }}>Rp {fmt(nextMonthTotal)}</p>
              <p className="text-xs text-gray-500 mt-1">Dari {nextMonthCicilan.length} cicilan</p>
            </div>
          </div>
        )}

        {/* Per-giro breakdown */}
        {loans.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-1 mb-2">
              Rincian per giro ({loans.length})
            </p>
            <div className="space-y-2">
              {loans.map(l => {
                const paid = paidMap[l.id] ?? 0
                const sisa = Math.max(0, Math.round(l.debt_amount - paid))
                const pct = l.debt_amount > 0 ? Math.min(100, paid / l.debt_amount * 100) : 0
                const isLunas = sisa === 0
                return (
                  <div key={l.id} className={`bg-white rounded-xl shadow-sm p-4 border-l-4 ${isLunas ? 'border-green-400' : 'border-[#9FA1FF]'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{l.suppliers?.name ?? l.bank_account}</p>
                        {l.suppliers?.name && <p className="text-xs text-gray-400 mt-0.5">{l.bank_account}</p>}
                        {l.due_date && <p className="text-xs text-gray-500 mt-0.5">Jatuh tempo: {fmtDate(l.due_date)}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-gray-400">Total: Rp {fmt(l.debt_amount)}</p>
                        {isLunas ? (
                          <span className="text-xs font-semibold text-green-600">Lunas</span>
                        ) : (
                          <p className="text-sm font-bold" style={{ color: '#3730A3' }}>Sisa: Rp {fmt(sisa)}</p>
                        )}
                      </div>
                    </div>
                    {!isLunas && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>Terbayar {pct.toFixed(1)}%</span>
                          <span>Rp {fmt(paid)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full bg-indigo-400" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Tips */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-1 mb-2">
            Tips pengelolaan
          </p>
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
            {totalSisa === 0 ? (
              <div className="flex gap-3 items-start">
                <FontAwesomeIcon icon={faCircleCheck} className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700">Semua hutang giro sudah lunas. Bagus!</p>
              </div>
            ) : (
              <>
                {overdueTotal > 0 && (
                  <div className="flex gap-3 items-start">
                    <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1.5" />
                    <p className="text-sm text-gray-700">
                      Ada <strong>Rp {fmt(overdueTotal)}</strong> cicilan dari bulan lalu yang belum dibayar. Prioritaskan ini segera.
                    </p>
                  </div>
                )}
                {thisMonthTotal > 0 && (
                  <div className="flex gap-3 items-start">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
                    <p className="text-sm text-gray-700">
                      Siapkan <strong>Rp {fmt(thisMonthTotal)}</strong> untuk cicilan giro bulan ini.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Link to full giro page */}
        <Link href="/tagihan-giro"
          className="w-full flex items-center justify-center py-3 rounded-xl border-2 text-sm font-semibold transition hover:opacity-80"
          style={{ borderColor: '#3730A3', color: '#3730A3' }}>
          Lihat Data Lengkap di Menu Giro
        </Link>

      </div>

      {/* Lunas confirm modal */}
      {confirmLunas && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ backgroundColor: '#3730A3' }}>
              <div>
                <p className="text-sm font-bold text-white">{supplierName(confirmLunas)}</p>
                {confirmLunas.installment_due_date && (
                  <p className="text-xs mt-0.5" style={{ color: '#C7D2FE' }}>{fmtDate(confirmLunas.installment_due_date)}</p>
                )}
              </div>
              <button onClick={() => setConfirmLunas(null)} className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition">
                <FontAwesomeIcon icon={faXmark} className="w-3 h-3" />
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-gray-600">Tandai cicilan ini sebagai lunas?</p>
              <p className="text-2xl font-bold mt-2" style={{ color: '#3730A3' }}>Rp {fmt(confirmLunas.installment_amount)}</p>
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setConfirmLunas(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition">
                Batal
              </button>
              <button onClick={handleLunas} disabled={savingLunas}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition disabled:opacity-40"
                style={{ backgroundColor: '#3730A3' }}>
                {savingLunas ? 'Menyimpan...' : 'Ya, Lunas'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
