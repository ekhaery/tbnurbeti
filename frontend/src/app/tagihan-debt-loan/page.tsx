'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faMoneyBillWave, faXmark, faPlus, faList } from '@fortawesome/free-solid-svg-icons'
import Link from 'next/link'
import {
  BANK_ACCOUNT_OPTIONS,
  DEBT_TYPE_OPTIONS,
  INSTALLMENT_TYPE_OPTIONS,
} from '@/lib/debtLoanOptions'
import { localDateStr } from '@/lib/date'

type DebtLoanDetail = {
  id: number
  code: string | null
  date: string
  due_date: string | null
  installment_amount: number
  installment_due_date: string | null
  is_paid: boolean
  payment_date: string | null
  debt_loan: { bank_account: string; debt_type: string } | null
}

type RekeningKoran = {
  id: number
  bank_account: string
  debt_amount: number
  installment_amount: number
  is_active: boolean
}

type FilterStatus = 'all' | 'unpaid' | 'paid'

const fmt = (n: number) => n.toLocaleString('id-ID')
const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

export default function TagihanDebtLoanPage() {
  const supabase = createClient()
  const [list, setList] = useState<DebtLoanDetail[]>([])
  const [rkList, setRkList] = useState<RekeningKoran[]>([])
  const [fetching, setFetching] = useState(true)
  const [filter, setFilter] = useState<FilterStatus>('unpaid')
  const [dateFilterMode, setDateFilterMode] = useState<'year' | 'range'>('year')
  const [yearFilter, setYearFilter] = useState<string>(new Date().getFullYear().toString())
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [bankFilter, setBankFilter] = useState('')
  const [bankQuery, setBankQuery] = useState('')
  const [bankDropdown, setBankDropdown] = useState(false)

  // Add debt modal
  const [showAddDebt, setShowAddDebt] = useState(false)
  const [addForm, setAddForm] = useState({ bank_account: BANK_ACCOUNT_OPTIONS[0] as string, debt_type: DEBT_TYPE_OPTIONS[0] as string, date: localDateStr(), debt_amount: '', installment_type: 'monthly' as string, installment_amount: '', due_date: '' })
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const handleAddDebt = async () => {
    if (!addForm.debt_amount) { setAddError('Masukkan jumlah hutang.'); return }
    setAddSaving(true); setAddError(null)
    const { error } = await supabase.from('debt_loan').insert({
      bank_account: addForm.bank_account, debt_type: addForm.debt_type, date: addForm.date,
      debt_amount: parseFloat(addForm.debt_amount), installment_type: addForm.installment_type,
      installment_amount: parseFloat(addForm.installment_amount) || 0,
      due_date: addForm.due_date || null,
    })
    setAddSaving(false)
    if (error) { setAddError(error.message); return }
    setShowAddDebt(false)
    setAddForm({ bank_account: BANK_ACCOUNT_OPTIONS[0] as string, debt_type: DEBT_TYPE_OPTIONS[0] as string, date: localDateStr(), debt_amount: '', installment_type: 'monthly' as string, installment_amount: '', due_date: '' })
    fetchData(); fetchRekeningKoran()
  }

  // Pay regular installment
  const [paying, setPaying] = useState<DebtLoanDetail | null>(null)
  const [saving, setSaving] = useState(false)

  // Pay Rekening Koran
  const [payingRk, setPayingRk] = useState<RekeningKoran | null>(null)
  const [rkPayAmount, setRkPayAmount] = useState('')
  const [rkSaving, setRkSaving] = useState(false)
  const [rkError, setRkError] = useState<string | null>(null)

  // Summary
  const [rekeningKoranTotal, setRekeningKoranTotal] = useState(0)
  const [rekeningKoranDebt, setRekeningKoranDebt] = useState(0)

  const fetchData = async () => {
    // Fetch debt_loan_detail (exclude Rekening Koran)
    const { data } = await supabase
      .from('debt_loan_detail')
      .select('id, code, date, due_date, installment_amount, installment_due_date, is_paid, payment_date, debt_loan(bank_account, debt_type)')
      .order('installment_due_date', { ascending: true })
    // Filter out Rekening Koran and Giro client-side
    const nonRk = (data ?? []).filter((d: DebtLoanDetail) => d.debt_loan?.debt_type !== 'Rekening Koran' && d.debt_loan?.debt_type !== 'Giro')
    setList(nonRk)
    setFetching(false)
  }

  const fetchRekeningKoran = async () => {
    // Active Rekening Koran records
    const { data: rkData } = await supabase
      .from('debt_loan')
      .select('id, bank_account, debt_amount, installment_amount, is_active')
      .eq('debt_type', 'Rekening Koran')
      .eq('is_active', true)
    setRkList((rkData as RekeningKoran[]) ?? [])

    // Paid RK details (for summary)
    const { data: rkPaidData } = await supabase
      .from('debt_loan_detail')
      .select('installment_amount, debt_loan!inner(debt_type)')
      .eq('debt_loan.debt_type', 'Rekening Koran')
      .eq('is_paid', true)
    const paidTotal = (rkPaidData ?? []).reduce((s: number, d: { installment_amount: number }) => s + d.installment_amount, 0)
    setRekeningKoranTotal(paidTotal)

    // Total debt_amount for Rekening Koran
    const { data: rkDebtData } = await supabase
      .from('debt_loan')
      .select('debt_amount')
      .eq('debt_type', 'Rekening Koran')
    const debtTotal = (rkDebtData ?? []).reduce((s: number, d: { debt_amount: number }) => s + d.debt_amount, 0)
    setRekeningKoranDebt(debtTotal)
  }

  useEffect(() => { fetchData() }, [])
  useEffect(() => { fetchRekeningKoran() }, [])

  const bankNames = Array.from(new Set(list.map(d => d.debt_loan?.bank_account ?? '').filter(Boolean))).sort()
  const years = Array.from(new Set(list.map(d => d.installment_due_date ? new Date(d.installment_due_date).getFullYear().toString() : '').filter(Boolean))).sort()

  const filtered = list.filter(d => {
    if (filter === 'paid' && !d.is_paid) return false
    if (filter === 'unpaid' && d.is_paid) return false
    if (bankFilter && d.debt_loan?.bank_account !== bankFilter) return false
    if (dateFilterMode === 'year' && yearFilter && d.installment_due_date && new Date(d.installment_due_date).getFullYear().toString() !== yearFilter) return false
    if (dateFilterMode === 'range') {
      if (dateFrom && d.installment_due_date && d.installment_due_date < dateFrom) return false
      if (dateTo && d.installment_due_date && d.installment_due_date > dateTo) return false
    }
    return true
  })

  // Group by month
  const grouped = filtered.reduce<Record<string, DebtLoanDetail[]>>((acc, d) => {
    const key = d.installment_due_date
      ? new Date(d.installment_due_date).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
      : 'Tanpa Tanggal'
    if (!acc[key]) acc[key] = []
    acc[key].push(d)
    return acc
  }, {})

  const totalUnpaid = list.filter(d => !d.is_paid).reduce((s, d) => s + d.installment_amount, 0)
  const totalPaid = list.filter(d => d.is_paid).reduce((s, d) => s + d.installment_amount, 0)

  // Pay regular installment
  const handlePay = async () => {
    if (!paying) return
    setSaving(true)
    const { error } = await supabase.from('debt_loan_detail')
      .update({ is_paid: true, payment_date: localDateStr() })
      .eq('id', paying.id)
    setSaving(false)
    if (error) return
    setPaying(null)
    fetchData()
  }

  // Pay Rekening Koran — creates new debt_loan_detail with is_paid=true
  const handleRkPay = async () => {
    if (!payingRk) return
    const amount = parseFloat(rkPayAmount)
    if (!amount || amount <= 0) { setRkError('Masukkan jumlah pembayaran.'); return }
    setRkSaving(true); setRkError(null)
    const today = localDateStr()
    const { error } = await supabase.from('debt_loan_detail').insert({
      debt_loan_id: payingRk.id,
      date: today,
      due_date: today,
      installment_amount: amount,
      installment_due_date: today,
      is_paid: true,
      payment_date: today,
    })
    setRkSaving(false)
    if (error) { setRkError(error.message); return }
    setPayingRk(null)
    setRkPayAmount('')
    fetchRekeningKoran()
  }

  // All months to display (from grouped + current month always shown for RK)
  const allMonths = Object.keys(grouped)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-xl mx-auto space-y-4">

        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Tagihan Debt & Loan</h2>
            <p className="text-xs text-gray-500 mt-0.5">Detail tagihan cicilan hutang.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/debt-loan"
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 shadow-sm transition">
              <FontAwesomeIcon icon={faList} className="w-3 h-3" />
              Lihat Daftar Hutang
            </Link>
            <button onClick={() => { setShowAddDebt(true); setAddError(null) }}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-[#121358] text-white hover:bg-[#1a1c6e] shadow-sm transition">
              <FontAwesomeIcon icon={faPlus} className="w-3 h-3" />
              Tambah
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#121358] rounded-xl shadow-sm p-3">
              <p className="text-xs font-semibold" style={{ color: '#B5BAFF' }}>Sudah Lunas</p>
              <p className="text-sm font-bold mt-0.5" style={{ color: '#D9F9DF' }}>Rp {fmt(totalPaid)}</p>
            </div>
            <div className="bg-[#121358] rounded-xl shadow-sm p-3">
              <p className="text-xs font-semibold leading-tight" style={{ color: '#B5BAFF' }}>Bunga Rek. Koran (terbayar)</p>
              <p className="text-sm font-bold mt-0.5" style={{ color: '#AEE2FF' }}>Rp {fmt(rekeningKoranTotal)}</p>
            </div>
          </div>
          <div className="bg-[#121358] rounded-xl shadow-sm p-3 space-y-2">
            <div>
              <p className="text-xs font-semibold" style={{ color: '#B5BAFF' }}>Belum Lunas</p>
              <p className="text-sm font-bold mt-0.5" style={{ color: '#FCB7C7' }}>Rp {fmt(totalUnpaid + rekeningKoranDebt)}</p>
            </div>
            <div className="pt-2 border-t border-white/10 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px]" style={{ color: '#B5BAFF' }}>Tagihan</p>
                <p className="text-xs font-semibold" style={{ color: '#FCB7C7' }}>{fmt(totalUnpaid)}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[10px]" style={{ color: '#B5BAFF' }}>Rek. Koran</p>
                <p className="text-xs font-semibold" style={{ color: '#FCB7C7' }}>{fmt(rekeningKoranDebt)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter card */}
        <div className="rounded-2xl shadow-sm p-4 space-y-3" style={{ backgroundColor: '#B5BAFF' }}>
          <p className="text-xs font-semibold text-[#121358]">Apply Filter:</p>

          {/* Bank filter */}
          <div className="relative">
            <input type="text" value={bankQuery}
              onChange={e => { setBankQuery(e.target.value); setBankFilter(''); setBankDropdown(true) }}
              onFocus={() => setBankDropdown(true)}
              onBlur={() => setTimeout(() => setBankDropdown(false), 150)}
              placeholder="Filter bank..."
              autoComplete="off"
              className={`w-full bg-gray-50 border rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#121358] ${bankFilter ? 'border-[#121358]/40 bg-[#121358]/5' : 'border-gray-200'}`}
            />
            {bankQuery && (
              <button onClick={() => { setBankQuery(''); setBankFilter('') }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <FontAwesomeIcon icon={faXmark} className="w-3 h-3" />
              </button>
            )}
            {bankDropdown && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                <button onMouseDown={() => { setBankFilter(''); setBankQuery(''); setBankDropdown(false) }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition ${!bankFilter ? 'bg-[#121358] text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                  Semua Bank
                </button>
                {bankNames.filter(n => n.toLowerCase().includes(bankQuery.toLowerCase())).map(name => (
                  <button key={name} onMouseDown={() => { setBankFilter(name); setBankQuery(name); setBankDropdown(false) }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition ${bankFilter === name ? 'bg-[#121358] text-white' : 'text-gray-700 hover:bg-gray-50'}`}>
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Date filter mode toggle */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button onClick={() => setDateFilterMode('year')}
              className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition ${dateFilterMode === 'year' ? 'bg-[#121358] text-white' : 'text-gray-500'}`}>
              Per Tahun
            </button>
            <button onClick={() => setDateFilterMode('range')}
              className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition ${dateFilterMode === 'range' ? 'bg-[#121358] text-white' : 'text-gray-500'}`}>
              Rentang Tanggal
            </button>
          </div>

          {dateFilterMode === 'year' ? (
            <div className="flex gap-2 overflow-x-auto pb-0.5">
              <button onClick={() => setYearFilter('')}
                className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition ${!yearFilter ? 'bg-[#121358] text-white' : 'bg-gray-100 text-gray-500'}`}>
                Semua Tahun
              </button>
              {years.map(y => (
                <button key={y} onClick={() => setYearFilter(y)}
                  className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition ${yearFilter === y ? 'bg-[#121358] text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {y}
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-[#121358] mb-1">Dari</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  style={{ fontSize: '11px' }}
                  className="w-full bg-white border border-gray-200 rounded-lg px-1.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#121358]" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[#121358] mb-1">Sampai</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  style={{ fontSize: '11px' }}
                  className="w-full bg-white border border-gray-200 rounded-lg px-1.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#121358]" />
              </div>
            </div>
          )}

        </div>

        {/* Status tabs */}
        <div className="bg-white rounded-2xl shadow-sm p-1 flex gap-1">
          {(['unpaid', 'paid', 'all'] as FilterStatus[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`flex-1 text-center text-sm font-medium py-2 rounded-xl transition-colors ${filter === f ? 'bg-slate-800 text-white' : 'bg-slate-200 sm:bg-transparent text-slate-500 sm:hover:bg-slate-200'}`}>
              {f === 'unpaid' ? 'Belum Lunas' : f === 'paid' ? 'Lunas' : 'Semua'}
            </button>
          ))}
        </div>

        {/* Total hutang tahunan */}
        {(() => {
          const installmentTotal = filtered.filter(d => !d.is_paid).reduce((s, d) => s + d.installment_amount, 0)
          const rkYearlyTotal = rkList.reduce((s, rk) => s + rk.installment_amount * 12, 0)
          return (
            <div className="rounded-xl px-4 py-2.5 bg-[#121358] space-y-1.5">
              <div className="flex items-center justify-between">
                {dateFilterMode === 'range' && (dateFrom || dateTo) ? (
                  <div style={{ color: '#B5BAFF' }}>
                    <p className="text-xs font-semibold">Total Dalam Rentang</p>
                    <p className="text-xs font-semibold sm:inline sm:ml-1">
                      {dateFrom ? dateFrom.split('-').reverse().join('/') : '...'} - {dateTo ? dateTo.split('-').reverse().join('/') : '...'}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs font-semibold" style={{ color: '#B5BAFF' }}>Total Hutang Tahunan</p>
                )}
                <p className="text-sm font-bold" style={{ color: '#FCB7C7' }}>Rp {fmt(installmentTotal + rkYearlyTotal)}</p>
              </div>
              <div className="border-t border-white/10 pt-1.5 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-[10px]" style={{ color: '#B5BAFF' }}>Cicilan</p>
                  <p className="text-[10px]" style={{ color: '#FCB7C7' }}>Rp {fmt(installmentTotal)}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[10px]" style={{ color: '#B5BAFF' }}>Rek. Koran (×12)</p>
                  <p className="text-[10px]" style={{ color: '#FCB7C7' }}>Rp {fmt(rkYearlyTotal)}</p>
                </div>
              </div>
            </div>
          )
        })()}

        {/* List grouped by month + RK per month */}
        {fetching ? (
          <div className="text-center text-sm text-gray-400 py-10">Memuat...</div>
        ) : (
          (() => {
            // Build month list: from installments + always include current month for RK
            const currentMonth = new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
            const monthSet = new Set([...allMonths, ...(filter !== 'paid' && rkList.length > 0 ? [currentMonth] : [])])
            const months = Array.from(monthSet)

            if (months.length === 0) return <div className="text-center text-sm text-gray-400 py-10">Tidak ada tagihan.</div>

            return months.map(month => (
              <div key={month} className="space-y-2">
                {/* Month header */}
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{month}</p>
                  {grouped[month] && (
                    <p className="text-xs font-semibold text-gray-500">
                      Rp {fmt(grouped[month].reduce((s, d) => s + d.installment_amount, 0))}
                      <span className="text-gray-300 mx-1">·</span>
                      <span className="text-green-600">{grouped[month].filter(d => d.is_paid).length} lunas</span>
                      <span className="text-gray-300 mx-1">·</span>
                      <span style={{ color: '#9FA1FF' }}>{grouped[month].filter(d => !d.is_paid).length} belum</span>
                    </p>
                  )}
                </div>

                {/* Installment cards */}
                {(grouped[month] ?? []).map(d => (
                  <div key={d.id} className={`bg-white rounded-xl shadow-sm p-4 border-l-4 ${d.is_paid ? 'border-green-400' : 'border-[#9FA1FF]'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-800">{d.debt_loan?.bank_account ?? '-'}</p>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#9FA1FF]/20 text-[#121358]">
                            {d.debt_loan?.debt_type ?? '-'}
                          </span>
                        </div>
                        {d.code && <p className="text-xs text-gray-400 font-mono mt-0.5">{d.code}</p>}
                        {d.installment_due_date && <p className="text-xs text-gray-400 mt-0.5">Cicilan: {fmtDate(d.installment_due_date)}</p>}
                        {d.due_date && <p className="text-xs text-gray-400 mt-0.5">Jatuh tempo: {fmtDate(d.due_date)}</p>}
                        {d.is_paid && d.payment_date && <p className="text-xs text-green-600 mt-0.5">Dibayar: {fmtDate(d.payment_date)}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-[#121358]">Rp {fmt(d.installment_amount)}</p>
                        {d.is_paid ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-600 mt-1">
                            <FontAwesomeIcon icon={faCheck} className="w-2.5 h-2.5" /> Lunas
                          </span>
                        ) : (
                          <button onClick={() => setPaying(d)}
                            className="mt-1 flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-[#121358] text-white hover:bg-[#1a1c6e] transition">
                            <FontAwesomeIcon icon={faMoneyBillWave} className="w-3 h-3" /> Bayar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Rekening Koran — shown in every month */}
                {filter !== 'paid' && rkList.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-1">Rekening Koran</p>
                    {rkList.map(rk => (
                      <div key={rk.id} className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-amber-400">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800">{rk.bank_account}</p>
                            <p className="text-xs text-gray-400 mt-0.5">Bunga per bulan: Rp {fmt(rk.installment_amount)}</p>
                          </div>
                          <button onClick={() => { setPayingRk(rk); setRkPayAmount(String(rk.installment_amount)); setRkError(null) }}
                            className="mt-1 flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-[#121358] text-white hover:bg-[#1a1c6e] transition">
                            <FontAwesomeIcon icon={faMoneyBillWave} className="w-3 h-3" /> Bayar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          })()
        )}
      </div>

      {/* Pay installment modal */}
      {paying && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-800">Konfirmasi Pembayaran</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {paying.debt_loan?.bank_account} · {paying.installment_due_date ? fmtDate(paying.installment_due_date) : '-'}
                </p>
              </div>
              <button onClick={() => setPaying(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="px-5 py-4 flex justify-between items-center">
              <span className="text-sm text-gray-500">Jumlah</span>
              <span className="text-base font-bold text-[#121358]">Rp {fmt(paying.installment_amount)}</span>
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setPaying(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition">Batal</button>
              <button onClick={handlePay} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-[#121358] hover:bg-[#1a1c6e] disabled:bg-[#121358]/40 text-white text-sm font-semibold transition">
                {saving ? 'Menyimpan...' : 'Konfirmasi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Rekening Koran modal */}
      {payingRk && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between" style={{ backgroundColor: '#B5BAFF' }}>
              <div>
                <h3 className="text-sm font-bold text-[#121358]">Bayar Rekening Koran</h3>
                <p className="text-xs text-[#121358]/70 mt-0.5">{payingRk.bank_account}</p>
              </div>
              <button onClick={() => setPayingRk(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#121358]/10 hover:bg-[#121358]/20 text-[#121358] transition">
                <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Jumlah Bayar</label>
                <input type="number" value={rkPayAmount} onChange={e => setRkPayAmount(e.target.value)}
                  placeholder="0" min="0"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
              </div>
              {rkError && <p className="text-xs text-red-500">⚠️ {rkError}</p>}
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setPayingRk(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition">Batal</button>
              <button onClick={handleRkPay} disabled={rkSaving} className="flex-1 py-2.5 rounded-xl bg-[#121358] hover:bg-[#1a1c6e] disabled:bg-[#121358]/40 text-white text-sm font-semibold transition">
                {rkSaving ? 'Menyimpan...' : 'Konfirmasi'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Add Debt Modal */}
      {showAddDebt && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-800">Tambah Debt & Loan</h3>
              <button onClick={() => setShowAddDebt(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3 max-h-[65vh] overflow-y-auto">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Bank Account</label>
                <select value={addForm.bank_account} onChange={e => setAddForm(f => ({ ...f, bank_account: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]">
                  {BANK_ACCOUNT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tipe Hutang</label>
                <select value={addForm.debt_type} onChange={e => setAddForm(f => ({ ...f, debt_type: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]">
                  {DEBT_TYPE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tanggal</label>
                <input type="date" value={addForm.date} onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Jumlah Hutang <span className="text-red-500">*</span></label>
                <input type="number" value={addForm.debt_amount} onChange={e => setAddForm(f => ({ ...f, debt_amount: e.target.value }))}
                  placeholder="0" min="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Tipe Cicilan</label>
                  <select value={addForm.installment_type} onChange={e => setAddForm(f => ({ ...f, installment_type: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]">
                    {INSTALLMENT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Jumlah Cicilan</label>
                  <input type="number" value={addForm.installment_amount} onChange={e => setAddForm(f => ({ ...f, installment_amount: e.target.value }))}
                    placeholder="0" min="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tanggal Lunas</label>
                <input type="date" value={addForm.due_date} onChange={e => setAddForm(f => ({ ...f, due_date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
              </div>
              {addError && <p className="text-xs text-red-500">⚠️ {addError}</p>}
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setShowAddDebt(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition">Batal</button>
              <button onClick={handleAddDebt} disabled={addSaving} className="flex-1 py-2.5 rounded-xl bg-[#121358] hover:bg-[#1a1c6e] disabled:bg-[#121358]/40 text-white text-sm font-semibold transition">
                {addSaving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
