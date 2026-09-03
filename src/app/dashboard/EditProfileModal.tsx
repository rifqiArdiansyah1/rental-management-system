'use client'

import { useState, useTransition, useRef } from 'react'
import { updateCustomerProfile } from '@/actions/customer'
import { useRouter } from 'next/navigation'

type Props = {
  initialName: string
  initialPhone: string
}

export default function EditProfileModal({ initialName, initialPhone }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState(initialPhone === '-' ? '' : initialPhone)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleOpen() {
    setName(initialName)
    setPhone(initialPhone === '-' ? '' : initialPhone)
    setError(null)
    setSuccess(false)
    setOpen(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await updateCustomerProfile(name, phone)
      if (res.success) {
        setSuccess(true)
        router.refresh()
        setTimeout(() => setOpen(false), 1200)
      } else {
        setError(res.error || 'Terjadi kesalahan.')
      }
    })
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="mt-4 text-xs text-secondary border border-secondary/40 px-4 py-2 rounded-lg hover:bg-secondary/10 transition-colors cursor-pointer flex items-center gap-1.5"
      >
        <span className="material-symbols-outlined text-sm">edit</span>
        Edit Profil
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-surface border border-surface-variant rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-on-surface text-lg">Edit Profil</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {success ? (
              <div className="flex flex-col items-center gap-3 py-6 text-emerald-400">
                <span className="material-symbols-outlined text-4xl">check_circle</span>
                <p className="font-semibold">Profil berhasil diperbarui!</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={2}
                    placeholder="Masukkan nama lengkap"
                    className="bg-surface-variant border border-outline-variant text-on-surface rounded-lg px-4 py-2.5 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                    Nomor Telepon
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Contoh: 081234567890"
                    className="bg-surface-variant border border-outline-variant text-on-surface rounded-lg px-4 py-2.5 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors"
                  />
                </div>

                {error && (
                  <p className="text-xs text-red-400">{error}</p>
                )}

                <div className="flex gap-3 mt-1">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={isPending}
                    className="flex-1 border border-surface-variant text-on-surface-variant py-2.5 rounded-lg text-sm hover:border-zinc-400 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex-1 bg-secondary text-on-secondary py-2.5 rounded-lg text-sm font-semibold hover:bg-secondary-fixed transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isPending ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
