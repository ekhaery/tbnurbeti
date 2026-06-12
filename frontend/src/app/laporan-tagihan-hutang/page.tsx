'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCalendarDays, faXmark, faChevronLeft, faChevronRight, faArrowUpAZ } from '@fortawesome/free-solid-svg-icons'

const fmt = (n: number) => n.toLocaleString('id-ID')
const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

const now = new Date()
const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
const defaultTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
const todayStr = now.toISOString().slice(0, 10)

type BillRow = { id: number; installment: number; paid_amount: number; is_paid: boolean; installment_due_date: string | null; due_date: string; suppliers: { name: string } | null }
type PurchasingRow = { id: number; total: number; date: string; due_date: string | null; suppliers: { name: string } | null }
type DetailRow = { id: number; installment_amount: number; is_paid: boolean; installment_due_date: string | null; due_date: string | null; debt_loan: { bank_account: string; debt_type: string; suppliers?: { name: string } | null } | null }

export default function LaporanTagihanHutangPage() {
  const supabase = createClient()
  const [dateFrom, setDateFrom] = useState(defaultFrom)
  const [dateTo, setDateTo] = useState(defaultTo)
  const [bills, setBills] = useState<BillRow[]>([])
  const [loanDetails, setLoanDetails] = useState<DetailRow[]>([])
  const [giroDetails, setGiroDetails] = useState<DetailRow[]>([])
  const [rkList, setRkList] = useState<{ id: number; installment_amount: number }[]>([])
  const [top5Purchasing, setTop5Purchasing] = useState<PurchasingRow[]>([])
  const [sortByDueDate, setSortByDueDate] = useState(false)
  const [rkPaid, setRkPaid] = useState(0)
  const [overdueBills, setOverdueBills] = useState<BillRow[]>([])
  const [overdueDetails, setOverdueDetails] = useState<DetailRow[]>([])
  const [fetching, setFetching] = useState(true)
  const [showCalendar, setShowCalendar] = useState(false)
  const [calMode, setCalMode] = useState<'weekly' | 'monthly'>('weekly')
  const [calWeekStart, setCalWeekStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1)); d.setHours(0,0,0,0); return d
  })
  const [calMonth, setCalMonth] = useState(new Date())
  const [showCalMenu, setShowCalMenu] = useState(false)

  const fetchAll = async () => {
    setFetching(true)
    try {
    const { data: billsData } = await supabase.from('bills')
      .select('id, installment, paid_amount, is_paid, installment_due_date, due_date, suppliers(name)')
      .gte('installment_due_date', dateFrom).lte('installment_due_date', dateTo)
    setBills((billsData ?? []) as BillRow[])

    const { data: loanData } = await supabase.from('debt_loan_detail')
      .select('id, installment_amount, is_paid, installment_due_date, due_date, debt_loan(bank_account, debt_type)')
      .gte('installment_due_date', dateFrom).lte('installment_due_date', dateTo)
    const allDetails = (loanData ?? []) as DetailRow[]
    setLoanDetails(allDetails.filter(d => d.debt_loan?.debt_type !== 'Giro' && d.debt_loan?.debt_type !== 'Rekening Koran'))
    setGiroDetails(allDetails.filter(d => d.debt_loan?.debt_type === 'Giro'))

    const { data: odBills } = await supabase.from('bills')
      .select('id, installment, paid_amount, is_paid, installment_due_date, due_date, suppliers(name)')
      .lt('due_date', todayStr).eq('is_paid', false)
    setOverdueBills((odBills ?? []) as BillRow[])

    const { data: odDetails } = await supabase.from('debt_loan_detail')
      .select('id, installment_amount, is_paid, installment_due_date, due_date, debt_loan(bank_account, debt_type, suppliers(name))')
      .lt('due_date', todayStr).eq('is_paid', false)
    setOverdueDetails((odDetails ?? []) as DetailRow[])

    // Rekening Koran (active, recurring monthly)
    const { data: rkData } = await supabase.from('debt_loan')
      .select('id, installment_amount').eq('debt_type', 'Rekening Koran').eq('is_active', true)
    setRkList((rkData ?? []) as { id: number; installment_amount: number }[])

    // Rekening Koran paid details in range (filter client-side)
    const { data: rkPaidData } = await supabase.from('debt_loan_detail')
      .select('installment_amount, debt_loan(debt_type)')
      .eq('is_paid', true)
      .gte('installment_due_date', dateFrom)
      .lte('installment_due_date', dateTo)
    const rkPaidTotal = (rkPaidData ?? [])
      .filter((d: { debt_loan: { debt_type: string } | null }) => d.debt_loan?.debt_type === 'Rekening Koran')
      .reduce((s: number, d: { installment_amount: number }) => s + d.installment_amount, 0)
    setRkPaid(rkPaidTotal)

    // Top 5 purchasing by total (filtered by due_date)
    const { data: purData } = await supabase.from('purchasing')
      .select('id, total, date, due_date, suppliers(name)')
      .gte('due_date', dateFrom).lte('due_date', dateTo)
      .order('total', { ascending: false }).limit(10)
    setTop5Purchasing((purData ?? []) as PurchasingRow[])
    } catch (e) { console.error('fetchAll error:', e) }
    setFetching(false)
  }

  useEffect(() => { fetchAll() }, [dateFrom, dateTo])

  const debtLoanBank = loanDetails.filter(d => !d.is_paid).reduce((s, d) => s + d.installment_amount, 0)
  const debtBills = bills.filter(b => !b.is_paid).reduce((s, b) => s + (b.installment - b.paid_amount), 0)
  const debtGiro = giroDetails.filter(d => !d.is_paid).reduce((s, d) => s + d.installment_amount, 0)
  const debtRK = rkList.reduce((s, r) => s + r.installment_amount, 0)
  const totalDebt = debtLoanBank + debtBills + debtGiro + debtRK
  const paidLoanBank = loanDetails.filter(d => d.is_paid).reduce((s, d) => s + d.installment_amount, 0)
  const paidBills = bills.filter(b => b.is_paid).reduce((s, b) => s + b.installment, 0)
  const paidGiro = giroDetails.filter(d => d.is_paid).reduce((s, d) => s + d.installment_amount, 0)
  const totalPaid = paidLoanBank + paidBills + paidGiro + rkPaid
  const top5Giro = [...giroDetails].sort((a, b) => b.installment_amount - a.installment_amount).slice(0, 5)

  const allCalEvents = [
    ...bills.map(b => ({ date: b.installment_due_date ?? '', label: b.suppliers?.name ?? '-', amount: b.installment, type: 'bills' })),
    ...giroDetails.map(d => ({ date: d.installment_due_date ?? '', label: (d.debt_loan as { bank_account: string } | null)?.bank_account ?? '-', amount: d.installment_amount, type: 'giro' })),
    ...loanDetails.map(d => ({ date: d.installment_due_date ?? '', label: (d.debt_loan as { bank_account: string } | null)?.bank_account ?? '-', amount: d.installment_amount, type: 'loan' })),
  ].filter(e => e.date)

  const typeColor = (type: string) => type === 'bills' ? '#9FA1FF' : type === 'giro' ? '#121358' : '#FCB7C7'

  const SR = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <div className="flex items-center justify-between py-1.5 border-b border-white/10 last:border-0">
      <p className="text-[10px]" style={{ color: '#B5BAFF' }}>{label}</p>
      <p className="text-xs font-semibold" style={{ color }}>Rp {fmt(value)}</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-xl mx-auto space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Laporan Tagihan Hutang</h2>
            <p className="text-xs text-gray-500 mt-0.5">Ringkasan semua kewajiban hutang.</p>
          </div>
          <div className="relative">
            <button onClick={() => setShowCalMenu(v => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-[#121358] text-white hover:bg-[#1a1c6e] transition">
              <FontAwesomeIcon icon={faCalendarDays} className="w-3 h-3" /> Kalender
            </button>
            {showCalMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowCalMenu(false)} />
                <div className="absolute right-0 top-9 z-40 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden w-36">
                  <button onMouseDown={() => { setCalMode('weekly'); setShowCalMenu(false); setShowCalendar(true) }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">Mingguan</button>
                  <button onMouseDown={() => { setCalMode('monthly'); setShowCalMenu(false); setShowCalendar(true) }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 border-t border-gray-100">Bulanan</button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="rounded-2xl shadow-sm p-4 space-y-3" style={{ backgroundColor: '#B5BAFF' }}>
          <p className="text-xs font-semibold text-[#121358]">Rentang Tanggal:</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-[#121358] mb-1">Dari</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ fontSize: '11px' }} className="w-full bg-white border border-gray-200 rounded-lg px-1.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#121358]" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[#121358] mb-1">Sampai</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ fontSize: '11px' }} className="w-full bg-white border border-gray-200 rounded-lg px-1.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#121358]" />
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-1">
          {[['Tagihan Dagang','#9FA1FF'],['Giro','#121358'],['Loan & Bank','#FCB7C7'],['Rekening Koran','#F5A623']].map(([l,c]) => (
            <div key={l} className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: c }}></span><span className="text-[10px] text-gray-500">{l}</span></div>
          ))}
        </div>

        {fetching ? <div className="text-center text-sm text-gray-400 py-10">Memuat...</div> : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {/* Total Hutang card */}
              <div className="bg-[#121358] rounded-xl p-3 space-y-1">
                <div className="pb-1.5 mb-1 border-b border-white/20">
                  <p className="text-xs font-bold text-white">Total Hutang</p>
                  <p className="text-sm font-black mt-0.5" style={{ color: '#FCB7C7' }}>Rp {fmt(totalDebt)}</p>
                </div>
                <SR label="Loan & Bank" value={debtLoanBank} color="#FCB7C7" />
                <SR label="Tagihan" value={debtBills} color="#FCB7C7" />
                <SR label="Giro" value={debtGiro} color="#FCB7C7" />
                <SR label="Rek. Koran" value={debtRK} color="#F5A623" />
              </div>
              {/* Total Terbayar card */}
              <div className="bg-[#121358] rounded-xl p-3 space-y-1">
                <div className="pb-1.5 mb-1 border-b border-white/20">
                  <p className="text-xs font-bold text-white">Total Terbayar</p>
                  <p className="text-sm font-black mt-0.5" style={{ color: '#D9F9DF' }}>Rp {fmt(totalPaid)}</p>
                </div>
                <SR label="Loan & Bank" value={paidLoanBank} color="#D9F9DF" />
                <SR label="Tagihan" value={paidBills} color="#D9F9DF" />
                <SR label="Giro" value={paidGiro} color="#D9F9DF" />
                <SR label="Rek. Koran" value={rkPaid} color="#F5A623" />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest px-1">Summary II</p>
              {top5Purchasing.length > 0 && (
                <div className="bg-[#121358] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold" style={{ color: '#B5BAFF' }}>Top 10 Tagihan Dagang</p>
                    <button onClick={() => setSortByDueDate(v => !v)}
                      className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded transition ${sortByDueDate ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'}`}>
                      <FontAwesomeIcon icon={faArrowUpAZ} className="w-3 h-3" />
                      JT ↑
                    </button>
                  </div>
                  <div className="space-y-0 max-h-64 overflow-y-auto">
                  {[...top5Purchasing].sort((a, b) => sortByDueDate
                    ? (a.due_date ?? '').localeCompare(b.due_date ?? '')
                    : b.total - a.total
                  ).map((p, i) => (
                    <div key={p.id} className="flex items-start justify-between py-1.5 gap-2 border-b border-white/10 last:border-0 rounded-lg px-1"
                      style={{ backgroundColor: i < 5 ? 'transparent' : 'rgba(255,255,255,0.06)' }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white">{p.suppliers?.name ?? '-'}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: '#B5BAFF' }}>{fmtDate(p.date)} | JT: {p.due_date ? fmtDate(p.due_date) : '-'}</p>
                      </div>
                      <p className="text-xs font-semibold shrink-0" style={{ color: '#FCB7C7' }}>Rp {fmt(p.total)}</p>
                    </div>
                  ))}
                  </div>
                </div>
              )}
              {top5Giro.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-4">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Top 5 Giro</p>
                  {top5Giro.map((d, i) => (
                    <div key={d.id} className="flex items-center justify-between py-1">
                      <p className="text-xs text-gray-600"><span className="font-bold text-gray-400 mr-1">{i+1}.</span>{(d.debt_loan as { bank_account: string } | null)?.bank_account ?? '-'}</p>
                      <p className="text-xs font-semibold text-[#121358]">Rp {fmt(d.installment_amount)}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="bg-white rounded-xl shadow-sm p-4">
                <p className="text-xs font-semibold text-red-600 mb-2">Overdue ({overdueBills.length + overdueDetails.length})</p>
                {overdueBills.length === 0 && overdueDetails.length === 0 ? (
                  <p className="text-xs text-gray-400">Tidak ada tagihan overdue.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {overdueBills.map(b => (
                      <div key={`b-${b.id}`} className="flex items-center justify-between">
                        <div><p className="text-xs text-gray-700">{b.suppliers?.name ?? '-'}</p><p className="text-[10px] text-red-400">Due: {fmtDate(b.due_date)}</p></div>
                        <p className="text-xs font-semibold text-red-500">Rp {fmt(b.installment - b.paid_amount)}</p>
                      </div>
                    ))}
                    {overdueDetails.map(d => (
                      <div key={`d-${d.id}`} className="flex items-center justify-between">
                        <div><p className="text-xs text-gray-700">{(d.debt_loan as { bank_account: string } | null)?.bank_account ?? '-'} <span className="text-[10px] text-gray-400">({(d.debt_loan as { debt_type: string } | null)?.debt_type})</span></p><p className="text-[10px] text-red-400">Due: {d.due_date ? fmtDate(d.due_date) : '-'}</p></div>
                        <p className="text-xs font-semibold text-red-500">Rp {fmt(d.installment_amount)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="hidden">{/* legend moved above */}
            </div>
          </>
        )}
      </div>

      {showCalendar && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 flex items-center justify-between bg-[#121358] shrink-0">
              <div className="flex items-center gap-2">
                <button onClick={() => { if (calMode==='weekly') setCalWeekStart(d => { const n=new Date(d); n.setDate(n.getDate()-7); return n }); else setCalMonth(d => new Date(d.getFullYear(), d.getMonth()-1, 1)) }} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white">
                  <FontAwesomeIcon icon={faChevronLeft} className="w-3 h-3" />
                </button>
                <p className="text-sm font-semibold text-white">
                  {calMode==='weekly' ? `${calWeekStart.toLocaleDateString('id-ID',{day:'numeric',month:'short'})} – ${new Date(calWeekStart.getTime()+6*86400000).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}` : calMonth.toLocaleDateString('id-ID',{month:'long',year:'numeric'})}
                </p>
                <button onClick={() => { if (calMode==='weekly') setCalWeekStart(d => { const n=new Date(d); n.setDate(n.getDate()+7); return n }); else setCalMonth(d => new Date(d.getFullYear(), d.getMonth()+1, 1)) }} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white">
                  <FontAwesomeIcon icon={faChevronRight} className="w-3 h-3" />
                </button>
              </div>
              <button onClick={() => setShowCalendar(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white">
                <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {calMode==='weekly' ? (
                <div className="divide-y divide-gray-100">
                  {Array.from({length:7},(_,i) => {
                    const d=new Date(calWeekStart); d.setDate(d.getDate()+i)
                    const ds=d.toISOString().slice(0,10)
                    const isToday=ds===todayStr
                    const evs=allCalEvents.filter(e=>e.date===ds)
                    const days=['Sen','Sel','Rab','Kam','Jum','Sab','Min']
                    return (
                      <div key={ds} className={`flex items-start gap-3 px-4 py-3 ${isToday?'bg-[#121358]/5':''}`}>
                        <div className={`shrink-0 w-12 text-center rounded-lg py-1.5 ${isToday?'bg-[#121358]':'bg-gray-100'}`}>
                          <p className={`text-[10px] font-semibold ${isToday?'text-white/70':'text-gray-400'}`}>{days[i]}</p>
                          <p className={`text-sm font-bold ${isToday?'text-white':'text-gray-700'}`}>{d.getDate()}</p>
                        </div>
                        <div className="flex-1 py-1 min-h-[2rem]">
                          {evs.length===0 ? <p className="text-xs text-gray-300">—</p> : (
                            <><p className="text-xs font-bold text-[#121358] mb-1">Rp {fmt(evs.reduce((s,e)=>s+e.amount,0))}</p>
                            <div className="flex flex-wrap gap-1">
                              {evs.map((e,idx) => <div key={idx} className="rounded-lg px-2 py-0.5 text-[10px] font-semibold text-white" style={{backgroundColor:typeColor(e.type)}}>{e.label} · Rp {fmt(e.amount)}</div>)}
                            </div></>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-7 border-b border-gray-100">
                    {['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(d => <div key={d} className="py-2 text-center text-[10px] font-semibold text-gray-400">{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7 divide-x divide-gray-100">
                    {(() => {
                      const yr=calMonth.getFullYear(), mo=calMonth.getMonth()
                      const first=new Date(yr,mo,1), off=first.getDay()===0?6:first.getDay()-1
                      const start=new Date(first); start.setDate(1-off)
                      return Array.from({length:42},(_,i) => {
                        const d=new Date(start); d.setDate(start.getDate()+i)
                        const ds=d.toISOString().slice(0,10)
                        const isToday=ds===todayStr, inMo=d.getMonth()===mo
                        const evs=allCalEvents.filter(e=>e.date===ds)
                        return (
                          <div key={i} className={`min-h-[60px] p-1 border-b border-gray-100 ${!inMo?'bg-gray-50':''}`}>
                            <div className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold mb-0.5 ${isToday?'bg-[#121358] text-white':inMo?'text-gray-700':'text-gray-300'}`}>{d.getDate()}</div>
                            {evs.slice(0,2).map((e,idx) => <div key={idx} className="rounded px-0.5 text-[8px] font-semibold text-white truncate mb-0.5" style={{backgroundColor:typeColor(e.type)}}>{e.label}</div>)}
                            {evs.length>2 && <p className="text-[8px] text-gray-400">+{evs.length-2}</p>}
                          </div>
                        )
                      })
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
