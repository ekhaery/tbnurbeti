export const PAYMENT_DISCIPLINE_OPTIONS = [
  { value: 'good',      label: 'Baik',      className: 'bg-green-100 text-green-700' },
  { value: 'watchlist', label: 'Perlu Dipantau', className: 'bg-yellow-100 text-yellow-700' },
  { value: 'risky',     label: 'Berisiko',      className: 'bg-orange-100 text-orange-700' },
  { value: 'bad_debt',  label: 'Buruk',         className: 'bg-red-100 text-red-700' },
] as const

export type PaymentDiscipline = typeof PAYMENT_DISCIPLINE_OPTIONS[number]['value']

export const disciplineConfig = (value: string) =>
  PAYMENT_DISCIPLINE_OPTIONS.find(o => o.value === value) ?? PAYMENT_DISCIPLINE_OPTIONS[0]
