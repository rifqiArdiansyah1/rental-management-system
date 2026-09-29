import React from 'react'
import { Phone, ShieldAlert, AlertTriangle, Truck, HeartPulse, LifeBuoy } from 'lucide-react'

interface NationalEmergencyDialPadProps {
  isEn?: boolean
}

export default function NationalEmergencyDialPad({ isEn = false }: NationalEmergencyDialPadProps) {
  const emergencyServices = [
    {
      number: '112',
      title: isEn ? '112 Universal Emergency (Toll-Free)' : '112 Panggilan Darurat Terpadu (Bebas Pulsa)',
      desc: isEn
        ? 'National integrated hotline. Can be called without SIM card & from locked screens. Connects to Police, Fire, Medical, and Search & Rescue.'
        : 'Layanan Terpadu Nasional (Bebas Pulsa, tanpa kartu SIM & dalam kondisi layar terkunci). Terhubung ke Polisi, Damkar, Medis, dan SAR.',
      icon: ShieldAlert,
      color: 'from-red-600 to-rose-700 text-white border-red-500/50 shadow-red-900/30',
      badge: isEn ? 'UNIVERSAL FIRST RESPONSE' : 'PRIORITAS PERTAMA NASIONAL',
      isPrimary: true,
    },
    {
      number: '110',
      title: isEn ? '110 Indonesian National Police (Polri)' : '110 Kepolisian Republik Indonesia (Polri)',
      desc: isEn
        ? 'Traffic accidents, criminal emergency, highway robbery, and urgent security threats.'
        : 'Kecelakaan lalu lintas berat, gangguan keamanan, tindak kejahatan, dan pengawalan darurat jalan raya.',
      icon: ShieldAlert,
      color: 'from-blue-900/60 to-slate-900/80 text-blue-300 border-blue-800/40',
      badge: 'POLRI',
    },
    {
      number: '119',
      title: isEn ? '119 Medical & Ambulance Hotline (SPGDT)' : '119 Ambulans & Gawat Darurat Medis (SPGDT)',
      desc: isEn
        ? 'Ministry of Health integrated emergency response for critical injuries and rapid medical evacuation.'
        : 'Sistem Penanggulangan Gawat Darurat Terpadu (Kemenkes) untuk penanganan medis dan evakuasi korban luka.',
      icon: HeartPulse,
      color: 'from-emerald-950/60 to-slate-900/80 text-emerald-300 border-emerald-800/40',
      badge: 'MEDIS',
    },
    {
      number: '14080',
      title: isEn ? '14080 Jasa Marga Highway Towing & Rescue' : '14080 Derek & Rescue Tol Jasa Marga',
      desc: isEn
        ? 'Official 24-hour towing and roadside assistance for breakdowns across all Indonesian Toll Roads.'
        : 'Layanan derek resmi 24 jam dan penanganan darurat armada mogok di seluruh ruas Jalan Tol Jasa Marga.',
      icon: Truck,
      color: 'from-amber-950/60 to-slate-900/80 text-amber-300 border-amber-800/40',
      badge: 'JALAN TOL',
    },
    {
      number: '115',
      title: isEn ? '115 BASARNAS (Search & Rescue)' : '115 BASARNAS (Pencarian & Penyelamatan)',
      desc: isEn
        ? 'Extreme terrain rescue, natural disaster response, and isolated remote area evacuation.'
        : 'Operasi pertolongan darurat rute terisolir, bencana alam, dan penyelamatan kondisi kritis.',
      icon: LifeBuoy,
      color: 'from-orange-950/60 to-slate-900/80 text-orange-300 border-orange-800/40',
      badge: 'SAR',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-5 h-5 text-amber-400" />
        <h3 className="font-headline-md text-lg text-white font-bold">
          {isEn ? 'National Emergency Numbers (Instant Dial)' : 'Nomor Darurat Nasional Resmi (Panggilan Cepat)'}
        </h3>
      </div>
      <p className="text-xs text-zinc-400 leading-relaxed">
        {isEn
          ? 'If you are facing severe danger, medical emergencies, or toll road breakdowns, call official state emergency services directly:'
          : 'Jika Anda berada dalam bahaya kritis, kecelakaan lalu lintas, atau membutuhkan derek tol seketika, hubungi layanan resmi berikut:'}
      </p>

      {/* Primary Highlight: 112 Universal */}
      {emergencyServices.slice(0, 1).map((srv) => {
        const IconComponent = srv.icon
        return (
          <div
            key={srv.number}
            className="relative overflow-hidden bg-gradient-to-r from-red-950/80 via-red-900/40 to-surface-container-lowest border border-red-600/60 rounded-xl p-5 shadow-lg shadow-red-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 flex-shrink-0">
                <IconComponent className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-bold tracking-wider px-2 py-0.5 rounded bg-red-600 text-white">
                    {srv.badge}
                  </span>
                  <span className="text-xs text-red-200 font-medium">Bebas Pulsa / SIM-Free</span>
                </div>
                <h4 className="text-base font-bold text-white">{srv.title}</h4>
                <p className="text-xs text-zinc-300 max-w-xl leading-relaxed">{srv.desc}</p>
              </div>
            </div>
            <a
              href={`tel:${srv.number}`}
              data-testid="emergency-dial-112"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-red-600 hover:bg-red-500 text-white font-mono font-bold text-lg shadow-md hover:shadow-red-600/40 transition-all flex-shrink-0"
            >
              <Phone className="w-5 h-5 fill-current" />
              <span>Hubungi {srv.number}</span>
            </a>
          </div>
        )
      })}

      {/* Grid of Other Services */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        {emergencyServices.slice(1).map((srv) => {
          const IconComponent = srv.icon
          return (
            <div
              key={srv.number}
              className="bg-surface-container-lowest/80 border border-surface-variant/40 hover:border-zinc-500 rounded-lg p-4 flex flex-col justify-between transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                    {srv.badge}
                  </span>
                  <span className="font-mono text-xs text-zinc-400">24 Jam</span>
                </div>
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-surface-variant/30 flex items-center justify-center text-zinc-300 flex-shrink-0">
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-sm font-semibold text-white">{srv.title}</h5>
                    <p className="text-[11px] text-zinc-400 leading-snug line-clamp-2 mt-0.5">{srv.desc}</p>
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
                <span className="font-mono font-bold text-lg text-amber-300">{srv.number}</span>
                <a
                  href={`tel:${srv.number}`}
                  data-testid={`emergency-dial-${srv.number}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Panggil {srv.number}</span>
                </a>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
