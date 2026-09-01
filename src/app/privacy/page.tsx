import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Link from 'next/link'
import { ShieldCheck, Lock, FileText, EyeOff, UserCheck, Scale } from 'lucide-react'

export const metadata = {
  title: 'Kebijakan Privasi | Prestige Motion',
  description: 'Komitmen perlindungan data pribadi pelanggan Prestige Motion sesuai UU No. 27 Tahun 2022 tentang Perlindungan Data Pribadi (UU PDP).'
}

export default function PrivacyPolicyPage() {
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
            <span className="text-zinc-400">Kebijakan Privasi</span>
          </div>
          <h1 className="font-display-lg text-3xl md:text-5xl text-on-surface font-bold tracking-tight mb-4">
            Kebijakan Privasi & Perlindungan Data
          </h1>
          <p className="font-body-md text-on-surface-variant text-base md:text-lg leading-relaxed">
            Terakhir diperbarui: September 2026. Komitmen penuh kami terhadap keamanan dan kerahasiaan data pribadi Anda berlandaskan Undang-Undang Republik Indonesia Nomor 27 Tahun 2022 tentang Perlindungan Data Pribadi (UU PDP).
          </p>
        </div>

        {/* Content Body */}
        <div className="max-w-4xl mx-auto space-y-12 font-body-md text-on-surface-variant leading-relaxed text-sm md:text-base">
          
          {/* Section 1: Prinsip Dasar */}
          <section className="bg-surface-container-low/60 border border-surface-variant/40 rounded-xl p-6 md:p-8 space-y-4">
            <div className="flex items-center gap-3 text-secondary font-semibold text-lg md:text-xl">
              <ShieldCheck className="w-6 h-6 text-secondary flex-shrink-0" />
              <h2 className="text-on-surface">1. Prinsip Perlindungan Data Pribadi</h2>
            </div>
            <p>
              Prestige Motion menghormati hak privasi setiap pelanggan. Kami menerapkan prinsip pembatasan tujuan (*purpose limitation*), pemrosesan yang sah (*lawful processing*), serta prinsip integritas dan kerahasiaan (*confidentiality & integrity*) dalam memproses seluruh data Anda.
            </p>
          </section>

          {/* Section 2: Data yang Kami Kumpulkan */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-secondary font-semibold text-lg md:text-xl">
              <FileText className="w-6 h-6 text-secondary flex-shrink-0" />
              <h2 className="text-on-surface">2. Data yang Dikumpulkan & Tujuan Pemrosesan</h2>
            </div>
            <p>
              Untuk memastikan legalitas berkendara, kepatuhan asuransi, serta keamanan armada selama masa sewa, kami mengumpulkan:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-zinc-300">
              <li>
                <strong className="text-white">Identitas Pelanggan (KYC)</strong>: Foto Kartu Tanda Penduduk (KTP) dan Surat Izin Mengemudi (SIM A/B) yang masih berlaku untuk verifikasi kelayakan mengemudi.
              </li>
              <li>
                <strong className="text-white">Data Kontak</strong>: Nama lengkap, nomor telepon (WhatsApp), dan alamat surel (email) untuk konfirmasi pesanan dan informasi operasional.
              </li>
              <li>
                <strong className="text-white">Informasi Transaksi</strong>: Riwayat reservasi sewa, preferensi cabang penjemputan/pengembalian, dan data konfirmasi pembayaran melalui gerbang pembayaran resmi.
              </li>
            </ul>
          </section>

          {/* Section 3: Mekanisme Keamanan Teknis */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-secondary font-semibold text-lg md:text-xl">
              <Lock className="w-6 h-6 text-secondary flex-shrink-0" />
              <h2 className="text-on-surface">3. Mekanisme Keamanan & Enkripsi Dokumen</h2>
            </div>
            <p>
              Dokumen identitas Anda disimpan dengan arsitektur keamanan bertingkat:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="bg-surface-container-lowest border border-surface-variant/40 rounded-lg p-5">
                <h3 className="text-secondary font-medium mb-2 flex items-center gap-2">
                  <EyeOff className="w-4 h-4" /> Penyimpanan Terisolasi (Private Storage)
                </h3>
                <p className="text-xs md:text-sm text-zinc-400">
                  Dokumen KTP/SIM tidak pernah disimpan pada direktori publik. Seluruh berkas dienkripsi di media penyimpanan tertutup (*private bucket*).
                </p>
              </div>
              <div className="bg-surface-container-lowest border border-surface-variant/40 rounded-lg p-5">
                <h3 className="text-secondary font-medium mb-2 flex items-center gap-2">
                  <UserCheck className="w-4 h-4" /> Akses Berbatas Waktu (Signed URL 5 Menit)
                </h3>
                <p className="text-xs md:text-sm text-zinc-400">
                  Tautan akses berkas hanya digenerate secara kriptografis dengan masa kedaluwarsa 5 menit, khusus bagi staf berwenang yang menangani pesanan terkait.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4: Pembatasan Akses Cabang & Jejak Audit */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-secondary font-semibold text-lg md:text-xl">
              <Scale className="w-6 h-6 text-secondary flex-shrink-0" />
              <h2 className="text-on-surface">4. Isolasi Cabang & Audit Trail Terpusat</h2>
            </div>
            <p>
              Kami menerapkan pembatasan akses berbasis peran (*Role-Based Access Control*) dan isolasi cabang (*branch scoping*):
            </p>
            <ul className="list-disc pl-6 space-y-2 text-zinc-300">
              <li>
                Staf di Cabang A tidak memiliki izin teknis maupun akses visual untuk melihat dokumen pelanggan dari pesanan Cabang B.
              </li>
              <li>
                Setiap kali staf berwenang membuka dokumen verifikasi, sistem secara otomatis mencatat jejak audit terenkripsi (<code className="text-xs bg-zinc-800 text-secondary px-1.5 py-0.5 rounded">document.view</code>) yang merekam waktu, identitas staf, dan peran yang mengakses.
              </li>
              <li>
                Percobaan akses tidak sah akan langsung diblokir dan dicatat ke dalam log pelanggaran keamanan (<code className="text-xs bg-zinc-800 text-red-400 px-1.5 py-0.5 rounded">document.view_denied</code>).
              </li>
            </ul>
          </section>

          {/* Section 5: Hak Pelanggan */}
          <section className="space-y-4">
            <h2 className="text-on-surface font-semibold text-lg md:text-xl">5. Hak Anda Sebagai Subjek Data</h2>
            <p>
              Sesuai ketentuan UU PDP Pasal 5–13, Anda berhak:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-zinc-300">
              <li>Mendapatkan kejelasan mengenai tujuan pengolahan data Anda.</li>
              <li>Memperbarui atau memperbaiki data pribadi yang tidak akurat.</li>
              <li>Meminta penghapusan atau pemusnahan dokumen identitas setelah kewajiban hukum transaksi sewa selesai dan masa retensi audit berakhir.</li>
            </ul>
          </section>

          {/* Section 6: Kontak Bantuan & DPO */}
          <section className="bg-surface-container-low/60 border border-surface-variant/40 rounded-xl p-6 md:p-8">
            <h2 className="text-on-surface font-semibold text-lg md:text-xl mb-3">6. Hubungi Petugas Perlindungan Data</h2>
            <p className="mb-4">
              Jika Anda memiliki pertanyaan mengenai pengolahan data pribadi Anda atau ingin menggunakan hak subjek data, silakan hubungi kami melalui:
            </p>
            <div className="text-sm text-zinc-300 space-y-1">
              <p><strong className="text-white">Email Privasi:</strong> privacy@prestigemotion.co.id</p>
              <p><strong className="text-white">WhatsApp Layanan:</strong> +62 811-3000-8888 (Jam Operasional 08:00 – 21:00 WIB)</p>
              <p><strong className="text-white">Alamat Kantor Pusat:</strong> Gedung Prestige Motion, Surabaya & Jakarta, Indonesia</p>
            </div>
          </section>

        </div>
      </main>

      <Footer />
    </div>
  )
}
