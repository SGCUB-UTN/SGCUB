import useDocumentacion from '../hooks/useDocumentacion'
import PageHeader from '../components/shared/PageHeader'
import StatCard from '../components/shared/StatCard'
import DocumentAlertTable from '../components/documental/DocumentAlertTable'
import { parseDueDate } from '../components/documental/dueDate'
import { HeadingSkeleton, SkeletonBlock, SkeletonStatus, TableSkeletonRows } from '../components/shared/Skeleton'

export default function DocumentacionDashboard() {
  const { documentosActivos: documentos, isLoading, getNombreTipo } = useDocumentacion(null, true)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const activeDocs = documentos
    .filter(doc => doc.persona_es_activo && doc.fecha_vencimiento)
    .map(doc => ({ ...doc, ...parseDueDate(doc, today) }))

  const expiredDocs = activeDocs
    .filter(doc => doc.daysFromToday < 0)
    .map(doc => ({ ...doc, overdueDays: Math.floor(-doc.daysFromToday) }))

  const upcomingDocs = activeDocs
    .filter(doc => doc.daysFromToday >= 0 && doc.daysFromToday <= 30)
    .map(doc => ({ ...doc, daysLeft: Math.ceil(doc.daysFromToday) }))

  const validCount = activeDocs.length - expiredDocs.length

  if (isLoading) {
    return (
      <SkeletonStatus label="Cargando dashboard documental..." className="w-full flex flex-col gap-5 pb-8">
        <SkeletonBlock soft className="h-4 w-56 mt-2" />
        <SkeletonBlock className="h-7 w-72 max-w-full" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((index) => <SkeletonBlock key={index} className="h-24 rounded-lg" />)}
        </div>
        {[0, 1].map((panel) => (
          <div key={panel} className="bg-surface-container-lowest rounded-lg shadow-sm overflow-hidden">
            <HeadingSkeleton withAction />
            <table className="w-full">
              <tbody>
                <TableSkeletonRows colSpan={4} rows={3} animated={false} />
              </tbody>
            </table>
          </div>
        ))}
      </SkeletonStatus>
    )
  }

  return (
    <div className="flex flex-col w-full gap-space-xl pb-space-xl">
      <div className="flex flex-col gap-1 max-w-3xl">
        <PageHeader breadcrumb={[{ label: 'Documental' }]} title="Control Documental" />
        <p className="font-body-md text-body-md text-on-surface-variant">
          Seguimiento institucional de aptos médicos, fichas de salud, autorizaciones y fichajes federativos del club.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard size="lg" eyebrow="Alerta Crítica" label="Documentación Vencida" value={expiredDocs.length} caption="inhabilitados" icon="gpp_bad" tone="error" />
        <StatCard size="lg" eyebrow="Prevención Activa" label="Próxima a Vencer" value={upcomingDocs.length} caption="a vencer (próx. 30 días)" icon="notification_important" tone="warning" />
        <StatCard size="lg" eyebrow="Cobertura Total" label="Total Vigentes al Día" value={validCount} caption="activos" icon="verified_user" tone="neutral" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg items-start">
        <DocumentAlertTable
          title="Próximos a Vencer"
          icon="timelapse"
          tone="warning"
          documentHeader="Documento Requerido"
          dateHeader="Vencimiento"
          rows={upcomingDocs}
          getBadgeLabel={doc => `Vence en ${doc.daysLeft} día/s`}
          getTypeName={getNombreTipo}
          emptyMessage="No hay documentos próximos a vencer"
        />
        <DocumentAlertTable
          title="Documentos Vencidos"
          icon="cancel"
          tone="error"
          documentHeader="Documento Vencido"
          dateHeader="Fecha Vencida"
          rows={expiredDocs}
          getBadgeLabel={doc => `${doc.overdueDays} día/s de mora`}
          getTypeName={getNombreTipo}
          emptyMessage="No hay documentos vencidos"
        />
      </div>
    </div>
  )
}
