'use client'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark } from '@fortawesome/free-solid-svg-icons'

type Props = {
  title: string
  description: string
  subLabel?: string
  confirmText: string
  onConfirmTextChange: (v: string) => void
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
  error?: string
}

export default function DeleteConfirmPopup({ title, description, subLabel, confirmText, onConfirmTextChange, onConfirm, onCancel, loading, error }: Props) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
        <div className="px-5 py-4 bg-red-600 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-white">{title}</p>
            {subLabel && <p className="text-[10px] font-mono text-white/70 mt-0.5">{subLabel}</p>}
          </div>
          <button onClick={onCancel} className="w-7 h-7 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition">
            <FontAwesomeIcon icon={faXmark} className="w-3 h-3" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-gray-700">{description}</p>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Tulis <span className="font-semibold text-red-500">&quot;delete&quot;</span> untuk mengkonfirmasi</label>
            <input
              type="text"
              value={confirmText}
              onChange={e => onConfirmTextChange(e.target.value)}
              placeholder="delete"
              autoFocus
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </div>
        </div>
        {error && <p className="mx-5 mb-3 text-xs font-semibold text-red-600 bg-red-50 rounded-xl px-3 py-2">⚠ {error}</p>}
        <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition">
            Batal
          </button>
          <button onClick={onConfirm} disabled={confirmText !== 'delete' || loading}
            className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-semibold transition">
            {loading ? 'Menghapus...' : 'Hapus'}
          </button>
        </div>
      </div>
    </div>
  )
}
