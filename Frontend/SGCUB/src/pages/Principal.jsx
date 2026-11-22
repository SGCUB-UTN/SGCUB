import useDashboard from '../hooks/useDashboard'
import AlertCenterSection from '../components/dashboard/AlertCenterSection'
import CuotaStatusSection from '../components/dashboard/CuotaStatusSection'
import DocumentationCenterSection from '../components/dashboard/DocumentationCenterSection'
import MemberCountsSection from '../components/dashboard/MemberCountsSection'
import PageHeader from '../components/shared/PageHeader'
import { SecondaryButton } from '../components/personas/tabs/parts'

export default function Principal() {
  const { isLoading, data, error, reload } = useDashboard()
  const sinDatos = Boolean(error) && !data

  return (
    <div className="w-full flex flex-col gap-5 pb-8">
      <PageHeader
        breadcrumb={[{ label: 'Inicio' }]}
        title="Panel principal"
      />

      {error && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-error-container/40 border border-error/20 rounded-md text-on-error-container" role="alert">
          <span className="material-symbols-outlined text-[20px] shrink-0" aria-hidden="true">cloud_off</span>
          <p className="flex-1 text-base">
            {sinDatos
              ? 'No pudimos traer el resumen. Revisá la conexión y probá de nuevo.'
              : 'No pudimos actualizar el resumen. Estás viendo los últimos datos que se cargaron.'}
          </p>
          <SecondaryButton icon="refresh" onClick={reload}>Reintentar</SecondaryButton>
        </div>
      )}

      {!sinDatos && (
        <>
          <MemberCountsSection isLoading={isLoading} members={data?.members} />

          <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-space-lg">
            <CuotaStatusSection isLoading={isLoading} cuotas={data?.cuotas} income={data?.income} />
            <DocumentationCenterSection isLoading={isLoading} documentation={data?.documentation} />
          </div>

          <AlertCenterSection isLoading={isLoading} alerts={data?.alerts} />
        </>
      )}
    </div>
  )
}
