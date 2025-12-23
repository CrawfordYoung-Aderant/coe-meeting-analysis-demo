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
    <div className="bg-primary-white rounded-lg shadow-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-headline font-light text-primary-dark">Before/After Comparison</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('side-by-side')}
            className={`px-4 py-2 rounded-lg text-sm font-copy font-medium transition-opacity ${
              viewMode === 'side-by-side'
                ? 'bg-primary-red text-primary-white'
                : 'bg-neutral-lighter text-neutral-dark hover:opacity-80'
            }`}
          >
            Side by Side
          </button>
          <button
            onClick={() => setViewMode('before-after')}
            className={`px-4 py-2 rounded-lg text-sm font-copy font-medium transition-opacity ${
              viewMode === 'before-after'
                ? 'bg-primary-red text-primary-white'
                : 'bg-neutral-lighter text-neutral-dark hover:opacity-80'
            }`}
          >
            Before/After
          </button>
        </div>
      </div>

      {viewMode === 'side-by-side' ? (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-copy font-semibold text-neutral-dark mb-2 uppercase tracking-wide">
              Original Input
            </h3>
            <div className="bg-neutral-lightest border border-neutral-lighter rounded-lg p-4 h-64 overflow-y-auto">
              <p className="text-neutral-dark whitespace-pre-wrap text-sm leading-relaxed font-copy">
                {originalText}
              </p>
            </div>
            <div className="mt-2 text-xs font-copy text-neutral-medium">
              {originalText.split(/\s+/).length} words
            </div>
          </div>
          <div>
            <h3 className="text-sm font-copy font-semibold text-neutral-dark mb-2 uppercase tracking-wide">
              Transcribed Text
            </h3>
            <div className="bg-secondary-blue/10 border border-secondary-blue/30 rounded-lg p-4 h-64 overflow-y-auto">
              <p className="text-neutral-dark whitespace-pre-wrap text-sm leading-relaxed font-copy">
                {transcribedText}
              </p>
            </div>
            <div className="mt-2 text-xs font-copy text-neutral-medium">
              {transcribedText.split(/\s+/).length} words
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-copy font-semibold text-neutral-dark mb-2 uppercase tracking-wide">
              Before: Original Input
            </h3>
            <div className="bg-neutral-lightest border border-neutral-lighter rounded-lg p-4 min-h-32 max-h-64 overflow-y-auto">
              <p className="text-neutral-dark whitespace-pre-wrap text-sm leading-relaxed font-copy">
                {originalText}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-2 text-secondary-blue">
              <div className="h-px w-12 bg-secondary-blue/30"></div>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              <div className="h-px w-12 bg-secondary-blue/30"></div>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-copy font-semibold text-neutral-dark mb-2 uppercase tracking-wide">
              After: Transcribed Text
            </h3>
            <div className="bg-secondary-blue/10 border border-secondary-blue/30 rounded-lg p-4 min-h-32 max-h-64 overflow-y-auto">
              <p className="text-neutral-dark whitespace-pre-wrap text-sm leading-relaxed font-copy">
                {transcribedText}
              </p>
            </div>
          </div>
        </div>
      )}

      {originalText !== transcribedText ? (
        <div className="mt-4 p-3 bg-secondary-yellow/10 border border-secondary-yellow/30 rounded-lg">
          <p className="text-sm font-copy text-neutral-dark">
            <strong>Note:</strong> Text has been processed and may differ from the original input.
          </p>
        </div>
      ) : (
        <div className="mt-4 p-3 bg-secondary-blue/10 border border-secondary-blue/30 rounded-lg">
          <p className="text-sm font-copy text-secondary-blue">
            <strong>Note:</strong> Transcribed text matches the original input.
          </p>
        </div>
      )}
    </div>
  )
}

