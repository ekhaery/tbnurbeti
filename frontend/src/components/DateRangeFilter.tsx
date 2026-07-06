'use client'

type Props = {
  dateFrom: string
  dateTo: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
}

export default function DateRangeFilter({ dateFrom, dateTo, onFromChange, onToChange }: Props) {
  return (
    <div className="rounded-2xl shadow-sm p-4 space-y-3" style={{ backgroundColor: '#B5BAFF' }}>
      <p className="text-xs font-semibold text-[#121358]">Rentang Tanggal:</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-semibold text-[#121358] mb-1">Dari</label>
          <input type="date" value={dateFrom} onChange={e => onFromChange(e.target.value)}
            style={{ fontSize: '11px' }}
            className="w-auto bg-white border border-gray-200 rounded-lg px-1.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#121358]" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-[#121358] mb-1">Sampai</label>
          <input type="date" value={dateTo} onChange={e => onToChange(e.target.value)}
            style={{ fontSize: '11px' }}
            className="w-auto bg-white border border-gray-200 rounded-lg px-1.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#121358]" />
        </div>
      </div>
    </div>
  )
}
