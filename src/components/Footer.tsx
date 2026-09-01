import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-surface-container-lowest w-full pt-16 pb-10 border-t border-surface-variant/40">
      <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
        {/* Main Footer Links Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 md:gap-12">
          {/* Brand Column */}
          <div className="col-span-1 sm:col-span-2 lg:col-span-1">
            <Link 
              href="/" 
              className="font-display-lg text-headline-md text-secondary tracking-tight block mb-4 hover:opacity-90 transition-opacity"
            >
              Prestige Motion
            </Link>
            <p className="font-body-md text-sm text-on-surface-variant leading-relaxed max-w-sm">
              Layanan rental kendaraan premium & armada mewah dengan standar kebersihan tertinggi, privasi terlindungi, dan jaringan cabang terpercaya.
            </p>
          </div>

          {/* Column 1: Layanan & Armada */}
          <div className="col-span-1">
            <h4 className="font-label-caps text-xs tracking-widest text-secondary uppercase mb-4 font-semibold">
              Layanan & Armada
            </h4>
            <ul className="flex flex-col gap-3 font-body-md text-sm">
              <li>
                <Link 
                  href="/#vehicles" 
                  className="text-on-surface-variant hover:text-white hover:translate-x-1 transition-all inline-block"
                >
                  Katalog Kendaraan
                </Link>
              </li>
              <li>
                <Link 
                  href="/locations" 
                  className="text-on-surface-variant hover:text-white hover:translate-x-1 transition-all inline-block"
                >
                  Lokasi Cabang
                </Link>
              </li>
              <li>
                <Link 
                  href="/contact" 
                  className="text-on-surface-variant hover:text-white hover:translate-x-1 transition-all inline-block"
                >
                  Bantuan & Reservasi
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2: Legal & Kebijakan */}
          <div className="col-span-1">
            <h4 className="font-label-caps text-xs tracking-widest text-secondary uppercase mb-4 font-semibold">
              Legal & Privasi
            </h4>
            <ul className="flex flex-col gap-3 font-body-md text-sm">
              <li>
                <Link 
                  href="/privacy" 
                  className="text-on-surface-variant hover:text-white hover:translate-x-1 transition-all inline-block"
                >
                  Kebijakan Privasi (UU PDP)
                </Link>
              </li>
              <li>
                <Link 
                  href="/terms" 
                  className="text-on-surface-variant hover:text-white hover:translate-x-1 transition-all inline-block"
                >
                  Syarat & Ketentuan Sewa
                </Link>
              </li>
              <li>
                <Link 
                  href="/contact#emergency" 
                  className="text-on-surface-variant hover:text-white hover:translate-x-1 transition-all inline-block"
                >
                  Eskalasi Darurat Perjalanan
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Jam Operasional & Kontak */}
          <div className="col-span-1">
            <h4 className="font-label-caps text-xs tracking-widest text-secondary uppercase mb-4 font-semibold">
              Operasional Cabang
            </h4>
            <div className="space-y-3 font-body-md text-sm text-on-surface-variant">
              <div>
                <p className="text-white font-medium">Jam Layanan CS & Serah Terima:</p>
                <p className="text-zinc-400">08:00 – 21:00 WIB (Setiap Hari)</p>
              </div>
              <div>
                <p className="text-white font-medium">Sistem Pemesanan Online:</p>
                <p className="text-emerald-400 font-medium">Aktif 24 Jam Non-Stop</p>
              </div>
              <div className="pt-1">
                <Link 
                  href="/locations" 
                  className="text-xs text-secondary hover:underline inline-flex items-center gap-1"
                >
                  Lihat Daftar Alamat Cabang →
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Copyright & Disclaimer */}
        <div className="mt-12 pt-8 border-t border-surface-variant/40 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-zinc-500">
          <p>
            © 2026 Prestige Motion. Seluruh hak cipta dilindungi undang-undang.
          </p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-zinc-300 transition-colors">
              Privasi
            </Link>
            <Link href="/terms" className="hover:text-zinc-300 transition-colors">
              Ketentuan
            </Link>
            <Link href="/locations" className="hover:text-zinc-300 transition-colors">
              Cabang
            </Link>
            <Link href="/contact" className="hover:text-zinc-300 transition-colors">
              Kontak
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
