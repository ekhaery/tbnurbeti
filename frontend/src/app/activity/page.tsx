'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

type Activity = {
  id: number
  activity: string
  created_at: string
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return 'Baru saja'
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`
  if (diff < 172800) return `${Math.floor(diff / 86400)} hari lalu`
  return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Hari Ini'
  if (d.toDateString() === yesterday.toDateString()) return 'Kemarin'
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export default function ActivityPage() {
  const supabase = createClient()
  const [list, setList] = useState<Activity[]>([])
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    supabase
      .from('user_activities')
      .select('id, activity, created_at')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }: { data: Activity[] | null }) => {
        setList(data ?? [])
        setFetching(false)
      })
  }, [])

  // Group by day
  const grouped = list.reduce<Record<string, Activity[]>>((acc, a) => {
    const key = dayLabel(a.created_at)
    if (!acc[key]) acc[key] = []
    acc[key].push(a)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-xl mx-auto space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Activity</h2>
          <p className="text-xs text-gray-500 mt-0.5">Riwayat aktivitas pengguna.</p>
        </div>

        {fetching ? (
          <div className="text-center text-sm text-gray-400 py-10">Memuat...</div>
        ) : list.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-10">Belum ada aktivitas.</div>
        ) : (
          Object.entries(grouped).map(([day, activities]) => (
            <div key={day} className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-1">{day}</p>
              {activities.map(a => (
                <div key={a.id} className="bg-white rounded-xl shadow-sm px-4 py-3 flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#9FA1FF] mt-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700">{a.activity}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{timeAgo(a.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
