const TONES = {
  neutral: { icon: 'bg-surface-container-high text-primary' },
  positive: { icon: 'bg-emerald-50 text-emerald-700 border border-emerald-100' },
  muted: { icon: 'bg-surface-container-high text-on-surface-variant' },
  warning: { icon: 'bg-secondary-fixed text-on-secondary-fixed', accent: 'text-secondary' },
  error: { icon: 'bg-error-container text-error', accent: 'text-error' },
}

const SIZES = {
  md: { row: 'mt-0.5', value: 'text-xl sm:text-2xl', caption: 'text-sm' },
  lg: { row: 'mt-2', value: 'font-display-lg text-display-lg leading-none', caption: 'text-base' },
}

export default function StatCard({ label, value, icon, tone = 'neutral', size = 'md', eyebrow, caption, wrapContent = false }) {
  const style = TONES[tone] ?? TONES.neutral
  const sizeStyle = SIZES[size] ?? SIZES.md
  return (
    <div className="min-w-0 bg-surface-container-lowest border border-outline-variant/30 rounded-lg p-4 flex items-center justify-between gap-3 shadow-xs">
      <div className="flex flex-col min-w-0">
        {eyebrow && (
          <span className={`text-sm font-semibold uppercase tracking-wider ${style.accent ?? 'text-outline'}`}>{eyebrow}</span>
        )}
        <span className="text-base xl:text-xl leading-tight font-medium text-on-surface-variant uppercase tracking-wider break-words">{label}</span>

        <div className={`flex items-baseline flex-wrap gap-x-1.5 gap-y-0 min-w-0 ${sizeStyle.row}`}>
          <span className={`${sizeStyle.value} font-bold truncate ${style.accent ?? 'text-on-surface'}`}>{value}</span>
          {caption && (
            <span className={`${sizeStyle.caption} font-medium text-on-surface-variant break-words ${style.accent ?? ''}`}>{caption}</span>
          )}
        </div>
      </div>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${style.icon}`}>
        <span className="material-symbols-outlined text-[22px]" aria-hidden="true">{icon}</span>
      </div>
    </div>
  )
}
