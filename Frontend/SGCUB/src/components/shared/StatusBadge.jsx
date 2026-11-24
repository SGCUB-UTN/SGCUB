import { TONOS_BADGE } from './statusTones'

const SIZES = {
  sm: 'gap-1 px-1.5 py-0.5 text-xs',
  md: 'gap-1.5 px-2.5 py-0.5 text-sm',
}

export default function StatusBadge({ badge, size = 'sm' }) {
  return (
    <span
      title={badge.title}
      className={`inline-flex items-center rounded-full font-semibold tabular-nums whitespace-nowrap ${SIZES[size] ?? SIZES.sm} ${TONOS_BADGE[badge.tono] ?? TONOS_BADGE.neutro}`}
    >
      {badge.icon && <span className="material-symbols-outlined !text-[20px] leading-none" aria-hidden="true">{badge.icon}</span>}
      {badge.label}
    </span>
  )
}
