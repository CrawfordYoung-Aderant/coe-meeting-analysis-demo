/**
 * API Configuration
 * Centralized configuration for API endpoints
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const API_ENDPOINTS = {
  BASE_URL: API_BASE_URL,
  TRANSCRIBE: `${API_BASE_URL}/api/transcribe`,
  TRANSCRIBE_STATUS: (jobName: string, s3Key?: string) => 
    s3Key 
      ? `${API_BASE_URL}/api/transcribe/status/${jobName}?s3_key=${encodeURIComponent(s3Key)}`
      : `${API_BASE_URL}/api/transcribe/status/${jobName}`,
  MEETING_PROCESS: `${API_BASE_URL}/api/meeting/process`,
  UPLOAD: `${API_BASE_URL}/api/upload`,
  FILES: (filename: string) => `${API_BASE_URL}/api/files/${filename}`,
  FILES_S3: (s3Key: string) => `${API_BASE_URL}/api/files/s3?key=${encodeURIComponent(s3Key)}`,
  MEETINGS: `${API_BASE_URL}/api/meetings`,
  MEETING: (meetingId: string) => `${API_BASE_URL}/api/meetings/${meetingId}`,
  HEALTH: `${API_BASE_URL}/health`,
} as const;

