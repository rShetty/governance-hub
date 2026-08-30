import { useEffect, useState } from 'react'
import { Modal, usePagination, PaginationControls } from '../components.jsx'

export default function Orchestration() {
  const [teams, setTeams] = useState([])
  const [workflows, setWorkflows] = useState([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState(null)
  const [teamForm, setTeamForm] = useState({ name: '', agents: '' })
  const [workflowForm, setWorkflowForm] = useState({ name: '', steps: '' })
  const [teamDialog, setTeamDialog] = useState(false)
  const [workflowDialog, setWorkflowDialog] = useState(false)
  const teamPage = usePagination(teams, 20)
  const workflowPage = usePagination(workflows, 20)

  const load = () => {
    fetch('/api/bff/orchestration')
      .then((response) => {
        if (!response.ok) throw new Error('Hive orchestration unavailable')
        return response.json()
      })
      .then((body) => {
        setTeams((Array.isArray(body) ? body : body.teams) ?? [])
        setWorkflows((Array.isArray(body) ? [] : body.workflows) ?? [])
        setError('')
      })
      .catch((cause) => setError(String(cause.message || cause)))
  }

  useEffect(load, [])

  const createTeam = async (event) => {
    event.preventDefault()
    const response = await fetch('/api/bff/orchestration/teams', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: teamForm.name,
        agent_ids: teamForm.agents.split(',').map((id) => id.trim()).filter(Boolean),
      }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) return setMessage({ ok: false, text: body.error || `status ${response.status}` })
    setMessage({ ok: true, text: `Team ${body.id ?? teamForm.name} created.` })
    setTeamForm({ name: '', agents: '' })
    setTeamDialog(false)
    load()
  }

  const createWorkflow = async (event) => {
    event.preventDefault()
    const response = await fetch('/api/bff/orchestration/workflows', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: workflowForm.name,
        steps: workflowForm.steps.split('\n').map((step) => step.trim()).filter(Boolean),
      }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) return setMessage({ ok: false, text: body.error || `status ${response.status}` })
    setMessage({ ok: true, text: `Workflow ${body.id ?? workflowForm.name} created.` })
    setWorkflowForm({ name: '', steps: '' })
    setWorkflowDialog(false)
    load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h-display text-2xl">Orchestration</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">Hive teams and deterministic workflows managed in the Hub.</p>
      </div>
      {error && <div className="panel p-4 text-sm text-amber-300">{error}</div>}
      {message && <div className={message.ok ? 'text-sm text-teal-300' : 'text-sm text-rose-400'} data-testid="orchestration-result">{message.text}</div>}
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn btn-primary" data-testid="team-open" onClick={() => setTeamDialog(true)}>Create team</button>
        <button type="button" className="btn btn-primary" data-testid="workflow-open" onClick={() => setWorkflowDialog(true)}>Create workflow</button>
      </div>
      <div className="grid xl:grid-cols-2 gap-6">
        <section className="panel overflow-hidden" data-testid="team-list">
          <div className="px-4 py-3 border-b border-[#232833]"><span className="label">Existing teams</span></div>
          {teamPage.pageItems.length ? teamPage.pageItems.map((team) => (
            <div key={team.id} className="px-4 py-2 border-t border-[#232833]/60 text-sm text-slate-300">{team.name}</div>
          )) : <div className="p-6 text-sm text-slate-600">None.</div>}
          <PaginationControls testIdPrefix="teams" page={teamPage.page} totalPages={teamPage.totalPages} total={teamPage.total} singular="team" plural="teams" onPageChange={teamPage.setPage} />
        </section>
        <section className="panel overflow-hidden" data-testid="workflow-list">
          <div className="px-4 py-3 border-b border-[#232833]"><span className="label">Existing workflows</span></div>
          {workflowPage.pageItems.length ? workflowPage.pageItems.map((workflow) => (
            <div key={workflow.id} className="px-4 py-2 border-t border-[#232833]/60 text-sm text-slate-300">{workflow.name}</div>
          )) : <div className="p-6 text-sm text-slate-600">None.</div>}
          <PaginationControls testIdPrefix="workflows" page={workflowPage.page} totalPages={workflowPage.totalPages} total={workflowPage.total} singular="workflow" plural="workflows" onPageChange={workflowPage.setPage} />
        </section>
      </div>
      <Modal open={teamDialog} title="Create Hive team" description="Group runtime agents into a governed team." onClose={() => setTeamDialog(false)}>
        <form className="panel p-5 space-y-3" data-testid="team-form" onSubmit={createTeam}>
          <input data-testid="team-name" required placeholder="team name" value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} />
          <input data-testid="team-agents" placeholder="agent IDs, comma separated" value={teamForm.agents} onChange={(e) => setTeamForm({ ...teamForm, agents: e.target.value })} />
          <button className="btn btn-primary" data-testid="team-submit">Create</button>
        </form>
      </Modal>
      <Modal open={workflowDialog} title="Create deterministic workflow" description="Define an ordered sequence of steps executed by a team." onClose={() => setWorkflowDialog(false)}>
        <form className="panel p-5 space-y-3" data-testid="workflow-form" onSubmit={createWorkflow}>
          <input data-testid="workflow-name" required placeholder="workflow name" value={workflowForm.name} onChange={(e) => setWorkflowForm({ ...workflowForm, name: e.target.value })} />
          <textarea data-testid="workflow-steps" rows="4" required placeholder="One step per line" value={workflowForm.steps} onChange={(e) => setWorkflowForm({ ...workflowForm, steps: e.target.value })}></textarea>
          <button className="btn btn-primary" data-testid="workflow-submit">Create</button>
        </form>
      </Modal>
    </div>
  )
}
