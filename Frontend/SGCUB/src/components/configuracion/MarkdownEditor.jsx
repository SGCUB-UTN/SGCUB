import { useRef } from 'react'
import { BULLET, ORDERED, toggleList, wrapSelection } from '../../utils/markdown'

const BOLD = { icon: 'format_bold', label: 'Negrita (Ctrl+B)', apply: (value, start, end) => wrapSelection(value, start, end, '**', 'texto en negrita') }
const ITALIC = { icon: 'format_italic', label: 'Cursiva (Ctrl+I)', apply: (value, start, end) => wrapSelection(value, start, end, '*', 'texto en cursiva') }
const NUMBERED = { icon: 'format_list_numbered', label: 'Lista numerada', apply: (value, start, end) => toggleList(value, start, end, ORDERED) }
const BULLETED = { icon: 'format_list_bulleted', label: 'Lista con viñetas', apply: (value, start, end) => toggleList(value, start, end, BULLET) }

const SHORTCUTS = { b: BOLD, i: ITALIC }

function ToolButton({ tool, onApply }) {
  return (
    <button
      type="button"
      title={tool.label}
      aria-label={tool.label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onApply(tool)}
      className="flex h-8 w-8 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary cursor-pointer"
    >
      <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{tool.icon}</span>
    </button>
  )
}

export default function MarkdownEditor({ id, value, onChange, rows = 12, lists = true, invalid = false, maxLength, describedBy }) {
  const textareaRef = useRef(null)

  const apply = (tool) => {
    const textarea = textareaRef.current
    const result = tool.apply(value, textarea.selectionStart, textarea.selectionEnd)
    onChange(result.value)
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(result.start, result.end)
    })
  }

  const handleKeyDown = (event) => {
    const tool = (event.ctrlKey || event.metaKey) && SHORTCUTS[event.key.toLowerCase()]
    if (!tool) return
    event.preventDefault()
    apply(tool)
  }

  return (
    <div className={`overflow-hidden rounded-lg border bg-white focus-within:ring-2 focus-within:ring-primary/40 ${invalid ? 'border-error' : 'border-outline-variant'}`}>
      <div role="toolbar" aria-label="Formato del texto" aria-controls={id} className="flex items-center gap-0.5 border-b border-outline-variant/60 bg-surface-container-low px-1.5 py-1">
        <ToolButton tool={BOLD} onApply={apply} />
        <ToolButton tool={ITALIC} onApply={apply} />
        {lists && (
          <>
            <div className="mx-1 h-5 w-px bg-outline-variant" aria-hidden="true" />
            <ToolButton tool={NUMBERED} onApply={apply} />
            <ToolButton tool={BULLETED} onApply={apply} />
          </>
        )}
      </div>
      <textarea
        ref={textareaRef}
        id={id}
        value={value}
        rows={rows}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className="block w-full resize-y px-3 py-2 text-sm leading-relaxed text-on-surface focus:outline-none"
      />
    </div>
  )
}
