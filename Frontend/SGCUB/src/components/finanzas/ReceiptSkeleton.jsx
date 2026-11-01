import { SkeletonBlock, SkeletonStatus } from '../shared/Skeleton'

export default function ReceiptSkeleton() {
  return (
    <SkeletonStatus label="Cargando comprobante..." className="flex flex-col gap-4">
      <div className="flex items-center gap-3 p-4 rounded-lg bg-surface-container-low border border-outline-variant/30">
        <SkeletonBlock className="w-8 h-8 shrink-0" />
        <div className="flex flex-1 flex-col gap-2">
          <SkeletonBlock soft className="h-3.5 w-40" />
          <SkeletonBlock className="h-6 w-48" />
        </div>
        <SkeletonBlock round className="h-6 w-16 shrink-0" />
      </div>
      <div className="grid grid-cols-2 gap-x-4">
        {[0, 1].map((index) => (
          <div key={index} className="flex flex-col gap-2">
            <SkeletonBlock soft className="h-3.5 w-28" />
            <SkeletonBlock className="h-6 w-32" />
          </div>
        ))}
      </div>
      <SkeletonBlock soft className="h-14 w-full" />
      <div className="flex flex-col gap-2 border border-outline-variant/30 rounded-lg p-3">
        <SkeletonBlock className="h-4 w-36" />
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex items-center justify-between gap-3">
            <SkeletonBlock soft className="h-3.5 w-1/2" />
            <SkeletonBlock soft className="h-3.5 w-20" />
          </div>
        ))}
      </div>
    </SkeletonStatus>
  )
}
