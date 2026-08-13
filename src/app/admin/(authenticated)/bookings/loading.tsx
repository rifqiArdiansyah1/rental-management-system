export default function BookingsLoading() {
  // A helper array for skeleton rows
  const skeletonRows = Array(5).fill(0)

  return (
    <div className="p-4 md:p-8 animate-pulse">
      <div className="h-9 w-64 bg-zinc-200 rounded mb-6"></div>

      {/* Mobile Card Skeleton (< lg) */}
      <div className="lg:hidden flex flex-col gap-4">
        {skeletonRows.map((_, i) => (
          <div key={`card-${i}`} className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-zinc-100 flex justify-between items-start">
              <div>
                <div className="h-6 w-24 bg-zinc-200 rounded"></div>
                <div className="h-4 w-32 bg-zinc-200 rounded mt-2"></div>
              </div>
              <div className="h-5 w-20 bg-zinc-200 rounded-full"></div>
            </div>
            
            <div className="p-4 grid grid-cols-2 gap-4">
              <div>
                <div className="h-4 w-20 bg-zinc-200 rounded mb-2"></div>
                <div className="h-5 w-32 bg-zinc-200 rounded mb-1"></div>
                <div className="h-4 w-24 bg-zinc-200 rounded"></div>
              </div>
              <div>
                <div className="h-4 w-20 bg-zinc-200 rounded mb-2"></div>
                <div className="h-5 w-24 bg-zinc-200 rounded mb-1"></div>
                <div className="h-4 w-28 bg-zinc-200 rounded"></div>
              </div>
            </div>

            <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex flex-col gap-2">
              <div className="h-[44px] w-full bg-zinc-200 rounded-md"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table Skeleton (>= lg) */}
      <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="px-6 py-4"><div className="h-5 w-24 bg-zinc-200 rounded"></div></th>
                <th className="px-6 py-4"><div className="h-5 w-24 bg-zinc-200 rounded"></div></th>
                <th className="px-6 py-4"><div className="h-5 w-32 bg-zinc-200 rounded"></div></th>
                <th className="px-6 py-4"><div className="h-5 w-28 bg-zinc-200 rounded"></div></th>
                <th className="px-6 py-4"><div className="h-5 w-16 bg-zinc-200 rounded ml-auto"></div></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {skeletonRows.map((_, i) => (
                <tr key={`row-${i}`}>
                  <td className="px-6 py-4">
                    <div className="h-5 w-24 bg-zinc-200 rounded mb-2"></div>
                    <div className="h-4 w-32 bg-zinc-200 rounded"></div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-5 w-32 bg-zinc-200 rounded mb-2"></div>
                    <div className="h-4 w-28 bg-zinc-200 rounded"></div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-5 w-24 bg-zinc-200 rounded mb-2"></div>
                    <div className="h-4 w-32 bg-zinc-200 rounded"></div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-6 w-24 bg-zinc-200 rounded-full mb-2"></div>
                    <div className="h-4 w-20 bg-zinc-200 rounded"></div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-9 w-32 bg-zinc-200 rounded ml-auto"></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
