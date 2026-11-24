export default function InactiveTag({ children }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-outline-variant/50 bg-surface-container-high text-sm font-medium text-on-surface-variant whitespace-nowrap">
      {children}
    </span>
  )
}
