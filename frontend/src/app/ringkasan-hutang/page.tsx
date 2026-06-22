'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faTriangleExclamation, faCircleCheck, faArrowRight } from '@fortawesome/free-solid-svg-icons'

const fmt = (n: number) => n.toLocaleString('id-ID')

export default function RingkasanHutangPage() {
  const supabase = createClient()
  const [fetching, setFetching] = useState(true)

  const [billsOverdueSisa, setBillsOverdueSisa] = useState(0)
  const [billsOverdueSupplierCount, setBillsOverdueSupplierCount] = useState(0)
  const [billsThisMonthSisa, setBillsThisMonthSisa] = useState(0)
  const [billsThisMonthTotal, setBillsThisMonthTotal] = useState(0)
  const [giroSisa, setGiroSisa] = useState(0)
  const [giroCount, setGiroCount] = useState(0)

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  useEffect(() => {
    const fetchAll = async () => {
      const [{ data: billsData }, { data: debtData }, { data: paidData }] = await Promise.all([
        supabase.from('bills').select('due_date, installment, paid_amount, is_paid, suppliers(name)'),
        supabase.from('debt_loan').select('id, debt_amount').eq('debt_type', 'Giro'),
        supabase.from('debt_loan_detail').select('debt_loan_id, installment_amount').eq('is_paid', true),
      ])

      const bills = (billsData ?? []) as { due_date: string; installment: number; paid_amount: number; is_paid: boolean; suppliers: { name: string } | null }[]
      const overdueBills = bills.filter(b => !b.is_paid && b.due_date.slice(0, 7) < currentMonth)
      const thisMonthBills = bills.filter(b => b.due_date.slice(0, 7) === currentMonth)

      setBillsOverdueSisa(overdueBills.reduce((s, b) => s + (b.installment - b.paid_amount), 0))
      setBillsOverdueSupplierCount(new Set(overdueBills.map(b => b.suppliers?.name ?? '-')).size)
      const tmTotal = thisMonthBills.reduce((s, b) => s + b.installment, 0)
      const tmPaid = thisMonthBills.reduce((s, b) => s + b.paid_amount, 0)
      setBillsThisMonthTotal(tmTotal)
      setBillsThisMonthSisa(tmTotal - tmPaid)

      const loans = (debtData ?? []) as { id: number; debt_amount: number }[]
      const paid = (paidData ?? []) as { debt_loan_id: number; installment_amount: number }[]
      const paidMap: Record<number, number> = {}
      for (const p of paid) paidMap[p.debt_loan_id] = (paidMap[p.debt_loan_id] ?? 0) + p.installment_amount
      setGiroSisa(loans.reduce((s, l) => s + Math.max(0, l.debt_amount - (paidMap[l.id] ?? 0)), 0))
      setGiroCount(loans.length)

      setFetching(false)
    }
    fetchAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totalHutangDagang = billsOverdueSisa + billsThisMonthSisa
  const totalHutang = totalHutangDagang + giroSisa

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
            <h2 className="text-lg font-bold text-gray-800">Ringkasan Hutang</h2>
            <p className="text-xs text-gray-500 mt-0.5">Semua kewajiban yang perlu dibayar</p>
          </div>
        </div>

        {/* Overdue alert */}
        {billsOverdueSisa > 0 && (
          <div className="rounded-xl bg-red-50 border-2 border-red-300 p-4 flex gap-3">
            <FontAwesomeIcon icon={faTriangleExclamation} className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700">Ada hutang yang sudah lewat jatuh tempo</p>
              <p className="text-xs text-red-600 mt-0.5">
                Rp {fmt(billsOverdueSisa)} dari {billsOverdueSupplierCount} supplier — segera diselesaikan.
              </p>
            </div>
          </div>
        )}

        {/* Total card */}
        <div className="rounded-xl p-5" style={{ backgroundColor: '#0F4C75' }}>
          <p className="text-xs mb-1" style={{ color: '#B3D4F5' }}>Total semua hutang sekarang</p>
          <p className="text-3xl font-bold text-white">Rp {fmt(totalHutang)}</p>
          <p className="text-xs mt-2" style={{ color: '#B3D4F5' }}>Hutang dagang + hutang giro</p>
        </div>

        {/* Hutang Dagang card */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border-l-4" style={{ borderLeftColor: '#800000' }}>
          <div className="px-4 pt-4 pb-3 border-b border-gray-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-800">Hutang Dagang</p>
                <p className="text-xs text-gray-500 mt-0.5">Nota pembelian dari supplier</p>
              </div>
              <Link href="/bills-insight" className="text-xs font-semibold flex items-center gap-1" style={{ color: '#800000' }}>
                Lihat Detail
                <FontAwesomeIcon icon={faArrowRight} className="w-2.5 h-2.5" />
              </Link>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {billsOverdueSisa > 0 && (
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs font-medium text-red-600">Lewat jatuh tempo</p>
                  <p className="text-[11px] text-gray-400">{billsOverdueSupplierCount} supplier</p>
                </div>
                <p className="text-sm font-bold text-red-600">Rp {fmt(billsOverdueSisa)}</p>
              </div>
            )}
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs font-medium text-gray-700">Bulan ini</p>
                <p className="text-[11px] text-gray-400">Total tagihan Rp {fmt(billsThisMonthTotal)}</p>
              </div>
              <p className="text-sm font-bold text-[#121358]">Rp {fmt(billsThisMonthSisa)}</p>
            </div>
            <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
              <p className="text-xs font-semibold text-gray-600">Total hutang dagang</p>
              <p className="text-base font-bold text-gray-800">Rp {fmt(totalHutangDagang)}</p>
            </div>
          </div>
        </div>

        {/* Hutang Giro card */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border-l-4" style={{ borderLeftColor: '#9FA1FF' }}>
          <div className="px-4 pt-4 pb-3 border-b border-gray-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-800">Hutang Giro</p>
                <p className="text-xs text-gray-500 mt-0.5">{giroCount} transaksi giro aktif</p>
              </div>
              <Link href="/tagihan-giro" className="text-xs font-semibold flex items-center gap-1" style={{ color: '#121358' }}>
                Lihat Detail
                <FontAwesomeIcon icon={faArrowRight} className="w-2.5 h-2.5" />
              </Link>
            </div>
          </div>
          <div className="p-4">
            <div className="flex justify-between items-center">
              <p className="text-xs font-semibold text-gray-600">Sisa hutang giro</p>
              <p className="text-base font-bold text-gray-800">Rp {fmt(giroSisa)}</p>
            </div>
          </div>
        </div>

        {/* All clear */}
        {totalHutang === 0 && (
          <div className="rounded-xl bg-green-50 border border-green-200 p-4 flex gap-3">
            <FontAwesomeIcon icon={faCircleCheck} className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            <p className="text-sm text-green-700">Tidak ada hutang yang perlu dibayar sekarang. Bagus!</p>
          </div>
        )}

      </div>
    </div>
  )
}
