'use client'

import { useState } from 'react'
import ComparisonView from '@/components/ComparisonView'
import FileUpload from '@/components/FileUpload'
import AudioPlayer from '@/components/AudioPlayer'
import MeetingSummary from '@/components/MeetingSummary'
import RequirementsView from '@/components/RequirementsView'

export default function Home() {
  const [inputText, setInputText] = useState('')
  const [transcribedText, setTranscribedText] = useState('')
  const [meetingSummary, setMeetingSummary] = useState<any>(null)
  const [requirements, setRequirements] = useState<any[]>([])
  const [uploadedFile, setUploadedFile] = useState<{ file_path: string; filename: string; media_uri: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [transcriptionStatus, setTranscriptionStatus] = useState<'idle' | 'uploading' | 'transcribing' | 'completed' | 'failed'>('idle')

  const handleFileUploaded = async (fileData: { file_path: string; filename: string; media_uri: string }) => {
    setUploadedFile(fileData)
    setError(null)
    setTranscriptionStatus('uploading')
    
    // Auto-start transcription
    await handleMeetingProcess(fileData.media_uri)
  }

  const handleMeetingProcess = async (mediaUri?: string) => {
    setLoading(true)
    setError(null)

    try {
      let textToProcess = inputText

      // If we have a media URI and no text, start transcription
      if (mediaUri && !textToProcess) {
        setTranscriptionStatus('uploading')
        // Use file_path if available (for local files that need S3 upload)
        const filePath = uploadedFile?.file_path
        
        const transcribeResponse = await fetch('http://localhost:5000/api/transcribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            audio_url: mediaUri.startsWith('s3://') ? mediaUri : undefined,
            file_path: filePath && !mediaUri.startsWith('s3://') ? filePath : undefined,
            media_format: mediaUri.split('.').pop()?.toLowerCase() || filePath?.split('.').pop()?.toLowerCase() || 'mp3',
          }),
        })

        if (!transcribeResponse.ok) {
          const errorData = await transcribeResponse.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to start transcription')
        }

        const transcribeData = await transcribeResponse.json()
        
        if (transcribeData.transcribed_text) {
          textToProcess = transcribeData.transcribed_text
        } else if (transcribeData.job_name) {
          // Poll for transcription
          setTranscriptionStatus('transcribing')
          pollAndProcessMeeting(transcribeData.job_name)
          return
        } else {
          throw new Error('Failed to start transcription job')
        }
      }

      if (!textToProcess) {
        throw new Error('No text to process')
      }

      // If we have text directly (not from transcription), reset status
      if (!mediaUri && textToProcess) {
        setTranscriptionStatus('idle')
      }

      // Process meeting - always try to use Bedrock if available
      const response = await fetch('http://localhost:5000/api/meeting/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: textToProcess,
          use_bedrock: true  // Explicitly request Bedrock extraction
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to process meeting')
      }

      const data = await response.json()
      setTranscribedText(data.original_text)
      setMeetingSummary(data.meeting_summary)
      setRequirements(data.requirements)
      
      // Mark as completed if we processed directly from text
      if (!mediaUri) {
        setTranscriptionStatus('completed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const pollAndProcessMeeting = async (jobName: string) => {
    const maxAttempts = 30
    let attempts = 0

    const poll = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/transcribe/status/${jobName}`)
        const data = await response.json()

        if (data.status === 'COMPLETED') {
          // Set the transcribed text first
          const transcribedText = data.transcribed_text
          setTranscribedText(transcribedText)
          setInputText(transcribedText)
          setTranscriptionStatus('completed')
          
          // Process the meeting with the transcribed text
          if (transcribedText) {
            try {
              const processResponse = await fetch('http://localhost:5000/api/meeting/process', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                  text: transcribedText,
                  use_bedrock: true  // Explicitly request Bedrock extraction
                }),
              })

              if (!processResponse.ok) {
                throw new Error('Failed to process meeting')
              }

              const processData = await processResponse.json()
              setMeetingSummary(processData.meeting_summary)
              setRequirements(processData.requirements)
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to process meeting')
            }
          }
          setLoading(false)
        } else if (data.status === 'FAILED') {
          setError(data.error || 'Transcription failed')
          setTranscriptionStatus('failed')
          setLoading(false)
        } else if (attempts < maxAttempts) {
          attempts++
          setTimeout(poll, 2000)
        } else {
          setError('Transcription timeout')
          setTranscriptionStatus('failed')
          setLoading(false)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
        setTranscriptionStatus('failed')
        setLoading(false)
      }
    }

    poll()
  }

  const getAudioUrl = () => {
    if (!uploadedFile) return null
    const filename = uploadedFile.file_path.split('/').pop() || uploadedFile.filename
    return `http://localhost:5000/api/files/${filename}`
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Meeting Analysis & Requirements Generator
          </h1>
          <p className="text-gray-600">
            Upload meeting audio or paste transcript to generate summaries and structured requirements
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
          <div className="space-y-6">
            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Meeting Audio/Video
              </label>
              <FileUpload onFileUploaded={handleFileUploaded} onError={setError} />
            </div>

            {/* Audio Player */}
            {uploadedFile && getAudioUrl() && (
              <AudioPlayer src={getAudioUrl()!} filename={uploadedFile.filename} />
            )}

            {/* Text Input (for pasting or manual entry) */}
            <div>
              <label htmlFor="meeting-text" className="block text-sm font-medium text-gray-700 mb-2">
                Or Paste Meeting Transcript
              </label>
              <textarea
                id="meeting-text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste meeting transcript here or upload audio file above..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                rows={6}
              />
            </div>

            {/* Transcription Status Indicator */}
            {transcriptionStatus !== 'idle' && (
              <div className="p-4 rounded-lg border-2 border-dashed">
                {transcriptionStatus === 'uploading' && (
                  <div className="flex items-center gap-3 text-blue-600">
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="font-medium">Uploading file to S3...</span>
                  </div>
                )}
                {transcriptionStatus === 'transcribing' && (
                  <div className="flex items-center gap-3 text-indigo-600">
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="font-medium">Transcribing audio... This may take a few minutes.</span>
                  </div>
                )}
                {transcriptionStatus === 'completed' && (
                  <div className="flex items-center gap-3 text-green-600">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="font-medium">Transcription completed! Meeting processed.</span>
                  </div>
                )}
                {transcriptionStatus === 'failed' && (
                  <div className="flex items-center gap-3 text-red-600">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="font-medium">Transcription failed. Please try again.</span>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => handleMeetingProcess()}
              disabled={
                loading || 
                transcriptionStatus === 'transcribing' || 
                transcriptionStatus === 'uploading' ||
                (!inputText.trim() && !uploadedFile) ||
                (uploadedFile && transcriptionStatus !== 'completed' && !inputText.trim())
              }
              className="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Processing Meeting...' : 
               transcriptionStatus === 'transcribing' || transcriptionStatus === 'uploading' ? 
               'Waiting for transcription...' : 
               'Process Meeting & Generate Requirements'}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        {meetingSummary && (
          <div className="space-y-6">
            <MeetingSummary summary={meetingSummary} />
            {requirements.length > 0 && <RequirementsView requirements={requirements} />}
            {transcribedText && inputText && inputText !== transcribedText && (
              <ComparisonView
                originalText={inputText}
                transcribedText={transcribedText}
              />
            )}
            {transcribedText && !inputText && (
              <div className="bg-white rounded-lg shadow-xl p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Transcribed Text</h2>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-h-96 overflow-y-auto">
                  <p className="text-gray-800 whitespace-pre-wrap text-sm leading-relaxed">
                    {transcribedText}
                  </p>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  {transcribedText.split(/\s+/).length} words
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
