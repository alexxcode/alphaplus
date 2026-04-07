import { NavLink } from 'react-router-dom'

const links = [
  { to: '/datasets',    icon: '🗄️',  label: 'Datasets'          },
  { to: '/training',    icon: '⚡',  label: 'Training'           },
  { to: '/models',      icon: '📦',  label: 'Models'             },
  { to: '/inference',   icon: '🎯',  label: 'Inference'          },
  { to: '/metrologia',  icon: '📐',  label: 'Metrología'         },
]

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1 style={{ fontSize: '0.85rem', lineHeight: 1.3 }}>Fábrica de Modelos de IA Industrial</h1>
        <span>v0.1 · Industrial Vision</span>
      </div>

      <nav className="sidebar-nav">
        {links.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <span className="icon">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div>Etiquetado Interno → GCS ←</div>
        <div>Fábrica de Modelos de IA Industrial</div>
      </div>
    </aside>
  )
}
