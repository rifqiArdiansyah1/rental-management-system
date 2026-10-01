'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  searchCustomerForWalkIn,
  resolveOrCreateWalkInCustomer,
  createWalkInBookingAction
} from '@/actions/walkInBooking'
import { calculateEstimatedPrice } from '@/lib/pricing'
import { formatIndonesianPhoneNumber } from '@/utils/whatsapp'
import {
  User,
  Car,
  Calendar,
  CreditCard,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Percent,
  MapPin,
  ArrowRight,
  Info
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

  // 1. Customer State
  const [customerSearchQuery, setCustomerSearchQuery] = useState('')
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null)

  // New Customer Form State (if not selecting existing)
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    email: '',
    phone: '',
    ktpNumber: '',
    simNumber: ''
  })
  const [isCreatingNewCustomer, setIsCreatingNewCustomer] = useState(false)

  // 2. Booking State
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    staffBranchId || branches[0]?.id || ''
  )
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('')
  const [rentalType, setRentalType] = useState<RentalType>('self_drive')

  // Tanggal & Jam (Default: hari ini + 3 jam, jam berikutnya yang bulat)
  const defaultStartDate = useMemo(() => {
    const d = new Date(Date.now() + 3.5 * 60 * 60 * 1000)
    d.setMinutes(0, 0, 0)
    // Format YYYY-MM-DDTHH:mm
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hour = String(d.getHours()).padStart(2, '0')
    const minute = String(d.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hour}:${minute}`
  }, [])

  const defaultEndDate = useMemo(() => {
    const d = new Date(Date.now() + 27.5 * 60 * 60 * 1000)
    d.setMinutes(0, 0, 0)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hour = String(d.getHours()).padStart(2, '0')
    const minute = String(d.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hour}:${minute}`
  }, [])

  const [startDateStr, setStartDateStr] = useState(defaultStartDate)
  const [endDateStr, setEndDateStr] = useState(defaultEndDate)

  // 3. Discount State
  const [discountAmount, setDiscountAmount] = useState<string>('')
  const [discountReason, setDiscountReason] = useState<string>('')

  // 4. KYC State
  const [verifyOnTheSpot, setVerifyOnTheSpot] = useState(true)

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

  // Handle Search Customer
  const handleSearchCustomer = async () => {
    if (!customerSearchQuery.trim() || customerSearchQuery.trim().length < 3) {
      setError('Masukkan minimal 3 karakter untuk mencari pelanggan (Nama, HP, atau Email).')
      return
    }
    setIsSearchingCustomer(true)
    setError(null)
    const res = await searchCustomerForWalkIn(customerSearchQuery)
    setIsSearchingCustomer(false)
    if (res.error) {
      setError(res.error)
    } else {
      setSearchResults(res.customers || [])
      if (!res.customers || res.customers.length === 0) {
        setIsCreatingNewCustomer(true)
      }
    }
  }

  // Handle Submit Booking
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validasi Pelanggan
    if (!selectedCustomer && !isCreatingNewCustomer) {
      setError('Pilih pelanggan yang sudah ada atau lengkapi data pelanggan baru.')
      return
    }

    if (isCreatingNewCustomer) {
      if (!newCustomer.name || newCustomer.name.trim().length < 2) {
        setError('Nama pelanggan baru wajib diisi minimal 2 karakter.')
        return
      }
      if (!newCustomer.email || !newCustomer.email.includes('@')) {
        setError('Email pelanggan baru tidak valid.')
        return
      }
      if (!formatIndonesianPhoneNumber(newCustomer.phone)) {
        setError('Nomor HP pelanggan baru tidak valid (contoh: 08123456789).')
        return
      }
    }

    // Validasi Kendaraan & Jadwal
    if (!selectedVehicleId) {
      setError('Pilih armada yang akan disewa.')
      return
    }

    const start = new Date(startDateStr)
    const end = new Date(endDateStr)
    if (end <= start) {
      setError('Waktu pengembalian harus setelah waktu penjemputan.')
      return
    }

    // Validasi Diskon
    const discNum = Number(discountAmount) || 0
    if (discNum > 0) {
      if (!isDiscountAuthorized) {
        setError('Akses ditolak: Staf Cabang tidak berwenang memberikan diskon sewa.')
        return
      }
      if (!discountReason || discountReason.trim().length < 5) {
        setError('Alasan diskon wajib diisi minimal 5 karakter.')
        return
      }
      if (discNum >= priceBreakdown.grandTotal) {
        setError('Nilai diskon tidak boleh melebihi atau menyamai total biaya sewa.')
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
            ktpNumber: newCustomer.ktpNumber || null,
            simNumber: newCustomer.simNumber || null
          })

          if (custRes.error || !custRes.customer) {
            setError(custRes.error || 'Gagal memproses data pelanggan.')
            return
          }
          activeCustomerId = custRes.customer.id
        }

        // 2. Create Walk-in Booking Action
        const bookingRes = await createWalkInBookingAction({
          customerId: activeCustomerId,
          vehicleId: selectedVehicleId,
          branchId: selectedBranchId,
          startDate: start,
          endDate: end,
          rentalType,
          discountAmount: discNum > 0 ? discNum : null,
          discountReason: discNum > 0 ? discountReason.trim() : null,
          verifyDocumentsOnTheSpot: verifyOnTheSpot
        })

        if (bookingRes.error || !bookingRes.bookingId) {
          setError(bookingRes.error || 'Gagal menerbitkan pesanan walk-in.')
          return
        }

        setSuccessMessage('Pesanan walk-in berhasil dibuat dan pembayaran kas telah dicatat!')
        router.push(`/admin/bookings/${bookingRes.bookingId}`)
      } catch (err: any) {
        setError(err.message || 'Terjadi kesalahan sistem saat memproses pemesanan.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Alert Error / Success */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Terjadi Kesalahan</p>
            <p className="mt-0.5">{error}</p>
          </div>
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
              onClick={() => {
                setSelectedCustomer(null)
                setIsCreatingNewCustomer(false)
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold px-3 py-1.5 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
            >
              Ganti Pelanggan
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Cari nomor HP, email, atau nama pelanggan..."
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleSearchCustomer()
                    }
                  }}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="button"
                onClick={handleSearchCustomer}
                disabled={isSearchingCustomer}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-900 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {isSearchingCustomer ? 'Mencari...' : 'Cari'}
              </button>
            </div>

            {/* Search Results Dropdown/List */}
            {searchResults.length > 0 && (
              <div className="border border-zinc-200 rounded-lg divide-y divide-zinc-100 max-h-56 overflow-y-auto">
                {searchResults.map((cust) => (
                  <div
                    key={cust.id}
                    onClick={() => {
                      setSelectedCustomer(cust)
                      setIsCreatingNewCustomer(false)
                      setSearchResults([])
                    }}
                    className="p-3 hover:bg-zinc-50 cursor-pointer flex justify-between items-center transition-colors text-sm"
                  >
                    <div>
                      <div className="font-semibold text-zinc-900">{cust.name}</div>
                      <div className="text-xs text-zinc-500 font-mono">
                        {cust.phone} • {cust.email}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      Pilih
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Toggle New Customer Button */}
            <div className="pt-2">
              {!isCreatingNewCustomer ? (
                <button
                  type="button"
                  onClick={() => setIsCreatingNewCustomer(true)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  + Pelanggan baru belum terdaftar? Input data baru di sini
                </button>
              ) : (
                <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                      Formulir Pelanggan Baru
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsCreatingNewCustomer(false)}
                      className="text-xs text-zinc-500 hover:text-zinc-700 underline"
                    >
                      Batal
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 mb-1">
                        Nama Lengkap *
                      </label>
                      <input
                        type="text"
                        required
                        value={newCustomer.name}
                        onChange={(e) =>
                          setNewCustomer({ ...newCustomer, name: e.target.value })
                        }
                        placeholder="Nama sesuai KTP"
                        className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 mb-1">
                        Nomor WhatsApp / HP *
                      </label>
                      <input
                        type="text"
                        required
                        value={newCustomer.phone}
                        onChange={(e) =>
                          setNewCustomer({ ...newCustomer, phone: e.target.value })
                        }
                        placeholder="Contoh: 08123456789"
                        className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 mb-1">Email *</label>
                      <input
                        type="email"
                        required
                        value={newCustomer.email}
                        onChange={(e) =>
                          setNewCustomer({ ...newCustomer, email: e.target.value })
                        }
                        placeholder="email@example.com"
                        className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 mb-1">
                        Nomor KTP (Opsional)
                      </label>
                      <input
                        type="text"
                        value={newCustomer.ktpNumber}
                        onChange={(e) =>
                          setNewCustomer({ ...newCustomer, ktpNumber: e.target.value })
                        }
                        placeholder="16 digit NIK"
                        className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-zinc-600 mb-1">
                        Nomor SIM A (Opsional)
                      </label>
                      <input
                        type="text"
                        value={newCustomer.simNumber}
                        onChange={(e) =>
                          setNewCustomer({ ...newCustomer, simNumber: e.target.value })
                        }
                        placeholder="Nomor SIM pengemudi"
                        className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-500 italic">
                    * Akun autentikasi aman akan dibuatkan otomatis. Pelanggan dapat mengatur kata
                    sandi mandiri via tautan email pemulihan.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: ARMADA & CABANG */}
      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6">
        <div className="flex items-center gap-2 mb-4 border-b border-zinc-100 pb-3">
          <Car className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-zinc-900">2. Pilihan Cabang & Armada</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {/* Cabang */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Cabang Layanan *</label>
            <select
              value={selectedBranchId}
              onChange={(e) => {
                setSelectedBranchId(e.target.value)
                setSelectedVehicleId('')
              }}
              disabled={userRole === 'staff_cabang' || userRole === 'admin_cabang'}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg bg-white disabled:bg-zinc-100"
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
            <label className="block text-xs font-medium text-zinc-700 mb-1">Jenis Layanan *</label>
            <select
              value={rentalType}
              onChange={(e) => setRentalType(e.target.value as RentalType)}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg bg-white"
            >
              <option value="self_drive">Lepas Kunci (Self-Drive)</option>
              <option value="with_driver">Dengan Sopir (+ Rp 150.000 / hari)</option>
            </select>
          </div>

          {/* Unit Kendaraan */}
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-zinc-700 mb-1">Pilih Kendaraan Tersedia *</label>
            {availableVehicles.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                Tidak ada unit armada yang berstatus tersedia di cabang ini saat ini.
              </div>
            ) : (
              <select
                required
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg bg-white font-medium"
              >
                <option value="">-- Pilih Unit Armada --</option>
                {availableVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.plateNumber}) • {v.category.name} — Rp{' '}
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
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
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
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              Durasi dihitung dalam kelipatan 24 jam kalender.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 4: RINCIAN BIAYA & DISKON KHUSUS */}
      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6">
        <div className="flex items-center gap-2 mb-4 border-b border-zinc-100 pb-3">
          <CreditCard className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-zinc-900">4. Rincian Biaya & Penerimaan Kas Tunai</h2>
        </div>

        {/* Pricing Summary Table */}
        <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200 text-sm space-y-2 mb-6">
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

        {/* Diskon Khusus Field */}
        <div className="border border-zinc-200 rounded-xl p-4 bg-zinc-50/50">
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
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mt-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Nominal Diskon (Rp)
                </label>
                <input
                  type="number"
                  min="0"
                  max={Math.max(0, priceBreakdown.grandTotal - 1)}
                  placeholder="Contoh: 50000"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Alasan Diskon (Wajib min. 5 karakter jika ada diskon)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Promo negosiasi walk-in akhir pekan"
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg bg-white"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 5: VERIFIKASI FISIK & SERAH TERIMA */}
      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6">
        <div className="flex items-center gap-2 mb-4 border-b border-zinc-100 pb-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-bold text-zinc-900">5. Verifikasi Fisik & SOP Kasir</h2>
        </div>

        <label className="flex items-start gap-3 p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl cursor-pointer">
          <input
            type="checkbox"
            checked={verifyOnTheSpot}
            onChange={(e) => setVerifyOnTheSpot(e.target.checked)}
            className="w-4 h-4 text-emerald-600 rounded mt-0.5"
          />
          <div className="text-xs text-zinc-700">
            <span className="font-semibold text-zinc-900 block mb-0.5">
              Verifikasi Fisik KTP & SIM Asli di Tempat
            </span>
            Staf telah memeriksa keaslian KTP dan SIM pelanggan secara langsung di meja kasir.
            Status KYC pelanggan akan otomatis ditandai sebagai <strong>Verified</strong> agar unit
            dapat segera diserahterimakan (Start Rental).
          </div>
        </label>
      </div>

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
          disabled={isPending || !selectedVehicleId}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm disabled:opacity-50 transition-colors flex items-center gap-2 cursor-pointer"
        >
          {isPending ? 'Menerbitkan Pesanan...' : 'Terima Kas Tunai & Terbitkan Pesanan'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </form>
  )
}
