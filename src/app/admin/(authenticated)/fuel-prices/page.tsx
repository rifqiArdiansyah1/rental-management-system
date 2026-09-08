import { redirect } from 'next/navigation'
import { requireAdminSession } from '@/actions/admin'
import { getFuelPrices } from '@/actions/fuelPrice'
import { FuelPricesTable } from './ClientActions'
import { Fuel, Info } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AdminFuelPricesPage() {
  const adminUser = await requireAdminSession()

  // Strict allowlist: only admin_pusat can manage fuel prices
  if (adminUser.role !== 'admin_pusat') {
    redirect('/admin/dashboard')
  }

  const prices = await getFuelPrices()

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
              <Fuel className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
                Tarif Bahan Bakar Minyak (BBM)
              </h1>
              <p className="text-sm text-zinc-500">
                Kelola acuan harga BBM untuk estimasi biaya perjalanan rental.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Kebijakan Opsi A Banner */}
      <div className="mb-6 p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-xs md:text-sm text-amber-900 space-y-1">
          <p className="font-semibold text-amber-950">
            Kebijakan Operasional: Estimasi Biaya Perjalanan (Opsi A)
          </p>
          <p className="text-amber-800 leading-relaxed">
            Tarif per liter yang dikonfigurasi di bawah ini merupakan acuan pasar untuk menghitung{' '}
            <strong>estimasi biaya BBM informasional</strong> bagi calon penyewa di halaman katalog publik dan pencatatan riil operasional trip bagi tim admin/CS. Biaya BBM dan tarif tol sepenuhnya ditanggung langsung oleh penyewa di luar tagihan rental.
          </p>
        </div>
      </div>

      {/* Fuel Prices Table */}
      <FuelPricesTable prices={prices} />
    </div>
  )
}
