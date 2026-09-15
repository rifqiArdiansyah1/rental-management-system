import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Link from 'next/link'
import { FileCheck, AlertCircle, Clock, Car, RefreshCw } from 'lucide-react'
import { getLocale, getDictionary } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Syarat & Ketentuan Sewa | Prestige Motion',
  description: 'Syarat dan ketentuan resmi penyewaan kendaraan premium dan armada mewah di Prestige Motion.'
}

export default async function TermsOfServicePage() {
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const isEn = locale === 'en'

  return (
    <div className="flex flex-col min-h-screen bg-background text-on-surface">
      <Navbar />

      <main className="flex-grow py-16 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto w-full">
        {/* Header Breadcrumb & Title */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="flex items-center gap-2 text-xs font-label-caps uppercase tracking-wider text-secondary mb-3">
            <Link href="/" className="hover:underline">{dict.nav.home}</Link>
            <span>/</span>
            <span>Legal</span>
            <span>/</span>
            <span className="text-zinc-400">{dict.footer.termsOfService}</span>
          </div>
          <h1 className="font-display-lg text-3xl md:text-5xl text-on-surface font-bold tracking-tight mb-4">
            {isEn ? 'Terms & Conditions of Rental' : 'Syarat & Ketentuan Penyewaan'}
          </h1>
          <p className="font-body-md text-on-surface-variant text-base md:text-lg leading-relaxed mb-6">
            {isEn
              ? 'Please review these terms and conditions carefully prior to confirming a vehicle reservation with Prestige Motion. By submitting a booking, you agree to comply with all operational guidelines set forth herein.'
              : 'Harap membaca syarat dan ketentuan berikut sebelum melakukan reservasi kendaraan di Prestige Motion. Dengan melakukan pemesanan, Anda menyetujui seluruh ketentuan operasional di bawah ini.'}
          </p>

          {/* Notice of Governing Language */}
          {isEn && (
            <div 
              className="bg-amber-500/10 border border-amber-500/30 text-amber-200 p-5 rounded-xl text-xs md:text-sm leading-relaxed" 
              data-testid="governing-language-notice"
            >
              <p className="font-semibold text-amber-300 mb-1">
                Notice of Governing Language
              </p>
              <p>
                {dict.legal.governingNoticeContent}
              </p>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="max-w-4xl mx-auto space-y-10 font-body-md text-on-surface-variant leading-relaxed text-sm md:text-base">
          
          {/* Section 1: Pemesanan & Pembayaran */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-secondary font-semibold text-lg md:text-xl">
              <Clock className="w-6 h-6 text-secondary flex-shrink-0" />
              <h2 className="text-on-surface">
                {isEn ? '1. Reservation Procedure & Payment Window' : '1. Prosedur Reservasi & Batas Waktu Pembayaran'}
              </h2>
            </div>
            <ul className="list-disc pl-6 space-y-2 text-zinc-300">
              <li>
                {isEn
                  ? 'Digital reservations operate 24 hours daily via the official Prestige Motion portal.'
                  : 'Sistem pemesanan online aktif 24 jam setiap hari melalui portal resmi Prestige Motion.'}
              </li>
              <li>
                {isEn ? (
                  <>
                    Reservations held in <code className="text-xs bg-zinc-800 text-amber-300 px-1.5 py-0.5 rounded">Pending Payment</code> status must be settled within <strong>1 (one) hour</strong>.
                  </>
                ) : (
                  <>
                    Setiap reservasi yang berstatus <code className="text-xs bg-zinc-800 text-amber-300 px-1.5 py-0.5 rounded">Menunggu Pembayaran (Pending Payment)</code> memiliki batas waktu penyelesaian pembayaran selama <strong>1 (satu) jam</strong>.
                  </>
                )}
              </li>
              <li>
                {isEn
                  ? 'Unsettled bookings expire automatically after 1 hour to release unit inventory for other clients.'
                  : 'Apabila pembayaran tidak diselesaikan dalam 1 jam, sistem otomatis membatalkan pesanan untuk membebaskan ketersediaan unit bagi pelanggan lain.'}
              </li>
            </ul>
          </section>

          {/* Section 2: Verifikasi Identitas (KYC) */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-secondary font-semibold text-lg md:text-xl">
              <FileCheck className="w-6 h-6 text-secondary flex-shrink-0" />
              <h2 className="text-on-surface">
                {isEn ? '2. Identity Verification & Credential Review (KYC)' : '2. Verifikasi Dokumen & Identitas (KYC)'}
              </h2>
            </div>
            <p>
              {isEn
                ? 'To ensure driver safety, compliance, and insurance validity, clients must provide:'
                : 'Untuk keamanan dan kepatuhan polis asuransi, penyewa wajib melengkapi:'}
            </p>
            <ul className="list-disc pl-6 space-y-2 text-zinc-300">
              <li>
                <strong>{isEn ? 'Original National ID or Passport' : 'Foto e-KTP Asli'}</strong> {isEn ? 'with current legal validity.' : 'yang masih berlaku.'}
              </li>
              <li>
                <strong>{isEn ? 'Original Valid Driver License' : 'Foto SIM A / B Asli'}</strong> {isEn ? 'corresponding to the rented vehicle category.' : 'yang masih berlaku sesuai jenis kendaraan yang disewa.'}
              </li>
              <li>
                {isEn ? (
                  <>
                    Vehicle handover or chauffeur departure can only take place once documents are confirmed as <code className="text-xs bg-zinc-800 text-emerald-400 px-1.5 py-0.5 rounded">Verified</code> by operations staff.
                  </>
                ) : (
                  <>
                    Serah terima kunci atau keberangkatan bersama pengemudi hanya dapat diproses setelah dokumen dinyatakan <code className="text-xs bg-zinc-800 text-emerald-400 px-1.5 py-0.5 rounded">Terverifikasi (Verified)</code> oleh staf cabang terkait.
                  </>
                )}
              </li>
            </ul>
          </section>

          {/* Section 3: Jenis Layanan Sewa */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-secondary font-semibold text-lg md:text-xl">
              <Car className="w-6 h-6 text-secondary flex-shrink-0" />
              <h2 className="text-on-surface">
                {isEn ? '3. Autonomous (Self-Drive) vs Chauffeur Services' : '3. Ketentuan Lepas Kunci vs Dengan Sopir'}
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-surface-container-low/60 border border-surface-variant/40 rounded-lg p-5">
                <h3 className="text-secondary font-semibold mb-2">
                  {dict.booking.selfDrive}
                </h3>
                <p className="text-xs md:text-sm text-zinc-300 leading-relaxed">
                  {isEn
                    ? 'The client assumes full responsibility for vehicle handling, fuel refills, and vehicle safety throughout the itinerary within approved regional parameters.'
                    : 'Penyewa bertanggung jawab penuh atas pengoperasian kendaraan, bahan bakar, serta keselamatan armada selama masa sewa berlangsung sesuai wilayah izin operasi cabang.'}
                </p>
              </div>
              <div className="bg-surface-container-low/60 border border-surface-variant/40 rounded-lg p-5">
                <h3 className="text-secondary font-semibold mb-2">
                  {dict.booking.withDriver}
                </h3>
                <p className="text-xs md:text-sm text-zinc-300 leading-relaxed">
                  {isEn
                    ? 'An executive certified chauffeur is assigned to your itinerary. Rental charges include professional chauffeur services for the booked schedule.'
                    : 'Sopir profesional bersertifikasi akan ditugaskan ke pesanan Anda. Biaya sewa telah mencakup jasa pengemudi sesuai durasi jadwal yang dipesan.'}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-surface-container-low/80 border border-secondary/20 text-xs md:text-sm text-zinc-300 leading-relaxed space-y-2">
              <p className="font-semibold text-secondary flex items-center gap-1.5">
                <Car className="w-4 h-4 text-secondary" />
                {isEn ? 'Fuel (BBM), Tolls & Parking Expenses (Policy Option A)' : 'Ketentuan Bahan Bakar (BBM) & Tol (Kebijakan Opsi A)'}
              </p>
              <p>
                {isEn
                  ? 'All rental rates published on Prestige Motion (for both Self-Drive and Chauffeur services) exclude fuel consumption, expressway tolls, and parking surcharges. These operational costs are directly borne by the client throughout the itinerary.'
                  : 'Seluruh tarif sewa kendaraan yang tertera di situs Prestige Motion (baik layanan Lepas Kunci maupun Dengan Sopir) belum termasuk biaya bahan bakar (BBM), tarif jalan tol, biaya parkir, dan retribusi jalan lainnya. Seluruh pengeluaran tersebut ditanggung langsung oleh penyewa selama perjalanan di luar tagihan rental.'}
              </p>
            </div>
          </section>

          {/* Section 4: Jeda Operasional & Pengembalian */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-secondary font-semibold text-lg md:text-xl">
              <RefreshCw className="w-6 h-6 text-secondary flex-shrink-0" />
              <h2 className="text-on-surface">
                {isEn ? '4. 3-Hour Detailing Buffer & Vehicle Return' : '4. Jeda Detailing 3 Jam & Pengembalian Armada'}
              </h2>
            </div>
            <ul className="list-disc pl-6 space-y-2 text-zinc-300">
              <li>
                {isEn
                  ? 'Every vehicle receives a mandatory 3-hour inspection and sanitization buffer post-return prior to subsequent release.'
                  : 'Setiap armada mendapatkan buffer proteksi 3 jam setelah pengembalian untuk keperluan inspeksi teknis 21 titik, pencucian menyeluruh, dan sanitasi kabin.'}
              </li>
              <li>
                {isEn
                  ? 'Returns must take place at the designated branch by the scheduled time within branch hours (08:00 – 21:00 WIB).'
                  : 'Pengembalian unit wajib dilakukan di cabang tujuan pengembalian sesuai jadwal pesanan paling lambat pada jam operasional cabang (08:00 – 21:00 WIB).'}
              </li>
              <li>
                {isEn
                  ? 'Unauthorized late returns are subject to hourly late penalty charges according to the vehicle rate category.'
                  : 'Keterlambatan pengembalian tanpa konfirmasi tertulis sebelumnya dapat dikenakan denda keterlambatan per jam sesuai tarif armada terkait.'}
              </li>
            </ul>
          </section>

          {/* Section 5: Kebijakan Pembatalan & Force Cancel */}
          <section className="bg-surface-container-low/60 border border-surface-variant/40 rounded-xl p-6 md:p-8 space-y-4">
            <div className="flex items-center gap-3 text-secondary font-semibold text-lg md:text-xl">
              <AlertCircle className="w-6 h-6 text-secondary flex-shrink-0" />
              <h2 className="text-on-surface">
                {isEn ? '5. Cancellation & Refund Policy' : '5. Kebijakan Pembatalan & Pengembalian Dana'}
              </h2>
            </div>
            <ul className="list-disc pl-6 space-y-2 text-zinc-300 text-sm">
              <li>
                {isEn
                  ? 'Client cancellations may be requested by contacting branch operations prior to itinerary commencement.'
                  : 'Pembatalan oleh pelanggan dapat diajukan dengan menghubungi staf cabang sebelum masa sewa dimulai.'}
              </li>
              <li>
                {isEn
                  ? 'Prestige Motion reserves the right to execute a Force Cancel if credential forgery or fraud is identified.'
                  : 'Prestige Motion berhak membatalkan pesanan secara sepihak (Force Cancel) apabila ditemukan pemalsuan identitas, dokumen tidak sah, atau indikasi pelanggaran hukum.'}
              </li>
              <li>
                {isEn
                  ? 'Approved refunds are processed within 3–5 business days following administrative review.'
                  : 'Kebijakan pengembalian dana (refund) diproses sesuai ketentuan pembatalan dan verifikasi administrasi kantor pusat dalam waktu 3–5 hari kerja.'}
              </li>
            </ul>
          </section>

        </div>
      </main>

      <Footer />
    </div>
  )
}
