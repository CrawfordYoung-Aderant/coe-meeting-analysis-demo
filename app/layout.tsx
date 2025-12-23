import './globals.css'
import type { Metadata } from 'next'
import { Poppins, Roboto, Roboto_Condensed } from 'next/font/google'

const poppins = Poppins({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  variable: '--font-poppins',
  display: 'swap',
})

const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  variable: '--font-roboto',
  display: 'swap',
})

const robotoCondensed = Roboto_Condensed({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-roboto-condensed',
  display: 'swap',
})

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
    <html lang="en" className={`${poppins.variable} ${roboto.variable} ${robotoCondensed.variable}`}>
      <body>{children}</body>
    </html>
  )
}

