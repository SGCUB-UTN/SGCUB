import { useNavigate } from 'react-router-dom'

export default function ProfileLinkBadge({ to, icon, title, children }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      title={title}
      onClick={(event) => {
        event.stopPropagation()
        navigate(to)
      }}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-primary/30 bg-primary/5 text-xs font-semibold text-primary whitespace-nowrap hover:bg-primary hover:text-on-primary transition-colors cursor-pointer"
    >
      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">{icon}</span>
      {children}
    </button>
  )
}
