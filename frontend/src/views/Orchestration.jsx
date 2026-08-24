import { useEffect, useState } from 'react'

export default function Orchestration() {
  const [teams, setTeams] = useState([])
  const [workflows, setWorkflows] = useState([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState(null)
  const [teamForm, setTeamForm] = useState({ name: '', agents: '' })
  const [workflowForm, setWorkflowForm] = useState({ name: '', steps: '' })

  const load = () => {
    Promise.all([
      fetch('/api/svc/hive/api/teams'),
      fetch('/api/svc/hive/api/workflows'),
    ]).then(async ([teamResponse, workflowResponse]) => {
      if (!teamResponse.ok || !workflowResponse.ok) throw new Error('Hive orchestration unavailable')
      const teamBody = await teamResponse.json()
      const workflowBody = await workflowResponse.json()
      setTeams(Array.isArray(teamBody) ? teamBody : teamBody.teams ?? [])
      setWorkflows(Array.isArray(workflowBody) ? workflowBody : workflowBody.workflows ?? [])
      setError('')
    }).catch((cause) => setError(String(cause.message || cause)))
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
      <div className="grid xl:grid-cols-2 gap-6">
        <form className="panel p-5 space-y-3" data-testid="team-form" onSubmit={createTeam}>
          <h2 className="font-semibold">Create team</h2>
          <input data-testid="team-name" required placeholder="team name" value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} />
          <input data-testid="team-agents" placeholder="agent IDs, comma separated" value={teamForm.agents} onChange={(e) => setTeamForm({ ...teamForm, agents: e.target.value })} />
          <button className="btn btn-primary" data-testid="team-submit">Create</button>
          <div data-testid="team-list">
            <span className="label">Existing teams</span>
            {teams.length ? teams.map((team) => <div key={team.id} className="text-sm text-slate-300 mt-1">{team.name}</div>) : <div className="text-sm text-slate-600">None.</div>}
          </div>
        </form>
        <form className="panel p-5 space-y-3" data-testid="workflow-form" onSubmit={createWorkflow}>
          <h2 className="font-semibold">Create workflow</h2>
          <input data-testid="workflow-name" required placeholder="workflow name" value={workflowForm.name} onChange={(e) => setWorkflowForm({ ...workflowForm, name: e.target.value })} />
          <textarea data-testid="workflow-steps" rows="4" required placeholder="One step per line" value={workflowForm.steps} onChange={(e) => setWorkflowForm({ ...workflowForm, steps: e.target.value })}></textarea>
          <button className="btn btn-primary" data-testid="workflow-submit">Create</button>
          <div data-testid="workflow-list">
            <span className="label">Existing workflows</span>
            {workflows.length ? workflows.map((workflow) => <div key={workflow.id} className="text-sm text-slate-300 mt-1">{workflow.name}</div>) : <div className="text-sm text-slate-600">None.</div>}
          </div>
        </form>
      </div>
    </div>
  )
}
