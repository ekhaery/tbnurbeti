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

export async function epsonPrint(payload: PrintPayload): Promise<void> {
  const res = await fetch('/api/print', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
}
