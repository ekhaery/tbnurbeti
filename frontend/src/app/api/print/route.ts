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
        }, 500)
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
  const divider = () => line('--------------------------------')

  // Initialize printer
  push(ESC, 0x40)

  // Center align
  push(ESC, 0x61, 1)

  // Bold on, double size
  push(ESC, 0x45, 1)
  push(GS, 0x21, 0x11)
  line('TOKO')

  // Reset size, bold off
  push(GS, 0x21, 0x00)
  push(ESC, 0x45, 0)

  // Left align
  push(ESC, 0x61, 0)
  divider()

  const dateStr = new Date(payload.date + 'T00:00:00').toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
  line(`No : ${payload.code}`)
  line(`Tgl: ${dateStr}`)
  divider()

  for (const item of payload.items) {
    const subtotal = item.price_sold * item.qty - item.discount
    line(item.name)
    let detail = `  ${item.qty} x Rp ${fmt(item.price_sold)}`
    if (item.discount > 0) detail += ` - Rp ${fmt(item.discount)}`
    detail += `  = Rp ${fmt(subtotal)}`
    line(detail)
  }

  divider()

  // Bold total
  push(ESC, 0x45, 1)
  line(`TOTAL: Rp ${fmt(payload.total)}`)
  push(ESC, 0x45, 0)

  if (payload.notes) {
    line(`Catatan: ${payload.notes}`)
  }

  // Feed and cut
  push(LF, LF, LF)
  push(GS, 0x56, 0x41, 0x03) // partial cut with feed

  return Buffer.from(bytes)
}
