'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faXmark, faPen, faTrash, faCalendarDays, faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons'
import {
  BANK_ACCOUNT_OPTIONS,
  INSTALLMENT_TYPE_OPTIONS,
  type DebtLoanPeriod,
} from '@/lib/debtLoanOptions'

type Supplier = { id: number; name: string }

type DebtLoan = {
  id: number
  bank_account: string
  debt_type: string
  date: string
  debt_amount: number
  installment_type: string
  installment_amount: number
  due_date: string | null
  period: DebtLoanPeriod | null
  supplier_id: number | null
  suppliers: { name: string } | null
}

const fmt = (n: number) => n.toLocaleString('id-ID')
const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

const emptyForm = () => ({
  bank_account: BANK_ACCOUNT_OPTIONS[0] as string,
  date: new Date().toISOString().slice(0, 10),
  debt_amount: '',
  installment_type: 'monthly' as string,
  installment_amount: '',
  due_date: '',
  supplier_id: '' as number | '',
  supplier_query: '',
})

function calcPeriodFn(date: string, dueDate: string): DebtLoanPeriod | null {
  if (!date || !dueDate) return null
  const start = new Date(date)
  const end = new Date(dueDate)
  if (end <= start) return null
  const diffMs = end.getTime() - start.getTime()
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24))
  const weeks = Math.round(days / 7)
  const month = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  return { days, weeks, month }
}

async function generateDetails(supabase: ReturnType<typeof createClient>, debtLoanId: number, form: ReturnType<typeof emptyForm>, period: DebtLoanPeriod | null) {
  if (!period) return
  const count = form.installment_type === 'daily' ? period.days
    : form.installment_type === 'weekly' ? period.weeks
    : period.month
  const installmentAmount = parseFloat(form.installment_amount) || 0
  const startDate = new Date(form.date)
  const details = Array.from({ length: count }, (_, i) => {
    const due = new Date(startDate)
    if (form.installment_type === 'daily') due.setDate(due.getDate() + (i + 1))
    else if (form.installment_type === 'weekly') due.setDate(due.getDate() + (i + 1) * 7)
    else due.setMonth(due.getMonth() + (i + 1))
    return {
      debt_loan_id: debtLoanId,
      date: form.date,
      due_date: form.due_date || null,
      installment_amount: installmentAmount,
      installment_due_date: due.toISOString().slice(0, 10),
      is_paid: false,
    }
  })
  await supabase.from('debt_loan_detail').insert(details)
}

type CalDetail = { id: number; installment_due_date: string | null; due_date: string | null; installment_amount: number; debt_loan: { bank_account: string; debt_amount: number; suppliers: { name: string } | null } | null }

function CalChip({ d, fmt }: { d: CalDetail; fmt: (n: number) => string }) {
  const dl = d.debt_loan
  const name = dl?.suppliers?.name ?? dl?.bank_account ?? '-'
  const isJatuhTempo = d.due_date && d.installment_due_date && d.due_date === d.installment_due_date
  return (
    <div className="rounded-lg px-2 py-1 text-xs font-semibold text-white w-full"
      style={{ backgroundColor: isJatuhTempo ? '#D92243' : '#9FA1FF' }}>
      <span>{name} · Rp {fmt(d.installment_amount)}</span>
      {isJatuhTempo && dl?.debt_amount != null && (
        <span className="ml-1">| <span className="font-black">Rp {fmt(dl.debt_amount)}</span></span>
      )}
    </div>
  )
}

