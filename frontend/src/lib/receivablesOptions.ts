export const RECEIVABLES_STATUS_OPTIONS = [
  { value: 'Lunas',             label: 'Lunas',             className: 'bg-green-100 text-green-700' },
  { value: 'Dibayar Sebagian',  label: 'Dibayar Sebagian',  className: 'bg-blue-100 text-blue-700' },
  { value: 'Belum Dibayar',     label: 'Belum Dibayar',     className: 'bg-gray-100 text-gray-600' },
  { value: 'Jatuh Tempo',       label: 'Jatuh Tempo',       className: 'bg-red-100 text-red-600' },
] as const

export type ReceivablesStatus = typeof RECEIVABLES_STATUS_OPTIONS[number]['value']

export const receivablesStatusConfig = (value: string) =>
  RECEIVABLES_STATUS_OPTIONS.find(o => o.value === value) ?? RECEIVABLES_STATUS_OPTIONS[2]
