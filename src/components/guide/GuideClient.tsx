'use client'

import { useState } from 'react'
import Link from 'next/link'
import { 
  ChevronDown, 
  HelpCircle, 
  ShieldAlert, 
  Clock, 
  CreditCard, 
  Compass, 
  FileText,
  AlertTriangle
} from 'lucide-react'

export interface FaqItem {
  category: 'kyc' | 'booking' | 'payment' | 'road'
  question: string
  answer: string
}

interface GuideClientProps {
  faqItems: FaqItem[]
  categories: {
    kyc: string
    booking: string
    payment: string
    road: string
  }
  allTabLabel: string
  overtimeDict: {
    title: string
    subtitle: string
    tier1Title: string
    tier1Desc: string
    tier2Title: string
    tier2Desc: string
    tier3Title: string
    tier3Desc: string
    termsLinkText: string
  }
  constantsData: {
    graceMinutes: number
    overtimePercent: number
    minOvertimeRate: number
    extremeHours: number
    turnoverHours: number
  }
  locale: string
}

export default function GuideClient({
  faqItems,
  categories,
  allTabLabel,
  overtimeDict,
  constantsData,
  locale,
}: GuideClientProps) {
  const isEn = locale === 'en'
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [openFaqIndices, setOpenFaqIndices] = useState<Record<number, boolean>>({})
  const [showOvertimeBreakdown, setShowOvertimeBreakdown] = useState<boolean>(false)

  const toggleFaq = (index: number) => {
    setOpenFaqIndices((prev) => ({
      ...prev,
      [index]: !prev[index],
    }))
  }

  const filteredFaqs = faqItems
    .map((item, originalIndex) => ({ ...item, originalIndex }))
    .filter((item) => selectedCategory === 'all' || item.category === selectedCategory)

  const categoryIcons: Record<string, any> = {
    kyc: FileText,
    booking: Clock,
    payment: CreditCard,
    road: Compass,
  }

  return (
    <div className="space-y-16">
      {/* Interactive Overtime Breakdown Accordion */}
      <div 
        id="overtime-breakdown" 
        className="bg-surface-container-low/70 border border-surface-variant/40 rounded-2xl p-6 md:p-8 hover:border-secondary/30 transition-all duration-300"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-secondary/10 border border-secondary/20 text-secondary mt-0.5">
              <Clock className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <h3 className="text-lg md:text-xl font-bold text-on-surface">
                {overtimeDict.title}
              </h3>
              <p className="text-xs md:text-sm text-on-surface-variant mt-1 leading-relaxed max-w-2xl">
                {overtimeDict.subtitle}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {isEn ? `Grace period: ${constantsData.graceMinutes} mins` : `Masa tenggang: ${constantsData.graceMinutes} menit`}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                  {isEn ? `Overtime: ${constantsData.overtimePercent * 100}% / hour` : `Denda: ${constantsData.overtimePercent * 100}% / jam`}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowOvertimeBreakdown(!showOvertimeBreakdown)}
            data-testid="toggle-overtime-breakdown-btn"
            className="self-start md:self-center px-4 py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-secondary border border-secondary/20 hover:border-secondary/40 text-xs font-semibold tracking-wide transition-all duration-200 inline-flex items-center gap-2 cursor-pointer"
          >
            <span>{showOvertimeBreakdown ? (isEn ? 'Hide Breakdown' : 'Sembunyikan Rincian') : (isEn ? 'View Breakdown Schedule' : 'Lihat Rincian Skema Denda')}</span>
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showOvertimeBreakdown ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Breakdown Content */}
        {showOvertimeBreakdown && (
          <div className="mt-8 pt-6 border-t border-surface-variant/30 space-y-4 animate-fade-in" data-testid="overtime-breakdown-details">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Tier 1 */}
              <div className="bg-surface-container/60 border border-emerald-500/20 rounded-xl p-5 hover:border-emerald-500/40 transition-colors">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold mb-2">
                  <span>✓ {isEn ? 'Grace Period' : 'Bebas Denda'}</span>
                </div>
                <h4 className="text-sm md:text-base font-bold text-on-surface mb-1">
                  {overtimeDict.tier1Title}
                </h4>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  {overtimeDict.tier1Desc}
                </p>
                <div className="mt-3 pt-3 border-t border-surface-variant/30 text-xs font-mono font-bold text-emerald-400">
                  Rp 0
                </div>
              </div>

              {/* Tier 2 */}
              <div className="bg-surface-container/60 border border-amber-500/20 rounded-xl p-5 hover:border-amber-500/40 transition-colors">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 text-xs font-semibold mb-2">
                  <span className="material-symbols-outlined text-[14px]">warning</span>
                  <span>{isEn ? 'Proportional Hourly' : 'Denda per Jam'}</span>
                </div>
                <h4 className="text-sm md:text-base font-bold text-on-surface mb-1">
                  {overtimeDict.tier2Title}
                </h4>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  {overtimeDict.tier2Desc}
                </p>
                <div className="mt-3 pt-3 border-t border-surface-variant/30 text-xs font-mono font-bold text-amber-300">
                  {constantsData.overtimePercent * 100}% {isEn ? 'daily rate / hr' : 'tarif sewa / jam'}
                </div>
              </div>

              {/* Tier 3 */}
              <div className="bg-surface-container/60 border border-rose-500/20 rounded-xl p-5 hover:border-rose-500/40 transition-colors">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-300 text-xs font-semibold mb-2">
                  <span className="material-symbols-outlined text-[14px]">error</span>
                  <span>{isEn ? 'Extreme Overtime' : 'Keterlambatan Ekstrem'}</span>
                </div>
                <h4 className="text-sm md:text-base font-bold text-on-surface mb-1">
                  {overtimeDict.tier3Title}
                </h4>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  {overtimeDict.tier3Desc}
                </p>
                <div className="mt-3 pt-3 border-t border-surface-variant/30 text-xs font-mono font-bold text-rose-300">
                  1 {isEn ? 'Full Day Rate' : 'Hari Penuh'}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 text-right">
              <Link 
                href="/terms#section-4" 
                className="text-xs text-secondary hover:underline font-semibold inline-flex items-center gap-1.5"
              >
                <span>{overtimeDict.termsLinkText}</span>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* FAQ Section */}
      <section id="faq" className="scroll-mt-24">
        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 mb-8 justify-center md:justify-start">
          <button
            onClick={() => setSelectedCategory('all')}
            data-testid="faq-category-all"
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-secondary text-on-secondary shadow-md'
                : 'bg-surface-container-low text-on-surface-variant hover:text-white hover:bg-surface-container'
            }`}
          >
            {allTabLabel}
          </button>

          {Object.entries(categories).map(([key, label]) => {
            const Icon = categoryIcons[key] || HelpCircle
            const isSelected = selectedCategory === key
            return (
              <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                data-testid={`faq-category-${key}`}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'bg-secondary text-on-secondary shadow-md'
                    : 'bg-surface-container-low text-on-surface-variant hover:text-white hover:bg-surface-container'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            )
          })}
        </div>

        {/* FAQ Accordion List */}
        <div className="space-y-3.5" data-testid="faq-accordion-list">
          {filteredFaqs.map((item) => {
            const isOpen = Boolean(openFaqIndices[item.originalIndex])
            return (
              <div
                key={item.originalIndex}
                className={`bg-surface-container-low/70 border rounded-xl overflow-hidden transition-all duration-200 ${
                  isOpen 
                    ? 'border-secondary/40 shadow-sm' 
                    : 'border-surface-variant/40 hover:border-secondary/20'
                }`}
              >
                <button
                  onClick={() => toggleFaq(item.originalIndex)}
                  data-testid={`faq-item-btn-${item.originalIndex}`}
                  className="w-full text-left p-5 md:p-6 flex items-start justify-between gap-4 cursor-pointer focus:outline-none"
                  aria-expanded={isOpen}
                >
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-[20px] text-secondary flex-shrink-0 mt-0.5">
                      help
                    </span>
                    <span className="text-sm md:text-base font-semibold text-on-surface leading-snug">
                      {item.question}
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-secondary flex-shrink-0 transition-transform duration-200 mt-0.5 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div 
                    className="px-5 md:px-6 pb-6 pt-1 text-xs md:text-sm text-on-surface-variant leading-relaxed border-t border-surface-variant/20 animate-fade-in pl-11 md:pl-12"
                    data-testid={`faq-answer-${item.originalIndex}`}
                  >
                    <p>{item.answer}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
