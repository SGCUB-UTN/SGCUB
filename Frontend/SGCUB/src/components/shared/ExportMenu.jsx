import { useState } from 'react'
import { Menu } from '@mantine/core'
import { downloadListPdf } from '../../api/listExport'
import { describeFilters, exportCsv, exportRows } from './listExport'

const TRIGGER_CLASS = 'inline-flex items-center justify-center gap-1.5 h-10 px-3 w-full sm:w-auto shrink-0 bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/40 text-on-surface rounded text-base font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60'

function MenuIcon({ name }) {
  return <span className="material-symbols-outlined text-[20px] text-on-surface-variant" aria-hidden="true">{name}</span>
}

export default function ExportMenu({ title, filename, columns, items, filters = [] }) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const disabled = items.length === 0 || isGenerating

  const downloadPdf = async () => {
    setError('')
    setIsGenerating(true)
    try {
      await downloadListPdf({
        title,
        filename,
        description: describeFilters(filters),
        columns: columns.map((column) => column.header),
        rows: exportRows(items, columns),
      })
    } catch {
      setError('No se pudo generar el PDF. Probá de nuevo.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1 w-full sm:w-auto">
      <Menu position="bottom-end" shadow="md" width={200} withinPortal>
        <Menu.Target>
          <button type="button" disabled={disabled} className={TRIGGER_CLASS}>
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">file_download</span>
            <span>{isGenerating ? 'Generando PDF...' : 'Exportar'}</span>
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">expand_more</span>
          </button>
        </Menu.Target>
        <Menu.Dropdown className="p-1">
          <Menu.Item icon={<MenuIcon name="table_view" />} onClick={() => exportCsv({ filename, columns, items })}>
            <span className="text-base text-on-surface">Excel (CSV)</span>
          </Menu.Item>
          <Menu.Item icon={<MenuIcon name="picture_as_pdf" />} onClick={downloadPdf}>
            <span className="text-base text-on-surface">PDF</span>
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      {error && <p className="text-sm text-error" role="alert">{error}</p>}
    </div>
  )
}
