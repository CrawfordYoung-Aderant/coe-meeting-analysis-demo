'use client'

interface Requirement {
  id: string
  title: string
  description: string
  type: string
  priority: string
  status: string
  assignee?: string
  due_date?: string
  acceptance_criteria: string[]
  source: string
  related_decisions?: string[]
}

interface RequirementsViewProps {
  requirements: Requirement[]
}

export default function RequirementsView({ requirements }: RequirementsViewProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return 'bg-secondary-red/20 text-secondary-red border-secondary-red/30'
      case 'medium':
        return 'bg-secondary-yellow/30 text-neutral-dark border-secondary-yellow/40'
      case 'low':
        return 'bg-secondary-blue/20 text-secondary-blue border-secondary-blue/30'
      default:
        return 'bg-neutral-lighter text-neutral-dark border-neutral-light'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'draft':
        return 'bg-neutral-lighter text-neutral-dark'
      case 'open':
        return 'bg-secondary-blue/20 text-secondary-blue'
      case 'in progress':
        return 'bg-secondary-yellow/30 text-neutral-dark'
      case 'completed':
        return 'bg-secondary-blue/20 text-secondary-blue'
      default:
        return 'bg-neutral-lighter text-neutral-dark'
    }
  }

  if (requirements.length === 0) {
    return (
      <div className="bg-primary-white rounded-lg shadow-xl p-6">
        <h2 className="text-2xl font-headline font-light text-primary-dark mb-4">Requirements</h2>
        <p className="font-copy text-neutral-medium">No requirements generated yet.</p>
      </div>
    )
  }

  return (
    <div className="bg-primary-white rounded-lg shadow-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-headline font-light text-primary-dark">Structured Requirements</h2>
        <span className="px-3 py-1 bg-secondary-blue/20 text-secondary-blue rounded-full text-sm font-copy font-medium">
          {requirements.length} requirements
        </span>
      </div>

      <div className="space-y-4">
        {requirements.map((req) => (
          <div
            key={req.id}
            className="border border-neutral-lighter rounded-lg p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-mono text-sm font-semibold text-secondary-blue">{req.id}</span>
                  <span className={`px-2 py-1 rounded text-xs font-copy font-medium border ${getPriorityColor(req.priority)}`}>
                    {req.priority}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-copy font-medium ${getStatusColor(req.status)}`}>
                    {req.status}
                  </span>
                  <span className="px-2 py-1 rounded text-xs font-copy font-medium bg-secondary-purple/20 text-secondary-purple">
                    {req.type}
                  </span>
                </div>
                <h3 className="text-lg font-headline font-medium text-primary-dark mb-2">{req.title}</h3>
                <p className="text-neutral-dark text-sm mb-3 font-copy">{req.description}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-3 text-sm font-copy">
              {req.assignee && (
                <div>
                  <span className="text-neutral-medium">Assignee:</span>
                  <span className="ml-2 font-medium text-neutral-dark">{req.assignee}</span>
                </div>
              )}
              {req.due_date && (
                <div>
                  <span className="text-neutral-medium">Due Date:</span>
                  <span className="ml-2 font-medium text-neutral-dark">{req.due_date}</span>
                </div>
              )}
            </div>

            {req.acceptance_criteria && req.acceptance_criteria.length > 0 && (
              <div className="mb-3">
                <h4 className="text-sm font-copy font-semibold text-neutral-dark mb-2">Acceptance Criteria:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {req.acceptance_criteria.map((criterion, idx) => (
                    <li key={idx} className="text-sm font-copy text-neutral-medium">{criterion}</li>
                  ))}
                </ul>
              </div>
            )}

            {req.related_decisions && req.related_decisions.length > 0 && (
              <div className="mt-3 pt-3 border-t border-neutral-lighter">
                <h4 className="text-sm font-copy font-semibold text-neutral-dark mb-2">Related Decisions:</h4>
                <div className="flex flex-wrap gap-2">
                  {req.related_decisions.map((decision, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-secondary-blue/20 text-secondary-blue rounded text-xs font-copy"
                    >
                      {decision}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-neutral-lightest">
              <span className="text-xs font-copy text-neutral-medium">Source: {req.source}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-neutral-lightest rounded-lg">
        <h4 className="text-sm font-copy font-semibold text-neutral-dark mb-2">Export Options</h4>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const json = JSON.stringify(requirements, null, 2)
              const blob = new Blob([json], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = 'requirements.json'
              a.click()
            }}
            className="px-4 py-2 bg-primary-red text-primary-white rounded-lg text-sm font-copy font-medium hover:opacity-90 transition-opacity"
          >
            Export JSON
          </button>
          <button
            onClick={() => {
              const csv = [
                ['ID', 'Title', 'Description', 'Type', 'Priority', 'Status', 'Assignee', 'Due Date'],
                ...requirements.map(req => [
                  req.id,
                  req.title,
                  req.description,
                  req.type,
                  req.priority,
                  req.status,
                  req.assignee || '',
                  req.due_date || ''
                ])
              ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
              
              const blob = new Blob([csv], { type: 'text/csv' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = 'requirements.csv'
              a.click()
            }}
            className="px-4 py-2 bg-secondary-blue text-primary-white rounded-lg text-sm font-copy font-medium hover:opacity-90 transition-opacity"
          >
            Export CSV
          </button>
        </div>
      </div>
    </div>
  )
}

