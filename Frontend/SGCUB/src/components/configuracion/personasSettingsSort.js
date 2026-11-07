export const talleSortKey = (nombre) => {
  const name = (nombre || '').trim().toUpperCase()
  if (/^\d+$/.test(name)) {
    return [0, parseInt(name, 10), '']
  }
  const letterRanks = {
    XXXS: 1, XXS: 2, XS: 3, S: 4, M: 5, L: 6,
    XL: 7, XXL: 8, '2XL': 8, XXXL: 9, '3XL': 9, '4XL': 10,
    'EXTRA CHICA': 3, CHICO: 4, CHICA: 4, MEDIANO: 5, MEDIANA: 5, GRANDE: 6,
    'EXTRA GRANDE': 7, 'DOBLE EXTRA GRANDE': 8,
  }
  if (letterRanks[name]) {
    return [1, letterRanks[name], '']
  }
  return [2, 0, name]
}

export const compareTalles = (a, b) => {
  const nameA = typeof a === 'string' ? a : a?.valor || a?.codigo || a?.nombre || ''
  const nameB = typeof b === 'string' ? b : b?.valor || b?.codigo || b?.nombre || ''
  const [typeA, valA, strA] = talleSortKey(nameA)
  const [typeB, valB, strB] = talleSortKey(nameB)
  if (typeA !== typeB) return typeA - typeB
  if (valA !== valB) return valA - valB
  return strA.localeCompare(strB, 'es')
}

export const compareObrasSociales = (a, b) => {
  const nameA = typeof a === 'string' ? a : a?.nombre || ''
  const nameB = typeof b === 'string' ? b : b?.nombre || ''
  const aSin = nameA.trim().toLowerCase() === 'sin obra social'
  const bSin = nameB.trim().toLowerCase() === 'sin obra social'
  if (aSin && !bSin) return -1
  if (!aSin && bSin) return 1
  return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' })
}

