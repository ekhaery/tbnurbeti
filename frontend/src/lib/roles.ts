// Role rules in one place.
//   owner — everything.
//   admin — everything except Laporan, Tagihan Dagang, Pengambilan Barang,
//           Finance and Settings > Users.
//   user  — cashier view (no drawer, no admin-only actions).
export type Role = 'owner' | 'admin' | 'user'

export const isOwner = (role: string | null | undefined) => role === 'owner'

// Admin-level actions that both owner and admin may do (edit products,
// edit/delete orders, transaksi settings, the drawer menu, ...).
export const hasAdminAccess = (role: string | null | undefined) => role === 'owner' || role === 'admin'

// Pages only the owner may open. Matched as path prefixes, so '/bills' also
// covers '/bills-insight' and '/tagihan-giro' covers '/tagihan-giro-insight'.
export const OWNER_ONLY_PATHS = [
  // Laporan
  '/arus-keuangan',
  '/laporan-pengeluaran',
  '/laporan-tagihan-hutang',
  '/laporan-penjualan-produk',
  '/report-biaya-operasional',
  // Tagihan Dagang
  '/bills',
  '/ringkasan-hutang',
  // Pengambilan Barang
  '/pengambilan-barang',
  // Finance
  '/arus-kas',
  '/tagihan-giro',
  '/tagihan-debt-loan',
  '/debt-loan',
  '/piutang',
  // Settings > Users
  '/settings/users',
]

export const canAccessPath = (role: string | null | undefined, pathname: string) =>
  isOwner(role) || !OWNER_ONLY_PATHS.some(p => pathname === p || pathname.startsWith(p))
