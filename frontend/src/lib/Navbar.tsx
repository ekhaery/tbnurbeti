'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBars, faRightFromBracket, faXmark, faGear, faUsers, faCartShopping, faTruck, faFileInvoiceDollar, faHandHoldingDollar, faMoneyCheckDollar, faReceipt, faUserGroup, faArrowTrendUp, faMoneyBillWave, faChartBar, faIdCard, faHouse } from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { faBell } from '@fortawesome/free-solid-svg-icons'
import { localDateStr } from '@/lib/date'

const settingsLinks = [
  { label: 'Category', href: '/settings/categories', icon: faGear },
  { label: 'Users', href: '/settings/users', icon: faUsers },
]

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { appUser, signOut } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [activityCount, setActivityCount] = useState(0)
  const [showProdukAlert, setShowProdukAlert] = useState(false)
  const [produkAlerts, setProdukAlerts] = useState<{ id: number; name: string; base_price: number; price: number }[]>([])
  const [loadingAlerts, setLoadingAlerts] = useState(false)
  const [editingProduct, setEditingProduct] = useState<{ id: number; name: string; base_price: number; price: number } | null>(null)
  const [editBasePrice, setEditBasePrice] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [savingProduct, setSavingProduct] = useState(false)
  const [saveCounter, setSaveCounter] = useState(0)
  const [priceError, setPriceError] = useState<string | null>(null)
  const ADMIN_PRICING = 'ibu'
  const isAdmin = appUser?.role === 'admin'
  const requiresPricingCounter = appUser?.name === ADMIN_PRICING
  const supabase = createClient()

  useEffect(() => {
    if (!appUser) return
    const today = localDateStr()
    supabase
      .from('user_activities')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', today)
      .then(({ count }: { count: number | null }) => setActivityCount(count ?? 0))
  }, [appUser])

  // Detect desktop
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    setIsDesktop(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Listen for openProdukAlert event (dispatched by home card and navbar button)
  useEffect(() => {
    const handler = () => { setShowProdukAlert(true); fetchProdukData() }
    window.addEventListener('openProdukAlert', handler)
    return () => window.removeEventListener('openProdukAlert', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Close drawer on route change — mobile only
  useEffect(() => {
    if (!isDesktop) setDrawerOpen(false)
  }, [pathname, isDesktop])

  // Prevent body scroll when drawer is open — mobile only
  useEffect(() => {
    document.body.style.overflow = (drawerOpen && !isDesktop) ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen, isDesktop])

  // Shift main content on desktop
  useEffect(() => {
    const main = document.getElementById('main-content')
    if (!main) return
    if (drawerOpen && isDesktop) {
      main.style.marginLeft = '18rem' // w-72 = 288px
      main.style.transition = 'margin-left 0.3s ease-in-out'
    } else {
      main.style.marginLeft = '0'
      main.style.transition = 'margin-left 0.3s ease-in-out'
    }
  }, [drawerOpen, isDesktop])

  const handleTutup = async () => {
    setShowProdukAlert(false)
    try {
      const today = localDateStr()

      // 1. Ensure 'Opening Stock' supplier exists
      let { data: supplier } = await supabase.from('suppliers').select('id').eq('name', 'Opening Stock').maybeSingle()
      if (!supplier) {
        const { data: ns } = await supabase.from('suppliers').insert({ name: 'Opening Stock' }).select('id').single()
        supplier = ns
      }
      if (!supplier) return

      // 2. Ensure 'OPENING-BALANCE' purchasing exists
      let { data: purch } = await supabase.from('purchasing').select('id').eq('code', 'OPENING-BALANCE').maybeSingle()
      if (!purch) {
        const { data: np } = await supabase.from('purchasing').insert({
          code: 'OPENING-BALANCE', supplier_id: supplier.id, date: today,
          notes: 'Saldo awal stok', total: 0, status: 'completed'
        }).select('id').single()
        purch = np
      }
      if (!purch) return

      // 3. Get product_ids already in stock_batches (via purchasing_items)
      const { data: sbRows } = await supabase.from('stock_batches').select('purchasing_item_id')
      const piIds = [...new Set((sbRows ?? []).map((r: { purchasing_item_id: number }) => r.purchasing_item_id).filter(Boolean))]
      let stockedProductIds: number[] = []
      if (piIds.length > 0) {
        const { data: piRows } = await supabase.from('purchasing_items').select('product_id').in('id', piIds)
        stockedProductIds = Array.from(new Set((piRows ?? []).map((r: { product_id: number }) => r.product_id)))
      }

      // 4. Get eligible products (base_price > 0, not yet in stock_batches)
      let pq = supabase.from('products').select('id, base_price').gt('base_price', 0)
      if (stockedProductIds.length > 0) pq = pq.not('id', 'in', `(${stockedProductIds.join(',')})`)
      const { data: eligibleProducts } = await pq
      if (!eligibleProducts || eligibleProducts.length === 0) return

      // 5. Insert purchasing_items
      const { data: newPis } = await supabase.from('purchasing_items')
        .insert(eligibleProducts.map((p: { id: number; base_price: number }) => ({
          purchasing_id: purch!.id, product_id: p.id, qty: 200, base_price: p.base_price,
        })))
        .select('id, product_id, qty, base_price')
      if (!newPis || newPis.length === 0) return

      // 6. Insert stock_batches
      await supabase.from('stock_batches').insert(
        newPis.map((pi: { id: number; product_id: number; qty: number; base_price: number }) => ({
          purchasing_item_id: pi.id, product_id: pi.product_id,
          qty_remaining: pi.qty, base_price: pi.base_price,
          received_at: today, is_available: true,
        }))
      )
    } catch (_) { /* silent */ }
  }

  const handleSaveProduct = async () => {
    if (!editingProduct) return
    const bp = parseFloat(editBasePrice)
    const pr = parseFloat(editPrice)
    if (!bp || bp <= 0 || !pr || pr <= 0) return
    if (bp >= pr) { setPriceError('Harga modal harus lebih kecil dari harga jual.'); return }
    setPriceError(null)
    setSavingProduct(true)
    await supabase.from('products').update({ base_price: bp, price: pr }).eq('id', editingProduct.id)
    setProdukAlerts(prev => prev.filter(p => p.id !== editingProduct.id))
    setSaveCounter(c => c + 1)
    setSavingProduct(false)
    setEditingProduct(null)
  }

  const fetchProdukData = async () => {
    if (produkAlerts.length > 0) return
    setLoadingAlerts(true)
    const { data: sbData } = await supabase.from('stock_batches').select('product_id')
    const sbIds = [...new Set((sbData ?? []).map((r: { product_id: number }) => r.product_id))]
    const exclusions = ['%Vinilex%', '%Pastel%', '%Tint%', '%Deep%', '%Accent%', '%Elastex%', '%Spot Less%', '%Satin Glo%', '%Catylac Interior Base%', '%Cat Dasar%', '%Glow Base%', '%Easy Clean Base%', '%Weathershield Base%', '%Pentalite Base%']
    let q = supabase.from('products').select('id, name, base_price, price').eq('base_price', 0).eq('is_deleted', false)
    for (const p of exclusions) q = q.not('name', 'ilike', p)
    q = q.not('name', 'ilike', 'Init%')
    if (sbIds.length > 0) q = q.not('id', 'in', `(${sbIds.join(',')})`)
    const { data } = await q.limit(10000).order('name', { ascending: true })
    setProdukAlerts((data ?? []) as { id: number; name: string; base_price: number; price: number }[])
    setLoadingAlerts(false)
  }

  const openProdukAlert = () => {
    window.dispatchEvent(new CustomEvent('openProdukAlert'))
    router.push('/products/list')
  }

  const linkClass = (active: boolean) =>
    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      active ? 'bg-white/20 text-white' : 'text-white/90 hover:bg-white/10 hover:text-white'
    }`

  const isSettingsActive = pathname.startsWith('/settings')
  const isProdukActive = pathname.startsWith('/products')

  if (!appUser) return null

  return (
    <>
      <nav className="bg-[#121358] fixed top-0 left-0 right-0 z-50 h-14">
        <div className="max-w-4xl mx-auto px-4 h-full flex items-center">
          {/* Kebab — admin only, leftmost */}
          {isAdmin && (
            <button
              onClick={() => setDrawerOpen(true)}
              className={`mr-2 ${linkClass(isSettingsActive && !drawerOpen)} px-2`}
              title="Menu"
            >
              <FontAwesomeIcon icon={faBars} className="w-4 h-4" />
            </button>
          )}


          {/* Nav links — right aligned */}
          <div className="flex flex-1 items-center justify-end gap-1">
            {/* Produk link */}
            {isAdmin ? (
              <button onClick={openProdukAlert} className={linkClass(isProdukActive)}>
                Produk
              </button>
            ) : (
              <Link href="/products/list" className={linkClass(isProdukActive)}>
                Produk
              </Link>
            )}

            {/* Transaksi link */}
            <Link href="/transaksi" className={linkClass(pathname.startsWith('/transaksi'))}>
              Transaksi
            </Link>

            {/* Activity link */}
            <Link href="/activity" className={`${linkClass(pathname.startsWith('/activity'))} relative`}>
              <FontAwesomeIcon icon={faBell} className="w-4 h-4" />
              {activityCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {activityCount > 99 ? '99+' : activityCount}
                </span>
              )}
            </Link>

            {/* Logout — non-admin only */}
            {!isAdmin && (
              <button
                onClick={async () => { await signOut(); router.push('/login') }}
                className="px-3 py-1.5 rounded-md text-white/90 hover:bg-white/10 hover:text-white transition-colors"
                title="Keluar"
              >
                <FontAwesomeIcon icon={faRightFromBracket} className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Drawer overlay — mobile only */}
      {drawerOpen && !isDesktop && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Drawer panel — slides in from left */}
      <div
        className={`fixed top-0 left-0 h-full w-72 bg-white z-50 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#121358]">
          <div>
            <p className="text-white font-bold text-base tracking-wide">TB NURBETI</p>
            {appUser && (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-white/70 text-xs">{appUser.name}</span>
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${isAdmin ? 'bg-blue-400/30 text-[#a8aaee]' : 'bg-white/10 text-white/60'}`}>
                  {appUser.role}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 transition"
          >
            <FontAwesomeIcon icon={faXmark} className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">

          {/* Aktifitas Harian */}
          <div>
            <p className="px-5 pb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Aktifitas Harian</p>
            <Link
              href="/"
              className={`flex items-center gap-3 px-5 py-3 text-sm transition ${
                pathname === '/'
                  ? 'text-[#121358] bg-[#121358]/8 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FontAwesomeIcon icon={faHouse} className="w-4 h-4 text-gray-400" />
              Home
            </Link>
          </div>

          {/* Laporan */}
          <div>
            <p className="px-5 pb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Laporan</p>
            <Link
              href="/laporan-penjualan"
              className={`flex items-center gap-3 px-5 py-3 text-sm transition ${
                pathname.startsWith('/laporan-penjualan')
                  ? 'text-[#121358] bg-[#121358]/8 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FontAwesomeIcon icon={faChartBar} className="w-4 h-4 text-gray-400" />
              Laporan
            </Link>
            <Link
              href="/laporan-tagihan-hutang"
              className={`flex items-center gap-3 px-5 py-3 text-sm transition ${
                pathname.startsWith('/laporan-tagihan-hutang')
                  ? 'text-[#121358] bg-[#121358]/8 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FontAwesomeIcon icon={faChartBar} className="w-4 h-4 text-gray-400" />
              Laporan Tagihan Hutang
            </Link>
          </div>

          {/* Purchasing */}
          <div>
            <p className="px-5 pb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Purchasing</p>
            <Link
              href="/purchasing/riwayat"
              className={`flex items-center gap-3 px-5 py-3 text-sm transition ${
                pathname.startsWith('/purchasing')
                  ? 'text-[#121358] bg-[#121358]/8 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FontAwesomeIcon icon={faCartShopping} className="w-4 h-4 text-gray-400" />
              Purchasing
            </Link>
            <Link
              href="/bills"
              className={`flex items-center gap-3 px-5 py-3 text-sm transition ${
                pathname.startsWith('/bills')
                  ? 'text-[#121358] bg-[#121358]/8 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FontAwesomeIcon icon={faHandHoldingDollar} className="w-4 h-4 text-gray-400" />
              Tagihan Dagang
            </Link>
          </div>

          {/* Finance */}
          <div>
            <p className="px-5 pb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Finance</p>
            <Link
              href="/tagihan-giro"
              className={`flex items-center gap-3 px-5 py-3 text-sm transition ${
                pathname.startsWith('/tagihan-giro')
                  ? 'text-[#121358] bg-[#121358]/8 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FontAwesomeIcon icon={faMoneyCheckDollar} className="w-4 h-4 text-gray-400" />
              Giro
            </Link>
            <Link
              href="/tagihan-debt-loan"
              className={`flex items-center gap-3 px-5 py-3 text-sm transition ${
                pathname.startsWith('/tagihan-debt-loan')
                  ? 'text-[#121358] bg-[#121358]/8 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FontAwesomeIcon icon={faReceipt} className="w-4 h-4 text-gray-400" />
              Debt & Loan
            </Link>
            <Link
              href="/piutang"
              className={`flex items-center gap-3 px-5 py-3 text-sm transition ${
                pathname.startsWith('/piutang')
                  ? 'text-[#121358] bg-[#121358]/8 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FontAwesomeIcon icon={faArrowTrendUp} className="w-4 h-4 text-gray-400" />
              Piutang
            </Link>
          </div>

          {/* Operational */}
          <div>
            <p className="px-5 pb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Operational</p>
            <Link
              href="/gaji-karyawan"
              className={`flex items-center gap-3 px-5 py-3 text-sm transition ${
                pathname.startsWith('/gaji-karyawan')
                  ? 'text-[#121358] bg-[#121358]/8 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
                <FontAwesomeIcon icon={faMoneyBillWave} className="w-4 h-4 text-gray-400" />
              Gaji Karyawan
            </Link>
          </div>

          {/* Masterdata */}
          <div>
            <p className="px-5 pb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Masterdata</p>
            <Link
              href="/customers"
              className={`flex items-center gap-3 px-5 py-3 text-sm transition ${
                pathname.startsWith('/customers')
                  ? 'text-[#121358] bg-[#121358]/8 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
                <FontAwesomeIcon icon={faUserGroup} className="w-4 h-4 text-gray-400" />
              Customer
            </Link>
            <Link
              href="/karyawan"
              className={`flex items-center gap-3 px-5 py-3 text-sm transition ${
                pathname.startsWith('/karyawan')
                  ? 'text-[#121358] bg-[#121358]/8 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FontAwesomeIcon icon={faIdCard} className="w-4 h-4 text-gray-400" />
              Karyawan
            </Link>
            <Link
              href="/settings/suppliers"
              className={`flex items-center gap-3 px-5 py-3 text-sm transition ${
                pathname.startsWith('/settings/suppliers')
                  ? 'text-[#121358] bg-[#121358]/8 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FontAwesomeIcon icon={faTruck} className="w-4 h-4 text-gray-400" />
              Supplier
            </Link>
          </div>

          {/* Settings */}
          <div>
            <p className="px-5 pb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Settings</p>
              {settingsLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-5 py-3 text-sm transition ${
                  pathname === item.href
                    ? 'text-[#121358] bg-[#121358]/8 font-semibold'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <FontAwesomeIcon icon={item.icon} className="w-4 h-4 text-gray-400" />
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Logout */}
        <div className="border-t border-gray-100 px-5 py-4">
          <button
            onClick={async () => { setDrawerOpen(false); await signOut(); router.push('/login') }}
            className="flex items-center gap-3 w-full text-sm text-red-500 hover:text-red-600 transition"
          >
            <FontAwesomeIcon icon={faRightFromBracket} className="w-4 h-4" />
            Keluar
          </button>
        </div>
      </div>
      {/* Produk alert popup — admin only */}
      {showProdukAlert && isAdmin && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex items-start justify-between gap-3 px-5 py-4 shrink-0" style={{ backgroundColor: '#800000' }}>
              <div>
                <p className="text-sm font-bold text-white leading-snug">200++ transaksi tidak bisa masuk ke stok karena harga belum diisi. Lengkapi sekarang.</p>
                {!loadingAlerts && produkAlerts.length > 0 && (
                  <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.65)' }}>{produkAlerts.length} produk belum ada harga</p>
                )}
              </div>
              <button
                onClick={() => setShowProdukAlert(false)}
                disabled={requiresPricingCounter && saveCounter < 1}
                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <FontAwesomeIcon icon={faXmark} className="w-3 h-3" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingAlerts ? (
                <div className="py-10 text-center text-sm text-gray-400">Memuat...</div>
              ) : produkAlerts.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">Semua produk sudah memiliki harga.</div>
              ) : (
                <>
                  <div className="px-5 py-3 border-b border-gray-100 bg-amber-50 flex items-center justify-between gap-3">
                    <p className="text-xs text-amber-700">Lengkapi setidaknya 1 data untuk menutup halaman ini.</p>
                    <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${saveCounter >= 1 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {saveCounter}/1
                    </span>
                  </div>
                  {produkAlerts.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => { setEditingProduct(p); setEditBasePrice(String(p.base_price || '')); setEditPrice(String(p.price || '')) }}
                      className="flex items-center justify-between px-5 py-2.5 border-b border-gray-50 cursor-pointer hover:bg-blue-50 transition"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800">{p.name}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          Modal: Rp {p.base_price.toLocaleString('id-ID')} · Jual: Rp {p.price.toLocaleString('id-ID')}
                        </p>
                      </div>
                      <span className="text-xs text-[#9FA1FF] shrink-0 ml-2">Isi harga →</span>
                    </div>
                  ))}
                </>
              )}
            </div>
            <div className="shrink-0 px-5 pt-3 pb-4 border-t border-gray-100 space-y-2">
              <button
                onClick={handleTutup}
                disabled={requiresPricingCounter && saveCounter < 1}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#800000' }}
              >
                Tutup
              </button>
              <button
                onClick={async () => { setShowProdukAlert(false); await signOut(); router.push('/login') }}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-red-500 border border-red-200 hover:bg-red-50 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit product price sub-popup */}
      {editingProduct && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4" style={{ backgroundColor: '#121358' }}>
              <p className="text-sm font-bold text-white leading-snug pr-2">{editingProduct.name}</p>
              <button onClick={() => setEditingProduct(null)} className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition">
                <FontAwesomeIcon icon={faXmark} className="w-3 h-3" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Harga Modal (base_price)</label>
                <input
                  type="number"
                  value={editBasePrice}
                  onChange={e => { setEditBasePrice(e.target.value); setPriceError(null) }}
                  placeholder="Rp 0"
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Harga Jual (price)</label>
                <input
                  type="number"
                  value={editPrice}
                  onChange={e => { setEditPrice(e.target.value); setPriceError(null) }}
                  placeholder="Rp 0"
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]"
                />
              </div>
              {priceError && <p className="text-xs text-red-500">{priceError}</p>}
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => { setEditingProduct(null); setPriceError(null) }} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition">
                Batal
              </button>
              <button
                onClick={handleSaveProduct}
                disabled={savingProduct || !editBasePrice || !editPrice || parseFloat(editBasePrice) <= 0 || parseFloat(editPrice) <= 0}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition disabled:opacity-40"
                style={{ backgroundColor: '#121358' }}
              >
                {savingProduct ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
