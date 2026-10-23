export const normalizeText = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim()

export const matchesSearch = (query, fields) => {
  const terms = normalizeText(query).split(' ').filter(Boolean)
  if (terms.length === 0) return true
  const haystack = normalizeText(fields.filter((field) => field !== null && field !== undefined).join(' '))
  return terms.every((term) => haystack.includes(term))
}
