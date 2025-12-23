import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Speech-to-Text Demo - AWS Transcribe',
  description: 'Convert speech to text and parse into structured output',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

