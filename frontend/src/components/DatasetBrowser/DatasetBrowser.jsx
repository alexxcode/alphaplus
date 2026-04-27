import { useState } from 'react'
import MentatTab from './MentatTab.jsx'
import ManualTab from './ManualTab.jsx'
import GDriveTab from './GDriveTab.jsx'
import UploadModal from './UploadModal.jsx'

export default function DatasetBrowser() {
  const [activeTab, setActiveTab] = useState('mentat')
  const [showUpload, setShowUpload] = useState(false)
  const [manualRefresh, setManualRefresh] = useState(0)
  const [gdriveRefresh, setGDriveRefresh] = useState(0)

  function handleUploadComplete() {
    setShowUpload(false)
    setActiveTab('manual')
    setManualRefresh(n => n + 1)
  }

  return (
    <div>
      <div className="page-header">
        <h2>Dataset Browser</h2>
        <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
          + Upload Dataset
        </button>
      </div>

      <div className="card">
        <div className="tabs">
          <button className={`tab${activeTab === 'mentat' ? ' active' : ''}`}
            onClick={() => setActiveTab('mentat')}>
            Auto Labeling
          </button>
          <button className={`tab${activeTab === 'manual' ? ' active' : ''}`}
            onClick={() => setActiveTab('manual')}>
            Manual Upload
          </button>
          <button className={`tab${activeTab === 'gdrive' ? ' active' : ''}`}
            onClick={() => setActiveTab('gdrive')}>
            Google Drive
          </button>
        </div>

        {activeTab === 'mentat' && <MentatTab />}
        {activeTab === 'manual' && <ManualTab refreshTrigger={manualRefresh} />}
        {activeTab === 'gdrive' && <GDriveTab refreshTrigger={gdriveRefresh} />}
      </div>

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onComplete={handleUploadComplete}
        />
      )}
    </div>
  )
}
