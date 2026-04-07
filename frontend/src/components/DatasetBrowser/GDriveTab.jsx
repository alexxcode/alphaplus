import { useEffect, useRef, useState } from 'react'
import { datasetsApi, formatBytes, formatDate } from '../../api/client.js'

const ACTIVE_STATUSES = new Set(['importing', 'extracting', 'validating'])

function StatusBadge({ status }) {
  const map = {
    importing:   'badge-processing',
    extracting:  'badge-processing',
    validating:  'badge-processing',
    ready:       'badge-ready',
    failed:      'badge-failed',
  }
  return (
    <span className={`badge ${map[status] || 'badge-pending'} flex gap-8`}>
      {ACTIVE_STATUSES.has(status) && <span className="spinner" />}
      {status}
    </span>
  )
}

/** Parse a Google Drive share URL and return {id, isFolder} or null if plain ID. */
function parseDriveInput(raw) {
  const s = raw.trim()
  // folder URL: /drive/folders/{ID}
  const folderMatch = s.match(/\/drive\/folders\/([a-zA-Z0-9_-]+)/)
  if (folderMatch) return { id: folderMatch[1], isFolder: true }
  // file URL: /file/d/{ID}/
  const fileMatch = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (fileMatch) return { id: fileMatch[1], isFolder: false }
  // open?id= or uc?id=
  const qMatch = s.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (qMatch) return { id: qMatch[1], isFolder: false }
  // raw ID (no slashes, no http)
  if (!s.includes('/') && !s.includes('http')) return null
  return null
}

export default function GDriveTab({ refreshTrigger }) {
  const [datasets, setDatasets]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [importing, setImporting]   = useState(false)
  const [toast, setToast]           = useState(null)
  const pollRef = useRef(null)

  // Import form
  const [fileId, setFileId]         = useState('')
  const [projectName, setProjectName] = useState('')
  const [urlWarning, setUrlWarning] = useState(null)

  async function load(silent = false) {
    if (!silent) setLoading(true)
    try {
      const data = await datasetsApi.listGDrive()
      setDatasets(data)
    } catch (_) {}
    setLoading(false)
  }

  useEffect(() => { load() }, [refreshTrigger])

  // Poll while any dataset is processing
  useEffect(() => {
    const hasActive = datasets.some(d => ACTIVE_STATUSES.has(d.status))
    if (hasActive && !pollRef.current) {
      pollRef.current = setInterval(() => load(true), 5000)
    }
    if (!hasActive && pollRef.current) {
      clearInterval(pollRef.current); pollRef.current = null
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [datasets])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  function handleFileIdChange(val) {
    setFileId(val)
    if (!val.trim()) { setUrlWarning(null); return }
    const parsed = parseDriveInput(val)
    if (parsed?.isFolder) {
      setUrlWarning('Eso es una URL de carpeta. Necesitas compartir el archivo ZIP directamente y pegar su URL o ID.')
    } else if (parsed?.id) {
      setUrlWarning(null)
    } else {
      setUrlWarning(null)
    }
  }

  async function handleImport(e) {
    e.preventDefault()
    if (!fileId.trim() || !projectName.trim()) return

    // Auto-extract file ID from URL if needed
    const parsed = parseDriveInput(fileId)
    if (parsed?.isFolder) {
      showToast('Pega la URL del archivo ZIP, no de una carpeta.', 'error')
      return
    }
    const resolvedId = parsed?.id ?? fileId.trim()

    setImporting(true)
    try {
      const res = await datasetsApi.importGDrive({
        gdrive_file_id: resolvedId,
        project_name: projectName.trim(),
      })
      showToast(`Import started: ${res.filename}`)
      setFileId('')
      setProjectName('')
      load()
    } catch (e) {
      showToast(e.message, 'error')
    }
    setImporting(false)
  }

  return (
    <div>
      {toast && (
        <div className={`alert alert-${toast.type === 'error' ? 'error' : 'success'}`}>
          {toast.msg}
        </div>
      )}

      {/* Import form */}
      <div style={{ marginBottom: 20, padding: 16, background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Import from Google Drive</div>
        <form onSubmit={handleImport}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Google Drive File ID</label>
              <input className="form-input"
                placeholder="e.g. 1aBcDeFgHiJkLmNoPqRsTuVwXyZ o pega la URL completa"
                value={fileId} onChange={e => handleFileIdChange(e.target.value)} required />
              {urlWarning
                ? <div className="text-muted mt-4" style={{ color: 'var(--error)' }}>{urlWarning}</div>
                : <div className="text-muted mt-4">ID o URL de un archivo ZIP compartido en Google Drive</div>
              }
            </div>
            <div className="form-group">
              <label className="form-label">Project Name</label>
              <input className="form-input"
                placeholder="e.g. glove-detection"
                value={projectName} onChange={e => setProjectName(e.target.value)} required />
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={importing}>
            {importing ? <><span className="spinner" /> Importing...</> : 'Import from Drive'}
          </button>
        </form>
      </div>

      {/* Dataset list */}
      {loading ? (
        <div className="empty-state">
          <div className="spinner spinner-lg" style={{ margin: '0 auto' }} />
        </div>
      ) : !datasets.length ? (
        <div className="empty-state">
          <p>No Google Drive datasets yet. Import one above.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Filename</th>
                <th>Size</th>
                <th>Classes</th>
                <th>Images</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map(d => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 500 }}>{d.project_name}</td>
                  <td className="text-muted">{d.original_filename}</td>
                  <td className="text-muted">{formatBytes(d.file_size_bytes)}</td>
                  <td>{d.class_count ?? '—'}</td>
                  <td>{d.image_count ?? '—'}</td>
                  <td><StatusBadge status={d.status} /></td>
                  <td className="text-muted">{formatDate(d.upload_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
