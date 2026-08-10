'use client'

import { useState, useTransition } from 'react'
import { uploadIdentityDocument } from '@/actions/document'

export default function DocumentUploadForm() {
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    const formData = new FormData(e.currentTarget)
    const file = formData.get('file') as File
    
    // Validasi dasar client-side
    if (file && file.size > 5 * 1024 * 1024) {
      setErrorMsg('Ukuran file maksimal 5MB')
      return
    }

    startTransition(async () => {
      try {
        const result = await uploadIdentityDocument(formData)
        if (result?.error) {
          setErrorMsg(result.error)
        } else {
          setSuccessMsg('Dokumen berhasil diunggah! Menunggu verifikasi admin.')
          ;(e.target as HTMLFormElement).reset()
        }
      } catch (err) {
        setErrorMsg('Terjadi kesalahan pada sistem.')
      }
    })
  }

  return (
    <div className="bg-surface p-6 rounded-xl border border-surface-variant shadow-sm w-full max-w-md">
      <h3 className="font-headline-sm text-on-surface mb-4">Upload Identitas</h3>
      
      {errorMsg && (
        <div className="mb-4 p-3 bg-error-container text-error rounded-md text-sm">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="mb-4 p-3 bg-success-container text-success rounded-md text-sm">
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-on-surface-variant">Jenis Dokumen</label>
          <select name="type" required className="p-2 rounded-md border border-outline bg-surface text-on-surface focus:outline-none focus:border-primary">
            <option value="ktp">KTP (Kartu Tanda Penduduk)</option>
            <option value="sim">SIM (Surat Izin Mengemudi)</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-on-surface-variant">Nomor Identitas</label>
          <input 
            type="text" 
            name="identityNumber" 
            required 
            placeholder="Masukkan nomor dokumen"
            className="p-2 rounded-md border border-outline bg-surface text-on-surface focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-on-surface-variant">File Dokumen (JPG/PNG/PDF)</label>
          <input 
            type="file" 
            name="file" 
            accept="image/jpeg, image/png, application/pdf" 
            required 
            className="p-2 text-sm text-on-surface-variant file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-medium file:bg-primary-container file:text-on-primary-container hover:file:bg-primary hover:file:text-on-primary transition-all"
          />
        </div>

        <button 
          type="submit" 
          disabled={isPending}
          className="mt-2 bg-primary text-on-primary py-2 px-4 rounded-full font-button hover:bg-primary-fixed transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
        >
          {isPending ? (
            <>
              <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
              Mengunggah...
            </>
          ) : (
            'Unggah Dokumen'
          )}
        </button>
      </form>
    </div>
  )
}
