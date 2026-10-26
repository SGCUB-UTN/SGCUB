function downloadLog(fileName, log) {
  const url = URL.createObjectURL(new Blob([log], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export default function LogDownloadButton({ fileName, log }) {
  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={() => downloadLog(fileName, log)}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">download</span>
        Descargar .txt
      </button>
    </div>
  )
}
