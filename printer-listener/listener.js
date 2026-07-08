'use strict'

require('dotenv').config()

const net = require('net')
const { createClient } = require('@supabase/supabase-js')

// ── CONFIG ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
const PRINTER_IP = process.env.PRINTER_IP || '192.168.1.67'
const PRINTER_PORT = parseInt(process.env.PRINTER_PORT || '9100', 10)
// ────────────────────────────────────────────────────────────────────────────

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[ERROR] SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ESC/POS helpers
const ESC = 0x1b
const GS  = 0x1d
const LF  = 0x0a

const fmt = (n) => Number(n).toLocaleString('id-ID')

function buildEscPos(payload) {
  const bytes = []
  const push  = (...b) => bytes.push(...b)
  const text  = (s) => bytes.push(...Buffer.from(s, 'utf8'))
  const line  = (s = '') => { text(s); push(LF) }
  const center = () => push(ESC, 0x61, 1)
  const left   = () => push(ESC, 0x61, 0)
  const bold   = (on) => push(ESC, 0x45, on ? 1 : 0)
  const wide   = () => line('================================')
  const thin   = () => line('--------------------------------')

  push(ESC, 0x40) // init

  center()
  wide()
  bold(true);  line('TB. NURBETI');  bold(false)
  line('Jl. KS. Tubun No. 46')
  line('Tegal')
  line('HP Admin: 0815-4806-4220')
  wide()

  left()
  const dateStr = new Date(payload.date + 'T00:00:00').toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  line(`No. Invoice : ${payload.code}`)
  line(`Tanggal     : ${dateStr}`)

  thin()
  line('Nama Barang      Qty      Total')
  thin()

  for (const item of payload.items) {
    const subtotal = item.price_sold * item.qty - item.discount
    line(item.name)
    if (item.discount > 0) line(`  Disc: Rp ${fmt(item.discount)}`)
    line(`  ${item.qty} pcs        Rp ${fmt(subtotal)}`)
  }

  thin()
  bold(true);  line(`TOTAL          Rp ${fmt(payload.total)}`);  bold(false)

  line('')
  line('Terima kasih atas kepercayaan Anda.')
  line('')
  bold(true);  line('Ketentuan Pengembalian Barang:');  bold(false)
  line('- Konfirmasi sebelum pengembalian.')
  line('- Maksimal 1 hari setelah barang diterima.')
  line('- Barang belum digunakan dan kemasan')
  line('  masih utuh.')
  line('- Nota asli wajib dibawa.')
  line('- Barang pesanan khusus atau yang telah')
  line('  dipotong tidak dapat dikembalikan.')
  wide()

  push(LF, LF, LF)
  push(GS, 0x56, 0x41, 0x03) // full cut

  return Buffer.from(bytes)
}

function sendRaw(data) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket()
    const timeout = setTimeout(() => {
      socket.destroy()
      reject(new Error('Connection timeout'))
    }, 8000)

    socket.connect(PRINTER_PORT, PRINTER_IP, () => {
      socket.write(data, (err) => {
        if (err) { clearTimeout(timeout); socket.destroy(); return reject(err) }
        setTimeout(() => { clearTimeout(timeout); socket.destroy(); resolve() }, 500)
      })
    })

    socket.on('error', (err) => { clearTimeout(timeout); reject(err) })
  })
}

async function printTransaction(transactionId) {
  console.log(`[PRINT] Fetching transaction ${transactionId}...`)

  const { data: trx, error } = await supabase
    .from('transactions')
    .select(`
      id, code, date, total, notes,
      transaction_items (
        qty, price_sold, discount,
        products ( name )
      )
    `)
    .eq('id', transactionId)
    .single()

  if (error || !trx) {
    console.error(`[PRINT] Failed to fetch transaction ${transactionId}:`, error?.message)
    return
  }

  const payload = {
    code:  trx.code,
    date:  trx.date,
    total: trx.total,
    notes: trx.notes ?? '',
    items: (trx.transaction_items ?? []).map((i) => ({
      name:       i.products?.name ?? 'Produk',
      qty:        i.qty,
      price_sold: i.price_sold,
      discount:   i.discount ?? 0,
    })),
  }

  try {
    await sendRaw(buildEscPos(payload))
    console.log(`[PRINT] ✓ Printed transaction ${trx.code}`)
  } catch (err) {
    console.error(`[PRINT] ✗ Print failed for ${trx.code}:`, err.message)
  }
}

function startListener() {
  console.log('[LISTENER] Connecting to Supabase Realtime...')

  const channel = supabase
    .channel('printer-listener')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'transactions' },
      (payload) => {
        const id = payload.new?.id
        console.log(`[LISTENER] New transaction detected: id=${id}`)
        printTransaction(String(id))
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[LISTENER] ✓ Listening on transactions table`)
        console.log(`[LISTENER] Printer: ${PRINTER_IP}:${PRINTER_PORT}`)
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error(`[LISTENER] Realtime error: ${status} — reconnecting in 5s...`)
        setTimeout(startListener, 5000)
      } else {
        console.log(`[LISTENER] Status: ${status}`)
      }
    })

  return channel
}

startListener()
