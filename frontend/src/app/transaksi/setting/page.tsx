'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '@/context/AuthContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons'
import Link from 'next/link'
import TransaksiTabs from '@/lib/TransaksiTabs'

const fmt = (n: number) => n.toLocaleString('id-ID')

type PendingTrx = { id: number; code: string; date: string }
type TrxItem = { id: number; product_id: number; qty: number; cogs: number; price_sold: number }
type StockBatch = { id: number; qty_remaining: number; base_price: number }

export default function TransaksiSettingPage() {
  const supabase = createClient()
  const { appUser, loading: authLoading } = useAuth()

  const [pendingCount, setPendingCount] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [done, setDone] = useState(false)

  const fetchPendingCount = async () => {
    const { count } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('is_initial_transformation', true)
    setPendingCount(count ?? 0)
  }

  useEffect(() => { if (appUser?.role === 'admin') fetchPendingCount() }, [appUser])

  const addLog = (msg: string) => setLogs(prev => [...prev, msg])

  const runBackfill = async () => {
    setRunning(true)
    setDone(false)
    setLogs([])

    const { data: transactions } = await supabase
      .from('transactions')
      .select('id, code, date')
      .eq('is_initial_transformation', true)
      .order('date', { ascending: true })
      .order('id', { ascending: true })

    if (!transactions || transactions.length === 0) {
      addLog('Tidak ada transaksi yang perlu diproses.')
      setRunning(false)
      setDone(true)
      return
    }

    addLog(`Ditemukan ${transactions.length} transaksi. Memulai backfill...`)

    for (const trx of transactions as PendingTrx[]) {
      addLog(`\nMemproses ${trx.code} (${trx.date})`)

      const { data: items } = await supabase
        .from('transaction_items')
        .select('id, product_id, qty, cogs, price_sold')
        .eq('transaction_id', trx.id)

      if (!items || items.length === 0) {
        addLog(`  → Tidak ada item, dilewati.`)
        await supabase.from('transactions').update({ is_initial_transformation: false }).eq('id', trx.id)
        continue
      }

      let trxOk = true

      for (const item of items as TrxItem[]) {
        const { count: existingCount } = await supabase
          .from('stock_batch_consumption')
          .select('id', { count: 'exact', head: true })
          .eq('transaction_item_id', item.id)

        if ((existingCount ?? 0) > 0) {
          addLog(`  → Product #${item.product_id}: sudah diproses sebelumnya, dilewati.`)
          continue
        }

        if (item.price_sold <= 10) {
          addLog(`  → Product #${item.product_id}: harga jual Rp ${item.price_sold} terlalu rendah, item dilewati.`)
          trxOk = false
          continue
        }

        const { data: batches } = await supabase
          .from('stock_batches')
          .select('id, qty_remaining, base_price')
          .eq('product_id', item.product_id)
          .eq('is_available', true)
          .gt('qty_remaining', 0)
          .order('received_at', { ascending: true })
          .order('id', { ascending: true })

        if (!batches || batches.length === 0) {
          addLog(`  ⚠ Product #${item.product_id}: tidak ada stok batch tersedia, item dilewati.`)
          trxOk = false
          continue
        }

        let totalCogs = 0
        let remaining = item.qty
        const consumptions: { batch: StockBatch; qty: number }[] = []

        for (const batch of batches as StockBatch[]) {
          if (remaining <= 0) break
          const consume = Math.min(remaining, batch.qty_remaining)
          totalCogs += consume * batch.base_price
          consumptions.push({ batch, qty: consume })
          remaining -= consume
        }

        if (remaining > 0) {
          addLog(`  ⚠ Product #${item.product_id}: stok tidak cukup (kurang ${remaining} unit), dilewati.`)
          trxOk = false
          continue
        }

        // Update cogs on transaction_item
        const { error: cogsErr } = await supabase
          .from('transaction_items')
          .update({ cogs: totalCogs })
          .eq('id', item.id)
        if (cogsErr) { addLog(`  ✗ Gagal update COGS: ${cogsErr.message}`); trxOk = false; continue }

        // Insert stock_batch_consumption + decrement batches
        for (const c of consumptions) {
          const { error: consErr } = await supabase.from('stock_batch_consumption').insert({
            transaction_item_id: item.id,
            stock_batch_id: c.batch.id,
            qty_consumed: c.qty,
          })
          if (consErr) { addLog(`  ✗ Gagal insert consumption: ${consErr.message}`); trxOk = false; break }

          const { error: batchErr } = await supabase
            .from('stock_batches')
            .update({ qty_remaining: c.batch.qty_remaining - c.qty })
            .eq('id', c.batch.id)
          if (batchErr) { addLog(`  ✗ Gagal update stok: ${batchErr.message}`); trxOk = false; break }
        }

        addLog(`  ✓ Product #${item.product_id}: COGS = Rp ${fmt(totalCogs)}`)
      }

      if (trxOk) {
        await supabase.from('transactions').update({ is_initial_transformation: false }).eq('id', trx.id)
        addLog(`  ✅ Transaksi ${trx.code} selesai.`)
      } else {
        addLog(`  ⚠ Transaksi ${trx.code} selesai dengan sebagian item dilewati — flag tidak dihapus.`)
      }
    }

    addLog(`\nBackfill selesai.`)
    setRunning(false)
    setDone(true)
    fetchPendingCount()
  }

  if (authLoading) return null

  if (appUser?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="px-4 pt-3 pb-10 max-w-xl mx-auto space-y-4">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#121358] hover:opacity-70 transition">
            <FontAwesomeIcon icon={faChevronLeft} className="w-3 h-3" /> Home
          </Link>
          <TransaksiTabs />
          <div className="bg-white rounded-xl shadow-sm p-6 text-center">
            <p className="text-sm font-semibold text-gray-500">Akses ditolak. Halaman ini hanya untuk admin.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-xl mx-auto space-y-4">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#121358] hover:opacity-70 transition">
          <FontAwesomeIcon icon={faChevronLeft} className="w-3 h-3" /> Home
        </Link>
        <TransaksiTabs />

        <div>
          <h2 className="text-lg font-bold text-gray-800">Setting Transaksi</h2>
          <p className="text-xs text-gray-500 mt-0.5">Pengaturan khusus admin.</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-gray-800">Backfill Initial Transformation</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Isi COGS, kurangi stok, dan catat konsumsi batch untuk transaksi yang dibuat dengan toggle Initial Transformation.
            </p>
          </div>

          <div className={`rounded-lg px-3 py-2 text-xs font-semibold ${pendingCount === null ? 'bg-gray-50 text-gray-400' : pendingCount > 0 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
            {pendingCount === null ? 'Memuat...' : pendingCount > 0 ? `${pendingCount} transaksi belum diproses` : 'Semua transaksi sudah diproses'}
          </div>

          <button
            onClick={runBackfill}
            disabled={running || pendingCount === 0}
            className="text-sm font-semibold px-5 py-2.5 rounded-full bg-[#121358] hover:bg-[#1a1c6e] disabled:opacity-40 text-white transition shadow-sm"
          >
            {running ? 'Memproses...' : 'Jalankan Backfill'}
          </button>

          {logs.length > 0 && (
            <div className="bg-gray-900 rounded-xl p-3 max-h-80 overflow-y-auto">
              {logs.map((line, i) => (
                <p key={i} className={`text-[11px] font-mono whitespace-pre-wrap leading-5 ${
                  line.includes('✅') ? 'text-green-400' :
                  line.includes('✓') ? 'text-green-300' :
                  line.includes('✗') ? 'text-red-400' :
                  line.includes('⚠') ? 'text-amber-400' :
                  line.startsWith('\n') ? 'text-white font-bold mt-1' :
                  'text-gray-300'
                }`}>{line}</p>
              ))}
              {done && <p className="text-[11px] font-mono text-blue-400 mt-1">─── selesai ───</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
