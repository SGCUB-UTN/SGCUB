import DonutChart from '../shared/DonutChart'
import { KpiColumn, KpiGrid } from '../shared/Kpi'
import { PANEL_CLASS } from '../shared/panel'
import SectionHeading from '../shared/SectionHeading'
import StatusBadge from '../shared/StatusBadge'

function LegendRow({ dotClass, label, count, detail }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="flex items-center gap-2 text-on-surface-variant min-w-0">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotClass}`} aria-hidden="true" />
        <span className="truncate">{label}</span>
      </span>
      <span className="font-semibold text-on-surface tabular-nums shrink-0">
        {count}
        {detail ? <span className="font-normal text-on-surface-variant ml-1">{detail}</span> : null}
      </span>
    </div>
  )
}

export default function ComunicacionesKPIs({ kpis, onOpenExcluded }) {
  const enviosMes = Number(kpis?.envios_mes ?? 0)
  const notificacionesTotales = Number(kpis?.notificaciones_totales ?? 0)
  const entregados = Number(kpis?.mensajes_entregados ?? 0)
  const fallidos = Number(kpis?.mensajes_fallidos ?? 0)
  const mensajesTotales = Number(kpis?.mensajes_totales ?? entregados + fallidos)
  const tasaEntrega = Number(kpis?.tasa_entrega ?? 0)

  const cobertura = kpis?.cobertura ?? {}
  const padronTotal = Number(cobertura.padron_total ?? 0)
  const conEmail = Number(cobertura.con_email ?? 0)
  const conTelefono = Number(cobertura.con_telefono ?? 0)
  const sinContacto = Number(cobertura.sin_contacto ?? kpis?.sin_contacto ?? 0)
  const conAlgunContacto = Math.max(0, padronTotal - sinContacto)

  const porCanal = kpis?.por_canal ?? {}
  const mailEnviados = Number(porCanal.mail_enviados ?? 0)
  const mailFallidos = Number(porCanal.mail_fallidos ?? 0)
 //DATOS PARA WHATSAPP (todavia no se implementa)
  // const whatsappEnviados = Number(porCanal.whatsapp_enviados ?? 0)
 // const whatsappFallidos = Number(porCanal.whatsapp_fallidos ?? 0)

  const remitente = kpis?.remitente ?? {}
  const emailRemitente = remitente.email_remitente || ''
  const smtpConfigurado = Boolean(remitente.smtp_configurado)

  const deliverySegments = [
    {
      key: 'entregados',
      amount: entregados,
      strokeClass: 'stroke-success',
      label: 'Entregados',
      display: String(entregados),
      share: `${tasaEntrega}%`,
    },
    {
      key: 'fallidos',
      amount: fallidos,
      strokeClass: 'stroke-error',
      label: 'Fallidos',
      display: String(fallidos),
      share: mensajesTotales > 0 ? `${Math.round((fallidos / mensajesTotales) * 100)}%` : '0%',
    },
  ]

  const coverageSegments = [
    {
      key: 'con_contacto',
      amount: conAlgunContacto,
      strokeClass: 'stroke-primary',
      label: 'Con contacto',
      display: String(conAlgunContacto),
      share: padronTotal > 0 ? `${Math.round((conAlgunContacto / padronTotal) * 100)}%` : '0%',
    },
    {
      key: 'sin_contacto',
      amount: sinContacto,
      strokeClass: 'stroke-warning',
      label: 'Sin contacto',
      display: String(sinContacto),
      share: padronTotal > 0 ? `${Math.round((sinContacto / padronTotal) * 100)}%` : '0%',
    },
  ]

  return (
    <section className={PANEL_CLASS} aria-labelledby="comunicaciones-kpis-title">
      <SectionHeading
        id="comunicaciones-kpis-title"
        icon="analytics"
        title="Estado y alcance de comunicaciones"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {emailRemitente && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-container text-xs font-medium text-on-surface-variant border border-outline-variant/40">
                <span className="material-symbols-outlined text-[15px] text-primary" aria-hidden="true">mail</span>
                <span>Remitente: <strong className="font-semibold text-on-surface">{emailRemitente}</strong></span>
              </span>
            )}
            <StatusBadge
              badge={{
                label: smtpConfigurado ? 'SMTP activo' : 'SMTP sin credenciales',
                tono: smtpConfigurado ? 'exito' : 'alerta',
                icon: smtpConfigurado ? 'check_circle' : 'info',
              }}
            />
          </div>
        }
      />

      <KpiGrid columns={3}>
        <KpiColumn title="Efectividad de entrega">
          <div className="flex items-center gap-5">
            <DonutChart
              segments={deliverySegments}
              total={mensajesTotales}
              size={112}
              stroke={14}
              centerValue={mensajesTotales > 0 ? `${tasaEntrega}%` : '—'}
              caption="Entrega"
              label="Efectividad de envíos"
              emptyLabel="Sin envíos registrados"
            />
            <div className="flex-1 flex flex-col gap-2.5 min-w-0">
              <LegendRow
                dotClass="bg-success"
                label="Entregados"
                count={entregados}
                detail={mensajesTotales > 0 ? `de ${mensajesTotales}` : null}
              />
              <LegendRow
                dotClass="bg-error"
                label="Fallidos"
                count={fallidos}
              />
              <div className="pt-2 border-t border-outline-variant/25 flex items-center justify-between text-xs text-on-surface-variant">
                <span>Campañas este mes</span>
                <span className="font-semibold text-on-surface tabular-nums">
                  {enviosMes} <span className="font-normal text-on-surface-variant">({notificacionesTotales} total)</span>
                </span>
              </div>
            </div>
          </div>
        </KpiColumn>

        <KpiColumn
          title="Cobertura del padrón activo"
          action={
            sinContacto > 0 && onOpenExcluded ? (
              <button
                type="button"
                onClick={onOpenExcluded}
                className="text-xs font-semibold text-primary hover:underline cursor-pointer"
              >
                Ver sin contacto ({sinContacto})
              </button>
            ) : null
          }
        >
          <div className="flex items-center gap-5">
            <DonutChart
              segments={coverageSegments}
              total={padronTotal}
              size={112}
              stroke={14}
              centerValue={String(padronTotal)}
              caption="Activos"
              label="Cobertura de contacto del padrón"
              emptyLabel="Sin socios activos"
            />
            <div className="flex-1 flex flex-col gap-2 min-w-0 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-on-surface-variant text-xs">
                  <span className="material-symbols-outlined text-[15px] text-primary" aria-hidden="true">mail</span>
                  Con email
                </span>
                <span className="font-semibold text-on-surface tabular-nums text-xs">{conEmail}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-on-surface-variant text-xs">
                  <span className="material-symbols-outlined text-[15px] text-success" aria-hidden="true">chat</span>
                  Con teléfono
                </span>
                <span className="font-semibold text-on-surface tabular-nums text-xs">{conTelefono}</span>
              </div>
              <div className="pt-1.5 border-t border-outline-variant/25 flex items-center justify-between gap-2 text-xs">
                <span className="text-on-surface-variant">Sin vías de contacto</span>
                <span className={`font-semibold tabular-nums ${sinContacto > 0 ? 'text-warning' : 'text-on-surface'}`}>
                  {sinContacto}
                </span>
              </div>
            </div>
          </div>
        </KpiColumn>

        <KpiColumn title="Desglose por canal">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low border border-outline-variant/30">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">mail</span>
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-on-surface leading-tight">Correo electrónico</p>
                  <p className="text-xs text-on-surface-variant truncate">
                    {mailFallidos > 0 ? `${mailFallidos} fallido${mailFallidos === 1 ? '' : 's'}` : 'Sin fallos registrados'}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-base font-bold text-on-surface tabular-nums">{mailEnviados}</span>
                <span className="block text-[11px] text-on-surface-variant">enviados</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-surface-container/50 border border-outline-variant/30 opacity-75">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-8 h-8 rounded-md bg-surface-container-high text-on-surface-variant flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">chat</span>
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-on-surface-variant leading-tight">WhatsApp</p>
                  <p className="text-xs text-on-surface-variant truncate">
                    Integración no configurada
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-surface-container-high text-[11px] font-semibold text-on-surface-variant shrink-0">
                Deshabilitado
              </span>
            </div>
          </div>
        </KpiColumn>
      </KpiGrid>
    </section>
  )
}
