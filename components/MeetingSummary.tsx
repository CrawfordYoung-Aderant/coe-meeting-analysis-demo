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
    <div className="bg-primary-white rounded-lg shadow-xl p-6">
      <h2 className="text-2xl font-headline font-light text-primary-dark mb-6">Meeting Summary</h2>

      <div className="space-y-6">
        {/* Main Summary */}
        {summary.summary && (
          <div>
            <h3 className="text-sm font-copy font-semibold text-neutral-dark mb-2 uppercase tracking-wide">
              Overview
            </h3>
            <div className="bg-secondary-blue/10 border border-secondary-blue/30 rounded-lg p-4">
              <p className="text-neutral-dark leading-relaxed font-copy">{summary.summary}</p>
            </div>
          </div>
        )}

        {/* Duration */}
        {summary.duration_estimate && (
          <div className="flex items-center gap-2 text-sm font-copy text-neutral-medium">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Estimated Duration: {summary.duration_estimate}</span>
          </div>
        )}

        {/* Participants */}
        {summary.participants && summary.participants.length > 0 && (
          <div>
            <h3 className="text-sm font-copy font-semibold text-neutral-dark mb-2 uppercase tracking-wide">
              Participants
            </h3>
            <div className="flex flex-wrap gap-2">
              {summary.participants.map((participant, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-secondary-blue/20 text-secondary-blue rounded-full text-sm font-copy font-medium"
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
            <h3 className="text-sm font-copy font-semibold text-neutral-dark mb-2 uppercase tracking-wide">
              Topics Discussed
            </h3>
            <div className="flex flex-wrap gap-2">
              {summary.topics.map((topic, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-secondary-purple/20 text-secondary-purple rounded-full text-sm font-copy"
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
            <h3 className="text-sm font-copy font-semibold text-neutral-dark mb-2 uppercase tracking-wide">
              Key Decisions
            </h3>
            <div className="space-y-2">
              {summary.key_decisions.map((decision, idx) => (
                <div
                  key={idx}
                  className="bg-secondary-blue/10 border-l-4 border-secondary-blue rounded p-3"
                >
                  <p className="text-neutral-dark text-sm font-copy">{decision}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Items */}
        {summary.action_items && summary.action_items.length > 0 && (
          <div>
            <h3 className="text-sm font-copy font-semibold text-neutral-dark mb-2 uppercase tracking-wide">
              Action Items
            </h3>
            <div className="space-y-3">
              {summary.action_items.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-secondary-yellow/10 border border-secondary-yellow/30 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-neutral-dark text-sm flex-1 font-copy">{item.text}</p>
                    <span className={`px-2 py-1 rounded text-xs font-copy font-medium ${
                      item.priority === 'high' ? 'bg-secondary-red/20 text-secondary-red' :
                      item.priority === 'medium' ? 'bg-secondary-yellow/30 text-neutral-dark' :
                      'bg-secondary-blue/20 text-secondary-blue'
                    }`}>
                      {item.priority}
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs font-copy text-neutral-medium">
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
            <h3 className="text-sm font-copy font-semibold text-neutral-dark mb-2 uppercase tracking-wide">
              Next Steps
            </h3>
            <ul className="list-disc list-inside space-y-1">
              {summary.next_steps.map((step, idx) => (
                <li key={idx} className="text-neutral-dark text-sm font-copy">{step}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

