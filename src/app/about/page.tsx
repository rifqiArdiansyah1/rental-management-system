import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Link from 'next/link'
import { prisma } from '@/utils/prisma'
import { 
  Building2, 
  ShieldCheck, 
  Clock, 
  Sparkles, 
  CircleDollarSign, 
  Lock, 
  Car, 
  UserCheck, 
  MapPin, 
  ArrowRight 
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Tentang Kami | Prestige Motion',
  description: 'Profil resmi, legalitas badan usaha, dan standar keunggulan layanan rental mobil premium Prestige Motion.'
}

export default async function AboutPage() {
  // Query active branches dynamically from database
  const activeBranches = await prisma.branch.findMany({
    where: { isActive: true },
    include: {
      _count: {
        select: {
          vehicles: {
            where: { isActive: true }
          }
        }
      }
    },
    orderBy: { city: 'asc' }
  })

  // Extract unique active cities
  const activeCities = Array.from(new Set(activeBranches.map(b => b.city)))

  return (
    <div className="flex flex-col min-h-screen bg-background text-on-surface">
      <Navbar />

      <main className="flex-grow py-16 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto w-full">
        {/* Header Breadcrumb & Title */}
        <div className="max-w-4xl mx-auto mb-16 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 text-xs font-label-caps uppercase tracking-wider text-secondary mb-3">
            <Link href="/" className="hover:underline">Home</Link>
            <span>/</span>
            <span className="text-zinc-400">Tentang Kami</span>
          </div>
          <h1 className="font-display-lg text-3xl md:text-5xl text-on-surface font-bold tracking-tight mb-4">
            Mendefinisikan Ulang Mobilitas Premium
          </h1>
          <p className="font-body-md text-on-surface-variant text-base md:text-lg leading-relaxed max-w-3xl">
            Prestige Motion menghadirkan layanan rental kendaraan kelas atas berbasis teknologi modern, dengan komitmen pada kenyamanan perjalanan, kebersihan armada, transparansi tarif, dan kepatuhan hukum yang solid.
          </p>
        </div>

        {/* Section 1: Profil Resmi & Legalitas Badan Usaha */}
        <section className="max-w-5xl mx-auto mb-16 bg-surface-container-lowest border border-surface-variant/50 rounded-2xl p-8 md:p-10">
          <div className="flex items-center gap-3 text-secondary font-semibold text-lg md:text-xl mb-4">
            <Building2 className="w-6 h-6 text-secondary flex-shrink-0" />
            <h2 className="text-on-surface">Profil & Identitas Badan Usaha</h2>
          </div>
          <p className="font-body-md text-on-surface-variant text-sm md:text-base leading-relaxed mb-6">
            Prestige Motion beroperasi secara resmi di bawah badan usaha berbadan hukum di Indonesia, memberikan kepastian hukum, perlindungan konsumen, dan standar asuransi perjalanan terpercaya bagi seluruh klien personal maupun korporat.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-surface-variant/40">
            <div className="bg-surface-container-low/60 rounded-xl p-5 border border-surface-variant/30">
              <p className="text-xs text-secondary font-label-caps uppercase tracking-wider font-semibold mb-1">
                Badan Usaha Resmi
              </p>
              <p className="text-base text-white font-bold">
                CV Prestige Motion Nusantara
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                Penyedia Jasa Transportasi & Rental Mobil
              </p>
            </div>

            <div className="bg-surface-container-low/60 rounded-xl p-5 border border-surface-variant/30">
              <p className="text-xs text-secondary font-label-caps uppercase tracking-wider font-semibold mb-1">
                Kategori Layanan
              </p>
              <p className="text-base text-white font-bold">
                Rental Premium & Sopir
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                Lepas Kunci & Layanan Pengemudi Eksekutif
              </p>
            </div>

            <div className="bg-surface-container-low/60 rounded-xl p-5 border border-surface-variant/30">
              <p className="text-xs text-secondary font-label-caps uppercase tracking-wider font-semibold mb-1">
                Kepatuhan Regulasi
              </p>
              <p className="text-base text-white font-bold">
                Berlisensi & Terproteksi
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                Kepatuhan Pajak & Perlindungan Konsumen UU PDP
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: 4 Pilar Standar Keunggulan Layanan */}
        <section className="max-w-5xl mx-auto mb-16">
          <div className="text-center md:text-left mb-8">
            <h2 className="font-headline-lg text-2xl md:text-3xl text-white font-bold mb-2">
              Mengapa Memilih Prestige Motion?
            </h2>
            <p className="font-body-md text-sm md:text-base text-on-surface-variant">
              Standar operasional ketat yang didukung sistem teknologi andal di setiap tahapan penyewaan.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pilar 1 */}
            <div className="bg-surface-container-lowest border border-surface-variant/40 rounded-xl p-6 flex gap-4">
              <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary flex-shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white mb-1">Pemesanan Online 24/7</h3>
                <p className="text-xs md:text-sm text-zinc-400 leading-relaxed">
                  Cek ketersediaan jadwal secara real-time dan lakukan booking kapan saja secara instan tanpa proses formulir manual yang memakan waktu.
                </p>
              </div>
            </div>

            {/* Pilar 2 */}
            <div className="bg-surface-container-lowest border border-surface-variant/40 rounded-xl p-6 flex gap-4">
              <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary flex-shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white mb-1">Jeda Detailing & Inspeksi 3 Jam</h3>
                <p className="text-xs md:text-sm text-zinc-400 leading-relaxed">
                  Setiap armada mendapatkan jeda pembersihan menyeluruh, inspeksi teknis, dan sanitasi kabin sebelum diserahterimakan kepada Anda.
                </p>
              </div>
            </div>

            {/* Pilar 3 */}
            <div className="bg-surface-container-lowest border border-surface-variant/40 rounded-xl p-6 flex gap-4">
              <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary flex-shrink-0">
                <CircleDollarSign className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white mb-1">Tarif Pasti Tanpa Biaya Tersembunyi</h3>
                <p className="text-xs md:text-sm text-zinc-400 leading-relaxed">
                  Harga yang Anda lihat adalah harga final yang transparan dengan rincian biaya sewa dan opsi layanan yang jelas sejak awal.
                </p>
              </div>
            </div>

            {/* Pilar 4 */}
            <div className="bg-surface-container-lowest border border-surface-variant/40 rounded-xl p-6 flex gap-4">
              <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary flex-shrink-0">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white mb-1">Perlindungan Data (UU PDP No. 27/2022)</h3>
                <p className="text-xs md:text-sm text-zinc-400 leading-relaxed">
                  Dokumen identitas (KTP/SIM) dienkripsi di media penyimpanan tertutup dan hanya diakses berbatas waktu via Signed URL dengan pencatatan audit log ketat.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Pilihan Skema Sewa Fleksibel */}
        <section className="max-w-5xl mx-auto mb-16 bg-surface-container-low/40 border border-surface-variant/40 rounded-2xl p-8 md:p-10">
          <h2 className="font-headline-lg text-xl md:text-2xl text-white font-bold mb-6 text-center md:text-left">
            Fleksibilitas Pilihan Layanan
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-surface-container-lowest border border-surface-variant/40 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <Car className="w-6 h-6 text-secondary" />
                <h3 className="text-lg font-bold text-white">Lepas Kunci (Self-Drive)</h3>
              </div>
              <p className="text-xs md:text-sm text-zinc-300 leading-relaxed mb-4">
                Pilihan tepat bagi Anda yang mengutamakan kebebasan berkendara mandiri dan privasi penuh selama perjalanan bisnis maupun liburan keluarga.
              </p>
              <Link 
                href="/#vehicles" 
                className="text-xs font-semibold text-secondary hover:text-white inline-flex items-center gap-1 group"
              >
                Cari Mobil Lepas Kunci <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <div className="bg-surface-container-lowest border border-surface-variant/40 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <UserCheck className="w-6 h-6 text-secondary" />
                <h3 className="text-lg font-bold text-white">Dengan Sopir (With Driver)</h3>
              </div>
              <p className="text-xs md:text-sm text-zinc-300 leading-relaxed mb-4">
                Layanan pengemudi profesional berlisensi dan berpengalaman yang siap mengantar perjalanan Anda dengan santun, tepat waktu, dan aman.
              </p>
              <Link 
                href="/#vehicles" 
                className="text-xs font-semibold text-secondary hover:text-white inline-flex items-center gap-1 group"
              >
                Cari Mobil dengan Sopir <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </section>

        {/* Section 4: Jaringan Cabang Aktif (Dynamic dari Database) */}
        <section className="max-w-5xl mx-auto mb-16">
          <div className="bg-surface-container-lowest border border-surface-variant/40 rounded-2xl p-8 md:p-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2 text-secondary font-semibold text-base mb-1">
                  <MapPin className="w-5 h-5 text-secondary" />
                  <span>Jangkauan Operasional Aktif</span>
                </div>
                <h2 className="font-headline-lg text-xl md:text-2xl text-white font-bold">
                  Hadir di Kota-Kota Strategis
                </h2>
              </div>
              <Link 
                href="/locations" 
                className="btn-secondary text-xs font-semibold text-secondary border border-secondary/50 px-4 py-2 rounded hover:bg-secondary hover:text-background transition-colors inline-flex items-center gap-1.5"
              >
                Lihat Detail Semua Cabang →
              </Link>
            </div>

            {activeBranches.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeBranches.map(branch => (
                  <div key={branch.id} className="bg-surface-container-low/50 border border-surface-variant/30 rounded-lg p-4">
                    <p className="text-white font-semibold text-sm">{branch.name}</p>
                    <p className="text-xs text-secondary font-medium mt-0.5">Kota {branch.city}</p>
                    <p className="text-xs text-zinc-400 mt-2 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                      {branch._count.vehicles} armada siap jalan
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">
                Jaringan cabang kami terus berkembang untuk menjangkau kebutuhan mobilitas Anda di berbagai kota.
              </p>
            )}
          </div>
        </section>

        {/* Section 5: Call To Action (CTA) */}
        <section className="max-w-5xl mx-auto text-center bg-gradient-to-r from-surface-container-low via-surface-container-lowest to-surface-container-low border border-surface-variant/50 rounded-2xl p-10 md:p-12">
          <h2 className="font-display-lg text-2xl md:text-4xl text-white font-bold mb-4">
            Siap Menikmati Perjalanan Istimewa?
          </h2>
          <p className="font-body-md text-on-surface-variant text-sm md:text-base max-w-xl mx-auto mb-8 leading-relaxed">
            Temukan kendaraan idaman Anda sekarang dan nikmati pengalaman sewa mobil premium tanpa ribet.
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <Link 
              href="/#vehicles" 
              className="btn-primary bg-secondary text-on-secondary font-button text-sm font-semibold px-8 py-3.5 rounded-DEFAULT inline-flex items-center gap-2 hover:bg-secondary-fixed transition-colors"
            >
              Pilih Armada Sekarang <ArrowRight className="w-4 h-4" />
            </Link>
            <Link 
              href="/contact" 
              className="font-button text-sm font-semibold text-zinc-300 border border-zinc-700 px-6 py-3.5 rounded-DEFAULT hover:border-zinc-400 hover:text-white transition-colors"
            >
              Hubungi Konsierge
            </Link>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  )
}
