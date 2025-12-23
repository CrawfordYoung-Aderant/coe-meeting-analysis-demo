'use client'

import { useState, useEffect } from 'react'
import FileUpload from '@/components/FileUpload'
import AudioPlayer from '@/components/AudioPlayer'
import MeetingSummary from '@/components/MeetingSummary'
import RequirementsView from '@/components/RequirementsView'
import { API_ENDPOINTS } from '@/config/api'

export default function Home() {
  const [inputText, setInputText] = useState('')
  const [transcribedText, setTranscribedText] = useState('')
  const [meetingSummary, setMeetingSummary] = useState<any>(null)
  const [requirements, setRequirements] = useState<any[]>([])
  const [uploadedFile, setUploadedFile] = useState<{ file_path?: string; filename: string; media_uri: string; s3_key?: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bedrockWarning, setBedrockWarning] = useState<string | null>(null)
  const [transcriptionStatus, setTranscriptionStatus] = useState<'idle' | 'uploading' | 'transcribing' | 'completed' | 'failed'>('idle')

  const handleFileUploaded = async (fileData: { file_path: string; filename: string; media_uri: string }) => {
    setUploadedFile(fileData)
    setError(null)
    setBedrockWarning(null)
    setTranscriptionStatus('uploading')
    
    // Auto-start transcription
    await handleMeetingProcess(fileData.media_uri)
  }

  const handleMeetingProcess = async (mediaUri?: string) => {
    setLoading(true)
    setError(null)
    setBedrockWarning(null)

    try {
      let textToProcess = inputText

      // If we have a media URI and no text, start transcription
      if (mediaUri && !textToProcess) {
        setTranscriptionStatus('uploading')
        // Use file_path if available (for local files that need S3 upload)
        const filePath = uploadedFile?.file_path
        
        const transcribeResponse = await fetch(API_ENDPOINTS.TRANSCRIBE, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            audio_url: mediaUri.startsWith('s3://') ? mediaUri : undefined,
            file_path: filePath && !mediaUri.startsWith('s3://') ? filePath : undefined,
            s3_key: uploadedFile?.s3_key || (mediaUri.startsWith('s3://') ? mediaUri.split('/').slice(-2).join('/') : undefined),
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
          pollAndProcessMeeting(transcribeData.job_name, transcribeData.s3_key || uploadedFile?.s3_key)
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
      const response = await fetch(API_ENDPOINTS.MEETING_PROCESS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: textToProcess,
          use_bedrock: true,  // Explicitly request Bedrock extraction
          audio_s3_key: uploadedFile?.s3_key,
          filename: uploadedFile?.filename
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to process meeting')
      }

      const data = await response.json()
      setTranscribedText(data.original_text)
      setMeetingSummary(data.meeting_summary)
      setRequirements(data.requirements)
      
      // Check for Bedrock warnings/errors
      if (data.bedrock_warning || data.bedrock_error) {
        setBedrockWarning(data.bedrock_warning || data.bedrock_error)
      }
      
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

  const pollAndProcessMeeting = async (jobName: string, s3Key?: string) => {
    const maxAttempts = 30
    let attempts = 0

    const poll = async () => {
      try {
        const url = API_ENDPOINTS.TRANSCRIBE_STATUS(jobName, s3Key)
        const response = await fetch(url)
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
              const processResponse = await fetch(API_ENDPOINTS.MEETING_PROCESS, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                  text: transcribedText,
                  use_bedrock: true,  // Explicitly request Bedrock extraction
                  audio_s3_key: data.s3_key || uploadedFile?.s3_key,
                  filename: uploadedFile?.filename
                }),
              })

              if (!processResponse.ok) {
                throw new Error('Failed to process meeting')
              }

              const processData = await processResponse.json()
              setMeetingSummary(processData.meeting_summary)
              setRequirements(processData.requirements)
              
              // Check for Bedrock warnings/errors
              if (processData.bedrock_warning || processData.bedrock_error) {
                setBedrockWarning(processData.bedrock_warning || processData.bedrock_error)
              }
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

  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  // Update audio URL when uploadedFile changes
  useEffect(() => {
    const updateAudioUrl = async () => {
      if (!uploadedFile) {
        setAudioUrl(null)
        return
      }
      
      // If file_path exists, use local file endpoint
      if (uploadedFile.file_path) {
        const filename = uploadedFile.file_path.split('/').pop() || uploadedFile.filename
        setAudioUrl(API_ENDPOINTS.FILES(filename))
        return
      }
      
      // If no file_path but we have s3_key, get presigned URL from backend
      if (uploadedFile.s3_key) {
        try {
          const response = await fetch(API_ENDPOINTS.FILES_S3(uploadedFile.s3_key))
          if (response.ok) {
            const data = await response.json()
            setAudioUrl(data.url)
            return
          }
        } catch (err) {
          console.error('Failed to get presigned URL:', err)
        }
      }
      
      setAudioUrl(null)
    }

    updateAudioUrl()
  }, [uploadedFile])

  return (
    <main className="min-h-screen bg-gradient-to-br from-neutral-lightest to-neutral-lighter py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-headline font-light text-primary-dark mb-2">
            Meeting Analysis & Requirements Generator
          </h1>
          <p className="font-copy font-light text-neutral-dark">
            Upload meeting audio or paste transcript to generate summaries and structured requirements
          </p>
        </div>

        <div className="bg-primary-white rounded-lg shadow-xl p-6 mb-6">
          <div className="space-y-6">
            {/* File Upload */}
            <div>
              <label className="block text-sm font-copy font-medium text-neutral-dark mb-2">
                Upload Meeting Audio/Video
              </label>
              <FileUpload onFileUploaded={handleFileUploaded} onError={setError} />
            </div>

            {/* Audio Player */}
            {uploadedFile && audioUrl && (
              <AudioPlayer src={audioUrl} filename={uploadedFile.filename} />
            )}

            {/* Text Input (for pasting or manual entry) */}
            <div>
              <label htmlFor="meeting-text" className="block text-sm font-copy font-medium text-neutral-dark mb-2">
                Or Paste Meeting Transcript
              </label>
              <textarea
                id="meeting-text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste meeting transcript here or upload audio file above..."
                className="w-full px-4 py-3 border border-neutral-lighter rounded-lg focus:ring-2 focus:ring-primary-red focus:border-transparent resize-none font-copy"
                rows={6}
              />
            </div>

            {/* Transcription Status Indicator */}
            {transcriptionStatus !== 'idle' && (
              <div className="p-4 rounded-lg border-2 border-dashed border-neutral-lighter">
                {transcriptionStatus === 'uploading' && (
                  <div className="flex items-center gap-3 text-secondary-blue">
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="font-copy font-medium">Uploading file to S3...</span>
                  </div>
                )}
                {transcriptionStatus === 'transcribing' && (
                  <div className="flex items-center gap-3 text-secondary-blue">
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="font-copy font-medium">Transcribing audio... This may take a few minutes.</span>
                  </div>
                )}
                {transcriptionStatus === 'completed' && (
                  <div className="flex items-center gap-3 text-secondary-blue">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="font-copy font-medium">Transcription completed! Meeting processed.</span>
                  </div>
                )}
                {transcriptionStatus === 'failed' && (
                  <div className="flex items-center gap-3 text-secondary-red">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="font-copy font-medium">Transcription failed. Please try again.</span>
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
              className="w-full bg-primary-red text-primary-white px-6 py-3 rounded-lg font-copy font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {loading ? 'Processing Meeting...' : 
               transcriptionStatus === 'transcribing' || transcriptionStatus === 'uploading' ? 
               'Waiting for transcription...' : 
               'Process Meeting & Generate Requirements'}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-secondary-red/30 rounded-lg text-secondary-red">
              <div className="flex items-start gap-2">
                <svg className="h-5 w-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-copy">{error}</span>
              </div>
            </div>
          )}
          
          {bedrockWarning && (
            <div className="mt-4 p-4 bg-secondary-yellow/10 border border-secondary-yellow/30 rounded-lg text-neutral-dark">
              <div className="flex items-start gap-2">
                <svg className="h-5 w-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <div className="font-copy font-semibold mb-1">Bedrock Extraction Warning</div>
                  <div className="text-sm font-copy">{bedrockWarning}</div>
                  <div className="text-xs mt-2 font-copy text-neutral-medium">
                    The system has automatically fallen back to regex-based extraction. Results may be less accurate than with Bedrock.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        {meetingSummary && (
          <div className="space-y-6">
            <MeetingSummary summary={meetingSummary} />
            {requirements.length > 0 && <RequirementsView requirements={requirements} />}
            {transcribedText && (
              <div className="bg-primary-white rounded-lg shadow-xl p-6">
                <h2 className="text-2xl font-headline font-light text-primary-dark mb-4">Transcribed Text</h2>
                <div className="bg-secondary-blue/10 border border-secondary-blue/30 rounded-lg p-4 max-h-96 overflow-y-auto">
                  <p className="text-neutral-dark whitespace-pre-wrap text-sm leading-relaxed font-copy">
                    {transcribedText}
                  </p>
                </div>
                <div className="mt-2 text-xs font-copy text-neutral-medium">
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
