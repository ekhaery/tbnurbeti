import { NextRequest, NextResponse } from 'next/server'
import net from 'net'

const PRINTER_IP = '192.168.1.67'
const PRINTER_PORT = 9100

function sendRaw(data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket()
    const timeout = setTimeout(() => {
      socket.destroy()
      reject(new Error('Connection timeout'))
    }, 8000)

    socket.connect(PRINTER_PORT, PRINTER_IP, () => {
      socket.write(data, (err) => {
        if (err) {
          clearTimeout(timeout)
          socket.destroy()
          reject(err)
          return
        }
        // Give printer time to receive before closing
        setTimeout(() => {
          clearTimeout(timeout)
          socket.destroy()
          resolve()
        }, 250)
      })
    })

    socket.on('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })
  })
}

export async function POST(req: NextRequest) {
  let body: { payload: PrintPayload }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const data = buildEscPos(body.payload)

  try {
    await sendRaw(data)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Tidak bisa konek ke printer: ${msg}` }, { status: 502 })
  }
}

// ESC/POS constants
const ESC = 0x1b
const GS = 0x1d
const LF = 0x0a

type PrintItem = {
  name: string
  qty: number
  price_sold: number
  discount: number
}

type PrintPayload = {
  code: string
  date: string
  items: PrintItem[]
  total: number
  notes: string
}

const fmt = (n: number) => n.toLocaleString('id-ID')

function buildEscPos(payload: PrintPayload): Buffer {
  const bytes: number[] = []

  const push = (...b: number[]) => bytes.push(...b)
  const text = (s: string) => bytes.push(...Buffer.from(s, 'utf8'))
  const line = (s = '') => { text(s); push(LF) }
  const center = () => push(ESC, 0x61, 1)
  const left = () => push(ESC, 0x61, 0)
  const bold = (on: boolean) => push(ESC, 0x45, on ? 1 : 0)
  const wide = () => line('================================')
  const thin = () => line('--------------------------------')

  // Initialize printer
  push(ESC, 0x40)

  // Header
  center()
  wide()
  bold(true)
  line('TB. NURBETI')
  bold(false)
  line('Jl. KS. Tubun No. 46')
  line('Tegal')
  line('HP Admin: 0815-4806-4220')
  wide()

  // Invoice info
  left()
  const dateStr = new Date(payload.date + 'T00:00:00').toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
  line(`No. Invoice : ${payload.code}`)
  line(`Tanggal     : ${dateStr}`)

  // Items
  thin()
  line('Nama Barang      Qty      Total')
  thin()

  for (const item of payload.items) {
    const perUnit = item.qty > 0 ? Math.round(item.price_sold / item.qty) : item.price_sold
    line(item.name)
    line(`  ${item.qty} pcs @${fmt(perUnit)}  | Rp ${fmt(item.price_sold)}`)
  }

  thin()

  // Total
  bold(true)
  line(`TOTAL          Rp ${fmt(payload.total)}`)
  bold(false)

  line('')
  line('Terima kasih atas kepercayaan Anda.')
  line('')
  bold(true)
  line('Ketentuan Pengembalian Barang:')
  bold(false)
  line('- Konfirmasi sebelum pengembalian.')
  line('- Maksimal 1 hari setelah barang diterima.')
  line('- Barang belum digunakan dan kemasan')
  line('  masih utuh.')
  line('- Nota asli wajib dibawa.')
  line('- Barang pesanan khusus atau yang telah')
  line('  dipotong tidak dapat dikembalikan.')
  wide()

  // Feed and cut
  push(LF, LF, LF)
  push(GS, 0x56, 0x41, 0x03)

  return Buffer.from(bytes)
}
