'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPenToSquare, faTrash, faPlus, faCheck, faXmark } from '@fortawesome/free-solid-svg-icons'

type Category = {
  id: number
  name: string
}

export default function CategoriesPage() {
  const supabase = createClient()

  const [categories, setCategories] = useState<Category[]>([])
  const [fetching, setFetching] = useState(true)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('id, name').order('name')
    setCategories(data ?? [])
    setFetching(false)
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  // CREATE
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    setError(null)
    const { error } = await supabase.from('categories').insert({ name: newName.trim() })
    setAdding(false)
    if (error) { setError(error.message); return }
    setNewName('')
    fetchCategories()
  }

  // UPDATE
  const handleEdit = async (id: number) => {
    if (!editName.trim()) return
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('categories').update({ name: editName.trim() }).eq('id', id)
    setSaving(false)
    if (error) { setError(error.message); return }
    setEditId(null)
    fetchCategories()
  }

  // DELETE
  const handleDelete = async (id: number) => {
    if (!confirm('Hapus kategori ini?')) return
    setDeletingId(id)
    setError(null)
    const { error } = await supabase.from('categories').delete().eq('id', id)
    setDeletingId(null)
    if (error) { setError(error.message); return }
    fetchCategories()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-xl mx-auto space-y-4">

        {/* Header */}
        <div>
          <h2 className="text-lg font-bold text-gray-800">Kategori</h2>
          <p className="text-xs text-gray-400 mt-0.5">{fetching ? '...' : `${categories.length} kategori`}</p>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* Add form */}
        <form onSubmit={handleAdd} className="bg-white rounded-xl shadow-sm p-4 flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nama kategori baru..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]"
          />
          <button
            type="submit"
            disabled={adding || !newName.trim()}
            className="flex items-center gap-1.5 bg-[#121358] hover:bg-[#1a1c6e] disabled:bg-[#121358]/40 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition"
          >
            <FontAwesomeIcon icon={faPlus} className="w-3.5 h-3.5" />
            {adding ? 'Menyimpan...' : 'Tambah'}
          </button>
        </form>

        {/* Category list */}
        {fetching ? (
          <div className="text-center text-sm text-gray-400 py-10">Memuat...</div>
        ) : categories.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-10">Belum ada kategori.</div>
        ) : (
          <div className="space-y-2">
            {categories.map((cat) => (
              <div key={cat.id} className="bg-white rounded-xl shadow-sm px-4 py-3 flex items-center gap-3">
                {editId === cat.id ? (
                  <>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]"
                    />
                    <button
                      onClick={() => handleEdit(cat.id)}
                      disabled={saving}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-100 hover:bg-green-200 text-green-600 transition"
                      title="Simpan"
                    >
                      <FontAwesomeIcon icon={faCheck} className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEditId(null)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 transition"
                      title="Batal"
                    >
                      <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium text-gray-800">{cat.name}</span>
                    <button
                      onClick={() => { setEditId(cat.id); setEditName(cat.name) }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-[#121358]/10 text-gray-400 hover:text-[#121358] transition"
                      title="Edit"
                    >
                      <FontAwesomeIcon icon={faPenToSquare} className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id)}
                      disabled={deletingId === cat.id}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-red-100 text-gray-400 hover:text-red-500 disabled:opacity-50 transition"
                      title="Hapus"
                    >
                      <FontAwesomeIcon icon={faTrash} className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
