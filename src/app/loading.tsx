export default function RootLoading() {
  return (
    <div className="flex-grow flex flex-col items-center justify-center min-h-[50vh] bg-background">
      <div className="flex flex-col items-center gap-4">
        {/* Simple elegant spinner */}
        <div className="w-12 h-12 rounded-full border-4 border-surface-variant border-t-secondary animate-spin"></div>
        <p className="text-on-surface-variant font-label-caps tracking-widest uppercase text-sm animate-pulse">
          Loading Prestige Motion...
        </p>
      </div>
    </div>
  )
}
