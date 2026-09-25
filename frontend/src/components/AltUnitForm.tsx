'use client'

import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark } from '@fortawesome/free-solid-svg-icons'

export type UnitOfMeasurement = { id: number; name: string; abbreviation: string }
export type ConversionContext = 'purchase' | 'sale' | 'both'
export type NewConversion = {
  unit_of_measurement_id: number
  factor_to_base: number // berapa unit dasar setara 1 unit alternatif
  context: ConversionContext
  price_override: number | null
}

export const contextLabel: Record<ConversionContext, string> = { purchase: 'Beli', sale: 'Jual', both: 'Beli & Jual' }

// Natural-language sentence for a factor_to_base value, always phrased with whole
// numbers where possible (e.g. "1 Kubik = 83 Biji" instead of "1 Biji = 0,012 Kubik").
export const conversionSentence = (factorToBase: number, altLabel: string, baseLabel: string) => {
  if (factorToBase >= 1) {
    const n = Number.isInteger(factorToBase) ? factorToBase : Math.round(factorToBase * 1000) / 1000
    return `1 ${altLabel} = ${n} ${baseLabel}`
  }
  const inverse = Math.round((1 / factorToBase) * 1000) / 1000
  return `1 ${baseLabel} = ${inverse} ${altLabel}`
}

