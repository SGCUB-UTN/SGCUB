import SectionHeading from './SectionHeading'
import { FLUSH_TABLE_CLASS, INSET_PADDING_X_CLASS } from './flushTable'

// Section of a card that spans its whole width: heading bar and tables go edge to edge, as in the
// tabs of a persona (see flushTable)
export default function FlushSection({ id, icon, title, actions, className = '', children }) {
  return (
    <section aria-labelledby={id} className={`min-w-0 ${FLUSH_TABLE_CLASS} ${className}`}>
      <SectionHeading id={id} as="h3" icon={icon} title={title} actions={actions} className={`${INSET_PADDING_X_CLASS} border-b`} />
      {children}
    </section>
  )
}

export function SectionEmpty({ children }) {
  return <p className={`${INSET_PADDING_X_CLASS} py-6 text-center text-base text-on-surface-variant`}>{children}</p>
}
