'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '@/context/AuthContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft, faXmark } from '@fortawesome/free-solid-svg-icons'
import { toTitleCase } from '@/lib/utils'
import { nowWIB } from '@/lib/date'

type Category = { id: number; name: string; is_price_required: boolean }
type Supplier = { id: number; name: string }
type UnitOfMeasurement = { id: number; name: string; abbreviation: string }
type ConversionContext = 'purchase' | 'sale' | 'both'
type UnitConversion = {
  id?: number
  unit_of_measurement_id: number
  factor_to_base: string
  context: ConversionContext
  price_override: string
}
const contextLabel: Record<ConversionContext, string> = { purchase: 'Beli', sale: 'Jual', both: 'Beli & Jual' }

export default function EditProductPage() {
  const supabase = createClient()
  const { appUser, loading } = useAuth()
  const router = useRouter()
  const { id } = useParams()

  const isAdmin = appUser?.role === 'admin'

  const [categories, setCategories] = useState<Category[]>([])
  const [unitOfMeasurements, setUnitOfMeasurements] = useState<UnitOfMeasurement[]>([])
  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([])
  const [selectedSuppliers, setSelectedSuppliers] = useState<Supplier[]>([])
  const [originalSupplierIds, setOriginalSupplierIds] = useState<number[]>([])
  const [supplierQuery, setSupplierQuery] = useState('')
  const [supplierDropdown, setSupplierDropdown] = useState(false)
  const [unitQuery, setUnitQuery] = useState('')
  const [unitDropdown, setUnitDropdown] = useState(false)
  const [hasAltUnit, setHasAltUnit] = useState(false)
  const [conversions, setConversions] = useState<UnitConversion[]>([])
  const [originalConversionIds, setOriginalConversionIds] = useState<number[]>([])
  const [newConvUnitId, setNewConvUnitId] = useState('')
  const [newConvUnitQuery, setNewConvUnitQuery] = useState('')
  const [newConvUnitDropdown, setNewConvUnitDropdown] = useState(false)
  const [newConvDirection, setNewConvDirection] = useState<'alt_to_base' | 'base_to_alt'>('alt_to_base')
  const [newConvFactor, setNewConvFactor] = useState('')
  const [newConvContext, setNewConvContext] = useState<ConversionContext>('sale')
  const [newConvPriceOverride, setNewConvPriceOverride] = useState('')
  const [convError, setConvError] = useState<string | null>(null)
  const [form, setForm] = useState({
    code: '',
    name: '',
    category_id: '',
    unit_of_measurement_id: '',
    base_price: '',
    price: '',
    is_discontinued: false,
  })
  const [fetching, setFetching] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [hasBatches, setHasBatches] = useState(false)

  useEffect(() => {
    supabase.from('categories').select('id, name, is_price_required').order('name').then(({ data }: { data: Category[] | null }) => setCategories(data ?? []))

    supabase.from('unit_of_measurements').select('id, name, abbreviation').order('name').then(({ data }: { data: UnitOfMeasurement[] | null }) => setUnitOfMeasurements(data ?? []))

    supabase.from('suppliers').select('id, name').order('name').then(({ data }: { data: Supplier[] | null }) => setAllSuppliers(data ?? []))

    supabase
      .from('product_supplier')
      .select('supplier_id, suppliers(id, name)')
      .eq('product_id', id)
      .then(({ data }: { data: { supplier_id: number; suppliers: { id: number; name: string } | null }[] | null }) => {
        const list = (data ?? []).map(r => ({ id: r.suppliers!.id, name: r.suppliers!.name }))
        setSelectedSuppliers(list)
        setOriginalSupplierIds(list.map(s => s.id))
      })

    supabase
      .from('product_unit_conversions')
      .select('id, unit_of_measurement_id, factor_to_base, context, price_override')
      .eq('product_id', id)
      .then(({ data }: { data: { id: number; unit_of_measurement_id: number; factor_to_base: number; context: ConversionContext; price_override: number | null }[] | null }) => {
        const list = (data ?? []).map(r => ({
          id: r.id,
          unit_of_measurement_id: r.unit_of_measurement_id,
          factor_to_base: String(r.factor_to_base),
          context: r.context,
          price_override: r.price_override !== null ? String(r.price_override) : '',
        }))
        setConversions(list)
        setOriginalConversionIds(list.map(c => c.id!))
        setHasAltUnit(list.length > 0)
      })

    supabase
      .from('products')
      .select('id, code, name, category_id, unit_of_measurement_id, base_price, price, is_discontinued')
      .eq('id', id)
      .single()
      .then(({ data }: { data: { code: string | null; name: string; category_id: number; unit_of_measurement_id: number | null; base_price: number; price: number; is_discontinued: boolean } | null }) => {
        if (data) {
          setForm({
            code: data.code ?? '',
            name: data.name ?? '',
            category_id: String(data.category_id ?? ''),
            unit_of_measurement_id: data.unit_of_measurement_id ? String(data.unit_of_measurement_id) : '',
            base_price: String(data.base_price ?? ''),
            price: String(data.price ?? ''),
            is_discontinued: data.is_discontinued ?? false,
          })
        }
        setFetching(false)
      })

    supabase
      .from('stock_batches')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', id)
      .then(({ count }: { count: number | null }) => setHasBatches((count ?? 0) > 0))
  }, [id])

  // Natural-language sentence for a factor_to_base value, always phrased with whole
  // numbers where possible (e.g. "1 Kubik = 83 Biji" instead of "1 Biji = 0,012 Kubik").
  const conversionSentence = (factorToBase: number, altLabel: string, baseLabel: string) => {
    if (factorToBase >= 1) {
      const n = Number.isInteger(factorToBase) ? factorToBase : Math.round(factorToBase * 1000) / 1000
      return `1 ${altLabel} = ${n} ${baseLabel}`
    }
    const inverse = Math.round((1 / factorToBase) * 1000) / 1000
    return `1 ${baseLabel} = ${inverse} ${altLabel}`
  }

  const addConversion = () => {
    setConvError(null)
    if (!newConvUnitId) { setConvError('Pilih unit terlebih dahulu.'); return }
    const input = parseFloat(newConvFactor)
    if (!(input > 0)) { setConvError('Jumlahnya harus lebih dari 0.'); return }
    const unitId = Number(newConvUnitId)
    if (conversions.some(c => c.unit_of_measurement_id === unitId && c.context === newConvContext)) {
      setConvError('Unit + context ini sudah ditambahkan.')
      return
    }
    // factor_to_base = berapa unit dasar setara 1 unit alternatif
    const factor = newConvDirection === 'alt_to_base' ? input : 1 / input
    setConversions(prev => [...prev, {
      unit_of_measurement_id: unitId,
      factor_to_base: String(factor),
      context: newConvContext,
      price_override: newConvPriceOverride,
    }])
    setNewConvUnitId('')
    setNewConvUnitQuery('')
    setNewConvDirection('alt_to_base')
    setNewConvFactor('')
    setNewConvContext('sale')
    setNewConvPriceOverride('')
  }

  const removeConversion = (idx: number) => {
    setConversions(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setSaving(true)

    const bp = parseFloat(form.base_price) || 0
    const pr = parseFloat(form.price) || 0
    if (bp >= 1 && bp <= 9) {
      setError('Harga modal tidak valid. Harus 0 atau minimal Rp 10.')
      setSaving(false)
      return
    }
    if (bp > 0 && pr > 0 && bp > pr * 0.99) {
      setError(`Harga modal terlalu tinggi. Maksimal Rp ${Math.floor(pr * 0.99).toLocaleString('id-ID')} (99% dari harga jual).`)
      setSaving(false)
      return
    }

    // Check name uniqueness (exclude self)
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .ilike('name', toTitleCase(form.name.trim()))
      .neq('id', id)
      .limit(1)
    if (existing && existing.length > 0) {
      setError(`Nama produk "${toTitleCase(form.name.trim())}" sudah ada.`)
      setSaving(false)
      return
    }

    // Sync product_supplier
    const currentIds = selectedSuppliers.map(s => s.id)
    const toAdd = currentIds.filter(id => !originalSupplierIds.includes(id))
    const toRemove = originalSupplierIds.filter(id => !currentIds.includes(id))
    if (toRemove.length > 0) {
      await supabase.from('product_supplier').delete().eq('product_id', id).in('supplier_id', toRemove)
    }
    if (toAdd.length > 0) {
      await supabase.from('product_supplier').insert(toAdd.map(sid => ({ product_id: Number(id), supplier_id: sid, is_primary: false })))
    }
    setOriginalSupplierIds(currentIds)

    // Sync product_unit_conversions: toggle off = remove all; otherwise diff by id
    if (!hasAltUnit) {
      if (originalConversionIds.length > 0) {
        await supabase.from('product_unit_conversions').delete().eq('product_id', id)
      }
      setOriginalConversionIds([])
    } else {
      const keepIds = conversions.filter(c => c.id).map(c => c.id!)
      const toDeleteIds = originalConversionIds.filter(cid => !keepIds.includes(cid))
      const toInsert = conversions.filter(c => !c.id)
      if (toDeleteIds.length > 0) {
        await supabase.from('product_unit_conversions').delete().in('id', toDeleteIds)
      }
      if (toInsert.length > 0) {
        await supabase.from('product_unit_conversions').insert(toInsert.map(c => ({
          product_id: Number(id),
          unit_of_measurement_id: c.unit_of_measurement_id,
          factor_to_base: parseFloat(c.factor_to_base),
          context: c.context,
          price_override: c.price_override ? parseFloat(c.price_override) : null,
        })))
      }
      setOriginalConversionIds(keepIds)
    }

    const { error: updateError } = await supabase
      .from('products')
      .update({
        code: form.code.trim() || null,
        name: toTitleCase(form.name),
        category_id: Number(form.category_id),
        unit_of_measurement_id: form.unit_of_measurement_id ? Number(form.unit_of_measurement_id) : null,
        base_price: parseFloat(form.base_price) || 0,
        price: parseFloat(form.price) || 0,
        is_discontinued: form.is_discontinued,
        updated_at: nowWIB(),
      })
      .eq('id', id)

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
    } else {
      setSuccess(true)
      setTimeout(() => router.push('/products/list'), 1000)
    }
  }

  const selectedUnit = unitOfMeasurements.find(u => String(u.id) === form.unit_of_measurement_id) ?? null
  const selectedCategory = categories.find(c => String(c.id) === form.category_id)
  const isPriceRequired = selectedCategory?.is_price_required ?? true

  if (loading || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
        Memuat...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
          <FontAwesomeIcon icon={faChevronLeft} className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-base font-bold text-gray-800">Edit Produk</h1>
          <p className="text-xs text-gray-400">Perbarui informasi produk</p>
        </div>
      </div>

      <div className="px-4 py-4 max-w-xl mx-auto space-y-4">
        {success && (
          <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
            ✅ Produk berhasil diperbarui.
          </div>
        )}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSave} className="bg-white rounded-xl shadow-sm p-4 space-y-4">
          {/* Code */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Kode Produk</label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#121358]"
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nama Produk <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#121358]"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Kategori <span className="text-red-500">*</span></label>
            <select
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              required
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#121358]"
            >
              <option value="">-- Pilih Kategori --</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Unit of Measurement */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Unit</label>
            {selectedUnit && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                <span className="inline-flex items-center gap-1 text-xs font-medium bg-[#121358] text-white px-2.5 py-1 rounded-full">
                  {selectedUnit.name} ({selectedUnit.abbreviation})
                  <button type="button" onClick={() => setForm({ ...form, unit_of_measurement_id: '' })} className="opacity-70 hover:opacity-100">
                    <FontAwesomeIcon icon={faXmark} className="w-2.5 h-2.5" />
                  </button>
                </span>
              </div>
            )}
            {!selectedUnit && (
              <div className="relative">
                <input
                  type="text"
                  value={unitQuery}
                  onChange={e => { setUnitQuery(e.target.value); setUnitDropdown(true) }}
                  onFocus={() => setUnitDropdown(true)}
                  onBlur={() => setTimeout(() => setUnitDropdown(false), 150)}
                  placeholder="Cari unit..."
                  autoComplete="off"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#121358]"
                />
                {unitDropdown && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {unitOfMeasurements
                      .filter(u => u.name.toLowerCase().includes(unitQuery.toLowerCase()) || u.abbreviation.toLowerCase().includes(unitQuery.toLowerCase()))
                      .map(u => (
                        <button key={u.id} type="button"
                          onMouseDown={() => { setForm({ ...form, unit_of_measurement_id: String(u.id) }); setUnitQuery(''); setUnitDropdown(false) }}
                          className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                          {u.name} ({u.abbreviation})
                        </button>
                      ))}
                    {unitOfMeasurements.filter(u => u.name.toLowerCase().includes(unitQuery.toLowerCase()) || u.abbreviation.toLowerCase().includes(unitQuery.toLowerCase())).length === 0 && (
                      <p className="px-4 py-2.5 text-xs text-gray-400">Tidak ada unit.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Price + Base Price + Stock */}
          <div className={`grid gap-3 ${isAdmin && !hasBatches ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {isAdmin && !hasBatches && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Harga Modal</label>
                <input
                  type="number"
                  value={form.base_price}
                  onChange={(e) => setForm({ ...form, base_price: e.target.value })}
                  min="0"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#121358]"
                />
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Harga Jual {isPriceRequired && <span className="text-red-500">*</span>}
              </label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required={isPriceRequired}
                placeholder={isPriceRequired ? undefined : 'Harga bervariasi, isi manual saat transaksi'}
                min="0"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#121358]"
              />
            </div>
          </div>

          {/* Suppliers */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Supplier</label>
            {selectedSuppliers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedSuppliers.map(s => (
                  <span key={s.id} className="inline-flex items-center gap-1 text-xs font-medium bg-[#121358] text-white px-2.5 py-1 rounded-full">
                    {s.name}
                    <button type="button" onClick={() => setSelectedSuppliers(prev => prev.filter(x => x.id !== s.id))} className="opacity-70 hover:opacity-100">
                      <FontAwesomeIcon icon={faXmark} className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative">
              <input
                type="text"
                value={supplierQuery}
                onChange={e => { setSupplierQuery(e.target.value); setSupplierDropdown(true) }}
                onFocus={() => setSupplierDropdown(true)}
                onBlur={() => setTimeout(() => setSupplierDropdown(false), 150)}
                placeholder="Cari dan tambah supplier..."
                autoComplete="off"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#121358]"
              />
              {supplierDropdown && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {allSuppliers
                    .filter(s => s.name.toLowerCase().includes(supplierQuery.toLowerCase()) && !selectedSuppliers.some(x => x.id === s.id))
                    .map(s => (
                      <button key={s.id} type="button"
                        onMouseDown={() => { setSelectedSuppliers(prev => [...prev, s]); setSupplierQuery(''); setSupplierDropdown(false) }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                        {s.name}
                      </button>
                    ))}
                  {allSuppliers.filter(s => s.name.toLowerCase().includes(supplierQuery.toLowerCase()) && !selectedSuppliers.some(x => x.id === s.id)).length === 0 && (
                    <p className="px-4 py-2.5 text-xs text-gray-400">Tidak ada supplier.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Unit Alternatif toggle */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm text-gray-700 font-medium">Unit Alternatif</p>
                <p className="text-xs text-gray-400">
                  Aktifkan kalau produk ini bisa dijual/dibeli dalam satuan lain, mis.
                  Bata Hebel per Kubik bisa dijual per Biji, atau Kuas per Pcs dibeli per Dus.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHasAltUnit(v => !v)}
                className={`relative w-10 h-5 rounded-full shrink-0 transition-colors duration-200 focus:outline-none ${
                  hasAltUnit ? 'bg-[#121358]' : 'bg-gray-200'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                  hasAltUnit ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {hasAltUnit && (
              <div className="mt-3 space-y-3">
                {convError && (
                  <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                    ⚠️ {convError}
                  </div>
                )}

                {conversions.length > 0 && (
                  <div className="space-y-1.5">
                    {conversions.map((c, i) => {
                      const unit = unitOfMeasurements.find(u => u.id === c.unit_of_measurement_id)
                      const factor = parseFloat(c.factor_to_base) || 0
                      const sentence = unit && factor > 0
                        ? conversionSentence(factor, unit.abbreviation, selectedUnit?.abbreviation ?? 'unit dasar')
                        : '-'
                      return (
                        <div key={i} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs">
                          <span className="font-medium text-gray-700">{sentence}</span>
                          <span className="ml-auto px-2 py-0.5 rounded-full bg-[#121358]/10 text-[#121358] font-medium shrink-0">
                            {contextLabel[c.context]}
                          </span>
                          {c.price_override && (
                            <span className="text-gray-400 shrink-0">Rp {parseFloat(c.price_override).toLocaleString('id-ID')}</span>
                          )}
                          <button type="button" onClick={() => removeConversion(i)} className="text-gray-400 hover:text-red-500 shrink-0">
                            <FontAwesomeIcon icon={faXmark} className="w-3 h-3" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-3">
                  {/* Step 1: pick the alternate unit */}
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">Unit alternatif</label>
                    {newConvUnitId ? (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-[#121358] text-white px-2.5 py-1.5 rounded-lg">
                          {unitOfMeasurements.find(u => u.id === Number(newConvUnitId))?.name}
                          <button type="button" onClick={() => { setNewConvUnitId(''); setNewConvUnitQuery('') }} className="opacity-70 hover:opacity-100">
                            <FontAwesomeIcon icon={faXmark} className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      </div>
                    ) : (
                      <div className="relative">
                        <input
                          type="text"
                          value={newConvUnitQuery}
                          onChange={e => { setNewConvUnitQuery(e.target.value); setNewConvUnitDropdown(true) }}
                          onFocus={() => setNewConvUnitDropdown(true)}
                          onBlur={() => setTimeout(() => setNewConvUnitDropdown(false), 150)}
                          placeholder="Cari unit (mis. Biji, Dus, Meter)..."
                          autoComplete="off"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#121358]"
                        />
                        {newConvUnitDropdown && (
                          <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                            {unitOfMeasurements
                              .filter(u => u.id !== Number(form.unit_of_measurement_id))
                              .filter(u => u.name.toLowerCase().includes(newConvUnitQuery.toLowerCase()) || u.abbreviation.toLowerCase().includes(newConvUnitQuery.toLowerCase()))
                              .map(u => (
                                <button key={u.id} type="button"
                                  onMouseDown={() => { setNewConvUnitId(String(u.id)); setNewConvUnitQuery('') }}
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
                  {newConvUnitId && (() => {
                    const altUnit = unitOfMeasurements.find(u => u.id === Number(newConvUnitId))
                    const baseLabel = selectedUnit?.name ?? 'unit dasar'
                    const altLabel = altUnit?.name ?? 'unit ini'
                    return (
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">Berapa perbandingannya?</label>
                        <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                          <button type="button"
                            onClick={() => setNewConvDirection('base_to_alt')}
                            className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border transition ${
                              newConvDirection === 'base_to_alt' ? 'bg-[#121358] text-white border-[#121358]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                            }`}>
                            1 {baseLabel} = ? {altLabel}
                          </button>
                          <button type="button"
                            onClick={() => setNewConvDirection('alt_to_base')}
                            className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border transition ${
                              newConvDirection === 'alt_to_base' ? 'bg-[#121358] text-white border-[#121358]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                            }`}>
                            1 {altLabel} = ? {baseLabel}
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 shrink-0">
                            1 {newConvDirection === 'base_to_alt' ? baseLabel : altLabel} =
                          </span>
                          <input
                            type="number"
                            value={newConvFactor}
                            onChange={e => setNewConvFactor(e.target.value)}
                            placeholder="jumlah"
                            min="0"
                            step="any"
                            className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#121358]"
                          />
                          <span className="text-xs text-gray-500">
                            {newConvDirection === 'base_to_alt' ? altLabel : baseLabel}
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
                          onClick={() => setNewConvContext(ctx)}
                          className={`py-1.5 rounded-lg text-[11px] font-medium border transition ${
                            newConvContext === ctx ? 'bg-[#121358] text-white border-[#121358]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
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
                      value={newConvPriceOverride}
                      onChange={e => setNewConvPriceOverride(e.target.value)}
                      placeholder="Kosongkan jika hitung otomatis dari harga jual"
                      min="0"
                      className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#121358]"
                    />
                  </div>

                  {newConvUnitId && newConvFactor && parseFloat(newConvFactor) > 0 && (() => {
                    const altUnit = unitOfMeasurements.find(u => u.id === Number(newConvUnitId))
                    const input = parseFloat(newConvFactor)
                    const factor = newConvDirection === 'alt_to_base' ? input : 1 / input
                    return (
                      <p className="text-[11px] text-gray-400 italic">
                        Akan disimpan sebagai: {conversionSentence(factor, altUnit?.abbreviation ?? '', selectedUnit?.abbreviation ?? 'unit dasar')}
                      </p>
                    )
                  })()}

                  <button
                    type="button"
                    onClick={addConversion}
                    className="w-full py-2 rounded-lg bg-[#121358] hover:bg-[#1a1c6e] text-white text-xs font-semibold transition"
                  >
                    + Tambah Unit Alternatif
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Discontinued toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm text-gray-700 font-medium">Discontinued</p>
              <p className="text-xs text-gray-400">Tandai produk jika tidak restock lagi</p>
            </div>
            <button
              type="button"
              onClick={() => setForm({ ...form, is_discontinued: !form.is_discontinued })}
              className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none ${
                form.is_discontinued ? 'bg-red-400' : 'bg-gray-200'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                form.is_discontinued ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#121358] hover:bg-[#1a1c6e] disabled:bg-[#121358]/40 text-white font-semibold py-3 rounded-xl transition text-sm"
          >
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </form>
      </div>
    </div>
  )
}
