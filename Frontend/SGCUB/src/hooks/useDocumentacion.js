import { useState, useEffect, useCallback, useMemo, useId } from 'react'
import { getDocumentos, createDocumento, deleteDocumento, getTiposDocumento, getEstadosDocumento, updateDocumento } from '../api/documentacion'
import { DEFAULT_DOCUMENT_ALERT_DAYS, getDocumentAlertDays } from '../api/configuracion'

export default function useDocumentacion(personaId = null, fetchAll = false) {
  const [documentos, setDocumentos] = useState([])
  const [tipos, setTipos] = useState([])
  const [estados, setEstados] = useState([])
  const [diasAviso, setDiasAviso] = useState(DEFAULT_DOCUMENT_ALERT_DAYS)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const { documentosActivos, documentosHistoricos } = useMemo(() => {
    if (!documentos || documentos.length === 0) return { documentosActivos: [], documentosHistoricos: [] };
    const docsWithStatus = documentos.map(d => {
      let status = 'vigente';
      if (d.fecha_vencimiento) {
        const dias = (new Date(`${d.fecha_vencimiento.split('T')[0]}T23:59:59`) - new Date()) / 86400000;
        if (dias < 0) status = 'vencido';
        else if (dias <= diasAviso) status = 'por_vencer';
      }
      return { ...d, status };
    });

    const groupedDocs = {};
    docsWithStatus.forEach(d => {
      const key = `${d.persona}_${d.tipo_documento}`;
      if (!groupedDocs[key]) groupedDocs[key] = [];
      groupedDocs[key].push(d);
    });

    const activeDocs = [];
    const historicDocs = [];

    Object.values(groupedDocs).forEach(group => {
      const [latest, ...older] = [...group].sort((a, b) => b.id_documento - a.id_documento);
      activeDocs.push(latest);
      historicDocs.push(...older);
    });

    return { documentosActivos: activeDocs, documentosHistoricos: historicDocs };
  }, [documentos, diasAviso]);

  const cargarDatos = useCallback(async () => {
    if (!fetchAll && !personaId) {
      setIsLoading(true);
      return;
    }

    setIsLoading(true)
    setError(null)
    try {
      const [docsData, tiposData, estadosData, alertDays] = await Promise.all([
        getDocumentos(fetchAll ? '' : personaId),
        getTiposDocumento(),
        getEstadosDocumento(),
        getDocumentAlertDays().catch(() => DEFAULT_DOCUMENT_ALERT_DAYS),
      ])
      setDiasAviso(alertDays)
      setDocumentos(docsData)
      setTipos(tiposData)
      setEstados(estadosData)
    } catch (err) {
      setError(err)
      console.error('Error cargando documentación:', err)
    } finally {
      setIsLoading(false)
    }
  }, [personaId, fetchAll])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  const instanceId = useId()
  useEffect(() => {
    const handleChange = (event) => {
      if (event.detail?.source !== instanceId) cargarDatos()
    }
    window.addEventListener('documentacionCambiada', handleChange)
    return () => window.removeEventListener('documentacionCambiada', handleChange)
  }, [cargarDatos, instanceId])

  const notifyChange = () => {
    window.dispatchEvent(new CustomEvent('documentacionCambiada', { detail: { source: instanceId } }))
  }

  const subirDocumento = async (documentData) => {
    try {
      await createDocumento(documentData)
      await cargarDatos()
      notifyChange()
    } catch (err) {
      console.error('Error subiendo documento:', err)
      throw err
    }
  }

  const actualizarDocumento = async (id, documentData) => {
    try {
      await updateDocumento(id, documentData)
      await cargarDatos()
      notifyChange()
    } catch (err) {
      console.error('Error actualizando documento:', err)
      throw err
    }
  }

  const borrarDocumento = async (id) => {
    try {
      await deleteDocumento(id)
      await cargarDatos()
      notifyChange()
    } catch (err) {
      console.error('Error eliminando documento:', err)
      throw err
    }
  }

  // Utilidad para obtener nombre del tipo / estado (opcional)
  const getNombreTipo = (id) => {
    const t = tipos.find(x => String(x.id_tipo_documento) === String(id))
    return t ? t.nombre : '—'
  }

  const getNombreEstado = (id) => {
    const e = estados.find(x => String(x.id_estado_documento) === String(id))
    return e ? e.nombre : '—'
  }

  return {
    documentos,
    tipos,
    estados,
    isLoading,
    error,
    cargarDatos,
    subirDocumento,
    actualizarDocumento,
    borrarDocumento,
    getNombreTipo,
    getNombreEstado,
    documentosActivos,
    documentosHistoricos
  }
}
