'use client'

import { useState } from 'react'

interface ComparisonViewProps {
  originalText: string
  transcribedText: string
  showOnlyIfDifferent?: boolean
}

export default function ComparisonView({ originalText, transcribedText, showOnlyIfDifferent = false }: ComparisonViewProps) {
  const [viewMode, setViewMode] = useState<'side-by-side' | 'before-after'>('side-by-side')
  
  // If showOnlyIfDifferent is true and texts are the same, don't show
  if (showOnlyIfDifferent && originalText === transcribedText) {
    return null
  }

  return (
    <div className="bg-white rounded-lg shadow-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Before/After Comparison</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('side-by-side')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'side-by-side'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Side by Side
          </button>
          <button
            onClick={() => setViewMode('before-after')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'before-after'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Before/After
          </button>
        </div>
      </div>

      {viewMode === 'side-by-side' ? (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Original Input
            </h3>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 h-64 overflow-y-auto">
              <p className="text-gray-800 whitespace-pre-wrap text-sm leading-relaxed">
                {originalText}
              </p>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {originalText.split(/\s+/).length} words
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Transcribed Text
            </h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 h-64 overflow-y-auto">
              <p className="text-gray-800 whitespace-pre-wrap text-sm leading-relaxed">
                {transcribedText}
              </p>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {transcribedText.split(/\s+/).length} words
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Before: Original Input
            </h3>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 min-h-32 max-h-64 overflow-y-auto">
              <p className="text-gray-800 whitespace-pre-wrap text-sm leading-relaxed">
                {originalText}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-2 text-indigo-600">
              <div className="h-px w-12 bg-indigo-300"></div>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              <div className="h-px w-12 bg-indigo-300"></div>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              After: Transcribed Text
            </h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 min-h-32 max-h-64 overflow-y-auto">
              <p className="text-gray-800 whitespace-pre-wrap text-sm leading-relaxed">
                {transcribedText}
              </p>
            </div>
          </div>
        </div>
      )}

      {originalText !== transcribedText ? (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> Text has been processed and may differ from the original input.
          </p>
        </div>
      ) : (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">
            <strong>Note:</strong> Transcribed text matches the original input.
          </p>
        </div>
      )}
    </div>
  )
}

