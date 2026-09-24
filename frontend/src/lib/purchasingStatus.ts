export type PurchasingStatus = 'init' | 'created' | 'partial' | 'completed'

export const PURCHASING_STATUS: Record<PurchasingStatus, { label: string; className: string }> = {
  init: {
    label: 'init',
    className: 'bg-orange-100 text-orange-500',
  },
  created: {
    label: 'Delivery Order',
    className: 'bg-blue-100 text-blue-600',
  },
  partial: {
    label: 'Sebagian Diterima',
    className: 'bg-purple-100 text-purple-600',
  },
  completed: {
    label: 'completed',
    className: 'bg-green-100 text-green-600',
  },
}
