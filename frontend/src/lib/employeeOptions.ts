export const SALARY_PERIOD_OPTIONS = [
  { value: 'harian',   label: 'Harian' },
  { value: 'mingguan', label: 'Mingguan' },
  { value: 'bulanan',  label: 'Bulanan' },
  { value: 'bonus',    label: 'Bonus' },
  { value: 'bpjs',     label: 'BPJS' },
  { value: 'makan',    label: 'Makan' },
] as const

export type SalaryPeriod = typeof SALARY_PERIOD_OPTIONS[number]['value']

export const salaryPeriodLabel = (value: string) =>
  SALARY_PERIOD_OPTIONS.find(o => o.value === value)?.label ?? value
