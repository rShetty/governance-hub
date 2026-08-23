import { useEffect, useState } from 'react'
import { me as fetchMe, loginUrl, logoutUrl } from './api'
import MissionControl from './views/MissionControl.jsx'
import AgentsView from './views/AgentsView.jsx'
import Identities from './views/Identities.jsx'
import Services from './views/Services.jsx'
import Activity from './views/Activity.jsx'
import Access from './views/Access.jsx'
import Tools from './views/Tools.jsx'
import Cost from './views/Cost.jsx'
import Security from './views/Security.jsx'
import Egress from './views/Egress.jsx'
import SupplyChain from './views/SupplyChain.jsx'
import Compliance from './views/Compliance.jsx'

const NAV = [
  { id: 'mission', label: 'Mission Control', icon: 'M3 12h4l3-8 4 16 3-8h4', view: MissionControl },
  { id: 'agents', label: 'Agents', icon: 'M12 2a4 4 0 0 1 4 4c0 1.1-.45 2.1-1.17 2.83A6 6 0 0 1 18 14v2H6v-2a6 6 0 0 1 3.17-5.17A4 4 0 0 1 12 2z', view: AgentsView, admin: false },
  { id: 'activity', label: 'Activity', icon: 'M22 12h-4l-3 9L9 3l-3 9H2', view: Activity },
  { id: 'access', label: 'Access', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a7.8 7.8 0 0 0 .1-1 7.8 7.8 0 0 0-.1-1l2.1-1.6a.5.5 0 0 0 .1-.7l-2-3.4a.5.5 0 0 0-.6-.2l-2.5 1a7.7 7.7 0 0 0-1.7-1l-.4-2.6A.5.5 0 0 0 14 3h-4a.5.5 0 0 0-.5.4L9.1 6a7.7 7.7 0 0 0-1.7 1l-2.5-1a.5.5 0 0 0-.6.2l-2 3.4a.5.5 0 0 0 .1.7L4.5 13a7.8 7.8 0 0 0 0 2l-2.1 1.6a.5.5 0 0 0-.1.7l2 3.4c.1.2.4.3.6.2l2.5-1c.5.4 1.1.7 1.7 1l.4 2.6c0 .3.2.5.5.5h4c.2 0 .5-.2.5-.5l.4-2.6c.6-.3 1.2-.6 1.7-1l2.5 1c.2.1.5 0 .6-.2l2-3.4a.5.5 0 0 0-.1-.7L19.4 15z', view: Access },
  { id: 'tools', label: 'Tools & MCP', icon: 'M14.7 6.3a5 5 0 0 0-6.6 6.6L3 18v3h3l5.1-5.1a5 5 0 0 0 6.6-6.6L14 13l-3-3 3.7-3.7z', view: Tools },
  { id: 'cost', label: 'Cost & Routing', icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6', view: Cost },
  { id: 'security', label: 'Security', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', view: Security },
  { id: 'egress', label: 'Egress', icon: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3', view: Egress },
  { id: 'supply-chain', label: 'Supply Chain', icon: 'M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2', view: SupplyChain },
  { id: 'compliance', label: 'Compliance', icon: 'M9 12l2 2 4-4M12 3l7 4v5c0 5-3.5 8.5-7 9.9C8.5 20.5 5 17 5 12V7z', view: Compliance },
]

const ADMIN_NAV = [
  { id: 'identities', label: 'Identity Directory', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-3a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75', view: Identities },
  { id: 'services', label: 'Service Registry', icon: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6', view: Services },
]

function Icon({ d }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

export default function App() {
  const [view, setView] = useState('mission')
  const [navOpen, setNavOpen] = useState(false)
  const [user, setUser] = useState(undefined)
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    fetchMe().then(setUser).catch(() => setUser(null))
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
      if (e.key === 'Escape') setPaletteOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const isAdmin = !!user?.is_admin || !!user?.admin
  const nav = user ? [...NAV, ...(isAdmin ? ADMIN_NAV : [])] : []
  const current = [...NAV, ...ADMIN_NAV].find((n) => n.id === view)
  const Current = current?.view ?? MissionControl

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[232px] bg-[#0d1015] border-r border-[#232833] p-3 transform transition-transform duration-200 lg:static lg:translate-x-0 ${
          navOpen ? 'translate-x-0' : '-translate-x-full'
        } flex flex-col`}
      >
        <div className="flex items-center gap-2.5 px-2 py-3 mb-2">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="1.6">
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
            <circle cx="12" cy="12" r="3.2" />
            <circle cx="12" cy="12" r="0.8" fill="#2dd4bf" />
          </svg>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold text-slate-100">Governance</div>
            <div className="text-[10px] uppercase tracking-widest text-slate-600">Argus Console</div>
          </div>
        </div>

        {user && (
          <>
            <button
              onClick={() => setPaletteOpen(true)}
              className="flex items-center gap-2 mx-1 mb-3 px-3 py-2 rounded-lg bg-[#0a0c10] border border-[#232833] text-[12px] text-slate-500 hover:border-[#39414f]"
            >
              <span>Jump to…</span>
              <kbd className="ml-auto num text-[10px] px-1.5 py-0.5 rounded bg-[#171b24] border border-[#232833]">⌘K</kbd>
            </button>

            <nav className="space-y-0.5 flex-1 overflow-y-auto">
              {nav.map((n) => (
                <button
                  key={n.id}
                  onClick={() => { setView(n.id); setNavOpen(false) }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors ${
                    view === n.id
                      ? 'bg-[#171b24] text-teal-300 border border-teal-500/20'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-[#171b24]/60 border border-transparent'
                  }`}
                >
                  <Icon d={n.icon} />
                  {n.label}
                </button>
              ))}
            </nav>

            <div className="pt-3 mt-3 border-t border-[#232833] space-y-2">
              {user !== undefined && user !== null && (
                <div className="px-2 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-200 truncate">{user.name || user.email}</div>
                    <div className="text-[10px] text-slate-600">{isAdmin ? 'administrator' : 'member'}</div>
                  </div>
                  <a href={logoutUrl} title="Sign out" className="text-slate-600 hover:text-slate-300 text-sm">⏻</a>
                </div>
              )}
              <div className="px-2 text-[10px] text-slate-700 num">
                <span className="dot dot-ok mr-1.5 align-middle" /> all systems · 15s
              </div>
            </div>
          </>
        )}
      </aside>

      {navOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setNavOpen(false)} />
      )}

      {/* Main */}
      <main className="flex-1 min-w-0 lg:pl-0">
        <header className="sticky top-0 z-20 bg-[#0a0c10]/90 backdrop-blur border-b border-[#232833] px-6 h-14 flex items-center gap-4">
          <button className="lg:hidden btn btn-ghost !px-2" onClick={() => setNavOpen(true)}>☰</button>
          <div className="text-sm font-semibold text-slate-100">{current?.label ?? 'Mission Control'}</div>
          <div className="ml-auto flex items-center gap-3">
            {!user ? (
              <a href={loginUrl('/')} className="btn btn-primary">Sign in — Argus SSO</a>
            ) : (
              <span className="badge badge-ok"><span className="dot dot-ok" /> authenticated</span>
            )}
          </div>
        </header>

        <div className="p-6 max-w-[1400px] fade-up" key={view}>
          <Current onChanged={user ? () => setUser(user) : undefined} admin={isAdmin} />
        </div>
      </main>

      {/* ⌘K palette */}
      {paletteOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center pt-[18vh]" onClick={() => setPaletteOpen(false)}>
          <div className="w-full max-w-md panel !bg-[#10131a] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus placeholder="Type a destination…"
              className="input !border-0 !border-b !rounded-none focus:!border-[#232833]"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const hit = nav.find((n) => n.label.toLowerCase().includes(e.target.value.toLowerCase()))
                  if (hit) { setView(hit.id); setPaletteOpen(false) }
                }
              }}
            />
            <div className="max-h-64 overflow-y-auto py-1">
              {nav.map((n) => (
                <button key={n.id}
                  onClick={() => { setView(n.id); setPaletteOpen(false) }}
                  className="w-full text-left px-4 py-2.5 text-[13px] text-slate-300 hover:bg-[#171b24] flex items-center gap-2.5">
                  <Icon d={n.icon} /> {n.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
