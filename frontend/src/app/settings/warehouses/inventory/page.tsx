'use client'

import WarehouseTabs from '@/lib/WarehouseTabs'

export default function WarehouseInventoryPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-xl mx-auto space-y-4">
        <WarehouseTabs />

        <div>
          <h2 className="text-lg font-bold text-gray-800">Set Up Inventory</h2>
          <p className="text-xs text-gray-500 mt-0.5">Fitur ini akan segera hadir.</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-8 flex items-center justify-center">
          <p className="text-sm text-gray-400">Coming soon</p>
        </div>
      </div>
    </div>
  )
}
