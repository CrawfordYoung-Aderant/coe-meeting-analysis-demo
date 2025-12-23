'use client'

import { useState, useRef } from 'react'

interface FileUploadProps {
  onFileUploaded: (fileData: { file_path: string; filename: string; media_uri: string }) => void
  onError: (error: string) => void
}

export default function FileUpload({ onFileUploaded, onError }: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<{ filename: string; file_path: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/flac', 'video/mp4', 'video/webm', 'audio/ogg']
    const fileExtension = file.name.split('.').pop()?.toLowerCase()
    const allowedExtensions = ['mp3', 'mp4', 'wav', 'm4a', 'flac', 'webm', 'ogg']

    if (!allowedExtensions.includes(fileExtension || '')) {
      onError('Invalid file type. Please upload audio (mp3, wav, m4a, flac, ogg) or video (mp4, webm) files.')
      return
    }

    // Validate file size (100MB max)
    if (file.size > 100 * 1024 * 1024) {
      onError('File size exceeds 100MB limit.')
      return
    }

    setUploading(true)
    onError('')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('http://localhost:5000/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const data = await response.json()
      setUploadedFile({ filename: data.filename, file_path: data.file_path })
      onFileUploaded(data)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && fileInputRef.current) {
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(file)
      fileInputRef.current.files = dataTransfer.files
      handleFileChange({ target: { files: dataTransfer.files } } as any)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  return (
    <div className="w-full">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-indigo-400 transition-colors bg-gray-50"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,video/*"
          onChange={handleFileChange}
          className="hidden"
          id="file-upload"
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          <div className="flex flex-col items-center">
            <svg
              className="w-12 h-12 text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            {uploading ? (
              <div className="text-indigo-600 font-medium">Uploading...</div>
            ) : uploadedFile ? (
              <div>
                <div className="text-green-600 font-medium mb-2">✓ {uploadedFile.filename}</div>
                <div className="text-sm text-gray-500">Click to upload a different file</div>
              </div>
            ) : (
              <div>
                <div className="text-gray-700 font-medium mb-2">
                  Drop audio/video file here or click to browse
                </div>
                <div className="text-sm text-gray-500">
                  Supports: MP3, WAV, M4A, FLAC, OGG, MP4, WebM (max 100MB)
                </div>
              </div>
            )}
          </div>
        </label>
      </div>
    </div>
  )
}

