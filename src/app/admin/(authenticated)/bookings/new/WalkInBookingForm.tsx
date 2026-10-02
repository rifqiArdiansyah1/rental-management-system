'use client'

import { useState, useTransition, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  searchCustomerForWalkIn,
  resolveOrCreateWalkInCustomer,
  uploadWalkInDocumentsAction,
  createWalkInBookingAction
} from '@/actions/walkInBooking'
import { calculateEstimatedPrice } from '@/lib/pricing'
import { formatIndonesianPhoneNumber } from '@/utils/whatsapp'
import { getVehicleDisplayName } from '@/lib/vehicleHelper'
import {
  User,
  Car,
  Calendar,
  CreditCard,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  ShieldCheck,
  Percent,
  ArrowRight,
  Info,
  X
} from 'lucide-react'
import { RentalType, UserRole } from '@prisma/client'

interface BranchOption {
  id: string
  name: string
  city: string
  address: string
  phone: string
}

interface VehicleOption {
  id: string
  name: string
  plateNumber: string
  dailyRate: number
  branchId: string
  category: {
    name: string
  }
}

interface WalkInBookingFormProps {
  branches: BranchOption[]
  vehicles: VehicleOption[]
  userRole: UserRole
  staffBranchId: string | null
}

export default function WalkInBookingForm({
  branches,
  vehicles,
  userRole,
  staffBranchId
}: WalkInBookingFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Refs untuk auto-scroll otomatis ke atas saat terjadi error validasi
  const errorAlertRef = useRef<HTMLDivElement>(null)
  const formTopRef = useRef<HTMLDivElement>(null)

  const scrollToTopOrError = () => {
    setTimeout(() => {
      if (errorAlertRef.current) {
        errorAlertRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
        try {
          errorAlertRef.current.focus({ preventScroll: true })
        } catch {}
      } else if (formTopRef.current) {
        formTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else {
        const mainEl = document.querySelector('main')
        if (mainEl) {
          mainEl.scrollTo({ top: 0, behavior: 'smooth' })
        }
      }
    }, 50)
  }

  const showError = (msg: string) => {
    setError(msg)
    scrollToTopOrError()
  }

  useEffect(() => {
    if (error) {
      scrollToTopOrError()
    }
  }, [error])

  // 1. Customer State
  const [customerSearchQuery, setCustomerSearchQuery] = useState('')
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchFeedback, setSearchFeedback] = useState<string | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null)

  // New Customer Form State
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    email: '',
    phone: ''
  })
  const [isCreatingNewCustomer, setIsCreatingNewCustomer] = useState(false)

  // 2. Booking State
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    staffBranchId || branches[0]?.id || ''
  )
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('')
  const [rentalType, setRentalType] = useState<RentalType>('self_drive')

  // Tanggal & Jam (Default: hari ini dalam rentang jam operasional 08:00 - 21:00 WIB, min. 3.5 jam)
  const defaultStartDate = useMemo(() => {
    const d = new Date(Date.now() + 3.5 * 60 * 60 * 1000)
    d.setMinutes(0, 0, 0)
    if (d.getHours() >= 21) {
      d.setDate(d.getDate() + 1)
      d.setHours(9, 0, 0)
    } else if (d.getHours() < 8) {
      d.setHours(9, 0, 0)
    }
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hour = String(d.getHours()).padStart(2, '0')
    const minute = String(d.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hour}:${minute}`
  }, [])

  const defaultEndDate = useMemo(() => {
    const start = new Date(defaultStartDate)
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
    const year = end.getFullYear()
    const month = String(end.getMonth() + 1).padStart(2, '0')
    const day = String(end.getDate()).padStart(2, '0')
    const hour = String(end.getHours()).padStart(2, '0')
    const minute = String(end.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hour}:${minute}`
  }, [defaultStartDate])

  const [startDateStr, setStartDateStr] = useState(defaultStartDate)
  const [endDateStr, setEndDateStr] = useState(defaultEndDate)

  // 3. Discount State
  const [discountAmount, setDiscountAmount] = useState<string>('')
  const [discountReason, setDiscountReason] = useState<string>('')

  // 4. KYC File Upload State (Wajib Bukti Fisik & Terpusat di Bagian 5)
  const [ktpFile, setKtpFile] = useState<File | null>(null)
  const [simFile, setSimFile] = useState<File | null>(null)
  const [manualKtpNumber, setManualKtpNumber] = useState('')
  const [manualSimNumber, setManualSimNumber] = useState('')

  // Filter vehicles by selected branch
  const availableVehicles = useMemo(() => {
    return vehicles.filter((v) => v.branchId === selectedBranchId)
  }, [vehicles, selectedBranchId])

  const selectedVehicle = useMemo(() => {
    return vehicles.find((v) => v.id === selectedVehicleId)
  }, [vehicles, selectedVehicleId])

  // Price Calculation
  const priceBreakdown = useMemo(() => {
    if (!selectedVehicle || !startDateStr || !endDateStr) {
      return { days: 0, vehicleTotal: 0, driverTotal: 0, grandTotal: 0, finalPrice: 0 }
    }
    try {
      const start = new Date(startDateStr)
      const end = new Date(endDateStr)
      if (end <= start) {
        return { days: 0, vehicleTotal: 0, driverTotal: 0, grandTotal: 0, finalPrice: 0 }
      }
      const estimate = calculateEstimatedPrice(
        selectedVehicle.dailyRate,
        start,
        end,
        rentalType
      )
      const disc = Number(discountAmount) || 0
      const finalPrice = Math.max(0, estimate.grandTotal - disc)
      return {
        ...estimate,
        discount: disc,
        finalPrice
      }
    } catch {
      return { days: 0, vehicleTotal: 0, driverTotal: 0, grandTotal: 0, finalPrice: 0 }
    }
  }, [selectedVehicle, startDateStr, endDateStr, rentalType, discountAmount])

  const isDiscountAuthorized = userRole === 'admin_cabang' || userRole === 'admin_pusat'
  const maxAllowedDiscount = Math.floor(priceBreakdown.vehicleTotal * 0.3)
  const isDiscountOverLimit = Number(discountAmount) > maxAllowedDiscount

  // Handle Search Customer
  const handleSearchCustomer = async () => {
    const trimmed = customerSearchQuery.trim()
    if (!trimmed || trimmed.length < 3) {
      showError('Masukkan minimal 3 karakter untuk mencari pelanggan (Nama, HP, atau Email).')
      return
    }
    setIsSearchingCustomer(true)
    setError(null)
    setSearchFeedback(null)
    const res = await searchCustomerForWalkIn(trimmed)
    setIsSearchingCustomer(false)
    if (res.error) {
      showError(res.error)
    } else {
      const results = res.customers || []
      setSearchResults(results)
      if (results.length === 0) {
        setIsCreatingNewCustomer(true)
        setSearchFeedback(`Tidak ditemukan pelanggan dengan kueri "${trimmed}". Silakan lengkapi formulir pendaftaran di bawah.`)
        // Auto pre-fill new customer if query looks like phone, email, or name
        if (trimmed.includes('@')) {
          setNewCustomer((prev) => ({ ...prev, email: trimmed }))
        } else if (/^[0-9+\s-]+$/.test(trimmed)) {
          setNewCustomer((prev) => ({ ...prev, phone: trimmed }))
        } else {
          setNewCustomer((prev) => ({ ...prev, name: trimmed }))
        }
      }
    }
  }

  // Handle Reset / Ganti Customer
  const handleResetCustomer = () => {
    setSelectedCustomer(null)
    setIsCreatingNewCustomer(false)
    setSearchResults([])
    setSearchFeedback(null)
    setKtpFile(null)
    setSimFile(null)
    setManualKtpNumber('')
    setManualSimNumber('')
  }

  // Handle Submit Booking
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validasi Pelanggan
    if (!selectedCustomer && !isCreatingNewCustomer) {
      showError('Pilih pelanggan yang sudah ada atau lengkapi data pelanggan baru.')
      return
    }

    if (isCreatingNewCustomer) {
      if (!newCustomer.name || newCustomer.name.trim().length < 2) {
        showError('Nama pelanggan baru wajib diisi minimal 2 karakter.')
        return
      }
      if (!newCustomer.email || !newCustomer.email.includes('@')) {
        showError('Email pelanggan baru tidak valid.')
        return
      }
      if (!formatIndonesianPhoneNumber(newCustomer.phone)) {
        showError('Nomor HP pelanggan baru tidak valid (contoh: 08123456789).')
        return
      }
    }

    // Validasi Kendaraan & Jadwal
    if (!selectedVehicleId) {
      showError('Pilih armada kendaraan yang akan disewa.')
      return
    }

    const start = new Date(startDateStr)
    const end = new Date(endDateStr)
    if (end <= start) {
      showError('Waktu pengembalian harus setelah waktu penjemputan.')
      return
    }

    // Validasi Diskon
    const discNum = Number(discountAmount) || 0
    if (discNum < 0) {
      showError('Nominal diskon tidak boleh bernilai negatif.')
      return
    }
    if (discNum > 0) {
      if (!isDiscountAuthorized) {
        showError('Akses ditolak: Staf Cabang tidak berwenang memberikan diskon sewa.')
        return
      }
      if (!discountReason || discountReason.trim().length < 10) {
        showError('Alasan diskon wajib diisi minimal 10 karakter dengan konteks manajerial yang jelas.')
        return
      }
      if (discNum > maxAllowedDiscount) {
        showError(
          `Nilai diskon melebihi batas maksimum 30% dari tarif sewa mobil (Maksimal: Rp ${maxAllowedDiscount.toLocaleString('id-ID')}).`
        )
        return
      }
    }

    startTransition(async () => {
      try {
        let activeCustomerId = selectedCustomer?.id

        // 1. Resolve / Create Customer jika baru
        if (isCreatingNewCustomer || !activeCustomerId) {
          const custRes = await resolveOrCreateWalkInCustomer({
            name: newCustomer.name,
            email: newCustomer.email,
            phone: newCustomer.phone,
            ktpNumber: manualKtpNumber.trim() || null,
            simNumber: manualSimNumber.trim() || null
          })

          if (custRes.error || !custRes.customer) {
            showError(custRes.error || 'Gagal memproses data pelanggan.')
            return
          }
          activeCustomerId = custRes.customer.id
        }

        // 2. Upload Dokumen Fisik jika disediakan (Bukti Foto Wajib)
        if (ktpFile || simFile) {
          const docFormData = new FormData()
          docFormData.append('customerId', activeCustomerId)
          if (ktpFile) {
            docFormData.append('ktpFile', ktpFile)
            if (manualKtpNumber.trim()) {
              docFormData.append('ktpNumber', manualKtpNumber.trim())
            }
          }
          if (simFile) {
            docFormData.append('simFile', simFile)
            if (manualSimNumber.trim()) {
              docFormData.append('simNumber', manualSimNumber.trim())
            }
          }

          const uploadRes = await uploadWalkInDocumentsAction(docFormData)
          if (uploadRes.error) {
            showError(uploadRes.error)
            return
          }
        }

        // 3. Create Walk-in Booking Action (Strict Pricing + Cash Payment)
        const bookingRes = await createWalkInBookingAction({
          customerId: activeCustomerId,
          vehicleId: selectedVehicleId,
          branchId: selectedBranchId,
          startDate: start,
          endDate: end,
          rentalType,
          discountAmount: discNum > 0 ? discNum : null,
          discountReason: discNum > 0 ? discountReason.trim() : null
        })

        if (bookingRes.error || !bookingRes.bookingId) {
          showError(bookingRes.error || 'Gagal menerbitkan pesanan walk-in.')
          return
        }

        setSuccessMessage('Pesanan walk-in berhasil dibuat dan pembayaran kas telah dicatat!')
        router.push(`/admin/bookings/${bookingRes.bookingId}`)
      } catch (err: any) {
        showError(err.message || 'Terjadi kesalahan sistem saat memproses pemesanan.')
      }
    })
  }

  const isCustomerVerified = selectedCustomer?.verificationStatus === 'verified'

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Anchor untuk auto-scroll ke puncak form */}
      <div ref={formTopRef} className="scroll-mt-6" />

      {/* Alert Error / Success */}
      {error && (
        <div
          ref={errorAlertRef}
          tabIndex={-1}
          role="alert"
          aria-live="assertive"
          className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-3 shadow-sm outline-none animate-alert-slide scroll-mt-6"
        >
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-900">Terjadi Kesalahan</p>
            <p className="mt-0.5 text-red-800">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-700 p-1 rounded-md transition-colors cursor-pointer"
            title="Tutup peringatan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Berhasil</p>
            <p className="mt-0.5">{successMessage}</p>
          </div>
        </div>
      )}

      {/* SECTION 1: PELANGGAN */}
      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6">
        <div className="flex items-center gap-2 mb-4 border-b border-zinc-100 pb-3">
          <User className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-zinc-900">1. Identitas Pelanggan Walk-In</h2>
        </div>

        {/* Selected Customer Card */}
        {selectedCustomer ? (
          <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-zinc-900 text-base">{selectedCustomer.name}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    selectedCustomer.verificationStatus === 'verified'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  KYC: {selectedCustomer.verificationStatus}
                </span>
              </div>
              <p className="text-xs text-zinc-600 mt-1 font-mono">
                {selectedCustomer.phone} • {selectedCustomer.email}
              </p>
              {(selectedCustomer.ktpNumber || selectedCustomer.simNumber) && (
                <p className="text-xs text-zinc-500 mt-0.5 font-mono">
                  {selectedCustomer.ktpNumber ? `KTP: ${selectedCustomer.ktpNumber}` : ''}{' '}
                  {selectedCustomer.simNumber ? `| SIM: ${selectedCustomer.simNumber}` : ''}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleResetCustomer}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold px-3 py-1.5 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
            >
              Ganti Pelanggan
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Cari pelanggan terdaftar via Nama, No HP (08...), atau Email..."
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleSearchCustomer()
                    }
                  }}
                  className="w-full pl-9 pr-4 py-2 border border-zinc-300 rounded-lg text-sm bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSearchCustomer}
                  disabled={isSearchingCustomer}
                  className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-semibold hover:bg-zinc-800 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isSearchingCustomer ? 'Mencari...' : 'Cari'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingNewCustomer(true)
                    setSearchResults([])
                    setSearchFeedback(null)
                  }}
                  className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm font-semibold hover:bg-blue-100 transition-colors cursor-pointer whitespace-nowrap"
                >
                  + Pelanggan Baru
                </button>
              </div>
            </div>

            {/* Search Feedback Message */}
            {searchFeedback && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>{searchFeedback}</span>
              </div>
            )}

            {/* Search Results List */}
            {searchResults.length > 0 && !selectedCustomer && (
              <div className="border border-zinc-200 rounded-xl divide-y divide-zinc-100 overflow-hidden shadow-sm">
                <p className="p-2.5 bg-zinc-50 text-xs font-semibold text-zinc-600">
                  Hasil Pencarian ({searchResults.length}):
                </p>
                {searchResults.map((cust) => (
                  <div
                    key={cust.id}
                    onClick={() => {
                      setSelectedCustomer(cust)
                      setIsCreatingNewCustomer(false)
                      setSearchResults([])
                      setSearchFeedback(null)
                    }}
                    className="p-3 hover:bg-blue-50/50 cursor-pointer flex justify-between items-center transition-colors"
                  >
                    <div>
                      <span className="font-semibold text-sm text-zinc-900">{cust.name}</span>
                      <span className="ml-2 text-xs text-zinc-500 font-mono">
                        {cust.phone} • {cust.email}
                      </span>
                    </div>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                        cust.verificationStatus === 'verified'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-zinc-100 text-zinc-700'
                      }`}
                    >
                      {cust.verificationStatus}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* New Customer Inline Form */}
            {isCreatingNewCustomer && (
              <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                    Input Data Pelanggan Baru di Tempat
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingNewCustomer(false)
                      setSearchFeedback(null)
                    }}
                    className="text-xs text-zinc-500 hover:text-zinc-700 cursor-pointer"
                  >
                    Batal
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Nama Lengkap (Sesuai KTP) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Budi Santoso"
                      value={newCustomer.name}
                      onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-lg bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Nomor Handphone (WhatsApp) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: 08123456789"
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-lg bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Email Pelanggan *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="Contoh: budi@gmail.com"
                      value={newCustomer.email}
                      onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-lg bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-zinc-500">
                  Foto dan nomor dokumen fisik (KTP & SIM) akan didokumentasikan pada Bagian 5 di bawah.
                  Akun pelanggan akan dibuatkan otomatis dengan kredensial acak aman.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECTION 2: CABANG & ARMADA */}
      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6">
        <div className="flex items-center gap-2 mb-4 border-b border-zinc-100 pb-3">
          <Car className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-zinc-900">2. Pilihan Armada & Layanan</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {/* Cabang */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Cabang Operasional *
            </label>
            <select
              value={selectedBranchId}
              onChange={(e) => {
                setSelectedBranchId(e.target.value)
                setSelectedVehicleId('')
              }}
              disabled={userRole === 'staff_cabang' || userRole === 'admin_cabang'}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg bg-white text-zinc-900 disabled:bg-zinc-100 disabled:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.city})
                </option>
              ))}
            </select>
          </div>

          {/* Tipe Rental */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Jenis Layanan Sewa *
            </label>
            <select
              value={rentalType}
              onChange={(e) => setRentalType(e.target.value as RentalType)}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="self_drive">Lepas Kunci (Self-Drive)</option>
              <option value="with_driver">Dengan Sopir (+ Rp 150.000 / hari)</option>
            </select>
          </div>

          {/* Unit Kendaraan */}
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Pilih Kendaraan Tersedia *
            </label>
            {availableVehicles.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                Tidak ada unit armada yang berstatus tersedia di cabang ini saat ini.
              </div>
            ) : (
              <select
                required
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg bg-white text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">-- Pilih Unit Armada --</option>
                {availableVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {getVehicleDisplayName(v, { mode: 'staff' })} • {v.category.name} — Rp{' '}
                    {v.dailyRate.toLocaleString('id-ID')} / hari
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 3: JADWAL SEWA */}
      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6">
        <div className="flex items-center gap-2 mb-4 border-b border-zinc-100 pb-3">
          <Calendar className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-zinc-900">3. Jadwal Sewa (WIB)</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Waktu Penjemputan / Mulai Sewa *
            </label>
            <input
              type="datetime-local"
              required
              value={startDateStr}
              onChange={(e) => setStartDateStr(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              Jam operasional cabang: 08:00 – 21:00 WIB.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Waktu Pengembalian *
            </label>
            <input
              type="datetime-local"
              required
              value={endDateStr}
              onChange={(e) => setEndDateStr(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              Durasi dihitung dalam kelipatan 24 jam kalender.
            </p>
          </div>
        </div>

        {/* Real-time Date Range Validation */}
        {startDateStr && endDateStr && new Date(endDateStr) <= new Date(startDateStr) && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>Waktu pengembalian harus setelah waktu penjemputan.</span>
          </div>
        )}
      </div>

      {/* SECTION 4: RINCIAN BIAYA & DISKON KHUSUS */}
      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6">
        <div className="flex items-center gap-2 mb-4 border-b border-zinc-100 pb-3">
          <CreditCard className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-zinc-900">4. Rincian Biaya & Penerimaan Kas Tunai</h2>
        </div>

        {/* Diskon Khusus Field */}
        <div className="border border-zinc-200 rounded-xl p-4 bg-zinc-50/50 mb-6">
          <div className="flex items-center gap-1.5 mb-2">
            <Percent className="w-4 h-4 text-zinc-700" />
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-800">
              Diskon Khusus Transaksi Walk-In
            </span>
          </div>

          {!isDiscountAuthorized ? (
            <div className="p-3 bg-zinc-100 border border-zinc-200 rounded-lg text-xs text-zinc-600 flex items-start gap-2">
              <Info className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-zinc-800">Wewenang Terbatas:</span> Hanya{' '}
                <strong>Admin Cabang</strong> atau <strong>Admin Pusat</strong> yang berwenang
                memberikan diskon sewa di tempat.
              </div>
            </div>
          ) : !selectedVehicleId ? (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                Pilih unit armada di Bagian 2 terlebih dahulu untuk mengaktifkan batas diskon (plafon 30%).
              </div>
            </div>
          ) : (
            <div className="space-y-3 mt-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Nominal Diskon (Rp) — Maks. 30% (Rp {maxAllowedDiscount.toLocaleString('id-ID')})
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={maxAllowedDiscount}
                    placeholder="Contoh: 50000"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 ${
                      isDiscountOverLimit
                        ? 'border-red-400 focus:ring-red-500 focus:border-red-500'
                        : 'border-zinc-300 focus:ring-blue-500 focus:border-blue-500'
                    }`}
                  />
                  {isDiscountOverLimit && (
                    <p className="text-[11px] text-red-600 mt-1 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Diskon melebihi batas plafon 30% (Maks. Rp {maxAllowedDiscount.toLocaleString('id-ID')})
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Alasan Diskon (Wajib min. 10 karakter jika ada diskon)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Diskon loyalitas pelanggan korporat"
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {Number(discountAmount) > 0 && discountReason.trim().length < 10 && (
                    <p className="text-[11px] text-amber-600 mt-1">
                      Alasan diskon wajib minimal 10 karakter ({discountReason.trim().length}/10 karakter).
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pricing Summary Table */}
        <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200 text-sm space-y-2">
          <div className="flex justify-between text-zinc-600">
            <span>Durasi Sewa:</span>
            <span className="font-semibold text-zinc-900">{priceBreakdown.days} Hari</span>
          </div>
          <div className="flex justify-between text-zinc-600">
            <span>Biaya Sewa Unit Kendaraan:</span>
            <span className="font-mono text-zinc-900">
              Rp {priceBreakdown.vehicleTotal.toLocaleString('id-ID')}
            </span>
          </div>
          {rentalType === 'with_driver' && (
            <div className="flex justify-between text-zinc-600">
              <span>Biaya Layanan Sopir:</span>
              <span className="font-mono text-zinc-900">
                Rp {priceBreakdown.driverTotal.toLocaleString('id-ID')}
              </span>
            </div>
          )}
          <div className="flex justify-between text-zinc-800 font-semibold border-t border-zinc-200 pt-2">
            <span>Subtotal Tarif Sistem:</span>
            <span className="font-mono text-zinc-900">
              Rp {priceBreakdown.grandTotal.toLocaleString('id-ID')}
            </span>
          </div>

          {Number(discountAmount) > 0 && (
            <div className="flex justify-between text-emerald-700 font-semibold">
              <span>Potongan Diskon:</span>
              <span className="font-mono">- Rp {Number(discountAmount).toLocaleString('id-ID')}</span>
            </div>
          )}

          <div className="flex justify-between text-zinc-900 font-bold text-base border-t-2 border-zinc-300 pt-3">
            <span>Total Uang Kas Diterima di Meja:</span>
            <span className="text-blue-700 font-mono text-lg">
              Rp {priceBreakdown.finalPrice.toLocaleString('id-ID')}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 5: DOKUMENTASI FISIK KTP & SIM (WAJIB BUKTI FOTO) */}
      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6">
        <div className="flex items-center gap-2 mb-4 border-b border-zinc-100 pb-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-bold text-zinc-900">
            5. Dokumentasi Fisik KTP & SIM (Wajib Bukti Foto)
          </h2>
        </div>

        {isCustomerVerified ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-sm text-emerald-900">
              <p className="font-bold">Identitas & Dokumen Terverifikasi Lengkap (KYC Verified)</p>
              <p className="text-xs text-emerald-700 mt-0.5">
                Pelanggan telah memiliki foto fisik KTP & SIM yang sah di sistem. Kunci unit siap
                diserahterimakan segera setelah pembayaran kas dicatat.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Wajib Foto Dokumen Fisik:</span> Sesuai regulasi
                keamanan & mitigasi sengketa sewa, staf kasir wajib memfoto dan mengunggah fisik KTP
                dan SIM asli pelanggan. Kunci unit mobil tidak dapat diserahterimakan (Start Rental)
                jika status verifikasi dokumen belum lengkap.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* KTP Card */}
              <div className="border border-zinc-200 rounded-xl p-4 bg-zinc-50/50">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-blue-600" />
                    Foto KTP Asli Fisik
                  </label>
                  {selectedCustomer?.ktpNumber && (
                    <span className="text-[11px] text-zinc-500 font-mono">
                      No: {selectedCustomer.ktpNumber}
                    </span>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={(e) => setKtpFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-zinc-900 font-medium file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
                {ktpFile && (
                  <div className="mt-2 flex items-center justify-between text-xs bg-emerald-50 text-emerald-800 px-2.5 py-1.5 rounded-lg border border-emerald-200">
                    <span className="truncate max-w-[200px] font-medium">
                      ✓ {ktpFile.name} ({Math.round(ktpFile.size / 1024)} KB)
                    </span>
                    <button
                      type="button"
                      onClick={() => setKtpFile(null)}
                      className="text-emerald-700 hover:text-red-600 transition-colors cursor-pointer"
                      title="Hapus file"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {!selectedCustomer?.ktpNumber && (
                  <div className="mt-2">
                    <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                      Nomor KTP (16 digit NIK)
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: 3271012345678901"
                      value={manualKtpNumber}
                      onChange={(e) => setManualKtpNumber(e.target.value)}
                      className="w-full px-3 py-1.5 border border-zinc-300 rounded-lg text-xs bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                )}
              </div>

              {/* SIM Card */}
              <div className="border border-zinc-200 rounded-xl p-4 bg-zinc-50/50">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-blue-600" />
                    Foto SIM Asli Fisik
                  </label>
                  {selectedCustomer?.simNumber && (
                    <span className="text-[11px] text-zinc-500 font-mono">
                      No: {selectedCustomer.simNumber}
                    </span>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={(e) => setSimFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-zinc-900 font-medium file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
                {simFile && (
                  <div className="mt-2 flex items-center justify-between text-xs bg-emerald-50 text-emerald-800 px-2.5 py-1.5 rounded-lg border border-emerald-200">
                    <span className="truncate max-w-[200px] font-medium">
                      ✓ {simFile.name} ({Math.round(simFile.size / 1024)} KB)
                    </span>
                    <button
                      type="button"
                      onClick={() => setSimFile(null)}
                      className="text-emerald-700 hover:text-red-600 transition-colors cursor-pointer"
                      title="Hapus file"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {!selectedCustomer?.simNumber && (
                  <div className="mt-2">
                    <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                      Nomor SIM Aktif
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: 123456789012"
                      value={manualSimNumber}
                      onChange={(e) => setManualSimNumber(e.target.value)}
                      className="w-full px-3 py-1.5 border border-zinc-300 rounded-lg text-xs bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Peringatan error tepat di atas tombol submit jika kasir berada di bagian bawah formulir */}
      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between gap-3 shadow-sm animate-alert-slide">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span className="font-medium text-red-800">{error}</span>
          </div>
          <button
            type="button"
            onClick={scrollToTopOrError}
            className="text-xs font-semibold text-red-700 hover:text-red-900 underline flex items-center gap-1 shrink-0 cursor-pointer"
          >
            Lihat Detail di Atas ↑
          </button>
        </div>
      )}

      {/* SUBMIT BUTTON */}
      <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={isPending}
          className="px-5 py-2.5 bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-700 text-sm font-semibold rounded-lg transition-colors cursor-pointer"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm disabled:opacity-50 transition-colors flex items-center gap-2 cursor-pointer"
        >
          {isPending ? 'Menerbitkan Pesanan...' : 'Terima Kas Tunai & Terbitkan Pesanan'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </form>
  )
}
