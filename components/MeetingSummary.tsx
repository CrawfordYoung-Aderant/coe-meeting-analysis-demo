'use client'

interface MeetingSummaryProps {
  summary: {
    summary?: string
    action_items?: Array<{
      text: string
      assignee?: string
      due_date?: string
      priority: string
      status: string
    }>
    key_decisions?: string[]
    participants?: string[]
    topics?: string[]
    next_steps?: string[]
    duration_estimate?: string
    entities?: Array<{ type: string; value: string }>
    dates?: string[]
  }
}

export default function MeetingSummary({ summary }: MeetingSummaryProps) {
  return (
    <div className="bg-white rounded-lg shadow-xl p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Meeting Summary</h2>

      <div className="space-y-6">
        {/* Main Summary */}
        {summary.summary && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Overview
            </h3>
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <p className="text-gray-800 leading-relaxed">{summary.summary}</p>
            </div>
          </div>
        )}

        {/* Duration */}
        {summary.duration_estimate && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Estimated Duration: {summary.duration_estimate}</span>
          </div>
        )}

        {/* Participants */}
        {summary.participants && summary.participants.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Participants
            </h3>
            <div className="flex flex-wrap gap-2">
              {summary.participants.map((participant, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
                >
                  {participant}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Topics */}
        {summary.topics && summary.topics.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Topics Discussed
            </h3>
            <div className="flex flex-wrap gap-2">
              {summary.topics.map((topic, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Key Decisions */}
        {summary.key_decisions && summary.key_decisions.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Key Decisions
            </h3>
            <div className="space-y-2">
              {summary.key_decisions.map((decision, idx) => (
                <div
                  key={idx}
                  className="bg-green-50 border-l-4 border-green-500 rounded p-3"
                >
                  <p className="text-gray-800 text-sm">{decision}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Items */}
        {summary.action_items && summary.action_items.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Action Items
            </h3>
            <div className="space-y-3">
              {summary.action_items.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-yellow-50 border border-yellow-200 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-gray-800 text-sm flex-1">{item.text}</p>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      item.priority === 'high' ? 'bg-red-100 text-red-700' :
                      item.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {item.priority}
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-600">
                    {item.assignee && (
                      <span>👤 {item.assignee}</span>
                    )}
                    {item.due_date && (
                      <span>📅 {item.due_date}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Next Steps */}
        {summary.next_steps && summary.next_steps.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Next Steps
            </h3>
            <ul className="list-disc list-inside space-y-1">
              {summary.next_steps.map((step, idx) => (
                <li key={idx} className="text-gray-700 text-sm">{step}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

