import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ClubSettings from '../components/configuracion/ClubSettings'
import CommunicationSettings from '../components/configuracion/CommunicationSettings'
import ConfigurationHistoryModal from '../components/configuracion/ConfigurationHistoryModal'
import DocumentSettings from '../components/configuracion/DocumentSettings'
import FinancialSettings from '../components/configuracion/FinancialSettings'
import PersonasSettings from '../components/configuracion/PersonasSettings'
import { formatVigencia } from '../components/configuracion/financialFields'
import { generalChangeLabels } from '../components/configuracion/generalFields'
import SaveChangesBar from '../components/configuracion/SaveChangesBar'
import SaveChangesModal from '../components/configuracion/SaveChangesModal'
import { BUTTON_CLASSES } from '../components/configuracion/settingsForm'
import { Notice } from '../components/configuracion/settingsParts'
import UnsavedChangesGuard from '../components/configuracion/UnsavedChangesGuard'
import PersonTabs from '../components/personas/TabsNavPersonas'
import PageHeader from '../components/shared/PageHeader'
import { SkeletonStatus, TabsSkeleton } from '../components/shared/Skeleton'
import useConfiguracion from '../hooks/useConfiguracion'

const annulledMessage = (annulled) => (
  annulled ? ` Se ${annulled === 1 ? 'anuló 1 cuota' : `anularon ${annulled} cuotas`} de jugadores en categorías exentas.` : ''
)

const savedMessage = (result) => {
  const version = result.financiera
  const annulled = annulledMessage(result.cuotas_anuladas)
  if (!version) return `Los cambios se guardaron.${annulled}`
  const updated = version.cuotas_actualizadas
  return `Los cambios se guardaron. Los aranceles y el calendario de facturación aplican ${formatVigencia(version.periodo_vigencia).toLowerCase()}`
    + (updated ? ` y se actualizaron ${updated} ${updated === 1 ? 'cuota' : 'cuotas'}.` : '.')
    + annulled
}

const revertedMessage = (version) => {
  const updated = version.cuotas_actualizadas
  return `Se revirtió el cambio programado ${formatVigencia(version.periodo_vigencia).toLowerCase()}`
    + (updated ? ` y se actualizaron ${updated} ${updated === 1 ? 'cuota' : 'cuotas'}.` : '.')
}

export default function Configuracion() {
  const config = useConfiguracion()
  const [searchParams] = useSearchParams()
  const [history, setHistory] = useState({ opened: false, section: '' })
  const [saveOpened, setSaveOpened] = useState(false)
  const [notice, setNotice] = useState({ tone: 'success', message: '' })

  const openHistory = (section = '') => setHistory({ opened: true, section })
  const isReady = !config.isLoading && !config.error && config.general && config.financiera
  const changesCount = config.changes.financiera.length
    + config.changes.exentas.length
    + generalChangeLabels(config.changes.general).length
    + (config.changes.logo ? 1 : 0)

  const requestSave = () => {
    if (config.validate()) {
      setNotice({ tone: 'success', message: '' })
      setSaveOpened(true)
    } else {
      setNotice({ tone: 'error', message: 'Hay datos con errores en Finanzas y facturación: revisalos antes de guardar.' })
    }
  }

  const cancel = () => {
    config.discard()
    setNotice({ tone: 'success', message: '' })
  }

  return (
    <div className="w-full flex flex-col gap-5 min-h-[calc(100vh-70px-1.5rem)] max-[700px]:min-h-[calc(100vh-80px-1rem)]">
      <PageHeader
        breadcrumb={[{ label: 'Administración' }, { label: 'Configuración' }]}
        title="Configuración"
        actions={(
          <button type="button" className={BUTTON_CLASSES.secondary} onClick={() => openHistory()} disabled={!isReady}>
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">history</span>
            Historial de cambios
          </button>
        )}
      />

      {config.isLoading && (
        <SkeletonStatus label="Cargando configuración...">
          <TabsSkeleton tabs={5} />
        </SkeletonStatus>
      )}
      {config.error && <Notice tone="error">No se pudo cargar la configuración. Recargá la página para volver a intentar.</Notice>}
      {notice.message && <Notice tone={notice.tone}>{notice.message}</Notice>}

      {isReady && (
        <PersonTabs
          defaultTab={searchParams.get('tab') ?? undefined}
          tabs={[
            {
              id: 'finanzas',
              label: 'Finanzas y facturación',
              icon: 'payments',
              content: (
                <FinancialSettings
                  config={config}
                  onShowHistory={() => openHistory('Finanzas')}
                  onReverted={(version) => setNotice({ tone: 'success', message: revertedMessage(version) })}
                />
              ),
            },
            {
              id: 'personas',
              label: 'Personas',
              icon: 'groups',
              content: <PersonasSettings />,
            },
            {
              id: 'documentacion',
              label: 'Documentación',
              icon: 'description',
              content: <DocumentSettings config={config} />,
            },
            {
              id: 'comunicaciones',
              label: 'Comunicaciones',
              icon: 'campaign',
              content: <CommunicationSettings config={config} />,
            },
            {
              id: 'club',
              label: 'Datos del club',
              icon: 'apartment',
              content: <ClubSettings config={config} />,
            },
          ]}
        />
      )}

      <SaveChangesBar count={changesCount} onCancel={cancel} onSave={requestSave} />

      {isReady && (
        <>
          <SaveChangesModal
            opened={saveOpened}
            onClose={() => setSaveOpened(false)}
            config={config}
            onSaved={(result) => setNotice({ tone: 'success', message: savedMessage(result) })}
          />
          <ConfigurationHistoryModal
            opened={history.opened}
            onClose={() => setHistory((current) => ({ ...current, opened: false }))}
            versions={config.versiones}
            initialSection={history.section}
          />
        </>
      )}

      <UnsavedChangesGuard isDirty={config.isDirty} />
    </div>
  )
}
