import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/shared/PageHeader'
import ComunicacionesKPIs from '../components/comunicaciones/ComunicacionesKPIs'
import ScopeSelector from '../components/comunicaciones/ScopeSelector'
import CanalesSelector from '../components/comunicaciones/CanalesSelector'
import SegmentedCategoriesSelector from '../components/comunicaciones/SegmentedCategoriesSelector'
import IndividualPlayerSelector from '../components/comunicaciones/IndividualPlayerSelector'
import CoverageAlerts from '../components/comunicaciones/CoverageAlerts'
import MessageComposer from '../components/comunicaciones/MessageComposer'
import ConfirmSendModal from '../components/comunicaciones/ConfirmSendModal'
import ExcludedListModal from '../components/comunicaciones/ExcludedListModal'
import PreviewModal from '../components/comunicaciones/PreviewModal'
import useCategorias from '../hooks/useCategorias'
import useSocio from '../hooks/useSocio'
import { getComunicacionesKPIs, postEnviarNotificacion } from '../api/comunicaciones'

export default function Comunicaciones() {
  const navigate = useNavigate()

  // Datos reales del padrón obtenidos directamente del Backend
  const { categorias } = useCategorias()
  const { socios, isLoading: isLoadingSocios } = useSocio()

  // Estados de datos de comunicaciones
  const [kpis, setKpis] = useState(null)

  // Alcance: 'segmentada' o 'individual'
  const [scope, setScope] = useState('segmentada')

  // Canales de difusión seleccionados para envío masivo (Email, WhatsApp o ambos)
  const [canalesMasivos, setCanalesMasivos] = useState(new Set(['email', 'whatsapp']))

  // Selección de categorías de fútbol reales (para alcance segmentado)
  const [selectedCategoryIds, setSelectedCategoryIds] = useState(new Set())

  // Selección de socio real para alcance individual
  const [selectedSocio, setSelectedSocio] = useState(null)
  const [selectedContactos, setSelectedContactos] = useState(new Set(['socio_tel', 'socio_email']))

  // Formulario del mensaje
  const [asunto, setAsunto] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  const [copiaSecretaria, setCopiaSecretaria] = useState(true)

  // Modales
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isExcluidosOpen, setIsExcluidosOpen] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isSending, setIsSending] = useState(false)

  // Cargar métricas al inicio
  useEffect(() => {
    getComunicacionesKPIs().then(setKpis)
  }, [])

  // Inicializar selección de categorías con las primeras cargadas del backend
  useEffect(() => {
    if (categorias && categorias.length > 0) {
      const validas = categorias.filter((c) => c.nombre.toLowerCase() !== 'no asignado')
      if (validas.length > 0) {
        setSelectedCategoryIds(new Set(validas.slice(0, 3).map((c) => c.categoria_id)))
      }
    }
  }, [categorias])

  // Seleccionar automáticamente el primer socio real si hay cargados
  useEffect(() => {
    if (socios && socios.length > 0 && selectedSocio === null) {
      setSelectedSocio(socios[0])
    }
  }, [socios, selectedSocio])

  // Socios reales que NO tienen ningún dato de contacto cargado en la BD
  const excluidos = useMemo(() => {
    return (socios || [])
      .filter((s) => !s.email && !s.telefono)
      .map((s) => ({
        id: s.socio_id,
        dni: s.dni || 'Sin DNI',
        nombre: `${s.nombre || ''} ${s.apellido || ''}`.trim() || 'Socio sin nombre',
        categoria: s.numero_socio ? `Socio #${s.numero_socio}` : 'Socio',
        motivo: 'Sin teléfono ni correo electrónico registrado',
      }))
  }, [socios])

  // Métricas calculadas basadas en los socios reales cargados
  const computedKPIs = useMemo(() => {
    const totalSocios = socios?.length || 0
    const sinContactoCount = excluidos.length
    const conContactoCount = totalSocios - sinContactoCount
    const tasa = totalSocios > 0 ? ((conContactoCount / totalSocios) * 100).toFixed(1) : 100
    const envios_mes = kpis?.envios_mes ?? 0

    return {
      envios_mes: kpis?.envios_mes ?? 0,
      mensajes_entregados: kpis?.mensajes_entregados ?? 0,
      tasa_entrega: tasa,
      canales_activos_texto: 'Email corporativo y WhatsApp',
      sin_contacto: sinContactoCount,
      envios_mes: envios_mes,
    }
  }, [kpis, excluidos, socios])

  // Manejo de categorías
  const handleToggleCategory = (id) => {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectAllCategories = () => {
    const valid = (categorias || [])
      .filter((c) => c.nombre.toLowerCase() !== 'no asignado')
      .map((c) => c.categoria_id)
    setSelectedCategoryIds(new Set(valid))
  }

  const handleSelectCategoryGroup = (categoryIds, shouldSelect) => {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev)
      categoryIds.forEach((id) => {
        if (shouldSelect) next.add(id)
        else next.delete(id)
      })
      return next
    })
  }

  const handleClearAllCategories = () => {
    setSelectedCategoryIds(new Set())
  }

  const handleToggleCanalMasivo = (canal) => {
    setCanalesMasivos((prev) => {
      const next = new Set(prev)
      if (next.has(canal)) next.delete(canal)
      else next.add(canal)
      return next
    })
  }

  // Manejo de contactos del socio
  const handleToggleContacto = (id) => {
    setSelectedContactos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectSocio = (socio) => {
    setSelectedSocio(socio)
    const iniciales = new Set()
    if (socio.telefono) iniciales.add('socio_tel')
    if (socio.email) iniciales.add('socio_email')
    setSelectedContactos(iniciales)
  }

  // Texto legible de canales activos según el modo
  const canalesTexto = useMemo(() => {
    if (scope === 'individual') {
      const tieneTel = selectedContactos.has('socio_tel')
      const tieneEmail = selectedContactos.has('socio_email')
      if (tieneTel && tieneEmail) return 'Email y WhatsApp'
      if (tieneTel) return 'WhatsApp directo'
      if (tieneEmail) return 'Correo Electrónico (Email)'
      return 'Ningún canal seleccionado'
    }
    const hasEmail = canalesMasivos.has('email')
    const hasWhatsApp = canalesMasivos.has('whatsapp')
    if (hasEmail && hasWhatsApp) return 'Email y WhatsApp'
    if (hasEmail) return 'Correo Electrónico (Email)'
    if (hasWhatsApp) return 'WhatsApp directo'
    return 'Ningún canal seleccionado'
  }, [scope, selectedContactos, canalesMasivos])

  // Canales activos para la vista previa
  const canalesParaPreview = useMemo(() => {
    if (scope === 'individual') {
      const canales = new Set()
      if (selectedContactos.has('socio_email')) canales.add('email')
      if (selectedContactos.has('socio_tel')) canales.add('whatsapp')
      return canales
    }
    return canalesMasivos
  }, [scope, selectedContactos, canalesMasivos])

  // Cálculo de destinatarios efectivos teniendo en cuenta los canales elegidos
  const destinatariosCount = useMemo(() => {
    if (scope === 'individual') {
      return selectedSocio ? selectedContactos.size : 0
    }

    // En masiva, si no seleccionó ningún canal, no hay destinatarios
    if (canalesMasivos.size === 0) {
      return 0
    }

    const hasEmail = canalesMasivos.has('email')
    const hasWhatsApp = canalesMasivos.has('whatsapp')

    // Filtrar socios reales según los canales elegidos
    const sociosValidos = (socios || []).filter((s) => {
      if (hasEmail && hasWhatsApp) return Boolean(s.email || s.telefono)
      if (hasEmail) return Boolean(s.email)
      if (hasWhatsApp) return Boolean(s.telefono)
      return false
    })

    let total = 0
    if (categorias && categorias.length > 0) {
      categorias.forEach((c) => {
        if (selectedCategoryIds.has(c.categoria_id)) {
          total += (c.cantidad_jugadores ?? 0)
        }
      })
    }
    // Si aún no hay jugadores asignados a las categorías, calculamos sobre socios válidos
    if (total === 0 && sociosValidos.length > 0) {
      total = sociosValidos.length
    }
    return total
  }, [scope, selectedSocio, selectedContactos, selectedCategoryIds, categorias, socios, canalesMasivos])

  // Descartar borrador
  const handleDiscard = () => {
    setAsunto('')
    setCuerpo('')
  }

  // Despacho de la notificación
  const handleConfirmSend = async () => {
    if (!asunto.trim() || !cuerpo.trim()) {
      alert('Por favor ingrese el asunto y cuerpo del mensaje.')
      return
    }

    if (scope === 'segmentada' && canalesMasivos.size === 0) {
      alert('Debe seleccionar al menos un canal de difusión (Email o WhatsApp).')
      return
    }

    if (destinatariosCount === 0) {
      alert('No hay destinatarios válidos seleccionados para este envío.')
      return
    }

    setIsSending(true)
    try {
      // Construir la lista de envíos asociados para persistir en EnvioNotificacion
      const envios = []
      if (scope === 'individual' && selectedSocio) {
        if (selectedContactos.has('socio_tel') && selectedSocio.telefono) {
          envios.push({
            socio: selectedSocio.socio_id,
            canal: 'WHATSAPP',
            estado: 'ENVIADA',
          })
        }
        if (selectedContactos.has('socio_email') && selectedSocio.email) {
          envios.push({
            socio: selectedSocio.socio_id,
            canal: 'MAIL',
            estado: 'ENVIADA',
          })
        }
      } else if (scope === 'segmentada') {
        const hasEmail = canalesMasivos.has('email')
        const hasWhatsApp = canalesMasivos.has('whatsapp')
        ;(socios || []).forEach((s) => {
          if (hasWhatsApp && s.telefono) {
            envios.push({
              socio: s.socio_id,
              canal: 'WHATSAPP',
              estado: 'ENVIADA',
            })
          }
          if (hasEmail && s.email) {
            envios.push({
              socio: s.socio_id,
              canal: 'MAIL',
              estado: 'ENVIADA',
            })
          }
        })
      }

      const payload = {
        titulo: asunto,
        asunto,
        contenido: cuerpo,
        tipo_alcance: scope,
        canales: Array.from(scope === 'individual' ? canalesParaPreview : canalesMasivos),
        categorias: Array.from(selectedCategoryIds),
        socio_id: scope === 'individual' ? selectedSocio?.socio_id : null,
        copia_secretaria: copiaSecretaria,
        destinatarios_count: destinatariosCount,
        envios,
      }

      await postEnviarNotificacion(payload)
      setIsConfirmOpen(false)

      // Limpiar el formulario y abrir la vista del historial
      setAsunto('')
      setCuerpo('')
      const successMessage = `Notificación despachada y guardada con éxito (${destinatariosCount} destinatarios)`
      navigate('/comunicaciones/historial', { state: { toastMessage: successMessage } })
    } catch (err) {
      console.error('Error al persistir notificación:', err)
      alert('Ocurrió un error al enviar la notificación. Verifique la conexión con el backend.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="w-full flex flex-col gap-5 pb-8">
      <div className="flex flex-col gap-1 max-w-full">
        <PageHeader
          breadcrumb={[{ label: 'Comunicaciones' }]}
          title="Nueva notificación"
        />
        <p className="text-sm text-on-surface-variant -mt-1.5">
          Canal oficial de avisos y notificaciones operativas institucionales para socios y familias vinculadas.
        </p>
      </div>

      <ComunicacionesKPIs kpis={computedKPIs} />

      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-sm p-5 md:p-6 flex flex-col gap-6">
        {/* Encabezado de la tarjeta */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-outline-variant/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[20px]">edit_note</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-on-surface">
                Componer Notificación Institucional
              </h2>
              <p className="text-xs text-on-surface-variant">
                Configure los destinatarios del padrón y defina el comunicado oficial.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-surface-container-high text-on-surface self-start sm:self-auto border border-outline-variant/20">
            <span className="w-2 h-2 rounded-full bg-primary"></span>
            Modo Redacción
          </span>
        </div>

        {/* Selector de Alcance */}
        <ScopeSelector scope={scope} onChange={setScope} />

        {/* Vista Individual con Socios Reales */}
        {scope === 'individual' && (
          <IndividualPlayerSelector
            socios={socios}
            selectedSocio={selectedSocio}
            onSelectSocio={handleSelectSocio}
            contactosSeleccionados={selectedContactos}
            onToggleContacto={handleToggleContacto}
            isLoading={isLoadingSocios}
          />
        )}

        {/* Vista Masiva / Segmentada */}
        {scope === 'segmentada' && (
          <div className="flex flex-col gap-4">
            <CanalesSelector
              canalesSeleccionados={canalesMasivos}
              onToggleCanal={handleToggleCanalMasivo}
            />

            <SegmentedCategoriesSelector
              categorias={categorias}
              selectedCategoryIds={selectedCategoryIds}
              onToggleCategory={handleToggleCategory}
              onSelectGroup={handleSelectCategoryGroup}
              onSelectAll={handleSelectAllCategories}
              onClearAll={handleClearAllCategories}
            />

            <CoverageAlerts
              validCount={destinatariosCount}
              totalCount={Math.max(destinatariosCount, socios?.length || 0)}
              categoriesCount={selectedCategoryIds.size}
              excludedCount={excluidos.length}
              onOpenExcluidos={() => setIsExcluidosOpen(true)}
            />
          </div>
        )}

        {/* Bloque 2: Contenido del Mensaje */}
        <MessageComposer
          asunto={asunto}
          cuerpo={cuerpo}
          copiaSecretaria={copiaSecretaria}
          onAsuntoChange={setAsunto}
          onCuerpoChange={setCuerpo}
          onCopiaSecretariaChange={setCopiaSecretaria}
          onDiscard={handleDiscard}
          onPreview={() => setIsPreviewOpen(true)}
          onSubmit={() => {
            if (!asunto.trim() || !cuerpo.trim()) {
              alert('Por favor ingrese el asunto y cuerpo del mensaje.')
              return
            }
            if (scope === 'individual' && !selectedSocio) {
              alert('Por favor seleccione un socio para el envío individual.')
              return
            }
            if (scope === 'individual' && selectedContactos.size === 0) {
              alert('El socio seleccionado no tiene canales de contacto habilitados o seleccionados.')
              return
            }
            if (scope === 'segmentada' && canalesMasivos.size === 0) {
              alert('Debe seleccionar al menos un canal de difusión (Email o WhatsApp).')
              return
            }
            setIsConfirmOpen(true)
          }}
        />
      </div>

      {/* Modales */}
      <ConfirmSendModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmSend}
        destinatariosCount={destinatariosCount}
        canalesTexto={canalesTexto}
        asunto={asunto}
        cuerpo={cuerpo}
        isSending={isSending}
      />

      <ExcludedListModal
        isOpen={isExcluidosOpen}
        onClose={() => setIsExcluidosOpen(false)}
        excluidos={excluidos}
      />

      <PreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        asunto={asunto}
        cuerpo={cuerpo}
        canales={canalesParaPreview}
      />

    </div>
  )
}
