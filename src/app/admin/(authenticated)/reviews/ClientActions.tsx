'use client'

import { useState, useTransition, useEffect } from 'react'
import { moderateReview, toggleFeaturedReview } from '@/actions/adminReview'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Eye, EyeOff, AlertCircle, X, Search, RotateCcw, Star, Sparkles } from 'lucide-react'

interface ReviewActionProps {
  reviewId: string
  isPublished: boolean
  isFeatured?: boolean
  hasComment?: boolean
  isPusat?: boolean
  vehicleName: string
  customerName: string
  currentReason?: string | null
}

export function ReviewRowActions({
  reviewId,
  isPublished,
  isFeatured = false,
  hasComment = true,
  isPusat = false,
  vehicleName,
  customerName,
  currentReason,
}: ReviewActionProps) {
  const router = useRouter()
  const [isHideModalOpen, setIsHideModalOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleHideSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason || !reason.trim()) {
      setError('Alasan penyembunyian ulasan wajib diisi.')
      return
    }

    setError(null)
    startTransition(async () => {
      const res = await moderateReview({
        reviewId,
        action: 'hide',
        reason: reason.trim(),
      })

      if (res.success) {
        setIsHideModalOpen(false)
        setReason('')
        router.refresh()
      } else {
        setError(res.error || 'Gagal menyembunyikan ulasan.')
      }
    })
  }

  const handleUnhide = () => {
    setError(null)
    startTransition(async () => {
      const res = await moderateReview({
        reviewId,
        action: 'unhide',
      })

      if (res.success) {
        router.refresh()
      } else {
        alert(res.error || 'Gagal menampilkan ulasan.')
      }
    })
  }

  const handleToggleFeature = () => {
    setError(null)
    startTransition(async () => {
      const res = await toggleFeaturedReview({
        reviewId,
        isFeatured: !isFeatured,
      })

      if (res.success) {
        router.refresh()
      } else {
        alert(res.error || 'Gagal mengubah status unggulan ulasan.')
      }
    })
  }

  return (
    <>
      <div className="flex items-center gap-2 justify-end">
        {/* Toggle Feature Button (Exclusive for admin_pusat) */}
        {isPusat && (
          isFeatured ? (
            <button
              type="button"
              onClick={handleToggleFeature}
              disabled={isPending}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
              data-testid={`toggle-feature-btn-${reviewId}`}
              title="Lepas status unggulan dari beranda"
            >
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
              <span>Lepas Unggulan</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleToggleFeature}
              disabled={isPending || !isPublished || !hasComment}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-zinc-50 hover:bg-amber-50 text-zinc-700 hover:text-amber-800 border border-zinc-200 hover:border-amber-300 transition-colors disabled:opacity-40 disabled:hover:bg-zinc-50 disabled:hover:text-zinc-700 disabled:cursor-not-allowed cursor-pointer shadow-sm"
              data-testid={`toggle-feature-btn-${reviewId}`}
              title={
                !isPublished
                  ? 'Ulasan yang disembunyikan tidak dapat diunggulkan'
                  : !hasComment
                  ? 'Ulasan tanpa teks komentar tidak dapat diunggulkan'
                  : 'Unggulkan ulasan ini di beranda'
              }
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Unggulkan</span>
            </button>
          )
        )}

        {isPublished ? (
          <button
            type="button"
            onClick={() => setIsHideModalOpen(true)}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
            data-testid={`hide-review-btn-${reviewId}`}
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>Sembunyikan</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleUnhide}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
            data-testid={`unhide-review-btn-${reviewId}`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Tampilkan</span>
          </button>
        )}
      </div>

      {/* Hide Review Modal */}
      {isHideModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md bg-white border border-zinc-200 rounded-2xl p-6 text-zinc-900 shadow-2xl">
            <button
              type="button"
              onClick={() => {
                setIsHideModalOpen(false)
                setError(null)
              }}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 transition-colors p-1 rounded-md"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-full bg-red-50 text-red-600 border border-red-100">
                <EyeOff className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-zinc-900">
                Sembunyikan Ulasan
              </h3>
            </div>
            <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
              Ulasan untuk <strong className="text-zinc-800">{vehicleName}</strong> oleh <strong className="text-zinc-800">{customerName}</strong> akan disembunyikan dari halaman publik dan dicatat di Log Audit.
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2" data-testid="moderation-error-banner">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleHideSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  Alasan Penyembunyian <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Contoh: Mengandung bahasa kasar, tuduhan tanpa dasar, dsb."
                  className="w-full bg-white border border-zinc-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-lg p-3 text-sm text-zinc-900 placeholder-zinc-400 outline-none resize-none transition-all"
                  data-testid="hide-reason-input"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsHideModalOpen(false)
                    setError(null)
                  }}
                  disabled={isPending}
                  className="px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg text-xs transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                  data-testid="confirm-hide-btn"
                >
                  {isPending ? 'Menyimpan...' : 'Sembunyikan Ulasan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

export function ReviewFilterBar({
  branches,
  isPusat,
}: {
  branches?: Array<{ id: string; name: string }>
  isPusat: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [search, setSearch] = useState(searchParams.get('search') || searchParams.get('q') || '')
  const currentBranch = searchParams.get('branch') || 'all'
  const currentStatus = searchParams.get('status') || 'all'

  // Debounced search query
  useEffect(() => {
    const handler = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (search.trim()) {
        params.set('search', search.trim())
      } else {
        params.delete('search')
        params.delete('q')
      }
      params.delete('page')
      router.push(`${pathname}?${params.toString()}`)
    }, 300)

    return () => clearTimeout(handler)
  }, [search])

  const updateParam = (key: string, val: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (val === 'all') {
      params.delete(key)
    } else {
      params.set(key, val)
    }
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  const resetFilters = () => {
    setSearch('')
    router.push(pathname)
  }

  const hasActiveFilters = search.trim() !== '' || currentBranch !== 'all' || currentStatus !== 'all'

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-zinc-200 mb-6 flex flex-col md:flex-row gap-4 items-end">
      {/* Search Input */}
      <div className="flex-1 w-full">
        <label className="block text-xs font-medium text-zinc-500 mb-1">
          Cari Armada, Pelanggan, atau Komentar
        </label>
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama mobil, plat nomor, pelanggan, atau isi ulasan..."
            className="w-full pl-9 pr-3 py-2 text-sm text-zinc-900 bg-white border border-zinc-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
          />
        </div>
      </div>

      {/* Branch filter (only for admin_pusat) */}
      {isPusat && branches && (
        <div className="w-full md:w-56">
          <label className="block text-xs font-medium text-zinc-500 mb-1">
            Cabang Asal
          </label>
          <select
            value={currentBranch}
            onChange={(e) => updateParam('branch', e.target.value)}
            className="w-full text-sm text-zinc-900 bg-white border border-zinc-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
            data-testid="admin-review-branch-filter"
          >
            <option value="all">Semua Cabang</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Status filter */}
      <div className="w-full md:w-48">
        <label className="block text-xs font-medium text-zinc-500 mb-1">
          Status Publikasi
        </label>
        <select
          value={currentStatus}
          onChange={(e) => updateParam('status', e.target.value)}
          className="w-full text-sm text-zinc-900 bg-white border border-zinc-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
          data-testid="admin-review-status-filter"
        >
          <option value="all">Semua Status</option>
          <option value="published">Terbit (Publik)</option>
          <option value="hidden">Disembunyikan</option>
        </select>
      </div>

      {/* Reset Button if filtered */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={resetFilters}
          className="px-3 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg border border-zinc-200 transition-colors flex items-center gap-1 shrink-0 h-[38px]"
          title="Reset semua filter"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      )}
    </div>
  )
}
