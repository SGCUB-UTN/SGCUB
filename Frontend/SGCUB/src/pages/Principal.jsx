import useDashboard from '../hooks/useDashboard'
import AlertCenterSection from '../components/dashboard/AlertCenterSection'
import CuotaStatusSection from '../components/dashboard/CuotaStatusSection'
import DocumentationCenterSection from '../components/dashboard/DocumentationCenterSection'
import MemberCountsSection from '../components/dashboard/MemberCountsSection'
import PageHeader from '../components/shared/PageHeader'
import LoadErrorBanner from '../components/shared/LoadErrorBanner'

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
        <LoadErrorBanner
          message={sinDatos
            ? 'No pudimos traer el resumen. Revisá la conexión y probá de nuevo.'
            : 'No pudimos actualizar el resumen. Estás viendo los últimos datos que se cargaron.'}
          onRetry={reload}
        />
      )}

      {!sinDatos && (
        <>
          <MemberCountsSection isLoading={isLoading} members={data?.members} />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-space-lg">
            <CuotaStatusSection isLoading={isLoading} cuotas={data?.cuotas} income={data?.income} />
            <DocumentationCenterSection isLoading={isLoading} documentation={data?.documentation} />
          </div>

          <AlertCenterSection isLoading={isLoading} alerts={data?.alerts} />
        </>
      )}
    </div>
  )
}
