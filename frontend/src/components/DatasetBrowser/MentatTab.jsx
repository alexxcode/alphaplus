import { useEffect, useState } from 'react'
import { datasetsApi, formatDate } from '../../api/client.js'

export default function MentatTab() {
  const [datasets, setDatasets] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await datasetsApi.listMentat()
      setDatasets(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return (
    <div className="empty-state">
      <div className="spinner spinner-lg" style={{ margin: '0 auto' }} />
      <p>Cargando datasets de Etiquetado Interno…</p>
    </div>
  )

  if (error) return (
    <div>
      <div className="alert alert-error">{error}</div>
      <button className="btn btn-secondary" onClick={load}>Retry</button>
    </div>
  )

  if (!datasets.length) return (
    <div className="empty-state">
      <div style={{ fontSize: 32 }}>🗄️</div>
      <p>No hay datasets de Etiquetado Interno.</p>
      <p>Exporta un dataset desde Etiquetado Interno usando "Export to GCS" para empezar.</p>
    </div>
  )

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: 12 }}>
        <span className="text-muted">{datasets.length} dataset{datasets.length !== 1 ? 's' : ''}</span>
        <button className="btn btn-secondary btn-sm" onClick={load}>↻ Refresh</button>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Timestamp</th>
              <th>Classes</th>
              <th>Images</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {datasets.map((ds, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 500 }}>{ds.project_name || '—'}</td>
                <td className="text-muted">{ds.timestamp || formatDate(ds.upload_date)}</td>
                <td>{ds.class_count ?? '—'}</td>
                <td>{ds.image_count ?? '—'}</td>
                <td><span className="badge badge-mentat">Etiquetado Interno</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
