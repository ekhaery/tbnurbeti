'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

type LogEntry = {
  id: string
  time: string
  code: string
  status: 'printing' | 'ok' | 'error'
  message?: string
}

export default function PrintListenerPage() {
  const supabase = createClient()
  const [connected, setConnected] = useState(false)
  const [log, setLog] = useState<LogEntry[]>([])
  const processedIds = useRef<Set<string>>(new Set())

  function addLog(entry: LogEntry) {
    setLog(prev => [entry, ...prev].slice(0, 50))
  }

  function updateLog(id: string, update: Partial<LogEntry>) {
    setLog(prev => prev.map(e => e.id === id ? { ...e, ...update } : e))
  }

  async function printTransaction(trxId: string) {
    if (processedIds.current.has(trxId)) return
    processedIds.current.add(trxId)

    const entryId = trxId
    const time = new Date().toLocaleTimeString('id-ID')

    // Fetch transaction header
    const { data: trx, error: trxErr } = await supabase
      .from('transactions')
      .select('id, code, date, notes')
      .eq('id', trxId)
      .single()

    if (trxErr || !trx) {
      addLog({ id: entryId, time, code: trxId, status: 'error', message: 'Gagal ambil data transaksi' })
      return
    }

    // Fetch items with product names
    const { data: items, error: itemsErr } = await supabase
      .from('transaction_items')
      .select('qty, price_sold, discount, products(name)')
      .eq('transaction_id', trxId)

    if (itemsErr || !items) {
      addLog({ id: entryId, time, code: trx.code, status: 'error', message: 'Gagal ambil items' })
      return
    }

    const total = items.reduce((sum: number, it: any) => sum + (it.price_sold ?? 0), 0)

    const payload = {
      code: trx.code,
      date: trx.date,
      notes: trx.notes ?? '',
      total,
      items: items.map((it: any) => ({
        name: it.products?.name ?? '-',
        qty: it.qty,
        price_sold: it.price_sold / (it.qty || 1),
        discount: it.discount ?? 0,
      })),
    }

    addLog({ id: entryId, time, code: trx.code, status: 'printing' })

    try {
      const res = await fetch('/api/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        updateLog(entryId, { status: 'error', message: body.error ?? `HTTP ${res.status}` })
      } else {
        updateLog(entryId, { status: 'ok' })
      }
    } catch (err: unknown) {
      updateLog(entryId, { status: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  useEffect(() => {
    const channel = supabase
      .channel('print-listener')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transactions' },
        (payload: { new: { id: string | number } }) => {
          console.log('[PrintListener] New transaction:', payload.new)
          printTransaction(String(payload.new.id))
        }
      )
      .subscribe((status: string) => {
        console.log('[PrintListener] Realtime status:', status)
        setConnected(status === 'SUBSCRIBED')
      })

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-[#121358] text-white p-6">
      <div className="max-w-lg mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Print Listener</h1>
            <p className="text-[#ffc908] text-xs mt-0.5">TB. NURBETI — Admin Mac</p>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${connected ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            {connected ? 'Terhubung' : 'Menghubungkan...'}
          </div>
        </div>

        {/* Info card */}
        <div className="bg-white/10 rounded-2xl p-4 text-sm text-white/80 space-y-1">
          <p>Halaman ini harus dibuka di <span className="text-[#ffc908] font-semibold">Mac yang terhubung ke printer</span> via <code className="text-xs bg-white/10 px-1 rounded">localhost:3000</code>.</p>
          <p className="text-xs text-white/50 mt-2">Setiap transaksi baru akan otomatis dicetak.</p>
        </div>

        {/* Log */}
        <div className="space-y-2">
          {log.length === 0 && (
            <div className="text-center text-white/40 text-sm py-8">
              Menunggu transaksi baru...
            </div>
          )}
          {log.map(entry => (
            <div key={entry.id} className="bg-white/10 rounded-xl px-4 py-3 flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-sm">{entry.code}</p>
                <p className="text-xs text-white/50">{entry.time}</p>
                {entry.message && <p className="text-xs text-red-300 mt-0.5">{entry.message}</p>}
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full shrink-0 ${
                entry.status === 'ok' ? 'bg-green-500/20 text-green-300' :
                entry.status === 'error' ? 'bg-red-500/20 text-red-300' :
                'bg-yellow-500/20 text-yellow-300'
              }`}>
                {entry.status === 'ok' ? '✓ Tercetak' : entry.status === 'error' ? '✗ Gagal' : '⏳ Mencetak'}
              </span>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
