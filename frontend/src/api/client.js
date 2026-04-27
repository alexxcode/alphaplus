export const BASE = '/api'

// ── Config / discovery ────────────────────────────────────────────────────────
export const configApi = {
  get: () => req('/config'),
}

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Datasets ──────────────────────────────────────────────────────────────────
export const datasetsApi = {
  listMentat:       ()     => req('/datasets/mentat'),
  registerMentat:   (body) => req('/datasets/mentat/register', { method: 'POST', body: JSON.stringify(body) }),
  listManual:       ()     => req('/datasets/manual'),
  listGDrive:     ()     => req('/datasets/gdrive'),
  getStatus:      (id)   => req(`/datasets/${id}/status`),
  initUpload:     (body) => req('/datasets/upload/init',     { method: 'POST', body: JSON.stringify(body) }),
  completeUpload: (body) => req('/datasets/upload/complete', { method: 'POST', body: JSON.stringify(body) }),
  importGDrive:   (body) => req('/datasets/gdrive/import',   { method: 'POST', body: JSON.stringify(body) }),
  browseGDrive:   (folderId = 'root') => req(`/datasets/gdrive/browse?folder_id=${folderId}`, { method: 'POST' }),
  cancel:         (id)   => req(`/datasets/${id}`,           { method: 'DELETE' }),
}

// ── Training ──────────────────────────────────────────────────────────────────
export const trainingApi = {
  createJob:  (body) => req('/training/jobs',                    { method: 'POST', body: JSON.stringify(body) }),
  listJobs:   ()     => req('/training/jobs'),
  getJob:     (id)   => req(`/training/jobs/${id}`),
  getMetrics: (id)   => req(`/training/jobs/${id}/metrics`),
}

// ── Models ────────────────────────────────────────────────────────────────────
export const modelsApi = {
  list:        ()     => req('/models'),
  listByName:  (name) => req(`/models/${name}`),
  promote:     (id)   => req(`/models/${id}/promote`, { method: 'POST' }),
  importExternal: async (name, modelType, ptFile) => {
    const fd = new FormData()
    fd.append('name', name)
    fd.append('model_type', modelType)
    fd.append('pt_file', ptFile)
    const res = await fetch(`${BASE}/models/import`, { method: 'POST', body: fd })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
      throw new Error(err.detail || `HTTP ${res.status}`)
    }
    return res.json()
  },
}

// ── Inference ─────────────────────────────────────────────────────────────────
export const inferenceApi = {
  status: () => req('/inference/status'),
  predict: async (file) => {
    const fd = new FormData()
    fd.append('file', file)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 600_000)
    try {
      const res = await fetch(`${BASE}/inference/predict`, {
        method: 'POST', body: fd, signal: controller.signal,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
        throw new Error(err.detail || `HTTP ${res.status}`)
      }
      return res.json()
    } finally {
      clearTimeout(timeout)
    }
  },
  downloadAnnotated: async (file, onProgress) => {
    const fd = new FormData()
    fd.append('file', file)
    const controller = new AbortController()
    // 15 min timeout — annotated video takes longer (renders each frame)
    const timeout = setTimeout(() => controller.abort(), 900_000)
    try {
      const res = await fetch(`${BASE}/inference/predict-annotated`, {
        method: 'POST', body: fd, signal: controller.signal,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
        throw new Error(err.detail || `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      // Trigger browser download
      const url = URL.createObjectURL(blob)
      const a   = document.createElement('a')
      const filename = res.headers.get('Content-Disposition')?.match(/filename="?([^"]+)"?/)?.[1]
                     || `annotated_${file.name}`
      a.href     = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      clearTimeout(timeout)
    }
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export function formatBytes(bytes) {
  if (!bytes) return '—'
  if (bytes < 1_048_576)      return `${(bytes / 1_024).toFixed(1)} KB`
  if (bytes < 1_073_741_824)  return `${(bytes / 1_048_576).toFixed(1)} MB`
  return `${(bytes / 1_073_741_824).toFixed(2)} GB`
}

export function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

export function formatDuration(seconds) {
  if (seconds == null) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}
