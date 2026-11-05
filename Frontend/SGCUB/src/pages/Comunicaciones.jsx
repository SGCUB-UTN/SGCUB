import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getCategorias } from '../api/categorias'
import { getComunicacionesKPIs, postEnviarNotificacion } from '../api/comunicaciones'
import { getJugadores } from '../api/jugadores'
import { getSocios } from '../api/socios'
import CanalesSelector from '../components/comunicaciones/CanalesSelector'
import ConfirmSendModal from '../components/comunicaciones/ConfirmSendModal'
import CoverageAlerts from '../components/comunicaciones/CoverageAlerts'
import ExcludedListModal from '../components/comunicaciones/ExcludedListModal'
import IndividualPlayerSelector from '../components/comunicaciones/IndividualPlayerSelector'
import ListRecipientsSummary from '../components/comunicaciones/ListRecipientsSummary'
import MessageComposer from '../components/comunicaciones/MessageComposer'
import PreviewModal from '../components/comunicaciones/PreviewModal'
import ScopeSelector from '../components/comunicaciones/ScopeSelector'
import SegmentedCategoriesSelector from '../components/comunicaciones/SegmentedCategoriesSelector'
import { SecondaryButton } from '../components/personas/tabs/parts'
import PageHeader from '../components/shared/PageHeader'
import { PANEL_BODY_CLASS, PANEL_CLASS } from '../components/shared/panel'
import SectionHeading from '../components/shared/SectionHeading'
import { HeadingSkeleton, LineSkeletons, SkeletonStatus } from '../components/shared/Skeleton'

function NuevoEnvioSkeleton() {
  return (
    <SkeletonStatus label="Cargando formulario de nuevo envío..." className="flex flex-col gap-5">
      <div className={PANEL_CLASS}>
        <HeadingSkeleton />
        <div className={PANEL_BODY_CLASS}>
          <LineSkeletons count={4} className="flex flex-col gap-4" />
        </div>
      </div>
      <div className={PANEL_CLASS}>
        <HeadingSkeleton />
        <div className={PANEL_BODY_CLASS}>
          <LineSkeletons count={3} className="flex flex-col gap-4" />
        </div>
      </div>
    </SkeletonStatus>
  )
}

