export const PROFILE_FIELDS = { jugador: 'aplica_jugador', socio: 'aplica_socio', docente: 'aplica_docente' }

export const appliesToProfile = (tipo, personaType) => Boolean(tipo[PROFILE_FIELDS[personaType] ?? PROFILE_FIELDS.jugador])

export const findMissingDocumentTypes = (tipos, activeDocuments, personaType) => {
  const loadedTypes = new Set(activeDocuments.map((doc) => String(doc.tipo_documento)))
  return tipos.filter((tipo) => (
    tipo.activo
    && tipo.obligatorio
    && appliesToProfile(tipo, personaType)
    && !loadedTypes.has(String(tipo.id_tipo_documento))
  ))
}
