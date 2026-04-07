import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Layout/Sidebar.jsx'
import DatasetBrowser from './components/DatasetBrowser/DatasetBrowser.jsx'
import TrainingManager from './components/TrainingManager/TrainingManager.jsx'
import ModelRegistry from './components/ModelRegistry/ModelRegistry.jsx'
import InferenceDemo from './components/InferenceDemo/InferenceDemo.jsx'
import MetrologiaPage from './components/Metrologia/MetrologiaPage.jsx'

export default function App() {
  return (
    <div className="app">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/"            element={<Navigate to="/datasets" replace />} />
          <Route path="/datasets"    element={<DatasetBrowser />} />
          <Route path="/training"    element={<TrainingManager />} />
          <Route path="/models"      element={<ModelRegistry />} />
          <Route path="/inference"   element={<InferenceDemo />} />
          <Route path="/metrologia"  element={<MetrologiaPage />} />
        </Routes>
      </main>
    </div>
  )
}
