import { Link } from 'react-router-dom'
import { DetailSkeleton } from '../shared/Skeleton'

export function LoadingFile({ text }) {
  return <DetailSkeleton label={text} />
}

export function ErrorFile({ message, backTo, backText }) {
  return (
    <div className="w-full space-y-4 pt-2">
      <Link
        to={backTo}
        className="inline-flex items-center gap-1.5 text-base font-medium text-on-surface-variant hover:text-primary px-3 py-1.5 rounded transition-colors bg-surface-container-lowest border border-outline-variant/30"
      >
        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        <span>{backText}</span>
      </Link>
      <div className="bg-error-container text-on-error-container p-4 rounded-lg border border-error/30 flex items-center gap-2.5" role="alert">
        <span className="material-symbols-outlined text-error">error</span>
        <p className="text-base font-medium">{message}</p>
      </div>
    </div>
  )
}
