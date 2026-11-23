const todayStamp = () => new Date().toISOString().slice(0, 10)

export const exportRows = (items, columns) =>
  items.map((item) => columns.map((column) => String(column.value(item) ?? '')))

export const exportCsv = ({ filename, columns, items }) => {
  const lines = [columns.map((column) => column.header), ...exportRows(items, columns)]
  const csv = lines
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    .join('\r\n')
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }))
  link.download = `${filename}-${todayStamp()}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(link.href)
}

export const formatExportAmount = (amount) => Number(amount ?? 0).toFixed(2).replace('.', ',')

export const describeFilters = (parts) => parts.filter(Boolean).join(' · ')
