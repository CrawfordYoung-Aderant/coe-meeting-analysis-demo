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
        return 'bg-red-100 text-red-800 border-red-300'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'draft':
        return 'bg-gray-100 text-gray-800'
      case 'open':
        return 'bg-blue-100 text-blue-800'
      case 'in progress':
        return 'bg-yellow-100 text-yellow-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (requirements.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-xl p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Requirements</h2>
        <p className="text-gray-500">No requirements generated yet.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Structured Requirements</h2>
        <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium">
          {requirements.length} requirements
        </span>
      </div>

      <div className="space-y-4">
        {requirements.map((req) => (
          <div
            key={req.id}
            className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-mono text-sm font-semibold text-indigo-600">{req.id}</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium border ${getPriorityColor(req.priority)}`}>
                    {req.priority}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(req.status)}`}>
                    {req.status}
                  </span>
                  <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                    {req.type}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{req.title}</h3>
                <p className="text-gray-700 text-sm mb-3">{req.description}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
              {req.assignee && (
                <div>
                  <span className="text-gray-500">Assignee:</span>
                  <span className="ml-2 font-medium text-gray-900">{req.assignee}</span>
                </div>
              )}
              {req.due_date && (
                <div>
                  <span className="text-gray-500">Due Date:</span>
                  <span className="ml-2 font-medium text-gray-900">{req.due_date}</span>
                </div>
              )}
            </div>

            {req.acceptance_criteria && req.acceptance_criteria.length > 0 && (
              <div className="mb-3">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Acceptance Criteria:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {req.acceptance_criteria.map((criterion, idx) => (
                    <li key={idx} className="text-sm text-gray-600">{criterion}</li>
                  ))}
                </ul>
              </div>
            )}

            {req.related_decisions && req.related_decisions.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Related Decisions:</h4>
                <div className="flex flex-wrap gap-2">
                  {req.related_decisions.map((decision, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs"
                    >
                      {decision}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-500">Source: {req.source}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Export Options</h4>
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
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
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
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
          >
            Export CSV
          </button>
        </div>
      </div>
    </div>
  )
}

