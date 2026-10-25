import { useState } from 'react'
import ClubSettings from '../components/configuracion/ClubSettings'
import CommunicationSettings from '../components/configuracion/CommunicationSettings'
import ConfigurationHistoryModal from '../components/configuracion/ConfigurationHistoryModal'
import DocumentSettings from '../components/configuracion/DocumentSettings'
import FinancialSettings from '../components/configuracion/FinancialSettings'
import { Notice } from '../components/configuracion/settingsParts'
import { BUTTON_CLASSES } from '../components/configuracion/settingsForm'
import PersonTabs from '../components/personas/TabsNavPersonas'
import PageHeader from '../components/shared/PageHeader'
import useConfiguracion from '../hooks/useConfiguracion'

export default function Configuracion() {
  const config = useConfiguracion()
  const [history, setHistory] = useState({ opened: false, section: '' })

  const openHistory = (section = '') => setHistory({ opened: true, section })

  const isReady = !config.isLoading && !config.error && config.general && config.financiera

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

      {isReady && (
        <PersonTabs
          tabs={[
            {
              id: 'finanzas',
              label: 'Finanzas y facturación',
              icon: 'payments',
              content: <FinancialSettings config={config} onShowHistory={() => openHistory('Finanzas')} />,
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

      {isReady && (
        <ConfigurationHistoryModal
          opened={history.opened}
          onClose={() => setHistory((current) => ({ ...current, opened: false }))}
          versions={config.versiones}
          initialSection={history.section}
        />
      )}
    </div>
  )
}
