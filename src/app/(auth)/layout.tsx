import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col min-h-screen bg-background text-on-surface">
      <Navbar />

      <main className="flex-grow flex items-center justify-center py-12 md:py-16 px-margin-mobile md:px-margin-desktop relative overflow-hidden">
        {/* Subtle luxury ambient radial glows */}
        <div 
          className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-secondary/5 rounded-full blur-3xl pointer-events-none" 
          aria-hidden="true"
        />
        <div 
          className="absolute bottom-10 left-1/3 w-[350px] h-[350px] bg-primary-container/20 rounded-full blur-3xl pointer-events-none" 
          aria-hidden="true"
        />

        <div className="relative z-10 w-full flex justify-center">
          {children}
        </div>
      </main>

      <Footer />
    </div>
  )
}
