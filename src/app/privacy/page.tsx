import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Link from 'next/link'
import { ShieldCheck, Lock, FileText, EyeOff, UserCheck, Scale } from 'lucide-react'
import { getLocale, getDictionary } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Kebijakan Privasi | Prestige Motion',
  description: 'Komitmen perlindungan data pribadi pelanggan Prestige Motion sesuai UU No. 27 Tahun 2022 tentang Perlindungan Data Pribadi (UU PDP).'
}

export default async function PrivacyPolicyPage() {
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
            <span className="text-zinc-400">{dict.footer.privacyPolicy}</span>
          </div>
          <h1 className="font-display-lg text-3xl md:text-5xl text-on-surface font-bold tracking-tight mb-4">
            {isEn ? 'Privacy Policy & Data Protection' : 'Kebijakan Privasi & Perlindungan Data'}
          </h1>
          <p className="font-body-md text-on-surface-variant text-base md:text-lg leading-relaxed mb-6">
            {isEn
              ? 'Last updated: September 2026. Our steadfast commitment to data protection and confidentiality is governed by Law No. 27 of 2022 of the Republic of Indonesia on Personal Data Protection (UU PDP).'
              : 'Terakhir diperbarui: September 2026. Komitmen penuh kami terhadap keamanan dan kerahasiaan data pribadi Anda berlandaskan Undang-Undang Republik Indonesia Nomor 27 Tahun 2022 tentang Perlindungan Data Pribadi (UU PDP).'}
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
        <div className="max-w-4xl mx-auto space-y-12 font-body-md text-on-surface-variant leading-relaxed text-sm md:text-base">
          
          {/* Section 1: Prinsip Dasar */}
          <section className="bg-surface-container-low/60 border border-surface-variant/40 rounded-xl p-6 md:p-8 space-y-4">
            <div className="flex items-center gap-3 text-secondary font-semibold text-lg md:text-xl">
              <ShieldCheck className="w-6 h-6 text-secondary flex-shrink-0" />
              <h2 className="text-on-surface">
                {isEn ? '1. Fundamental Data Protection Principles' : '1. Prinsip Perlindungan Data Pribadi'}
              </h2>
            </div>
            <p>
              {isEn
                ? 'Prestige Motion respects the privacy rights of every esteemed client. We adhere strictly to purpose limitation, lawful processing, and the tenets of confidentiality and integrity when handling your personal information.'
                : 'Prestige Motion menghormati hak privasi setiap pelanggan. Kami menerapkan prinsip pembatasan tujuan (purpose limitation), pemrosesan yang sah (lawful processing), serta prinsip integritas dan kerahasiaan (confidentiality & integrity) dalam memproses seluruh data Anda.'}
            </p>
          </section>

          {/* Section 2: Data yang Kami Kumpulkan */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-secondary font-semibold text-lg md:text-xl">
              <FileText className="w-6 h-6 text-secondary flex-shrink-0" />
              <h2 className="text-on-surface">
                {isEn ? '2. Collected Data & Processing Purposes' : '2. Data yang Dikumpulkan & Tujuan Pemrosesan'}
              </h2>
            </div>
            <p>
              {isEn
                ? 'To ensure lawful operation, insurance coverage validity, and asset security throughout your rental period, we collect:'
                : 'Untuk memastikan legalitas berkendara, kepatuhan asuransi, serta keamanan armada selama masa sewa, kami mengumpulkan:'}
            </p>
            <ul className="list-disc pl-6 space-y-2 text-zinc-300">
              <li>
                <strong className="text-white">
                  {isEn ? 'Identity Documentation (KYC)' : 'Identitas Pelanggan (KYC)'}
                </strong>: {isEn ? 'Government-issued ID or Passport and valid Driver License to confirm driving eligibility.' : 'Foto Kartu Tanda Penduduk (KTP) dan Surat Izin Mengemudi (SIM A/B) yang masih berlaku untuk verifikasi kelayakan mengemudi.'}
              </li>
              <li>
                <strong className="text-white">
                  {isEn ? 'Contact Coordinates' : 'Data Kontak'}
                </strong>: {isEn ? 'Full legal name, phone/WhatsApp number, and email address for reservation confirmations and operational notices.' : 'Nama lengkap, nomor telepon (WhatsApp), dan alamat surel (email) untuk konfirmasi pesanan dan informasi operasional.'}
              </li>
              <li>
                <strong className="text-white">
                  {isEn ? 'Transaction & Itinerary Data' : 'Informasi Transaksi'}
                </strong>: {isEn ? 'Rental schedule, branch pickup/return preferences, and payment verification records.' : 'Riwayat reservasi sewa, preferensi cabang penjemputan/pengembalian, dan data konfirmasi pembayaran melalui gerbang pembayaran resmi.'}
              </li>
            </ul>
          </section>

          {/* Section 3: Mekanisme Keamanan Teknis */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-secondary font-semibold text-lg md:text-xl">
              <Lock className="w-6 h-6 text-secondary flex-shrink-0" />
              <h2 className="text-on-surface">
                {isEn ? '3. Technical Security & Document Encryption' : '3. Mekanisme Keamanan & Enkripsi Dokumen'}
              </h2>
            </div>
            <p>
              {isEn
                ? 'Your identification credentials are safeguarded by multi-layered technical security protocols:'
                : 'Dokumen identitas Anda disimpan dengan arsitektur keamanan bertingkat:'}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="bg-surface-container-lowest border border-surface-variant/40 rounded-lg p-5">
                <h3 className="text-secondary font-medium mb-2 flex items-center gap-2">
                  <EyeOff className="w-4 h-4" /> {isEn ? 'Private Encrypted Storage' : 'Penyimpanan Terisolasi (Private Storage)'}
                </h3>
                <p className="text-xs md:text-sm text-zinc-400">
                  {isEn
                    ? 'Identity records are never exposed to public storage buckets. All files are encrypted at rest in access-controlled vaults.'
                    : 'Dokumen KTP/SIM tidak pernah disimpan pada direktori publik. Seluruh berkas dienkripsi di media penyimpanan tertutup (private bucket).'}
                </p>
              </div>
              <div className="bg-surface-container-lowest border border-surface-variant/40 rounded-lg p-5">
                <h3 className="text-secondary font-medium mb-2 flex items-center gap-2">
                  <UserCheck className="w-4 h-4" /> {isEn ? '5-Minute Cryptographic Signed URLs' : 'Akses Berbatas Waktu (Signed URL 5 Menit)'}
                </h3>
                <p className="text-xs md:text-sm text-zinc-400">
                  {isEn
                    ? 'Access links are dynamically generated with a strict 5-minute expiry, restricted strictly to authorized operations staff.'
                    : 'Tautan akses berkas hanya digenerate secara kriptografis dengan masa kedaluwarsa 5 menit, khusus bagi staf berwenang yang menangani pesanan terkait.'}
                </p>
              </div>
            </div>
          </section>

          {/* Section 4: Pembatasan Akses Cabang & Jejak Audit */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-secondary font-semibold text-lg md:text-xl">
              <Scale className="w-6 h-6 text-secondary flex-shrink-0" />
              <h2 className="text-on-surface">
                {isEn ? '4. Branch Scoping & Centralized Audit Trail' : '4. Isolasi Cabang & Audit Trail Terpusat'}
              </h2>
            </div>
            <p>
              {isEn
                ? 'We enforce rigorous Role-Based Access Control and strict branch-level isolation:'
                : 'Kami menerapkan pembatasan akses berbasis peran (Role-Based Access Control) dan isolasi cabang (branch scoping):'}
            </p>
            <ul className="list-disc pl-6 space-y-2 text-zinc-300">
              <li>
                {isEn
                  ? 'Staff stationed at Branch A possess no authorization or capability to inspect customer documents for reservations originating at Branch B.'
                  : 'Staf di Cabang A tidak memiliki izin teknis maupun akses visual untuk melihat dokumen pelanggan dari pesanan Cabang B.'}
              </li>
              <li>
                {isEn ? (
                  <>
                    Each document access event triggers an immutable audit log entry recording timestamp, reviewer ID, and operational role (successful: <code className="text-xs bg-zinc-800 text-secondary px-1.5 py-0.5 rounded">document.view</code> or denied: <code className="text-xs bg-zinc-800 text-red-400 px-1.5 py-0.5 rounded">document.view_denied</code>).
                  </>
                ) : (
                  <>
                    Setiap kali staf berwenang membuka dokumen verifikasi, sistem secara otomatis mencatat jejak audit terenkripsi yang merekam waktu, identitas staf, dan peran yang mengakses (sukses: <code className="text-xs bg-zinc-800 text-secondary px-1.5 py-0.5 rounded">document.view</code> atau ditolak: <code className="text-xs bg-zinc-800 text-red-400 px-1.5 py-0.5 rounded">document.view_denied</code>).
                  </>
                )}
              </li>
            </ul>
          </section>

          {/* Section 5: Hak Pelanggan */}
          <section className="space-y-4">
            <h2 className="text-on-surface font-semibold text-lg md:text-xl">
              {isEn ? '5. Your Rights as a Data Subject' : '5. Hak Anda Sebagai Subjek Data'}
            </h2>
            <p>
              {isEn
                ? 'In accordance with Articles 5–13 of the Indonesian Personal Data Protection Law (UU PDP), you are entitled to:'
                : 'Sesuai ketentuan UU PDP Pasal 5–13, Anda berhak:'}
            </p>
            <ul className="list-disc pl-6 space-y-2 text-zinc-300">
              <li>{isEn ? 'Clarity regarding the scope and purpose of processing.' : 'Mendapatkan kejelasan mengenai tujuan pengolahan data Anda.'}</li>
              <li>{isEn ? 'Rectification of inaccurate personal records.' : 'Memperbarui atau memperbaiki data pribadi yang tidak akurat.'}</li>
              <li>{isEn ? 'Request disposal or erasure of identity documentation following conclusion of legal retention mandates.' : 'Meminta penghapusan atau pemusnahan dokumen identitas setelah kewajiban hukum transaksi sewa selesai dan masa retensi audit berakhir.'}</li>
            </ul>
          </section>

          {/* Section 6: Kontak Bantuan & DPO */}
          <section className="bg-surface-container-low/60 border border-surface-variant/40 rounded-xl p-6 md:p-8">
            <h2 className="text-on-surface font-semibold text-lg md:text-xl mb-3">
              {isEn ? '6. Contact Data Protection Officer' : '6. Hubungi Petugas Perlindungan Data'}
            </h2>
            <p className="mb-4">
              {isEn
                ? 'For questions regarding your personal data or to exercise your rights as a data subject, please contact:'
                : 'Jika Anda memiliki pertanyaan mengenai pengolahan data pribadi Anda atau ingin menggunakan hak subjek data, silakan hubungi kami melalui:'}
            </p>
            <div className="text-sm text-zinc-300 space-y-1">
              <p><strong className="text-white">Email Privasi:</strong> privacy@prestigemotion.co.id</p>
              <p><strong className="text-white">WhatsApp Layanan:</strong> +62 811-3000-8888 (08:00 – 21:00 WIB)</p>
              <p><strong className="text-white">Kantor Pusat:</strong> Gedung Prestige Motion, Surabaya & Jakarta, Indonesia</p>
            </div>
          </section>

        </div>
      </main>

      <Footer />
    </div>
  )
}
