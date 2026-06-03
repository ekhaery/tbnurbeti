'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPenToSquare, faTrash, faPlus, faCheck, faXmark } from '@fortawesome/free-solid-svg-icons'

type Role = { id: number; name: string }
type AppUser = {
  id: number
  name: string
  email: string
  role_id: number
  roles: { name: string }
}

export default function UsersPage() {
  const supabase = createClient()

  const [users, setUsers] = useState<AppUser[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // add form
  const [newName, setNewName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRoleId, setNewRoleId] = useState<number | ''>('')
  const [adding, setAdding] = useState(false)

  // edit
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editRoleId, setEditRoleId] = useState<number | ''>('')
  const [saving, setSaving] = useState(false)

  const [deletingId, setDeletingId] = useState<number | null>(null)

  const fetchData = async () => {
    const [{ data: usersData }, { data: rolesData }] = await Promise.all([
      supabase.from('users').select('id, name, email, role_id, roles(name)').order('name'),
      supabase.from('roles').select('id, name').order('name'),
    ])
    setUsers((usersData as unknown as AppUser[]) ?? [])
    setRoles(rolesData ?? [])
    setFetching(false)
  }

  useEffect(() => { fetchData() }, [])

  // CREATE
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || !newPassword || !newRoleId) return
    setAdding(true)
    setError(null)

    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), password: newPassword, role_id: newRoleId }),
    })

    const json = await res.json()
    setAdding(false)

    if (!res.ok) { setError(json.error ?? 'Gagal membuat user.'); return }

    setNewName('')
    setNewPassword('')
    setNewRoleId('')
    fetchData()
  }

  // UPDATE name + role
  const handleEdit = async (id: number) => {
    if (!editName.trim() || !editRoleId) return
    setSaving(true)
    setError(null)
    const { error } = await supabase
      .from('users')
      .update({ name: editName.trim(), role_id: editRoleId })
      .eq('id', id)
    setSaving(false)
    if (error) { setError(error.message); return }
    setEditId(null)
    fetchData()
  }

  // DELETE
  const handleDelete = async (user: AppUser) => {
    if (!confirm(`Hapus user "${user.name}"?`)) return
    setDeletingId(user.id)
    setError(null)
    await supabase.from('users').delete().eq('id', user.id)
    setDeletingId(null)
    fetchData()
  }

  const roleName = (r: Role) => r.name.charAt(0).toUpperCase() + r.name.slice(1)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-xl mx-auto space-y-4">

        {/* Header */}
        <div>
          <h2 className="text-lg font-bold text-gray-800">Users</h2>
          <p className="text-xs text-gray-400 mt-0.5">{fetching ? '...' : `${users.length} pengguna`}</p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* Add form */}
        <form onSubmit={handleAdd} className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tambah User</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Username <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="nama"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Password <span className="text-red-500">*</span></label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Role <span className="text-red-500">*</span></label>
            <select
              value={newRoleId}
              onChange={(e) => setNewRoleId(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]"
              required
            >
              <option value="">-- Pilih Role --</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{roleName(r)}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={adding || !newName.trim() || !newPassword || !newRoleId}
            className="w-full flex items-center justify-center gap-1.5 bg-[#121358] hover:bg-[#1a1c6e] disabled:bg-[#121358]/40 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition"
          >
            <FontAwesomeIcon icon={faPlus} className="w-3.5 h-3.5" />
            {adding ? 'Menyimpan...' : 'Tambah User'}
          </button>
        </form>

        {/* User list */}
        {fetching ? (
          <div className="text-center text-sm text-gray-400 py-10">Memuat...</div>
        ) : users.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-10">Belum ada user.</div>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="bg-white rounded-xl shadow-sm px-4 py-3 flex items-center gap-3">
                {editId === u.id ? (
                  <>
                    <div className="flex-1 flex gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]"
                      />
                      <select
                        value={editRoleId}
                        onChange={(e) => setEditRoleId(Number(e.target.value))}
                        className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]"
                      >
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>{roleName(r)}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => handleEdit(u.id)}
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
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{u.name}</p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        u.roles?.name === 'admin' ? 'bg-[#121358]/10 text-[#121358]' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {u.roles?.name}
                      </span>
                    </div>
                    <button
                      onClick={() => { setEditId(u.id); setEditName(u.name); setEditRoleId(u.role_id) }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-[#121358]/10 text-gray-400 hover:text-[#121358] transition"
                      title="Edit"
                    >
                      <FontAwesomeIcon icon={faPenToSquare} className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(u)}
                      disabled={deletingId === u.id}
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
