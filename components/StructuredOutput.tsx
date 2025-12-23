'use client'

interface StructuredOutputProps {
  data: {
    entities?: Array<{ type: string; value: string }>
    key_phrases?: string[]
    action_items?: Array<{ text: string; priority: string }>
    dates?: string[]
    numbers?: Array<{ type: string; value: number | string }>
    summary?: string
    word_count?: number
    sentence_count?: number
  }
}

export default function StructuredOutput({ data }: StructuredOutputProps) {
  return (
    <div className="bg-white rounded-lg shadow-xl p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Structured Output</h2>
      
      <div className="space-y-6">
        {/* Summary */}
        {data.summary && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Summary
            </h3>
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <p className="text-gray-800 text-sm leading-relaxed">{data.summary}</p>
            </div>
          </div>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-2 gap-4">
          {data.word_count !== undefined && (
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-indigo-600">{data.word_count}</div>
              <div className="text-xs text-gray-600 uppercase tracking-wide mt-1">Words</div>
            </div>
          )}
          {data.sentence_count !== undefined && (
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-indigo-600">{data.sentence_count}</div>
              <div className="text-xs text-gray-600 uppercase tracking-wide mt-1">Sentences</div>
            </div>
          )}
        </div>

        {/* Action Items */}
        {data.action_items && data.action_items.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Action Items
            </h3>
            <div className="space-y-2">
              {data.action_items.map((item, index) => (
                <div
                  key={index}
                  className="bg-green-50 border-l-4 border-green-500 rounded p-3"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">•</span>
                    <p className="text-gray-800 text-sm flex-1">{item.text}</p>
                    <span className={`text-xs px-2 py-1 rounded ${
                      item.priority === 'high' ? 'bg-red-100 text-red-700' :
                      item.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {item.priority}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Entities */}
        {data.entities && data.entities.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Extracted Entities
            </h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex flex-wrap gap-2">
                {data.entities.map((entity, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-gray-200 rounded-full text-xs"
                  >
                    <span className="text-gray-500">{entity.type}:</span>
                    <span className="font-medium text-gray-800">{entity.value}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Key Phrases */}
        {data.key_phrases && data.key_phrases.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Key Phrases
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.key_phrases.map((phrase, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium"
                >
                  {phrase}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Dates */}
        {data.dates && data.dates.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Dates
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.dates.map((date, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"
                >
                  {date}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Numbers */}
        {data.numbers && data.numbers.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Numbers
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.numbers.slice(0, 10).map((num, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium"
                >
                  {num.value}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