export default function Comunicaciones() {
  const location = useLocation()
  const navigate = useNavigate()
  const debtNotice = location.state?.debtNotice
  const initialRecipients = debtNotice?.recipients

  const [isLoading, setIsLoading] = useState(true)
  const [remitente, setRemitente] = useState(null)
  const [categorias, setCategorias] = useState([])
  const [socios, setSocios] = useState([])
  const [jugadores, setJugadores] = useState([])

  const [scope, setScope] = useState(() =>
    initialRecipients?.length === 1
      ? 'individual'
      : initialRecipients?.length > 1
        ? 'lista'
        : 'segmentada'
  )
  const [canales, setCanales] = useState({ email: true, whatsapp: false })
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([])
  const [selectedSocio, setSelectedSocio] = useState(null)
  const [listSelection, setListSelection] = useState(() => initialRecipients ?? [])

  const [asunto, setAsunto] = useState(() => debtNotice?.subject ?? '')
  const [cuerpo, setCuerpo] = useState(() => debtNotice?.body ?? '')
  const [copiaSecretaria, setCopiaSecretaria] = useState(false)
  const [validationError, setValidationError] = useState('')

  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isExcludedOpen, setIsExcludedOpen] = useState(false)
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    const fetchAllData = async () => {
      setIsLoading(true)
      try {
        const [kpisRes, catRes, socRes, jugRes] = await Promise.allSettled([
          getComunicacionesKPIs(),
          getCategorias(),
          getSocios(),
          getJugadores(),
        ])

        if (kpisRes.status === 'fulfilled' && kpisRes.value?.remitente) {
          setRemitente(kpisRes.value.remitente)
        }
        if (catRes.status === 'fulfilled' && Array.isArray(catRes.value)) {
          setCategorias(catRes.value)
        }
        if (socRes.status === 'fulfilled' && Array.isArray(socRes.value)) {
          setSocios(socRes.value)
        }
        if (jugRes.status === 'fulfilled' && Array.isArray(jugRes.value)) {
          setJugadores(jugRes.value)
        }
      } finally {
        setIsLoading(false)
      }
    }
    fetchAllData()
  }, [])

  const activeSocios = useMemo(() => {
    return socios.filter(
      (s) => !s.estado_administrativo_nombre || s.estado_administrativo_nombre === 'Activo'
    )
  }, [socios])

  // Mapa de categoria_id -> array de socios activos pertenecientes a esa categoría
  const { categorySociosMap, categoryCounts } = useMemo(() => {
    const map = {}
    const counts = {}
    const socioById = new Map(activeSocios.map((s) => [String(s.socio_id || s.id), s]))

    jugadores.forEach((jug) => {
      const isJugadorActivo = !jug.estado?.nombre || jug.estado.nombre === 'Activo'
      if (!isJugadorActivo) return

      const rawSocio = jug.socio
      if (!rawSocio) return
      const socioId = String(rawSocio.socio_id || rawSocio.id || rawSocio)
      const socioObj =
        socioById.get(socioId) ||
        (typeof rawSocio === 'object' ? rawSocio : null)
      if (!socioObj) return

      const catIds = [
        jug.categoria?.categoria_id ?? jug.categoria,
        jug.categoria_secundaria?.categoria_id ?? jug.categoria_secundaria,
      ].filter(Boolean)

      catIds.forEach((catId) => {
        if (!map[catId]) {
          map[catId] = new Map()
        }
        map[catId].set(socioId, socioObj)
      })
    })

    Object.keys(map).forEach((catId) => {
      counts[catId] = map[catId].size
    })

    return { categorySociosMap: map, categoryCounts: counts }
  }, [jugadores, activeSocios])

  // Resolución cuando viene un destinatario individual desde otro módulo
  useEffect(() => {
    if (initialRecipients?.length !== 1 || selectedSocio || socios.length === 0) return
    const target = initialRecipients[0]
    const matched = socios.find(
      (s) =>
        (target.socio_id && String(s.socio_id || s.id) === String(target.socio_id)) ||
        (target.dni && String(s.dni) === String(target.dni))
    )
    if (!matched) return
    setSelectedSocio(matched)
    setCanales({
      email: Boolean(matched.email && matched.email.includes('@')),
      whatsapp: false,
    })
  }, [initialRecipients, selectedSocio, socios])

  const listSocios = useMemo(() => {
    if (listSelection.length === 0) return []
    const seen = new Set()
    return listSelection.reduce((acc, target) => {
      const matched = socios.find(
        (s) =>
          (target.socio_id && String(s.socio_id || s.id) === String(target.socio_id)) ||
          (target.dni && String(s.dni) === String(target.dni))
      )
      const id = matched?.socio_id || matched?.id
      if (matched && id && !seen.has(id)) {
        seen.add(id)
        acc.push(matched)
      }
      return acc
    }, [])
  }, [listSelection, socios])

  const missingSocioCount = Math.max(0, listSelection.length - listSocios.length)

  // Destinatarios objetivo según el alcance seleccionado
  const targetSocios = useMemo(() => {
    if (scope === 'individual') {
      return selectedSocio ? [selectedSocio] : []
    }
    if (scope === 'lista') {
      return listSocios
    }
    if (scope === 'padron') {
      return activeSocios
    }
    if (scope === 'segmentada') {
      const uniqueMap = new Map()
      selectedCategoryIds.forEach((catId) => {
        const catMap = categorySociosMap[catId]
        if (catMap) {
          catMap.forEach((socioObj, socioId) => {
            uniqueMap.set(socioId, socioObj)
          })
        }
      })
      return Array.from(uniqueMap.values())
    }
    return []
  }, [scope, selectedSocio, listSocios, activeSocios, selectedCategoryIds, categorySociosMap])

  // Cobertura y exclusiones según los canales elegidos
  const coverage = useMemo(() => {
    let emailReachable = 0
    let whatsappReachable = 0
    const reachable = []
    const excluded = []

    targetSocios.forEach((s) => {
      const hasEmail = Boolean(s.email && s.email.includes('@'))
      const hasPhone = Boolean(s.telefono && String(s.telefono).trim().length > 0)
      if (hasEmail) emailReachable += 1
      if (hasPhone) whatsappReachable += 1

      const canReceiveEmail = canales.email && hasEmail
      const canReceiveWhatsapp = canales.whatsapp && hasPhone

      if (canReceiveEmail || canReceiveWhatsapp) {
        reachable.push(s)
      } else {
        excluded.push(s)
      }
    })

    return {
      totalCount: targetSocios.length,
      validCount: reachable.length,
      excludedCount: excluded.length,
      emailReachable,
      whatsappReachable,
      reachableSocios: reachable,
      excludedSocios: excluded,
    }
  }, [targetSocios, canales])

  const handleToggleCategory = (catId) => {
    setValidationError('')
    setSelectedCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    )
  }

  const handleSelectAllCategories = (ids) => {
    setValidationError('')
    setSelectedCategoryIds((prev) => Array.from(new Set([...prev, ...ids])))
  }

  const handleClearCategories = (ids) => {
    setValidationError('')
    setSelectedCategoryIds((prev) => prev.filter((id) => !ids.includes(id)))
  }

  const getScopeText = () => {
    if (scope === 'individual') {
      return selectedSocio
        ? `${selectedSocio.nombre} ${selectedSocio.apellido}`
        : 'Socio individual'
    }
    if (scope === 'lista') {
      return debtNotice?.scopeLabel
        ? `Listado (${debtNotice.scopeLabel})`
        : `Selección de listado (${listSocios.length})`
    }
    if (scope === 'padron') {
      return `Todo el padrón activo (${activeSocios.length} socios)`
    }
    return `${selectedCategoryIds.length} ${
      selectedCategoryIds.length === 1 ? 'categoría deportiva' : 'categorías deportivas'
    }`
  }

  const validateBeforeAction = () => {
    if (!canales.email && !canales.whatsapp) {
      setValidationError('Seleccioná al menos un canal de envío (Correo electrónico o WhatsApp).')
      return false
    }
    if (scope === 'individual' && !selectedSocio) {
      setValidationError('Seleccioná un socio destinatario para el envío individual.')
      return false
    }
    if (scope === 'segmentada' && selectedCategoryIds.length === 0) {
      setValidationError('Seleccioná al menos una categoría deportiva para el envío.')
      return false
    }
    if (coverage.validCount === 0) {
      setValidationError(
        'Ninguno de los destinatarios seleccionados posee datos de contacto válidos para el canal elegido.'
      )
      return false
    }
    if (!asunto.trim()) {
      setValidationError('Ingresá un asunto para el comunicado antes de continuar.')
      return false
    }
    if (!cuerpo.trim()) {
      setValidationError('Escribí el cuerpo del mensaje antes de continuar.')
      return false
    }
    setValidationError('')
    return true
  }

  const handleOpenPreview = () => {
    if (!canales.email && !canales.whatsapp) {
      setValidationError('Seleccioná al menos un canal para visualizar la vista previa.')
      return
    }
    setValidationError('')
    setIsPreviewOpen(true)
  }

  const handleOpenConfirm = () => {
    if (validateBeforeAction()) {
      setIsConfirmOpen(true)
    }
  }

  const handleConfirmSend = async () => {
    setIsSending(true)
    setValidationError('')
    try {
      const enviosList = []
      coverage.reachableSocios.forEach((s) => {
        const socioId = s.socio_id || s.id
        if (!socioId) return
        const hasEmail = Boolean(s.email && s.email.includes('@'))
        const hasPhone = Boolean(s.telefono && String(s.telefono).trim().length > 0)
        if (canales.email && hasEmail) {
          enviosList.push({ socio: socioId, canal: 'MAIL', estado: 'ENVIADA' })
        }
        if (canales.whatsapp && hasPhone) {
          enviosList.push({ socio: socioId, canal: 'WHATSAPP', estado: 'ENVIADA' })
        }
      })

      const created = await postEnviarNotificacion({
        titulo: asunto.trim(),
        asunto: asunto.trim(),
        contenido: cuerpo.trim(),
        copia_secretaria: copiaSecretaria,
        envios: enviosList,
      })

      setIsConfirmOpen(false)
      navigate('/comunicaciones', { state: { flashResult: created } })
    } catch (err) {
      const detail =
        err?.response?.data?.detail ||
        err?.message ||
        'Ocurrió un error al procesar el envío de la notificación.'
      setValidationError(String(detail))
      setIsConfirmOpen(false)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumb={[
          { label: 'Comunicaciones', to: '/comunicaciones' },
          { label: 'Nuevo envío' },
        ]}
        title="Nuevo envío"
        subtitle="Seleccioná los destinatarios y canales para redactar y enviar un comunicado oficial."
        actions={
          <SecondaryButton
            type="button"
            icon="arrow_back"
            onClick={() => navigate('/comunicaciones')}
          >
            Volver al panel
          </SecondaryButton>
        }
      />

      {isLoading ? (
        <NuevoEnvioSkeleton />
      ) : (
        <>
          <section className={PANEL_CLASS} aria-labelledby="destinatarios-heading">
            <SectionHeading
              id="destinatarios-heading"
              icon="group"
              title="1. Destinatarios y canales de envío"
            />
            <div className={`${PANEL_BODY_CLASS} flex flex-col gap-5`}>
              <ScopeSelector
                scope={scope}
                setScope={(newScope) => {
                  setValidationError('')
                  setScope(newScope)
                }}
                hasListSelection={listSelection.length > 0}
              />

              {scope === 'lista' && (
                <ListRecipientsSummary
                  recipients={listSocios}
                  scopeLabel={debtNotice?.scopeLabel}
                  missingSocioCount={missingSocioCount}
                  onClearList={() => {
                    setListSelection([])
                    setScope('segmentada')
                  }}
                />
              )}

              {scope === 'individual' && (
                <IndividualPlayerSelector
                  socios={activeSocios}
                  selectedSocio={selectedSocio}
                  onSelectSocio={(socio) => {
                    setValidationError('')
                    setSelectedSocio(socio)
                  }}
                  canales={canales}
                  setCanales={setCanales}
                />
              )}

              {scope === 'segmentada' && (
                <SegmentedCategoriesSelector
                  categorias={categorias}
                  categoryCounts={categoryCounts}
                  selectedCategoryIds={selectedCategoryIds}
                  onToggleCategory={handleToggleCategory}
                  onSelectAll={handleSelectAllCategories}
                  onClearAll={handleClearCategories}
                />
              )}

              {scope !== 'individual' && (
                <CanalesSelector
                  canales={canales}
                  setCanales={(updater) => {
                    setValidationError('')
                    setCanales(updater)
                  }}
                  remitente={remitente}
                />
              )}

              <CoverageAlerts
                validCount={coverage.validCount}
                totalCount={coverage.totalCount}
                excludedCount={coverage.excludedCount}
                emailReachable={coverage.emailReachable}
                whatsappReachable={coverage.whatsappReachable}
                canales={canales}
                onOpenExcluded={
                  coverage.excludedCount > 0 ? () => setIsExcludedOpen(true) : undefined
                }
              />
            </div>
          </section>

          <section className={PANEL_CLASS} aria-labelledby="mensaje-heading">
            <SectionHeading
              id="mensaje-heading"
              icon="mail"
              title="2. Redacción del comunicado"
            />
            <div className={PANEL_BODY_CLASS}>
              <MessageComposer
                asunto={asunto}
                setAsunto={(val) => {
                  if (validationError) setValidationError('')
                  setAsunto(val)
                }}
                cuerpo={cuerpo}
                setCuerpo={(val) => {
                  if (validationError) setValidationError('')
                  setCuerpo(val)
                }}
                copiaSecretaria={copiaSecretaria}
                setCopiaSecretaria={setCopiaSecretaria}
                remitente={remitente}
                validationError={validationError}
                onOpenPreview={handleOpenPreview}
                onOpenConfirm={handleOpenConfirm}
              />
            </div>
          </section>
        </>
      )}

      <PreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        asunto={asunto}
        cuerpo={cuerpo}
        canales={canales}
        remitente={remitente}
      />

      <ConfirmSendModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmSend}
        isSending={isSending}
        asunto={asunto}
        canales={canales}
        validCount={coverage.validCount}
        scopeText={getScopeText()}
        remitente={remitente}
        copiaSecretaria={copiaSecretaria}
      />

      <ExcludedListModal
        isOpen={isExcludedOpen}
        onClose={() => setIsExcludedOpen(false)}
        excludedList={coverage.excludedSocios}
      />
    </div>
  )
}
