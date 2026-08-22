import { useEffect, useState } from 'react'
import { me as fetchMe, loginUrl, logoutUrl } from './api'
import Identities from './views/Identities.jsx'
import Services from './views/Services.jsx'
import Overview from './views/Overview.jsx'
import Agents from './views/Agents.jsx'
import Policies from './views/Policies.jsx'
import Tools from './views/Tools.jsx'
import Cost from './views/Cost.jsx'
import Security from './views/Security.jsx'
import Egress from './views/Egress.jsx'

const NAV = [
  { id: 'overview', label: 'Overview', icon: '◈' },
  { id: 'identities', label: 'Identities', icon: '🪪', admin: true },
  { id: 'services', label: 'Service Registry', icon: '⚙️', admin: true },
  { id: 'hive', label: 'Agents', icon: '🐝' },
  { id: 'patroclus', label: 'Policies & Access', icon: '🛡️' },
  { id: 'relay', label: 'Tools & MCP', icon: '🔌' },
  { id: 'miser', label: 'Cost & Routing', icon: '💸' },
  { id: 'sentiel', label: 'Security', icon: '🔍' },
  { id: 'aegis', label: 'Egress', icon: '🌐' },
]

const VIEWS = {
  overview: Overview,
  identities: Identities,
  services: Services,
  hive: Agents,
  patroclus: Policies,
  relay: Tools,
  miser: Cost,
  sentiel: Security,
  aegis: Egress,
}

export default function App() {
  const [view, setView] = useState('overview')
  const [navOpen, setNavOpen] = useState(false)
  const [user, setUser] = useState(undefined) // undefined = loading, null = logged out
  const View = VIEWS[view] ?? Overview

  useEffect(() => {
    fetchMe().then(setUser).catch(() => setUser(null))
  }, [])

  const isAdmin = !!user?.admin

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-950/95 backdrop-blur-xl border-r border-slate-800/80 p-4 transform transition-transform duration-200 lg:static lg:translate-x-0 ${
          navOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 px-2 py-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 grid place-items-center text-lg shadow-lg shadow-indigo-500/30">
            🛡️
          </div>
          <div>
            <div className="font-bold leading-tight">Governance Hub</div>
            <div className="text-[11px] text-slate-500">AI governance console</div>
          </div>
        </div>

        <nav className="space-y-1">
          {NAV.filter((n) => !n.admin || isAdmin).map((n) => (
            <button
              key={n.id}
              onClick={() => { setView(n.id); setNavOpen(false) }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                view === n.id
                  ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <span className="text-base w-5 text-center">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-4 left-4 right-4 space-y-2">
          {user === undefined ? null : user === null ? (
            <a
              href={loginUrl('/')}
              className="block text-center px-3 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-sm font-semibold text-white"
            >
              Sign in — Argus SSO
            </a>
          ) : (
            <div className="glass p-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-200 truncate">{user.name || user.email}</div>
                <div className="text-[10px] text-slate-500 truncate">{isAdmin ? 'administrator' : user.email}</div>
              </div>
              <a href={logoutUrl} title="Sign out" className="text-slate-500 hover:text-slate-200 text-lg leading-none px-1">⎋</a>
            </div>
          )}
          <div className="glass p-3 text-[11px] text-slate-500">
            <span className="live-dot inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 align-middle" />
            Monitoring · auto-refresh 15s · IdP: Argus
          </div>
        </div>
      </aside>

      {navOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setNavOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 min-w-screen lg:ml-0">
        <header className="sticky top-0 z-20 flex items-center justify-between px-5 py-3.5 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl">
          <button
            className="lg:hidden text-slate-300 border border-slate-700 rounded-lg px-3 py-1.5"
            onClick={() => setNavOpen(true)}
          >
            ☰
          </button>
          <div className="font-semibold">{NAV.find((n) => n.id === view)?.label}</div>
          <a
            href="/api/services"
            target="_blank"
            rel="noopener"
            className="text-xs text-slate-500 hover:text-indigo-300 transition-colors"
          >
            API ↗
          </a>
        </header>

        <main className="p-5 lg:p-8 max-w-[1400px] mx-auto">
          <View go={setView} />
        </main>
      </div>
    </div>
  )
}
