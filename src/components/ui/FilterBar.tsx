'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface FilterBarProps {
  branches: Array<{ id: string; name: string; city: string }>
  categories: Array<{ id: string; name: string }>
}

export default function FilterBar({ branches, categories }: FilterBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t, locale } = useLanguage()
  const isEn = locale === 'en'
  
  const currentBranch = searchParams.get('branch') || 'all'
  const currentCategory = searchParams.get('category') || 'all'

  const [branchId, setBranchId] = useState(currentBranch)
  const [categoryId, setCategoryId] = useState(currentCategory)

  const applyFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (branchId !== 'all') {
      params.set('branch', branchId)
    } else {
      params.delete('branch')
    }

    if (categoryId !== 'all') {
      params.set('category', categoryId)
    } else {
      params.delete('category')
    }

    router.push(`/?${params.toString()}`, { scroll: false })
  }, [branchId, categoryId, router, searchParams])

  return (
    <section className="relative z-20 w-full px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto -mt-8">
      <div className="bg-surface-container-high border border-outline-variant/30 rounded-lg p-6 shadow-2xl backdrop-blur-xl flex flex-col md:flex-row items-end gap-6 transition-all duration-300 hover:border-secondary/30">
        <div className="w-full md:w-1/3 flex flex-col gap-2">
          <label className="font-label-caps text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
            {isEn ? 'Select Location' : 'Pilihan Cabang'}
          </label>
          <div className="relative">
            <select 
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full min-h-[44px] h-[46px] bg-surface border border-outline-variant rounded p-3 text-on-surface font-body-md focus:border-secondary focus:ring-1 focus:ring-secondary appearance-none text-sm transition-colors duration-200"
            >
              <option value="all">{t.home.filter.allBranches}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.city} - {b.name}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-on-surface-variant">
              <span className="material-symbols-outlined">expand_more</span>
            </div>
          </div>
        </div>
        <div className="w-full md:w-1/3 flex flex-col gap-2">
          <label className="font-label-caps text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
            {isEn ? 'Vehicle Category' : 'Kategori Kendaraan'}
          </label>
          <div className="relative">
            <select 
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full min-h-[44px] h-[46px] bg-surface border border-outline-variant rounded p-3 text-on-surface font-body-md focus:border-secondary focus:ring-1 focus:ring-secondary appearance-none text-sm transition-colors duration-200"
            >
              <option value="all">{t.home.filter.allCategories}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-on-surface-variant">
              <span className="material-symbols-outlined">expand_more</span>
            </div>
          </div>
        </div>
        <div className="w-full md:w-auto md:ml-auto">
          <button 
            onClick={applyFilters}
            className="group w-full md:w-auto min-h-[44px] h-[46px] bg-surface-container-lowest border border-secondary text-secondary font-button text-sm font-semibold px-8 py-3 rounded-DEFAULT hover:bg-secondary/15 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px] transition-transform duration-300 group-hover:scale-110">search</span>
            {isEn ? 'Apply Filter' : 'Terapkan Filter'}
          </button>
        </div>
      </div>
    </section>
  )
}
