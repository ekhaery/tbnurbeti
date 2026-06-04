export type ArrivalStatus = 'arrived' | 'partial' | 'pending'

export const ARRIVAL_STATUS: Record<ArrivalStatus, { label: string; className: string }> = {
  arrived: {
    label: '✓ Sudah Tiba',
    className: 'bg-green-100 text-green-600',
  },
  partial: {
    label: '~ Sebagian',
    className: 'bg-blue-100 text-blue-600',
  },
  pending: {
    label: '○ Belum Tiba',
    className: 'bg-gray-100 text-gray-500',
  },
}

type BatchLike = { is_available: boolean }
type ItemLike = { stock_batches: BatchLike[] }

export function getArrivalStatus(items: ItemLike[]): ArrivalStatus {
  const allBatches = items.flatMap(i => i.stock_batches)
  if (allBatches.length === 0) return 'pending'
  const availableCount = allBatches.filter(b => b.is_available).length
  if (availableCount === allBatches.length) return 'arrived'
  if (availableCount > 0) return 'partial'
  return 'pending'
}
