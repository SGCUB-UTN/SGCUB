const TONOS_BADGE = {
  info: 'bg-primary-fixed/30 text-primary',
  ok: 'bg-emerald-50 text-emerald-700',
  alerta: 'bg-amber-50 text-amber-700',
  error: 'bg-error-container text-on-error-container',
  neutro: 'bg-surface-container-high text-on-surface-variant',
}

const PUNTO_BADGE = {
  ok: 'bg-emerald-500',
  alerta: 'bg-amber-500',
  error: 'bg-error',
}

export default function StatusBadge({ badge }) {
  return (
    <span
      title={badge.title}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold ${TONOS_BADGE[badge.tono] ?? TONOS_BADGE.neutro}`}
    >
      {!badge.hideDot && PUNTO_BADGE[badge.tono] && <span className={`w-1.5 h-1.5 rounded-full ${PUNTO_BADGE[badge.tono]}`} />}
      {badge.icon && <span className="material-symbols-outlined !text-[20px] leading-none" aria-hidden="true">{badge.icon}</span>}
      {badge.label}
    </span>
  )
}