export default function TagihanGiroPage() {
  const supabase = createClient()
  const [list, setList] = useState<DebtLoan[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [supplierDropdown, setSupplierDropdown] = useState(false)
  const [fetching, setFetching] = useState(true)

  // Filters
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterSupplierFilter, setFilterSupplierFilter] = useState('')
  const [filterSupplierQuery, setFilterSupplierQuery] = useState('')
  const [filterSupplierDropdown, setFilterSupplierDropdown] = useState(false)

  // Calendar
  const [showCalendar, setShowCalendar] = useState(false)
  const [calWeekStart, setCalWeekStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1)); d.setHours(0,0,0,0); return d
  })
  const [calDetails, setCalDetails] = useState<CalDetail[]>([])

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState<DebtLoan | null>(null)
  const [editForm, setEditForm] = useState(emptyForm())
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [deleting, setDeleting] = useState<DebtLoan | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const fetchData = async () => {
    const { data } = await supabase.from('debt_loan').select('*, suppliers(name)').eq('debt_type', 'Giro').order('date', { ascending: false })
    setList((data as DebtLoan[]) ?? [])
    setFetching(false)
  }

  const fetchCalDetails = async () => {
    const { data } = await supabase
      .from('debt_loan_detail')
      .select('id, installment_due_date, due_date, installment_amount, debt_loan!inner(bank_account, debt_type, debt_amount, suppliers(name))')
      .eq('debt_loan.debt_type', 'Giro')
      .eq('is_paid', false)
    setCalDetails((data ?? []) as typeof calDetails)
  }

  useEffect(() => {
    fetchData()
    fetchCalDetails()
    supabase.from('suppliers').select('id, name').order('name')
      .then(({ data }: { data: Supplier[] | null }) => setSuppliers(data ?? []))
  }, [])

  const set = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }))
  const setEdit = (field: string, value: string) => setEditForm(prev => ({ ...prev, [field]: value }))

  const period = calcPeriodFn(form.date, form.due_date)
  const editPeriod = calcPeriodFn(editForm.date, editForm.due_date)

  const installmentLabel = (type: string) => INSTALLMENT_TYPE_OPTIONS.find(o => o.value === type)?.label ?? type

  const handleSave = async () => {
    if (!form.debt_amount) { setError('Masukkan jumlah tagihan.'); return }
    setSaving(true); setError(null)
    const { data: newRecord, error } = await supabase.from('debt_loan').insert({
      bank_account: form.bank_account, debt_type: 'Giro', date: form.date,
      debt_amount: parseFloat(form.debt_amount), installment_type: form.installment_type,
      installment_amount: parseFloat(form.installment_amount) || 0,
      due_date: form.due_date || null, period: period ?? null,
      supplier_id: form.supplier_id || null,
    }).select('id').single()
    if (error || !newRecord) { setError(error?.message ?? 'Gagal menyimpan.'); setSaving(false); return }
    await generateDetails(supabase, newRecord.id, form, period)
    setSaving(false); setShowForm(false); setForm(emptyForm()); fetchData()
  }

  const openEdit = (d: DebtLoan) => {
    setEditing(d); setEditError(null)
    setEditForm({ bank_account: d.bank_account, date: d.date, debt_amount: String(d.debt_amount), installment_type: d.installment_type, installment_amount: String(d.installment_amount), due_date: d.due_date ?? '', supplier_id: d.supplier_id ?? '', supplier_query: d.suppliers?.name ?? '' })
  }

  const handleEditSave = async () => {
    if (!editForm.debt_amount) { setEditError('Masukkan jumlah tagihan.'); return }
    setEditSaving(true); setEditError(null)
    const { error } = await supabase.from('debt_loan').update({
      bank_account: editForm.bank_account, date: editForm.date,
      debt_amount: parseFloat(editForm.debt_amount), installment_type: editForm.installment_type,
      installment_amount: parseFloat(editForm.installment_amount) || 0,
      due_date: editForm.due_date || null, period: editPeriod ?? null,
      supplier_id: editForm.supplier_id || null,
    }).eq('id', editing!.id)
    if (error) { setEditError(error.message); setEditSaving(false); return }
    await supabase.from('debt_loan_detail').delete().eq('debt_loan_id', editing!.id)
    await generateDetails(supabase, editing!.id, editForm, editPeriod)
    setEditSaving(false); setEditing(null); fetchData()
  }

  const handleDelete = async () => {
    if (!deleting) return
    setConfirmingDelete(true)
    await supabase.from('debt_loan').delete().eq('id', deleting.id)
    setConfirmingDelete(false); setDeleting(null); fetchData()
  }

  const calcAutoInstallment = (f: ReturnType<typeof emptyForm>, p: DebtLoanPeriod | null): string => {
    const amount = parseFloat(f.debt_amount)
    if (!p || !amount || amount <= 0) return ''
    const n = f.installment_type === 'daily' ? p.days : f.installment_type === 'weekly' ? p.weeks : p.month
    if (!n || n <= 0) return ''
    return String(Math.round((amount / n) * 100) / 100)
  }

  const formFields = (f: ReturnType<typeof emptyForm>, setF: (k: string, v: string) => void, p: DebtLoanPeriod | null, err: string | null) => {
    const autoInstallment = calcAutoInstallment(f, p)
    return (
    <div className="px-5 py-4 space-y-3 max-h-[65vh] overflow-y-auto">
      <div className="relative">
        <label className="block text-xs text-gray-500 mb-1">Supplier</label>
        <input type="text" value={f.supplier_query}
          onChange={e => { setF('supplier_query', e.target.value); setF('supplier_id', ''); setSupplierDropdown(true) }}
          onFocus={() => setSupplierDropdown(true)}
          onBlur={() => setTimeout(() => setSupplierDropdown(false), 150)}
          placeholder="Cari supplier..."
          autoComplete="off"
          className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358] ${f.supplier_id ? 'border-[#121358]/40 bg-[#121358]/5' : 'border-gray-300'}`}
        />
        {supplierDropdown && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
            <button type="button" onMouseDown={() => { setF('supplier_id', ''); setF('supplier_query', ''); setSupplierDropdown(false) }}
              className={`w-full text-left px-4 py-2.5 text-sm transition ${!f.supplier_id ? 'bg-[#121358] text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              Tanpa Supplier
            </button>
            {suppliers.filter(s => s.name.toLowerCase().includes(f.supplier_query.toLowerCase())).map(s => (
              <button key={s.id} type="button"
                onMouseDown={() => { setF('supplier_id', String(s.id)); setF('supplier_query', s.name); setSupplierDropdown(false) }}
                className={`w-full text-left px-4 py-2.5 text-sm transition ${f.supplier_id === s.id ? 'bg-[#121358] text-white' : 'text-gray-700 hover:bg-gray-50'}`}>
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Bank Account</label>
        <select value={f.bank_account} onChange={e => setF('bank_account', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]">
          {BANK_ACCOUNT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Tanggal Dibuat</label>
        <input type="date" value={f.date} onChange={e => setF('date', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Jatuh Tempo</label>
        <input type="date" value={f.due_date} min={f.date} onChange={e => { setF('due_date', e.target.value); setF('installment_amount', calcAutoInstallment({ ...f, due_date: e.target.value }, calcPeriodFn(f.date, e.target.value))) }}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
        {p && <p className="text-xs text-gray-400 mt-1">{p.days} hari · {p.weeks} minggu · {p.month} bulan</p>}
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Jumlah Tagihan <span className="text-red-500">*</span></label>
        <input type="number" value={f.debt_amount} onChange={e => { setF('debt_amount', e.target.value); setF('installment_amount', calcAutoInstallment({ ...f, debt_amount: e.target.value }, p)) }}
          placeholder="0" min="0"
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Tipe Cicilan</label>
          <select value={f.installment_type} onChange={e => { setF('installment_type', e.target.value); setF('installment_amount', calcAutoInstallment({ ...f, installment_type: e.target.value }, p)) }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]">
            {INSTALLMENT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Jumlah Cicilan</label>
          <input type="number" value={autoInstallment || f.installment_amount} disabled
            placeholder="Auto"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 text-gray-500 cursor-not-allowed" />
          {autoInstallment && <p className="text-[10px] text-gray-400 mt-0.5">= Rp {fmt(parseFloat(autoInstallment))}/cicilan</p>}
        </div>
      </div>
      {err && <p className="text-xs text-red-500">⚠️ {err}</p>}
    </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Giro</h2>
            <p className="text-xs text-gray-500 mt-0.5">Tagihan berbasis giro.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCalendar(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-white border border-gray-200 text-[#121358] hover:bg-gray-50 shadow-sm transition">
              <FontAwesomeIcon icon={faCalendarDays} className="w-3 h-3" />
              Lihat Kalender
            </button>
            <button onClick={() => { setShowForm(true); setError(null) }}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-[#121358] text-white hover:bg-[#1a1c6e] transition">
              <FontAwesomeIcon icon={faPlus} className="w-3 h-3" /> Tambah
            </button>
          </div>
        </div>

        {/* Filter card */}
        <div className="rounded-2xl shadow-sm p-4 space-y-3" style={{ backgroundColor: '#B5BAFF' }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-[#121358]">Filter Jatuh Tempo Cek:</p>
            <button
              onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); setFilterSupplierFilter(''); setFilterSupplierQuery('') }}
              className="text-2xl font-bold text-[#121358]/60 hover:text-[#121358] transition leading-none"
            >
              ↺
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-[#121358] mb-1">Dari</label>
              <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                style={{ fontSize: '11px' }}
                className="w-full bg-white border border-gray-200 rounded-lg px-1.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#121358]" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[#121358] mb-1">Sampai</label>
              <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                style={{ fontSize: '11px' }}
                className="w-full bg-white border border-gray-200 rounded-lg px-1.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#121358]" />
            </div>
          </div>
          <div className="relative">
            <input type="text" value={filterSupplierQuery}
              onChange={e => { setFilterSupplierQuery(e.target.value); setFilterSupplierFilter(''); setFilterSupplierDropdown(true) }}
              onFocus={() => setFilterSupplierDropdown(true)}
              onBlur={() => setTimeout(() => setFilterSupplierDropdown(false), 150)}
              placeholder="Filter supplier..."
              autoComplete="off"
              className={`w-full bg-white border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358] ${filterSupplierFilter ? 'border-[#121358]/40 bg-[#121358]/5' : 'border-gray-200'}`}
            />
            {filterSupplierDropdown && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                <button onMouseDown={() => { setFilterSupplierFilter(''); setFilterSupplierQuery(''); setFilterSupplierDropdown(false) }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition ${!filterSupplierFilter ? 'bg-[#121358] text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                  Semua Supplier
                </button>
                {suppliers.filter(s => s.name.toLowerCase().includes(filterSupplierQuery.toLowerCase())).map(s => (
                  <button key={s.id} onMouseDown={() => { setFilterSupplierFilter(s.name); setFilterSupplierQuery(s.name); setFilterSupplierDropdown(false) }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition ${filterSupplierFilter === s.name ? 'bg-[#121358] text-white' : 'text-gray-700 hover:bg-gray-50'}`}>
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        {(() => {
          const filteredList = list.filter(d => {
            if (filterDateFrom && (d.due_date ?? '') < filterDateFrom) return false
            if (filterDateTo && (d.due_date ?? '') > filterDateTo) return false
            if (filterSupplierFilter && d.suppliers?.name !== filterSupplierFilter) return false
            return true
          })
          const totalDebt = filteredList.reduce((s, d) => s + d.debt_amount, 0)
          return filteredList.length > 0 ? (
            <div className="bg-[#121358] rounded-xl px-4 py-3 space-y-1">
              {filterSupplierFilter && <p className="text-xs font-bold text-white">{filterSupplierFilter}</p>}
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold" style={{ color: '#B5BAFF' }}>Total Hutang Giro</p>
                <p className="text-sm font-bold" style={{ color: '#FCB7C7' }}>Rp {fmt(totalDebt)}</p>
              </div>
              <p className="text-[10px] text-white/50">{filteredList.length} giro</p>
            </div>
          ) : null
        })()}

        {fetching ? (
          <div className="text-center text-sm text-gray-400 py-10">Memuat...</div>
        ) : list.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-10">Belum ada data.</div>
        ) : (
          <div className="space-y-3">
            {list.filter(d => {
              if (filterDateFrom && (d.due_date ?? '') < filterDateFrom) return false
              if (filterDateTo && (d.due_date ?? '') > filterDateTo) return false
              if (filterSupplierFilter && d.suppliers?.name !== filterSupplierFilter) return false
              return true
            }).map(d => (
              <div key={d.id} className="relative bg-white rounded-xl shadow-sm p-4 border-l-4 border-[#9FA1FF]">
                <div className="flex items-start justify-between gap-3 pr-8">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-800">{d.bank_account}</p>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#9FA1FF]/20 text-[#121358]">Giro</span>
                    </div>
                    {d.suppliers?.name && <p className="text-xs text-gray-500 mt-0.5">{d.suppliers.name}</p>}
                    <p className="text-xs text-gray-500 mt-0.5">{fmtDate(d.date)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Cicilan: {installmentLabel(d.installment_type)} · Rp {fmt(d.installment_amount)}</p>
                    {d.due_date && <p className="text-xs text-gray-500 mt-0.5">Jatuh Tempo: {fmtDate(d.due_date)}</p>}
                    {d.period && <p className="text-xs text-gray-500 mt-0.5">{d.period.days} hari · {d.period.weeks} minggu · {d.period.month} bulan</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-[#121358]">Rp {fmt(d.debt_amount)}</p>
                  </div>
                </div>
                <button onClick={() => openEdit(d)}
                  className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full text-[#121358]/50 hover:bg-[#121358]/10 hover:text-[#121358] transition">
                  <FontAwesomeIcon icon={faPen} className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Weekly Calendar Modal */}
      {showCalendar && (() => {
        const days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(calWeekStart); d.setDate(d.getDate() + i); return d
        })
        const todayStr = new Date().toISOString().slice(0, 10)
        const dayNames = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
        const prevWeek = () => setCalWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })
        const nextWeek = () => setCalWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })
        const weekEnd = days[6]
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between bg-[#121358]">
                <button onClick={prevWeek} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition">
                  <FontAwesomeIcon icon={faChevronLeft} className="w-3 h-3" />
                </button>
                <p className="text-sm font-semibold text-white">
                  {calWeekStart.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} – {weekEnd.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={nextWeek} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition">
                    <FontAwesomeIcon icon={faChevronRight} className="w-3 h-3" />
                  </button>
                  <button onClick={() => setShowCalendar(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition">
                    <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
                {days.map((day, idx) => {
                  const dateStr = day.toISOString().slice(0, 10)
                  const isToday = dateStr === todayStr
                  const dayDetails = calDetails.filter(d => d.installment_due_date === dateStr)
                  const dayTotal = dayDetails.reduce((s, d) => s + d.installment_amount, 0)
                  return (
                    <div key={dateStr} className={`flex items-start gap-3 px-4 py-3 ${isToday ? 'bg-[#121358]/5' : ''}`}>
                      <div className={`shrink-0 w-12 text-center rounded-lg py-1.5 ${isToday ? 'bg-[#121358]' : 'bg-gray-100'}`}>
                        <p className={`text-[10px] font-semibold ${isToday ? 'text-white/70' : 'text-gray-400'}`}>{dayNames[idx]}</p>
                        <p className={`text-sm font-bold ${isToday ? 'text-white' : 'text-gray-700'}`}>{day.getDate()}</p>
                      </div>
                      <div className="flex-1 min-h-[2.5rem]">
                        {dayDetails.length === 0 ? (
                          <p className="text-xs text-gray-300 mt-1">—</p>
                        ) : (
                          <>
                            <p className="text-xs font-bold text-[#121358] mb-1">Rp {fmt(dayTotal)}</p>
                            <div className="flex flex-wrap gap-1">
                              {dayDetails.map(d => (
                                <CalChip key={d.id} d={d} fmt={fmt} />
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Add Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-800">Tambah Giro</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
              </button>
            </div>
            {formFields(form, set, period, error)}
            <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition">Batal</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-[#121358] hover:bg-[#1a1c6e] disabled:bg-[#121358]/40 text-white text-sm font-semibold transition">
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-800">Edit Giro</h3>
              <button onClick={() => setEditing(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
              </button>
            </div>
            {formFields(editForm, setEdit, editPeriod, editError)}
            {editPeriod && <p className="px-5 text-xs text-amber-600 pb-2">⚠️ Detail cicilan lama akan dihapus dan dibuat ulang.</p>}
            <div className="px-5 py-4 border-t border-gray-100 space-y-2">
              <div className="flex gap-2">
                <button onClick={() => setEditing(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition">Batal</button>
                <button onClick={handleEditSave} disabled={editSaving} className="flex-1 py-2.5 rounded-xl bg-[#121358] hover:bg-[#1a1c6e] disabled:bg-[#121358]/40 text-white text-sm font-semibold transition">
                  {editSaving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
              <button onClick={() => { setEditing(null); setDeleting(editing) }}
                className="w-full py-2.5 rounded-xl border border-red-200 text-sm font-medium text-red-500 hover:bg-red-50 transition flex items-center justify-center gap-2">
                <FontAwesomeIcon icon={faTrash} className="w-3 h-3" /> Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-800">Hapus Giro?</h3>
              <p className="text-xs text-gray-400 mt-1">Semua detail cicilan terkait juga akan dihapus permanen.</p>
            </div>
            <div className="flex gap-2 px-5 py-4">
              <button onClick={() => setDeleting(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition">Batal</button>
              <button onClick={handleDelete} disabled={confirmingDelete} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white text-sm font-semibold transition">
                {confirmingDelete ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
