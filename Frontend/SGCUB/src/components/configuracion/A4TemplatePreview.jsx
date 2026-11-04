import { useEffect, useRef, useState } from 'react'
import MarkdownText, { MarkdownInline } from '../shared/MarkdownText'
import SegmentedControl from '../shared/SegmentedControl'

const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842
const MM = PAGE_WIDTH / 210
const PADDING = 18 * MM + 6
const USABLE_HEIGHT = PAGE_HEIGHT - 2 * PADDING
const LABEL_WIDTH = 48 * MM
const SIGNATURE_WIDTH = 70 * MM
const MUTED = '#3e4850'
const FAINT = '#787f85'
const FIELD_LINE = '#c4c9ce'

const ADULT = 'adult'
const MINOR = 'minor'
const TEACHER = 'teacher'

const SAMPLE = {
  [ADULT]: { nombre: 'Juan Pérez', dni: '40.123.456' },
  [MINOR]: { nombre: 'Tomás Pérez', dni: '52.123.456' },
  [TEACHER]: { nombre: 'Laura Gómez', dni: '28.123.456' },
}
const SAMPLE_CATEGORY = 'Sub 14 (Masculino)'
const SAMPLE_GUARDIAN = [['Nombre y apellido', 'María Pérez'], ['DNI', '25.123.456'], ['Vínculo', 'Madre']]
const DATE_BLANK = '____ / ____ / ________'

const profileOptions = (tipo) => [
  ...(tipo.aplica_jugador ? [{ value: ADULT, label: 'Jugador' }, { value: MINOR, label: 'Jugador menor' }] : []),
  ...(tipo.aplica_docente ? [{ value: TEACHER, label: 'Docente' }] : []),
]

function useElementSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const element = ref.current
    if (!element) return undefined
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return size
}

function FieldRows({ rows }) {
  return (
    <div className="flex flex-col">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-end" style={{ paddingTop: 5 }}>
          <span className="shrink-0 text-[9px] leading-[12px]" style={{ width: LABEL_WIDTH, color: MUTED }}>{label}</span>
          <span className="flex-1 text-[10px] font-bold leading-[13px]" style={{ borderBottom: `0.5px solid ${FIELD_LINE}`, paddingBottom: 3 }}>{value}</span>
        </div>
      ))}
    </div>
  )
}

function Signatures({ labels }) {
  return (
    <div className="flex justify-center" style={{ gap: 16 * MM, paddingTop: 16 * MM }}>
      {labels.map((label) => (
        <div key={label} className="text-center text-[8px] leading-[11px]" style={{ width: SIGNATURE_WIDTH, borderTop: `0.8px solid ${MUTED}`, paddingTop: 3, color: MUTED }}>
          {label}
        </div>
      ))}
    </div>
  )
}

function Stub({ form, profile, clubName }) {
  const person = SAMPLE[profile]
  const rows = [['Nombre y apellido', person.nombre], ['DNI', person.dni]]
  if (profile !== TEACHER && form.mostrar_categoria) rows.push(['Categoría a la que ingresa', SAMPLE_CATEGORY])
  const signers = []
  if (profile !== MINOR || form.firma_jugador_menor) signers.push(profile === TEACHER ? 'Firma del docente' : 'Firma del jugador')
  if (profile === MINOR) signers.push('Firma del responsable legal')

  return (
    <div>
      <p className="text-[8.5px] font-bold leading-[11.5px]" style={{ color: MUTED }}>{clubName}</p>
      <p className="text-[11px] font-bold leading-[14px]">Talón de conformidad · {form.titulo}</p>
      <div style={{ height: 3 * MM }} />
      <FieldRows rows={rows} />
      {profile === MINOR && (
        <>
          <div style={{ height: 4 * MM }} />
          <p className="text-[8.5px] font-bold leading-[11.5px]" style={{ color: MUTED }}>RESPONSABLE LEGAL</p>
          <FieldRows rows={SAMPLE_GUARDIAN} />
        </>
      )}
      <div style={{ height: 4 * MM }} />
      <p className="text-[9.5px] leading-[13.5px]"><MarkdownInline text={form.talon_leyenda} /></p>
      <div style={{ height: 2 * MM }} />
      <FieldRows rows={[['Fecha', DATE_BLANK]]} />
      <Signatures labels={signers} />
    </div>
  )
}

function Body({ text }) {
  return (
    <MarkdownText
      text={text}
      className="flex flex-col text-[10px] leading-[14.5px] [&>*]:mb-[8.5px] [&_ol]:pl-[20px] [&_ul]:pl-[20px]"
    />
  )
}

export default function A4TemplatePreview({ form, tipo, logoUrl, clubName }) {
  const options = profileOptions(tipo)
  const [profile, setProfile] = useState(options[0]?.value ?? ADULT)
  const activeProfile = options.some((option) => option.value === profile) ? profile : (options[0]?.value ?? ADULT)
  const frameRef = useRef(null)
  const contentRef = useRef(null)
  const { width } = useElementSize(frameRef)
  const { height: contentHeight } = useElementSize(contentRef)

  const scale = width ? width / PAGE_WIDTH : 0
  const pages = Math.max(1, Math.ceil(contentHeight / USABLE_HEIGHT))
  const pageHeight = Math.max(PAGE_HEIGHT, contentHeight + 2 * PADDING)
  const breaks = Array.from({ length: pages - 1 }, (_, index) => PADDING + (index + 1) * USABLE_HEIGHT)
  const title = form.titulo || 'Sin título'

  return (
    <div className="flex flex-col gap-3">
      {options.length > 1 && (
        <SegmentedControl label="Talón de ejemplo" options={options} value={activeProfile} onChange={setProfile} />
      )}
      <div ref={frameRef} className="w-full" style={{ height: pageHeight * scale }}>
        <div
          className="relative origin-top-left bg-white text-[#0b1c30] shadow-md ring-1 ring-outline-variant/50"
          style={{ width: PAGE_WIDTH, height: pageHeight, padding: PADDING, transform: `scale(${scale})`, fontFamily: 'Helvetica, Arial, sans-serif' }}
        >
          <div ref={contentRef}>
            {logoUrl
              ? <img src={logoUrl} alt="" className="mx-auto object-contain" style={{ maxWidth: 40 * MM, maxHeight: 24 * MM }} />
              : <p className="text-center text-[10px] font-bold" style={{ color: MUTED }}>{clubName}</p>}
            <div style={{ height: 6 * MM }} />
            <h4 className="text-center text-[16px] font-bold leading-[20px]">{title}</h4>
            <div style={{ height: 7 * MM }} />
            <Body text={form.cuerpo} />
            <div style={{ height: 6 * MM - 8.5 }} />
            <div style={{ borderTop: `0.8px dashed ${FAINT}`, paddingTop: 3 }}>
              <p className="text-center text-[7.5px] italic" style={{ color: FAINT }}>Recortar por la línea punteada y entregar el talón firmado al club</p>
            </div>
            <div style={{ height: 6 * MM }} />
            <Stub form={{ ...form, titulo: title }} profile={activeProfile} clubName={clubName} />
          </div>
          {breaks.map((top) => (
            <div key={top} className="absolute inset-x-0 border-t-2 border-dashed border-error/60" style={{ top }}>
              <span className="absolute right-2 -top-5 rounded bg-error px-2 py-0.5 text-[10px] font-semibold text-white">Salto de hoja</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-on-surface-variant">
        Hoja A4 con datos de ejemplo. {pages > 1 ? `El documento ocupa ${pages} hojas.` : 'El documento entra en una hoja.'}
      </p>
    </div>
  )
}
