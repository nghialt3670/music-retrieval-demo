import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Music } from 'lucide-react'
import { FaGithub } from 'react-icons/fa'
import Link from 'next/link'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Music Retrieval Demo',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} h-screen flex flex-col`}>
        <header className="w-full flex justify-between p-4">
          <div className="h-full flex items-center space-x-2">
            <Music className="size-6" />
            <h1 className="text-xl font-bold">Music Retrieval Demo - CS336</h1>
          </div>
          <Link href="https://github.com/nguyenthanhhy0108/Music-Retrieval">
            <FaGithub className="size-6" />
          </Link>
        </header>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
