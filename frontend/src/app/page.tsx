'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHandshake, faTag, faReceipt, faUserCheck, faLightbulb, faSackDollar } from '@fortawesome/free-solid-svg-icons'

const cards = [
  {
    label: 'Kunjungan Sales',
    icon: faHandshake,
    href: '/kunjungan-sales',
    bg: '#121358',
    text: 'white',
    sub: 'Catat kunjungan sales hari ini',
  },
  {
    label: 'Daftar Harga Barang',
    icon: faTag,
    href: '/products/list',
    bg: '#1e2894',
    text: 'white',
    sub: 'Lihat & kelola harga produk',
  },
  {
    label: 'Transaksi',
    icon: faReceipt,
    href: '/transaksi',
    bg: '#4C8CE4',
    text: 'white',
    sub: 'Buat & lihat riwayat transaksi',
  },
  {
    label: 'Tagihan Dagang Insight',
    icon: faLightbulb,
    href: '/bills-insight',
    bg: '#800000',
    text: 'white',
    sub: 'Ringkasan & situasi hutang dagang',
  },
  {
    label: 'Ringkasan Hutang',
    icon: faSackDollar,
    href: '/ringkasan-hutang',
    bg: '#0F4C75',
    text: 'white',
    sub: 'Total hutang dagang & giro',
  },
  {
    label: 'Absen Karyawan',
    icon: faUserCheck,
    href: '#',
    bg: '#8FB3E2',
    text: '#121358',
    sub: 'Rekap kehadiran karyawan',
  },
]

const cardClass = 'rounded-2xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow active:scale-95'

export default function HomePage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-6 pb-10 max-w-xl mx-auto space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Aktifitas Harian</h2>
          <p className="text-xs text-gray-500 mt-0.5">Pilih aktifitas yang ingin dilakukan.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {cards.map(card => {
            const inner = (
              <>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                  <FontAwesomeIcon icon={card.icon} className="w-5 h-5" style={{ color: card.text }} />
                </div>
                <div>
                  <p className="text-sm font-bold leading-tight" style={{ color: card.text }}>{card.label}</p>
                  <p className="text-[10px] mt-0.5 opacity-70" style={{ color: card.text }}>{card.sub}</p>
                </div>
              </>
            )

            if (card.label === 'Daftar Harga Barang') {
              return (
                <button
                  key={card.label}
                  onClick={() => { window.dispatchEvent(new CustomEvent('openProdukAlert')); router.push(card.href) }}
                  className={cardClass}
                  style={{ backgroundColor: card.bg }}
                >
                  {inner}
                </button>
              )
            }

            return (
              <Link key={card.label} href={card.href} className={cardClass} style={{ backgroundColor: card.bg }}>
                {inner}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
