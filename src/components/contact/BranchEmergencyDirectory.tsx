import React from 'react'
import { Building2, Phone, Clock, MapPin, ShieldCheck, AlertCircle } from 'lucide-react'

interface BranchItem {
  id: string
  name: string
  city: string
  address: string
  phone: string
  openTime?: string
  closeTime?: string
}

interface BranchEmergencyDirectoryProps {
  branches: BranchItem[]
  isEn?: boolean
}

export default function BranchEmergencyDirectory({
  branches,
  isEn = false,
}: BranchEmergencyDirectoryProps) {
  return (
    <div className="space-y-8">
      {/* Branch Contacts Grid */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-secondary" />
          <h3 className="font-headline-md text-lg text-white font-bold">
            {isEn ? 'Direct Branch Operational Hotlines' : 'Kontak Hotline Langsung Cabang Operasional'}
          </h3>
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed">
          {isEn
            ? 'Each branch operates dedicated local fleet support during service hours (08:00 – 21:00 WIB):'
            : 'Setiap cabang mengelola armada dan penanganan kendala lokal pada jam operasional (08:00 – 21:00 WIB):'}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map((b) => (
            <div
              key={b.id}
              className="bg-surface-container-lowest/90 border border-surface-variant/40 hover:border-secondary/40 rounded-xl p-5 flex flex-col justify-between transition-all group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                    {b.city}
                  </span>
                  <span className="text-xs text-zinc-400 flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3 text-secondary" /> {b.openTime || '08:00'}–{b.closeTime || '21:00'} WIB
                  </span>
                </div>
                <h4 className="text-base font-bold text-white group-hover:text-secondary-light transition-colors">
                  {b.name}
                </h4>
                <p className="text-xs text-zinc-400 line-clamp-2 flex items-start gap-1">
                  <MapPin className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0 mt-0.5" />
                  <span>{b.address}</span>
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-zinc-800/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase text-zinc-500 block">Nomor Telepon</span>
                  <span className="font-mono text-sm font-semibold text-white">{b.phone}</span>
                </div>
                <a
                  href={`tel:${b.phone}`}
                  data-testid={`branch-direct-call-${b.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/15 hover:bg-secondary/25 text-secondary border border-secondary/30 text-xs font-semibold transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Call' : 'Telepon'}</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Safety SOP & Operational Transparency */}
      <div className="bg-surface-container-high/40 border border-zinc-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <h4 className="text-sm font-bold text-white uppercase tracking-wider">
            {isEn
              ? 'Roadside Emergency Protocol (Safety SOP)'
              : 'Standar Operasional Keselamatan Darurat di Jalan (SOP Lapangan)'}
          </h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
            <span className="font-mono text-amber-400 font-bold">1. AMANKAN KENDARAAN</span>
            <p className="text-zinc-300 leading-relaxed">
              Nyalakan lampu hazard segera. Jika aman, pasang segitiga pengaman minimal 30 meter di belakang unit.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
            <span className="font-mono text-emerald-400 font-bold">2. ZONA AMAN PENUMPANG</span>
            <p className="text-zinc-300 leading-relaxed">
              Evakuasi seluruh penumpang keluar dari kabin mobil ke balik pembatas jalan tol atau trotoar yang aman.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
            <span className="font-mono text-red-400 font-bold">3. DARURAT UTAMA (112 / 14080)</span>
            <p className="text-zinc-300 leading-relaxed">
              Bila terdapat korban luka atau berada di jalan tol, hubungi Panggilan Darurat Terpadu 112 atau Derek Tol 14080 seketika.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
            <span className="font-mono text-blue-400 font-bold">4. LAPOR & DOKUMENTASI</span>
            <p className="text-zinc-300 leading-relaxed">
              Laporkan via tombol Lapor Kendala di atas dan ambil dokumentasi visual untuk keperluan asuransi armada.
            </p>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-blue-950/30 border border-blue-900/40 text-xs text-blue-200 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Transparansi Jam Layanan:</strong> Cabang kami beroperasi pada pukul <strong>08:00 – 21:00 WIB</strong>. Di luar rentang waktu tersebut, seluruh tim eskalasi darurat kami mengandalkan koordinasi prioritas bersama otoritas darurat terpadu nasional (112 & 14080). Laporan kendala yang Anda submit di luar jam operasional otomatis diproses sebagai prioritas pertama saat operasional pagi dimulai.
          </p>
        </div>
      </div>
    </div>
  )
}
