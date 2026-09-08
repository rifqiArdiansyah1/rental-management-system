'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateFuelPrice, FuelPriceItem } from '@/actions/fuelPrice'
import { FUEL_TYPE_LABELS } from '@/lib/constants'
import { Fuel, Edit2, AlertCircle } from 'lucide-react'

export function EditFuelPriceModal({
  item,
  onClose,
}: {
  item: FuelPriceItem
  onClose: () => void
}) {
  const router = useRouter()
  const [price, setPrice] = useState(item.pricePerLiter.toString())
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const numPrice = Number(price)
    if (isNaN(numPrice) || numPrice <= 0) {
      setError('Harga per liter harus lebih besar dari 0')
      return
    }

    startTransition(async () => {
      setError(null)
      const res = await updateFuelPrice(item.fuelType, numPrice)
      if (res.error) {
        setError(res.error)
      } else {
        onClose()
        router.refresh()
      }
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-xl max-w-md w-full shadow-xl"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
            <Fuel className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-zinc-900">Perbarui Tarif BBM</h3>
            <p className="text-xs text-zinc-500">
              {FUEL_TYPE_LABELS[item.fuelType] || item.fuelType}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Harga per Liter (Rp) *
            </label>
            <input
              type="number"
              min="1"
              step="50"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Misal: 10000"
              className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <p className="font-semibold mb-0.5">ℹ️ Catatan Kebijakan (Opsi A)</p>
            <p>
              Tarif BBM ini murni digunakan sebagai dasar kalkulasi estimasi biaya perjalanan informasional bagi penyewa dan tim operasional. BBM tidak ditagihkan ke penyewa via invoice rental.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-2.5 bg-red-50 text-red-700 text-xs rounded-md border border-red-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-md transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            onClick={() => handleSubmit()}
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-md transition-colors disabled:opacity-50"
          >
            {isPending ? 'Menyimpan...' : 'Simpan Tarif'}
          </button>
        </div>
      </form>
    </div>
  )
}

export function FuelPricesTable({ prices }: { prices: FuelPriceItem[] }) {
  const [selectedItem, setSelectedItem] = useState<FuelPriceItem | null>(null)

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-600">
            <thead className="bg-zinc-50 text-zinc-900 font-medium border-b border-zinc-200">
              <tr>
                <th className="px-6 py-4">Jenis Bahan Bakar</th>
                <th className="px-6 py-4">Harga Acuan / Liter</th>
                <th className="px-6 py-4">Terakhir Diperbarui</th>
                <th className="px-6 py-4">Diperbarui Oleh</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {prices.map((item) => (
                <tr key={item.fuelType} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-zinc-900">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <span>{FUEL_TYPE_LABELS[item.fuelType] || item.fuelType}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono font-bold text-zinc-900 text-base">
                      {new Intl.NumberFormat('id-ID', {
                        style: 'currency',
                        currency: 'IDR',
                        maximumFractionDigits: 0,
                      }).format(item.pricePerLiter)}
                    </span>
                    <span className="text-xs text-zinc-500 ml-1">/ Liter</span>
                  </td>
                  <td className="px-6 py-4 text-xs text-zinc-500">
                    {new Intl.DateTimeFormat('id-ID', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(item.updatedAt))}
                  </td>
                  <td className="px-6 py-4 text-xs text-zinc-600">
                    {item.updaterName || item.updatedBy || 'Sistem (Default Baseline)'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setSelectedItem(item)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-md transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Edit Tarif
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedItem && (
        <EditFuelPriceModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </>
  )
}
