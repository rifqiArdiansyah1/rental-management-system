import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Link from 'next/link'
import { MessageSquare, Mail, PhoneCall, AlertTriangle, Clock, ShieldAlert } from 'lucide-react'
import ScrollReveal from '@/components/ui/ScrollReveal'

export const metadata = {
  title: 'Hubungi Kami & Layanan Pelanggan | Prestige Motion',
  description: 'Informasi kontak resmi, layanan pelanggan, dan bantuan eskalasi darurat rental Prestige Motion.'
}

export default function ContactPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-on-surface">
      <Navbar />

      <main className="flex-grow py-16 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto w-full">
        {/* Header Breadcrumb & Title (Pure CSS entrance, LCP safe) */}
        <div className="max-w-4xl mx-auto mb-12 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 text-xs font-label-caps uppercase tracking-wider text-secondary mb-3 animate-hero-kicker">
            <Link href="/" className="hover:underline">Home</Link>
            <span>/</span>
            <span className="text-zinc-400">Kontak</span>
          </div>
          <h1 className="font-display-lg text-3xl md:text-5xl text-on-surface font-bold tracking-tight mb-4 animate-page-header">
            Pusat Bantuan & Layanan Pelanggan
          </h1>
          <p className="font-body-md text-on-surface-variant text-base md:text-lg leading-relaxed max-w-2xl animate-page-desc">
            Tim konsierge dan staf cabang kami siap membantu kebutuhan reservasi, pertanyaan armada, serta bantuan operasional perjalanan Anda.
          </p>
        </div>

        {/* Contact Cards Grid with Staggered ScrollReveal */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-16">
          {/* WhatsApp / Chat */}
          <ScrollReveal delay={0}>
            <div className="bg-surface-container-lowest border border-surface-variant/40 hover:border-emerald-500/50 rounded-xl p-6 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-emerald-500/5 group h-full">
              <div>
                <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-4 transition-all duration-300 group-hover:scale-110 group-hover:bg-emerald-500/20">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <h3 className="font-headline-md text-xl text-white font-bold mb-2 group-hover:text-emerald-300 transition-colors">WhatsApp Concierge</h3>
                <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                  Respon cepat untuk konsultasi armada, jadwal ketersediaan, dan konfirmasi reservasi.
                </p>
              </div>
              <div>
                <p className="text-lg font-mono font-semibold text-emerald-400 mb-1">+62 811-3000-8888</p>
                <p className="text-xs text-zinc-500 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Setiap Hari, 08:00 – 21:00 WIB
                </p>
              </div>
            </div>
          </ScrollReveal>

          {/* Email Support */}
          <ScrollReveal delay={100}>
            <div className="bg-surface-container-lowest border border-surface-variant/40 hover:border-secondary/50 rounded-xl p-6 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-secondary/5 group h-full">
              <div>
                <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary mb-4 transition-all duration-300 group-hover:scale-110 group-hover:bg-secondary/20">
                  <Mail className="w-6 h-6" />
                </div>
                <h3 className="font-headline-md text-xl text-white font-bold mb-2 group-hover:text-secondary-light transition-colors">Email Resmi</h3>
                <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                  Kebutuhan kerja sama korporat, penawaran sewa jangka panjang, dan administrasi umum.
                </p>
              </div>
              <div>
                <p className="text-base font-medium text-white mb-1">contact@prestigemotion.co.id</p>
                <p className="text-xs text-zinc-500">Respon dalam waktu maksimal 1x24 jam kerja</p>
              </div>
            </div>
          </ScrollReveal>

          {/* Hotline Operasional */}
          <ScrollReveal delay={200}>
            <div className="bg-surface-container-lowest border border-surface-variant/40 hover:border-blue-500/50 rounded-xl p-6 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-blue-500/5 group h-full">
              <div>
                <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 mb-4 transition-all duration-300 group-hover:scale-110 group-hover:bg-blue-500/20">
                  <PhoneCall className="w-6 h-6" />
                </div>
                <h3 className="font-headline-md text-xl text-white font-bold mb-2 group-hover:text-blue-300 transition-colors">Hotline Operasional</h3>
                <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                  Hubungi saluran operasional langsung untuk koordinasi serah terima di cabang.
                </p>
              </div>
              <div>
                <p className="text-lg font-mono font-semibold text-white mb-1">0800-1-PRESTIGE</p>
                <p className="text-xs text-zinc-500">Bebas Pulsa / Pulsa Lokal</p>
              </div>
            </div>
          </ScrollReveal>
        </div>

        {/* Emergency Escalation Section */}
        <ScrollReveal delay={150}>
          <section id="emergency" className="max-w-5xl mx-auto bg-red-950/20 border border-red-900/40 hover:border-red-700/60 rounded-xl p-8 scroll-mt-20 transition-all duration-300 group">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 flex-shrink-0 transition-transform duration-300 group-hover:scale-110">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="space-y-3">
                <h2 className="font-headline-md text-xl text-red-300 font-bold">
                  Bantuan & Eskalasi Darurat Perjalanan (Emergency Trip Support)
                </h2>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  Khusus untuk pelanggan dengan status sewa yang sedang aktif (<code className="text-xs bg-red-950/80 text-red-300 px-1.5 py-0.5 rounded">Ongoing Rental</code>), jika Anda mengalami kendala teknis darurat di jalan (kerusakan mekanis, kendala sopir, atau insiden perjalanan di luar jam operasional reguler):
                </p>
                <div className="bg-surface-container-lowest/80 border border-red-900/30 rounded-lg p-4 space-y-2 text-sm">
                  <p className="text-white">
                    <strong>1. Hotline Darurat 24 Jam:</strong> <span className="font-mono text-amber-300 font-bold">+62 811-9999-0000</span>
                  </p>
                  <p className="text-zinc-400 text-xs">
                    Sertakan nomor pesanan (Booking ID) dan lokasi terkini kendaraan saat menghubungi petugas tanggap darurat kami.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </ScrollReveal>

      </main>

      <Footer />
    </div>
  )
}
