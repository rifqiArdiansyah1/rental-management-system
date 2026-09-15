import Link from 'next/link'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import { getLocale, getDictionary } from '@/lib/i18n/server'

export default async function Footer() {
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const isEn = locale === 'en'

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
              {dict.footer.tagline}
            </p>
          </div>

          {/* Column 1: Layanan & Informasi */}
          <div className="col-span-1">
            <h4 className="font-label-caps text-xs tracking-widest text-secondary uppercase mb-4 font-semibold">
              {dict.footer.navigationTitle}
            </h4>
            <ul className="flex flex-col gap-3 font-body-md text-sm">
              <li>
                <Link 
                  href="/#vehicles" 
                  className="text-on-surface-variant hover:text-white hover:translate-x-1 transition-all inline-block"
                >
                  {dict.nav.fleet}
                </Link>
              </li>
              <li>
                <Link 
                  href="/locations" 
                  className="text-on-surface-variant hover:text-white hover:translate-x-1 transition-all inline-block"
                >
                  {dict.nav.locations}
                </Link>
              </li>
              <li>
                <Link 
                  href="/about" 
                  className="text-on-surface-variant hover:text-white hover:translate-x-1 transition-all inline-block"
                >
                  {dict.nav.about}
                </Link>
              </li>
              <li>
                <Link 
                  href="/contact" 
                  className="text-on-surface-variant hover:text-white hover:translate-x-1 transition-all inline-block"
                >
                  {dict.nav.contact}
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2: Legal & Kebijakan */}
          <div className="col-span-1">
            <h4 className="font-label-caps text-xs tracking-widest text-secondary uppercase mb-4 font-semibold">
              {dict.footer.legalTitle}
            </h4>
            <ul className="flex flex-col gap-3 font-body-md text-sm">
              <li>
                <Link 
                  href="/privacy" 
                  className="text-on-surface-variant hover:text-white hover:translate-x-1 transition-all inline-block"
                >
                  {dict.footer.privacyPolicy}
                </Link>
              </li>
              <li>
                <Link 
                  href="/terms" 
                  className="text-on-surface-variant hover:text-white hover:translate-x-1 transition-all inline-block"
                >
                  {dict.footer.termsOfService}
                </Link>
              </li>
              <li>
                <Link 
                  href="/contact" 
                  className="text-on-surface-variant hover:text-white hover:translate-x-1 transition-all inline-block"
                >
                  {isEn ? 'Emergency Support & Assistance' : 'Eskalasi Darurat Perjalanan'}
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Jam Operasional & Kontak */}
          <div className="col-span-1">
            <h4 className="font-label-caps text-xs tracking-widest text-secondary uppercase mb-4 font-semibold">
              {isEn ? 'Branch Operations' : 'Operasional Cabang'}
            </h4>
            <div className="space-y-3 font-body-md text-sm text-on-surface-variant">
              <div>
                <p className="text-white font-medium">{isEn ? 'Customer Service & Handover:' : 'Jam Layanan CS & Serah Terima:'}</p>
                <p className="text-zinc-400">{dict.footer.operatingHours}</p>
              </div>
              <div>
                <p className="text-white font-medium">{isEn ? 'Digital Reservation System:' : 'Sistem Pemesanan Online:'}</p>
                <p className="text-emerald-400 font-medium">{isEn ? 'Active 24 Hours Daily' : 'Aktif 24 Jam Non-Stop'}</p>
              </div>
              <div className="pt-1">
                <Link 
                  href="/locations" 
                  className="text-xs text-secondary hover:underline inline-flex items-center gap-1"
                >
                  {isEn ? 'View Branch Addresses →' : 'Lihat Daftar Alamat Cabang →'}
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Copyright & Language Switcher */}
        <div className="mt-12 pt-8 border-t border-surface-variant/40 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-zinc-500">
          <p>
            © {new Date().getFullYear()} Prestige Motion. {dict.footer.allRightsReserved}
          </p>
          <div className="flex items-center gap-6">
            <LanguageSwitcher variant="footer" />
            <div className="flex flex-wrap gap-4">
              <Link href="/privacy" className="hover:text-zinc-300 transition-colors">
                {dict.footer.privacyPolicy}
              </Link>
              <Link href="/terms" className="hover:text-zinc-300 transition-colors">
                {dict.footer.termsOfService}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
