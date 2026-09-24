import { createClient } from '@/lib/supabase-browser'

// Activity templates
export const USER_ACTIVITY = {
  ADD_NEW_PRODUCT: (userName: string, productName: string, price: number) =>
    `${userName} telah menambahkan produk baru ${productName}, Rp ${price.toLocaleString('id-ID')}`,

  ADD_NEW_PURCHASING: (userName: string, supplierName: string, total: number) =>
    `${userName} telah menambahkan purchasing baru dari ${supplierName}, Rp ${total.toLocaleString('id-ID')}`,

  EDIT_PURCHASING: (userName: string, code: string, total: number) =>
    `${userName} telah mengubah data purchasing ${code}, Rp ${total.toLocaleString('id-ID')}`,

  DELETE_ORDER: (userName: string, code: string, supplierName: string) =>
    `${userName} telah menghapus order ${code} dari ${supplierName}`,

  CREATE_DELIVERY_ORDER: (userName: string, supplierName: string) =>
    `${userName} telah membuat delivery order baru dari ${supplierName}`,

  RECEIVE_DELIVERY_ORDER: (userName: string, code: string, supplierName: string, total: number) =>
    `${userName} menandai barang diterima untuk ${code} dari ${supplierName}, Rp ${total.toLocaleString('id-ID')}`,
}

// Log an activity
export async function logActivity(
  supabase: ReturnType<typeof createClient>,
  userId: number | null | undefined,
  activity: string
) {
  if (!activity) return
  await supabase.from('user_activities').insert({
    user_id: userId ?? null,
    activity,
  })
}
