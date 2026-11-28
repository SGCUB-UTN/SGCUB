import { SecondaryButton } from '../personas/tabs/parts'

export default function LoadErrorBanner({ message, onRetry }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-error-container/40 border border-error/20 rounded-md text-on-error-container" role="alert">
      <span className="material-symbols-outlined text-[20px] shrink-0" aria-hidden="true">cloud_off</span>
      <p className="flex-1 text-base">{message}</p>
      <SecondaryButton icon="refresh" onClick={onRetry}>Reintentar</SecondaryButton>
    </div>
  )
}
