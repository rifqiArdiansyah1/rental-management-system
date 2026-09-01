import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Link from 'next/link'
import { FileCheck, AlertCircle, Clock, Car, RefreshCw } from 'lucide-react'

export const metadata = {
  title: 'Syarat & Ketentuan Sewa | Prestige Motion',
  description: 'Syarat dan ketentuan resmi penyewaan kendaraan premium dan armada mewah di Prestige Motion.'
}

export default function TermsOfServicePage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-on-surface">
      <Navbar />

      <main className="flex-grow py-16 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto w-full">
        {/* Header Breadcrumb & Title */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="flex items-center gap-2 text-xs font-label-caps uppercase tracking-wider text-secondary mb-3">
            <Link href="/" className="hover:underline">Home</Link>
            <span>/</span>
            <span>Legal</span>
            <span>/</span>
            <span className="text-zinc-400">Syarat & Ketentuan</span>
          </div>
          <h1 className="font-display-lg text-3xl md:text-5xl text-on-surface font-bold tracking-tight mb-4">
            Syarat & Ketentuan Penyewaan
          </h1>
          <p className="font-body-md text-on-surface-variant text-base md:text-lg leading-relaxed">
            Harap membaca syarat dan ketentuan berikut sebelum melakukan reservasi kendaraan di Prestige Motion. Dengan melakukan pemesanan, Anda menyetujui seluruh ketentuan operasional di bawah ini.
          </p>
        </div>

        {/* Content Body */}
        <div className="max-w-4xl mx-auto space-y-10 font-body-md text-on-surface-variant leading-relaxed text-sm md:text-base">
          
          {/* Section 1: Pemesanan & Pembayaran */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-secondary font-semibold text-lg md:text-xl">
              <Clock className="w-6 h-6 text-secondary flex-shrink-0" />
              <h2 className="text-on-surface">1. Prosedur Reservasi & Batas Waktu Pembayaran</h2>
            </div>
            <ul className="list-disc pl-6 space-y-2 text-zinc-300">
              <li>
                Sistem pemesanan online aktif 24 jam setiap hari melalui portal resmi Prestige Motion.
              </li>
              <li>
                Setiap reservasi yang berstatus <code className="text-xs bg-zinc-800 text-amber-300 px-1.5 py-0.5 rounded">Menunggu Pembayaran (Pending Payment)</code> memiliki batas waktu penyelesaian pembayaran selama <strong>1 (satu) jam</strong>.
              </li>
              <li>
                Apabila pembayaran tidak diselesaikan dalam 1 jam, sistem otomatis membatalkan pesanan untuk membebaskan ketersediaan unit bagi pelanggan lain.
              </li>
            </ul>
          </section>

          {/* Section 2: Verifikasi Identitas (KYC) */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-secondary font-semibold text-lg md:text-xl">
              <FileCheck className="w-6 h-6 text-secondary flex-shrink-0" />
              <h2 className="text-on-surface">2. Verifikasi Dokumen & Identitas (KYC)</h2>
            </div>
            <p>
              Untuk keamanan dan kepatuhan polis asuransi, penyewa wajib melengkapi:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-zinc-300">
              <li>
                <strong>Foto e-KTP Asli</strong> yang masih berlaku.
              </li>
              <li>
                <strong>Foto SIM A / B Asli</strong> yang masih berlaku sesuai jenis kendaraan yang disewa.
              </li>
              <li>
                Serah terima kunci atau keberangkatan bersama pengemudi hanya dapat diproses setelah dokumen dinyatakan <code className="text-xs bg-zinc-800 text-emerald-400 px-1.5 py-0.5 rounded">Terverifikasi (Verified)</code> oleh staf cabang terkait.
              </li>
            </ul>
          </section>

          {/* Section 3: Jenis Layanan Sewa */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-secondary font-semibold text-lg md:text-xl">
              <Car className="w-6 h-6 text-secondary flex-shrink-0" />
              <h2 className="text-on-surface">3. Ketentuan Lepas Kunci vs Dengan Sopir</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-surface-container-low/60 border border-surface-variant/40 rounded-lg p-5">
                <h3 className="text-secondary font-semibold mb-2">Lepas Kunci (Self Drive)</h3>
                <p className="text-xs md:text-sm text-zinc-300 leading-relaxed">
                  Penyewa bertanggung jawab penuh atas pengoperasian kendaraan, bahan bakar, serta keselamatan armada selama masa sewa berlangsung sesuai wilayah izin operasi cabang.
                </p>
              </div>
              <div className="bg-surface-container-low/60 border border-surface-variant/40 rounded-lg p-5">
                <h3 className="text-secondary font-semibold mb-2">Dengan Sopir (With Driver)</h3>
                <p className="text-xs md:text-sm text-zinc-300 leading-relaxed">
                  Sopir profesional bersertifikasi akan ditugaskan ke pesanan Anda. Biaya sewa telah mencakup jasa pengemudi sesuai durasi jadwal yang dipesan.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4: Jeda Operasional & Pengembalian */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-secondary font-semibold text-lg md:text-xl">
              <RefreshCw className="w-6 h-6 text-secondary flex-shrink-0" />
              <h2 className="text-on-surface">4. Jeda Detailing 3 Jam & Pengembalian Armada</h2>
            </div>
            <ul className="list-disc pl-6 space-y-2 text-zinc-300">
              <li>
                Setiap armada mendapatkan <strong>buffer proteksi 3 jam</strong> setelah pengembalian untuk keperluan inspeksi teknis 21 titik, pencucian menyeluruh, dan sanitasi kabin.
              </li>
              <li>
                Pengembalian unit wajib dilakukan di cabang tujuan pengembalian sesuai jadwal pesanan paling lambat pada jam operasional cabang (08:00 – 21:00 WIB).
              </li>
              <li>
                Keterlambatan pengembalian tanpa konfirmasi tertulis sebelumnya dapat dikenakan denda keterlambatan per jam sesuai tarif armada terkait.
              </li>
            </ul>
          </section>

          {/* Section 5: Kebijakan Pembatalan & Force Cancel */}
          <section className="bg-surface-container-low/60 border border-surface-variant/40 rounded-xl p-6 md:p-8 space-y-4">
            <div className="flex items-center gap-3 text-secondary font-semibold text-lg md:text-xl">
              <AlertCircle className="w-6 h-6 text-secondary flex-shrink-0" />
              <h2 className="text-on-surface">5. Kebijakan Pembatalan & Pengembalian Dana</h2>
            </div>
            <ul className="list-disc pl-6 space-y-2 text-zinc-300 text-sm">
              <li>
                Pembatalan oleh pelanggan dapat diajukan dengan menghubungi staf cabang sebelum masa sewa dimulai.
              </li>
              <li>
                Prestige Motion berhak membatalkan pesanan secara sepihak (*Force Cancel*) apabila ditemukan pemalsuan identitas, dokumen tidak sah, atau indikasi pelanggaran hukum.
              </li>
              <li>
                Kebijakan pengembalian dana (*refund*) diproses sesuai ketentuan pembatalan dan verifikasi administrasi kantor pusat dalam waktu 3–5 hari kerja.
              </li>
            </ul>
          </section>

        </div>
      </main>

      <Footer />
    </div>
  )
}