// Form for one alternate unit: pick unit, state the ratio, choose where it's used.
// Pass `initial` to edit an existing conversion (mount with a key per conversion).
// onAdd may be async (e.g. writing straight to product_unit_conversions); a thrown
// Error's message is shown in the form and the inputs are kept.
export default function AltUnitForm({
  units,
  baseUnit,
  existing,
  onAdd,
  submitLabel = '+ Tambah Unit Alternatif',
  initial,
  onCancel,
}: {
  units: UnitOfMeasurement[]
  baseUnit: UnitOfMeasurement | null | undefined
  existing: { unit_of_measurement_id: number; context: ConversionContext }[]
  onAdd: (conv: NewConversion) => void | Promise<void>
  submitLabel?: string
  initial?: NewConversion
  onCancel?: () => void
}) {
  // Show an existing factor in whichever direction gives a whole-ish number
  const initialDirection: 'alt_to_base' | 'base_to_alt' = initial && initial.factor_to_base < 1 ? 'base_to_alt' : 'alt_to_base'
  const initialFactor = initial
    ? String(Math.round((initialDirection === 'alt_to_base' ? initial.factor_to_base : 1 / initial.factor_to_base) * 1000) / 1000)
    : ''
  const [unitId, setUnitId] = useState(initial ? String(initial.unit_of_measurement_id) : '')
  const [unitQuery, setUnitQuery] = useState('')
  const [unitDropdown, setUnitDropdown] = useState(false)
  const [direction, setDirection] = useState<'alt_to_base' | 'base_to_alt'>(initialDirection)
  const [factorInput, setFactorInput] = useState(initialFactor)
  const [context, setContext] = useState<ConversionContext>(initial?.context ?? 'sale')
  const [priceOverride, setPriceOverride] = useState(initial?.price_override != null ? String(initial.price_override) : '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const altUnit = units.find(u => u.id === Number(unitId))

  const handleAdd = async () => {
    setError(null)
    if (!unitId) { setError('Pilih unit terlebih dahulu.'); return }
    const input = parseFloat(factorInput)
    if (!(input > 0)) { setError('Jumlahnya harus lebih dari 0.'); return }
    const id = Number(unitId)
    if (existing.some(c => c.unit_of_measurement_id === id && c.context === context)) {
      setError('Unit + context ini sudah ditambahkan.')
      return
    }
    setSaving(true)
    try {
      await onAdd({
        unit_of_measurement_id: id,
        factor_to_base: direction === 'alt_to_base' ? input : 1 / input,
        context,
        price_override: priceOverride ? parseFloat(priceOverride) : null,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan unit alternatif.')
      setSaving(false)
      return
    }
    setSaving(false)
    setUnitId('')
    setUnitQuery('')
    setDirection('alt_to_base')
    setFactorInput('')
    setContext('sale')
    setPriceOverride('')
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
          ⚠️ {error}
        </div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-3">
        {/* Step 1: pick the alternate unit */}
        <div>
          <label className="block text-[11px] text-gray-500 mb-1">Unit alternatif</label>
          {unitId ? (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-[#121358] text-white px-2.5 py-1.5 rounded-lg">
                {altUnit?.name}
                <button type="button" onClick={() => { setUnitId(''); setUnitQuery('') }} className="opacity-70 hover:opacity-100">
                  <FontAwesomeIcon icon={faXmark} className="w-2.5 h-2.5" />
                </button>
              </span>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                value={unitQuery}
                onChange={e => { setUnitQuery(e.target.value); setUnitDropdown(true) }}
                onFocus={() => setUnitDropdown(true)}
                onBlur={() => setTimeout(() => setUnitDropdown(false), 150)}
                placeholder="Cari unit (mis. Biji, Dus, Meter)..."
                autoComplete="off"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#121358]"
              />
              {unitDropdown && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {units
                    .filter(u => u.id !== baseUnit?.id)
                    .filter(u => u.name.toLowerCase().includes(unitQuery.toLowerCase()) || u.abbreviation.toLowerCase().includes(unitQuery.toLowerCase()))
                    .map(u => (
                      <button key={u.id} type="button"
                        onMouseDown={() => { setUnitId(String(u.id)); setUnitQuery('') }}
                        className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">
                        {u.name} ({u.abbreviation})
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 2: state the ratio in whichever direction reads naturally */}
        {unitId && (() => {
          const baseLabel = baseUnit?.name ?? 'unit dasar'
          const altLabel = altUnit?.name ?? 'unit ini'
          return (
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">Berapa perbandingannya?</label>
              <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                <button type="button"
                  onClick={() => setDirection('base_to_alt')}
                  className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border transition ${
                    direction === 'base_to_alt' ? 'bg-[#121358] text-white border-[#121358]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}>
                  1 {baseLabel} = ? {altLabel}
                </button>
                <button type="button"
                  onClick={() => setDirection('alt_to_base')}
                  className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border transition ${
                    direction === 'alt_to_base' ? 'bg-[#121358] text-white border-[#121358]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}>
                  1 {altLabel} = ? {baseLabel}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 shrink-0">
                  1 {direction === 'base_to_alt' ? baseLabel : altLabel} =
                </span>
                <input
                  type="number"
                  value={factorInput}
                  onChange={e => setFactorInput(e.target.value)}
                  placeholder="jumlah"
                  min="0"
                  step="any"
                  className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#121358]"
                />
                <span className="text-xs text-gray-500">
                  {direction === 'base_to_alt' ? altLabel : baseLabel}
                </span>
              </div>
            </div>
          )
        })()}

        {/* Step 3: where this alternate unit can be used */}
        <div>
          <label className="block text-[11px] text-gray-500 mb-1">Dipakai untuk</label>
          <div className="grid grid-cols-3 gap-1.5">
            {(['sale', 'purchase', 'both'] as ConversionContext[]).map(ctx => (
              <button key={ctx} type="button"
                onClick={() => setContext(ctx)}
                className={`py-1.5 rounded-lg text-[11px] font-medium border transition ${
                  context === ctx ? 'bg-[#121358] text-white border-[#121358]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}>
                {contextLabel[ctx]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[11px] text-gray-500 mb-1">Harga khusus untuk unit ini (opsional)</label>
          <input
            type="number"
            value={priceOverride}
            onChange={e => setPriceOverride(e.target.value)}
            placeholder="Kosongkan jika hitung otomatis dari harga jual"
            min="0"
            className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#121358]"
          />
        </div>

        {unitId && parseFloat(factorInput) > 0 && (() => {
          const input = parseFloat(factorInput)
          const factor = direction === 'alt_to_base' ? input : 1 / input
          return (
            <p className="text-[11px] text-gray-400 italic">
              Akan disimpan sebagai: {conversionSentence(factor, altUnit?.abbreviation ?? '', baseUnit?.abbreviation ?? 'unit dasar')}
            </p>
          )
        })()}

        <div className="flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2 rounded-lg border border-gray-300 bg-white text-gray-600 text-xs font-semibold hover:bg-gray-50 transition"
            >
              Batal
            </button>
          )}
          <button
            type="button"
            onClick={handleAdd}
            disabled={saving}
            className="flex-1 py-2 rounded-lg bg-[#121358] hover:bg-[#1a1c6e] disabled:opacity-40 text-white text-xs font-semibold transition"
          >
            {saving ? 'Menyimpan...' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
