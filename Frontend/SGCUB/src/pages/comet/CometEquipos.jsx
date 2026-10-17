import EquiposTable from '../../components/comet/EquiposTable'
import PageHeader from '../../components/shared/PageHeader'
import { useCometEquipos } from '../../hooks/useComet'

export default function CometEquipos() {
  const { data, isLoading, error, recargar } = useCometEquipos()

  return (
    <div className="w-full flex flex-col gap-5">
      <PageHeader
        breadcrumb={[
          { label: 'Integraciones' },
          { label: 'COMET', to: '/comet' },
          { label: 'Equipos' },
        ]}
        title="Equipos"
        actions={(
          <button
            type="button"
            onClick={recargar}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded text-sm font-medium bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/40 text-on-surface transition-colors disabled:opacity-60"
          >
            <span className={`material-symbols-outlined text-[18px] ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true">
              refresh
            </span>
            <span>Actualizar</span>
          </button>
        )}
      />

      <section aria-label="Equipos">
        <EquiposTable data={data} isLoading={isLoading} error={error} />
      </section>
    </div>
  )
}