import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FoodRescue | Surplus Redistribution Platform',
  description: 'AI-Powered Food Surplus Redistribution & Rescue Platform for Andhra Pradesh, India.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-gray-900 min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  )
}
