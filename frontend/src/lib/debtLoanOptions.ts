export const BANK_ACCOUNT_OPTIONS = [
  'BCA',
  'Kospin',
] as const

export const DEBT_TYPE_OPTIONS = [
  'Rekening Koran',
  'Pinjaman Berjangka',
  'Giro',
] as const

export const INSTALLMENT_TYPE_OPTIONS = [
  { value: 'daily',   label: 'Harian' },
  { value: 'weekly',  label: 'Mingguan' },
  { value: 'monthly', label: 'Bulanan' },
] as const

export type BankAccount      = typeof BANK_ACCOUNT_OPTIONS[number]
export type DebtType         = typeof DEBT_TYPE_OPTIONS[number]
export type InstallmentType  = 'daily' | 'weekly' | 'monthly'

export type DebtLoanPeriod = {
  days:  number
  weeks: number
  month: number
}
