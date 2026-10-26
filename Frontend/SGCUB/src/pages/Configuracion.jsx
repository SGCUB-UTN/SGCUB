import { useState } from 'react'
import ClubSettings from '../components/configuracion/ClubSettings'
import CommunicationSettings from '../components/configuracion/CommunicationSettings'
import ConfigurationHistoryModal from '../components/configuracion/ConfigurationHistoryModal'
import DocumentSettings from '../components/configuracion/DocumentSettings'
import FinancialSettings from '../components/configuracion/FinancialSettings'
import { formatVigencia } from '../components/configuracion/financialFields'
import { generalChangeLabels } from '../components/configuracion/generalFields'
import SaveChangesBar from '../components/configuracion/SaveChangesBar'
import SaveChangesModal from '../components/configuracion/SaveChangesModal'
import { BUTTON_CLASSES } from '../components/configuracion/settingsForm'
import { Notice } from '../components/configuracion/settingsParts'
import UnsavedChangesGuard from '../components/configuracion/UnsavedChangesGuard'
import PersonTabs from '../components/personas/TabsNavPersonas'
import PageHeader from '../components/shared/PageHeader'
import useConfiguracion from '../hooks/useConfiguracion'

const savedMessage = (result) => {
  const version = result.financiera
  if (!version) return 'Los cambios se guardaron.'
  const updated = version.cuotas_actualizadas
  return `Los cambios se guardaron. Los aranceles y el calendario de facturación aplican ${formatVigencia(version.periodo_vigencia).toLowerCase()}`
    + (updated ? ` y se actualizaron ${updated} ${updated === 1 ? 'cuota' : 'cuotas'}.` : '.')
}

const revertedMessage = (version) => {
  const updated = version.cuotas_actualizadas
  return `Se revirtió el cambio programado ${formatVigencia(version.periodo_vigencia).toLowerCase()}`
    + (updated ? ` y se actualizaron ${updated} ${updated === 1 ? 'cuota' : 'cuotas'}.` : '.')
}

export default function Configuracion() {
  const config = useConfiguracion()
  const [history, setHistory] = useState({ opened: false, section: '' })
  const [saveOpened, setSaveOpened] = useState(false)
  const [notice, setNotice] = useState({ tone: 'success', message: '' })

  const openHistory = (section = '') => setHistory({ opened: true, section })
  const isReady = !config.isLoading && !config.error && config.general && config.financiera
  const changesCount = config.changes.financiera.length
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
    <div className="w-full flex flex-col gap-5">
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

      {config.isLoading && <p className="text-base text-on-surface-variant">Cargando configuración...</p>}
      {config.error && <Notice tone="error">No se pudo cargar la configuración. Recargá la página para volver a intentar.</Notice>}
      {notice.message && <Notice tone={notice.tone}>{notice.message}</Notice>}

      {isReady && (
        <PersonTabs
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
