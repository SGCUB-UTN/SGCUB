import useDashboard from '../hooks/useDashboard'
import AlertCenterSection from '../components/dashboard/AlertCenterSection'
import CuotaStatusSection from '../components/dashboard/CuotaStatusSection'
import DocumentationCenterSection from '../components/dashboard/DocumentationCenterSection'
import MemberCountsSection from '../components/dashboard/MemberCountsSection'
import PageHeader from '../components/shared/PageHeader'

export default function Principal() {
  const { isLoading, data, error } = useDashboard()

  return (
    <div className="w-full flex flex-col gap-5 pb-8">
      <PageHeader
        breadcrumb={[{ label: 'Inicio' }]}
        title="Panel principal"
      />

      {error && (
        <p className="p-4 bg-error-container/40 border border-error/20 rounded-md text-sm text-on-error-container" role="alert">
          No se pudo cargar el panel principal.
        </p>
      )}

      <MemberCountsSection isLoading={isLoading} members={data?.members} />

      <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-space-lg">
        <CuotaStatusSection isLoading={isLoading} cuotas={data?.cuotas} income={data?.income} />
        <DocumentationCenterSection isLoading={isLoading} documentation={data?.documentation} />
      </div>

      <AlertCenterSection isLoading={isLoading} alerts={data?.alerts} />
    </div>
  )
}
