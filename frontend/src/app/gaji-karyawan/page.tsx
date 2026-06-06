'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { salaryPeriodLabel } from '@/lib/employeeOptions'

type Employee = {
  id: number
  name: string
  employee_salary: { id: number; period: string; amount: number }[]
}

const fmt = (n: number) => n.toLocaleString('id-ID')

type Tab = 'daftar' | 'riwayat'

export default function GajiKaryawanPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('daftar')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    supabase
      .from('employees')
      .select('id, name, employee_salary(id, period, amount)')
      .order('name')
      .then(({ data }: { data: Employee[] | null }) => {
        setEmployees(data ?? [])
        setFetching(false)
      })
  }, [])

  const totalGaji = employees.reduce((sum, e) =>
    sum + e.employee_salary.reduce((s, sal) => s + sal.amount, 0), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-xl mx-auto space-y-4">

        <div>
          <h2 className="text-lg font-bold text-gray-800">Gaji Karyawan</h2>
          <p className="text-xs text-gray-500 mt-0.5">Manajemen penggajian karyawan.</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm p-1 flex gap-1">
          {([['daftar', 'Daftar Gaji Karyawan'], ['riwayat', 'Riwayat']] as [Tab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 text-center text-sm font-medium py-2 rounded-xl transition-colors ${tab === t ? 'bg-slate-800 text-white' : 'bg-slate-200 sm:bg-transparent text-slate-500 sm:hover:bg-slate-200'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Daftar Gaji Karyawan */}
        {tab === 'daftar' && (
          <>
            {/* Summary */}
            <div className="bg-[#121358] rounded-xl p-3">
              <p className="text-xs font-semibold" style={{ color: '#B5BAFF' }}>Total Gaji</p>
              <p className="text-base font-bold mt-0.5" style={{ color: '#FCB7C7' }}>Rp {fmt(totalGaji)}</p>
            </div>

            {fetching ? (
              <div className="text-center text-sm text-gray-400 py-10">Memuat...</div>
            ) : employees.length === 0 ? (
              <div className="text-center text-sm text-gray-400 py-10">Belum ada karyawan.</div>
            ) : (
              <div className="space-y-2">
                {employees.map(e => {
                  const total = e.employee_salary.reduce((s, sal) => s + sal.amount, 0)
                  return (
                    <div key={e.id} className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-[#9FA1FF]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800">{e.name}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {e.employee_salary.map(s => (
                              <span key={s.id} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#9FA1FF]/20 text-[#121358]">
                                {salaryPeriodLabel(s.period)}: Rp {fmt(s.amount)}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-[#121358]">Rp {fmt(total)}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* Riwayat */}
        {tab === 'riwayat' && (
          <div className="text-center text-sm text-gray-400 py-10">Halaman ini sedang dalam pengembangan.</div>
        )}
      </div>
    </div>
  )
}
